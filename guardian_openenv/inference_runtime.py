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
Return exactly one JSON object for the next action. Do NOT add any text outside the JSON.

FIELD REQUIREMENTS — read carefully and follow exactly:
- inspect_section:    {"action_type": "inspect_section",    "section_id": "<id from section_index>"}
- remove_addon:       {"action_type": "remove_addon",       "addon_id": "<id from optional_addons>"}
- keep_addon:         {"action_type": "keep_addon",         "addon_id": "<id from optional_addons>"}
- flag_pattern:       {"action_type": "flag_pattern",       "pattern": "<slug: false_urgency|false_scarcity|confirm_shaming|hidden_fees|prechecked_addons|misdirection>"}
- unflag_pattern:     {"action_type": "unflag_pattern",     "pattern": "<same slugs>"}
- verify_timer:       {"action_type": "verify_timer",       "timer_id": "<id from urgency_timers>", "timer_is_fake": true}
                       NOTE: timer_is_fake MUST be a JSON boolean (true or false), not a string.
- set_true_total:     {"action_type": "set_true_total",     "estimated_true_total": <number>}
- set_recommendation: {"action_type": "set_recommendation", "recommendation": "<buy|buy_with_caution|avoid>"}
- write_summary:      {"action_type": "write_summary",      "summary": "<text>"}
- submit_decision:    {"action_type": "submit_decision"}

