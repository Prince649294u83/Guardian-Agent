from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Callable

from openai import OpenAI

from guardian_openenv.environment import GuardianReviewEnvironment
from guardian_openenv.models import (
    ActionType,
    BaselineEpisodeResult,
    BaselineRunSummary,
    GuardianAction,
    PatternLabel,
    RecommendationDecision,
)
from guardian_openenv.tasks import TASKS


SYSTEM_PROMPT = """You are Guardian Agent, a consumer-protection shopping assistant.
Your job is to protect a shopper from dark patterns, fake urgency, hidden fees, and unnecessary upsells.
Return exactly one JSON object for the next action.
Prioritize:
1. Inspecting the most informative checkout sections first
2. Removing unnecessary extras
3. Verifying whether timers are fake
4. Estimating the true final total against the budget
5. Recommending whether the shopper should proceed
Only use valid action types and ids from the observation."""


def load_dotenv() -> None:
    dotenv_path = Path(".env")
    if not dotenv_path.exists():
        return
    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def build_client(strict_submission_env: bool = True) -> tuple[OpenAI, str]:
    load_dotenv()

    api_base_url = os.environ.get("API_BASE_URL")
    model_name = os.environ.get("MODEL_NAME", "default-proxy-model")
    api_key = os.environ.get("API_KEY", os.environ.get("HF_TOKEN"))

    if strict_submission_env:
        missing = [name for name, value in {"API_BASE_URL": api_base_url, "API_KEY": api_key}.items() if not value]
        if missing:
            raise RuntimeError(
                f"Missing required environment variables for inference: {', '.join(missing)}"
            )
        return OpenAI(api_key=api_key, base_url=api_base_url), model_name

    openai_key = os.environ.get("OPENAI_API_KEY")
    openai_base_url = os.environ.get("OPENAI_BASE_URL")
    openai_model = os.environ.get("OPENAI_MODEL")

    if api_base_url and api_key:
        return OpenAI(api_key=api_key, base_url=api_base_url), model_name
    if openai_key:
        client_kwargs = {"api_key": openai_key}
        if openai_base_url:
            client_kwargs["base_url"] = openai_base_url
        return OpenAI(**client_kwargs), openai_model or "gpt-4.1-mini"
    raise RuntimeError("Provide API_BASE_URL+API_KEY or OPENAI_API_KEY to run inference.")


def observation_to_prompt(observation) -> str:
    opened = (
        observation.opened_section.model_dump()
        if observation.opened_section
        else None
    )
    return json.dumps(
        {
            "task_id": observation.task_id,
            "difficulty": observation.difficulty,
            "objective": observation.objective,
            "shopper_context": observation.shopper_context.model_dump(mode="json"),
            "visible_cart": [item.model_dump(mode="json") for item in observation.visible_cart],
            "optional_addons": [item.model_dump(mode="json") for item in observation.optional_addons],
            "urgency_timers": [item.model_dump() for item in observation.urgency_timers],
            "pressure_signals": [item.model_dump() for item in observation.pressure_signals],
            "section_index": [item.model_dump() for item in observation.section_index],
            "opened_section": opened,
            "current_decision": observation.current_decision.model_dump(mode="json"),
            "remaining_steps": observation.remaining_steps,
            "last_action_message": observation.last_action_message,
            "action_history": observation.action_history,
            "allowed_action_types": [action.value for action in ActionType],
            "pattern_labels": [label.value for label in PatternLabel],
            "recommendations": [decision.value for decision in RecommendationDecision],
        },
        indent=2,
    )


def extract_json_object(text: str) -> dict:
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Model returned empty content.")
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise ValueError(f"Model did not return valid JSON. Raw content: {cleaned[:400]}")