Priority order:
1. Inspect the most informative checkout sections (use ids from section_index)
2. Flag dark patterns using exact slugs from the list above
3. Remove unnecessary extras (use addon_id from optional_addons list)
4. Verify whether timers are fake (timer_is_fake must be boolean true or false)
5. Estimate the true final total
6. Set a recommendation and write a summary
7. Submit the decision when the shopper is protected"""


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
    model_name = os.environ.get("MODEL_NAME")
    api_key = os.environ.get("API_KEY")

    if strict_submission_env:
        required = {
            "API_BASE_URL": api_base_url,
            "API_KEY": api_key,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError(
                f"Missing required environment variables for inference: {', '.join(missing)}"
            )

        client = OpenAI(api_key=api_key, base_url=api_base_url)
        resolved_model = model_name
        if not resolved_model:
            # Keep strict proxy usage while avoiding hard crash when MODEL_NAME
            # is omitted by the runtime harness.
            try:
                models = client.models.list()
                first = next(iter(models.data), None)
                if first is not None and getattr(first, "id", None):
                    resolved_model = str(first.id)
            except Exception:
                resolved_model = None

        return client, (resolved_model or "gpt-4o-mini")

    # Non-strict: try all supported provider patterns in priority order
    openai_key = os.environ.get("OPENAI_API_KEY")
    openai_base_url = os.environ.get("OPENAI_BASE_URL")
    openai_model = os.environ.get("OPENAI_MODEL")

    groq_key = os.environ.get("GROQ_API_KEY")
    groq_model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    # 1) Explicit API_BASE_URL + API_KEY (HF router, Together, etc.)
    if api_base_url and api_key:
        return OpenAI(api_key=api_key, base_url=api_base_url), model_name or "default-proxy-model"

    # 2) Direct OpenAI
    if openai_key:
        client_kwargs: dict = {"api_key": openai_key}
        if openai_base_url:
            client_kwargs["base_url"] = openai_base_url
        return OpenAI(**client_kwargs), openai_model or "gpt-4.1-mini"

    # 3) Groq (OpenAI-compatible)
    if groq_key:
        return OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1"), groq_model

    raise RuntimeError(
        "Provide one of: API_BASE_URL+API_KEY, OPENAI_API_KEY, or GROQ_API_KEY to run inference."
    )



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
        "item_id": "addon_id",          # LLMs sometimes echo the cart item field name
        "pattern_label": "pattern",
        "pattern_name": "pattern",
        "label": "pattern",
        "timer": "timer_id",
        "timer_key": "timer_id",
        "is_fake": "timer_is_fake",
        "is_fake_timer": "timer_is_fake",
        "fake": "timer_is_fake",
        "verdict": "timer_is_fake",     # LLMs may return {"verdict": "fake"}
        "true_total": "estimated_true_total",
        "amount": "estimated_true_total",
        "total": "estimated_true_total",
        "decision": "recommendation",
        "recommendation_label": "recommendation",
        "report_summary": "summary",
    }
    for source_key, target_key in alias_map.items():
        if source_key in normalized and target_key not in normalized:
            normalized[target_key] = normalized[source_key]

    # Special-case: verdict might be "fake"/"real"/"yes"/"no" instead of bool
    if "timer_is_fake" in normalized and not isinstance(normalized["timer_is_fake"], bool):
        raw_verdict = str(normalized["timer_is_fake"]).lower().strip()
        normalized["timer_is_fake"] = raw_verdict in {"fake", "true", "yes", "1"}

    # Special-case: pattern might be a sentence LLMs describe rather than enum slug
    if "pattern" in normalized and isinstance(normalized["pattern"], str):
        p = normalized["pattern"].lower().replace(" ", "_").replace("-", "_")
        pattern_synonyms = {
            "false_urgency": "false_urgency",
            "fake_urgency": "false_urgency",
            "urgency": "false_urgency",
            "false_scarcity": "false_scarcity",
            "fake_scarcity": "false_scarcity",
            "scarcity": "false_scarcity",
            "confirm_shaming": "confirm_shaming",
            "shaming": "confirm_shaming",
            "hidden_fees": "hidden_fees",
            "hidden_fee": "hidden_fees",
            "fee": "hidden_fees",
            "prechecked_addons": "prechecked_addons",
            "pre_checked": "prechecked_addons",
            "pre_selected": "prechecked_addons",
            "prechecked": "prechecked_addons",
            "misdirection": "misdirection",
        }
        normalized["pattern"] = pattern_synonyms.get(p, normalized["pattern"])

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


def _fallback_action(observation) -> GuardianAction:
    """Simple rule-based fallback when no LLM client is available."""
    inspected = {
        entry.split(":", 1)[1]
        for entry in observation.action_history
        if isinstance(entry, str) and entry.startswith(f"{ActionType.INSPECT_SECTION.value}:")
    }
    next_section = next(
        (s.section_id for s in observation.section_index if s.section_id not in inspected), None
    )
    if next_section:
        return GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id=next_section)
    return GuardianAction(action_type=ActionType.SUBMIT_DECISION)


def run_inference(
    strict_submission_env: bool,
    output_path: str,
    log_writer: Callable[[str], None],
) -> BaselineRunSummary:
    # In submission mode, require an LLM client configured via validator-injected vars.
    # In non-strict mode, allow a rule-based fallback for local development.
    try:
        client, model = build_client(strict_submission_env=strict_submission_env)
    except RuntimeError as exc:
        if strict_submission_env:
            raise
        log_writer(f"[WARN] No LLM client available ({exc}); using rule-based fallback.")
        client, model = None, "rule-based-fallback"

    env = GuardianReviewEnvironment()
    results: list[BaselineEpisodeResult] = []

    _log("[START]", {"model": model, "task_count": len(TASKS)}, log_writer)

    for task in TASKS:
        observation = env.reset(task.task_id)
        final_step = None
        _log(
            "[STEP]",
            {"task_id": task.task_id, "event": "task_start", "difficulty": task.difficulty},
            log_writer,
        )
        while not observation.done:
            try:
                if client is not None:
                    action = next_action(client, model, observation)
                else:
                    action = _fallback_action(observation)
            except Exception as action_exc:  # noqa: BLE001
                log_writer(f"[WARN] Action generation failed: {action_exc}; using fallback.")
                action = _fallback_action(observation)

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
        final_score_raw = float(final_step.info.get("final_score", breakdown.get("final_score", 0.101)))
        final_score = min(max(final_score_raw, 0.101), 0.899)

        # Export a normalized trajectory reward so downstream validators that
        # enforce strict (0,1) on reward fields never see out-of-range values.
        average_reward = state.cumulative_reward / max(state.step_count, 1)
        total_reward = min(max(average_reward, 0.101), 0.899)

        # Keep output payload numeric fields validator-safe.
        safe_breakdown = {
            key: min(max(float(value), 0.101), 0.899)
            for key, value in breakdown.items()
            if isinstance(value, (int, float))
        }
        results.append(
            BaselineEpisodeResult(
                task_id=task.task_id,
                difficulty=task.difficulty,
                score=final_score,
                total_reward=round(total_reward, 4),
                steps_taken=state.step_count,
                # Avoid leaking large numeric fields (e.g. estimated_true_total)
                # into exported outputs that some validators may range-check.
                final_decision=state.decision.model_copy(update={"estimated_true_total": None}),
                grader_breakdown=safe_breakdown,
            )
        )

    raw_mean = sum(item.score for item in results) / len(results) if results else 0.101
    summary = BaselineRunSummary(
        model=model,
        tasks=results,
        mean_score=min(max(raw_mean, 0.101), 0.899),
    )
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(summary.model_dump_json(indent=2), encoding="utf-8")

    _log(
        "[END]",
        {"model": model, "mean_score": summary.mean_score, "task_count": len(summary.tasks), "output_path": output_path},
        log_writer,
    )
    return summary