def normalize_action_payload(payload: dict) -> dict:
    normalized = dict(payload)
    alias_map = {
        "action": "action_type",
        "type": "action_type",
        "section": "section_id",
        "section_key": "section_id",
        "addon": "addon_id",
        "addon_key": "addon_id",
        "pattern_label": "pattern",
        "pattern_name": "pattern",
        "label": "pattern",
        "timer": "timer_id",
        "timer_key": "timer_id",
        "is_fake": "timer_is_fake",
        "true_total": "estimated_true_total",
        "amount": "estimated_true_total",
        "decision": "recommendation",
        "recommendation_label": "recommendation",
        "report_summary": "summary",
    }
    for source_key, target_key in alias_map.items():
        if source_key in normalized and target_key not in normalized:
            normalized[target_key] = normalized[source_key]

    compact_fields = [
        normalized.get("action_input"),
        normalized.get("value"),
        normalized.get("selection"),
        normalized.get("choice"),
    ]
    for compact in compact_fields:
        if not isinstance(compact, str) or ":" not in compact:
            continue
        prefix, suffix = compact.split(":", 1)
        prefix = prefix.strip().lower()
        suffix = suffix.strip()
        if prefix in {"inspect_section", "section"} and "section_id" not in normalized:
            normalized["section_id"] = suffix
        elif prefix in {"remove_addon", "keep_addon", "addon"} and "addon_id" not in normalized:
            normalized["addon_id"] = suffix
        elif prefix in {"flag_pattern", "pattern"} and "pattern" not in normalized:
            normalized["pattern"] = suffix
        elif prefix in {"verify_timer", "timer"} and "timer_id" not in normalized:
            normalized["timer_id"] = suffix
        elif prefix in {"set_true_total", "true_total"} and "estimated_true_total" not in normalized:
            normalized["estimated_true_total"] = suffix
        elif prefix in {"set_recommendation", "recommendation"} and "recommendation" not in normalized:
            normalized["recommendation"] = suffix
    return normalized


def next_action(client: OpenAI, model: str, observation) -> GuardianAction:
    request_kwargs = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Pick the next best action for this checkout-protection environment.\n"
                    "Return valid JSON only.\n"
                    "If the shopper is fully protected and the recommendation is ready, submit the decision.\n"
                    f"{observation_to_prompt(observation)}"
                ),
            },
        ],
        "response_format": {"type": "json_object"},
    }
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(**request_kwargs)
            content = response.choices[0].message.content or "{}"
            payload = normalize_action_payload(extract_json_object(content))
            return GuardianAction.model_validate(payload)
        except Exception as error:  # noqa: BLE001
            last_error = error
            message = str(error).lower()
            if "response_format" in message:
                request_kwargs.pop("response_format", None)
                request_kwargs["messages"][1]["content"] += "\nReturn a single raw JSON object with no markdown fences."
                continue
            if attempt < 2 and any(code in message for code in ["429", "503", "rate", "timeout", "temporarily unavailable"]):
                time.sleep(2**attempt)
                continue
            break
    assert last_error is not None
    raise last_error


def _log(prefix: str, payload: dict, log_writer: Callable[[str], None]) -> None:
    log_writer(f"{prefix} {json.dumps(payload, separators=(',', ':'))}")


def run_inference(
    strict_submission_env: bool,
    output_path: str,
    log_writer: Callable[[str], None],
) -> BaselineRunSummary:
    client, model = build_client(strict_submission_env=strict_submission_env)
    env = GuardianReviewEnvironment()
    results: list[BaselineEpisodeResult] = []

    _log("[START]", {"model": model, "task_count": len(TASKS)}, log_writer)

    for task in TASKS:
        observation = env.reset(task.task_id)
        final_step = None
        _log(
            "[STEP]",
            {
                "task_id": task.task_id,
                "event": "task_start",
                "difficulty": task.difficulty,
            },
            log_writer,
        )
        while not observation.done:
            action = next_action(client, model, observation)
            final_step = env.step(action)
            observation = final_step.observation
            _log(
                "[STEP]",
                {
                    "task_id": task.task_id,
                    "step_index": env.state().step_count,
                    "action_type": action.action_type.value,
                    "reward": final_step.reward.value,
                    "score": final_step.reward.score,
                    "done": final_step.done,
                },
                log_writer,
            )
            if final_step.done:
                break
        if final_step is None:
            raise RuntimeError(f"Inference never executed a step for task {task.task_id}")

        state = env.state()
        breakdown = final_step.info.get("grader_breakdown", {})
        final_score = float(final_step.info.get("final_score", breakdown.get("final_score", 0.0)))
        results.append(
            BaselineEpisodeResult(
                task_id=task.task_id,
                difficulty=task.difficulty,
                final_score=final_score,
                total_reward=state.cumulative_reward,
                steps_taken=state.step_count,
                final_decision=state.decision,
                grader_breakdown=breakdown,
            )
        )

    raw_mean = sum(item.final_score for item in results) / len(results) if results else 0.001
    summary = BaselineRunSummary(
        model=model,
        tasks=results,
        mean_score=min(max(raw_mean, 0.001), 0.999),
    )
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(summary.model_dump_json(indent=2), encoding="utf-8")

    _log(
        "[END]",
        {
            "model": model,
            "mean_score": summary.mean_score,
            "task_count": len(summary.tasks),
            "output_path": output_path,
        },
        log_writer,
    )
    return summary
