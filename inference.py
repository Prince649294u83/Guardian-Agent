from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any

from guardian_openenv.client import GuardianReviewEnvClient
from guardian_openenv.inference_runtime import build_client, next_action
from guardian_openenv.models import ActionType, BaselineEpisodeResult, BaselineRunSummary, GuardianAction
from guardian_openenv.tasks import TASKS

BENCHMARK = "guardian-openenv"
OUTPUT_PATH = "outputs/inference_scores.json"
SUCCESS_SCORE_THRESHOLD = 0.6


def log_event(prefix: str, payload: dict[str, Any]) -> None:
    print(f"{prefix} {json.dumps(payload, separators=(',', ':'))}", flush=True)


def log_start(task: str, env: str, model: str) -> None:
    log_event("[START]", {"task": task, "env": env, "model": model})


def log_step(step: int, action: GuardianAction, reward: float, done: bool, error: str | None = None) -> None:
    log_event(
        "[STEP]",
        {
            "step": step,
            "action_type": action.action_type.value,
            "payload": action.model_dump(mode="json", exclude_none=True),
            "reward": reward,
            "done": done,
            "error": error,
        },
    )


def log_end(success: bool, steps: int, score: float, rewards: list[float], task_id: str) -> None:
    log_event(
        "[END]",
        {
            "task": task_id,
            "success": success,
            "steps": steps,
            "score": round(score, 4),
            "rewards": [round(value, 4) for value in rewards],
        },
    )


def fallback_action(observation) -> GuardianAction:
    inspected = {
        entry.split(":", 1)[1]
        for entry in observation.action_history
        if isinstance(entry, str) and entry.startswith(f"{ActionType.INSPECT_SECTION.value}:")
    }
    next_section = next((section.section_id for section in observation.section_index if section.section_id not in inspected), None)
    if next_section:
        return GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id=next_section)
    return GuardianAction(action_type=ActionType.SUBMIT_DECISION)


def get_model_action(client, model: str, observation) -> GuardianAction:
    try:
        return next_action(client, model, observation)
    except Exception as exc:  # noqa: BLE001
        print(f"[DEBUG] Model request failed: {exc}", flush=True)
        return fallback_action(observation)


async def run_task(env: GuardianReviewEnvClient, client, model: str, task) -> BaselineEpisodeResult:
    history: list[str] = []
    rewards: list[float] = []
    steps_taken = 0
    score = 0.001
    success = False

    from guardian_openenv.models import CurrentDecision
    log_start(task=task.task_id, env=BENCHMARK, model=model)

    final_step = None
    observation = None
    try:
        try:
            observation = env.reset(task.task_id)
        except Exception as exc:
            print(f"[ERROR] Failed to reset env for task {task.task_id}: {exc}", flush=True)
            log_step(step=1, action=GuardianAction(action_type=ActionType.SUBMIT_DECISION), reward=0.0, done=True, error=str(exc))
            return BaselineEpisodeResult(
                task_id=task.task_id, difficulty=task.difficulty, final_score=0.001,
                total_reward=0.0, steps_taken=0, final_decision=CurrentDecision(), grader_breakdown={"error": 0.999}
            )

        for step in range(1, task.max_steps + 1):
            if observation.done:
                break

            action = get_model_action(client, model, observation)
            try:
                result = env.step(action)
            except Exception as e:
                log_step(step=step, action=action, reward=0.0, done=True, error=str(e))
                break

            observation = result.observation
            reward = result.reward.value if result.reward else 0.0
            done = result.done

            rewards.append(reward)
            steps_taken = step

            log_step(step=step, action=action, reward=reward, done=done)
            history.append(f"Step {step}: {action.model_dump(mode='json', exclude_none=True)!r} -> reward {reward:+.2f}")
            final_step = result

            if done:
                break
            await asyncio.sleep(0)

        if final_step is None:
            raise RuntimeError(f"Inference never executed a step for task {task.task_id}")

        grader_breakdown = final_step.info.get("grader_breakdown", {})
        score = float(final_step.info.get("final_score", final_step.reward.score if final_step.reward else 0.001))
        score = min(max(score, 0.001), 0.999)
        success = score >= SUCCESS_SCORE_THRESHOLD

        state = env.state()
        return BaselineEpisodeResult(
            task_id=task.task_id,
            difficulty=task.difficulty,
            final_score=score,
            total_reward=state.cumulative_reward,
            steps_taken=steps_taken,
            final_decision=state.decision,
            grader_breakdown=grader_breakdown,
        )
    except Exception as exc:
        print(f"[ERROR] Task {task.task_id} failed: {exc}", flush=True)
        return BaselineEpisodeResult(
            task_id=task.task_id, difficulty=task.difficulty, final_score=0.001,
            total_reward=0.0, steps_taken=steps_taken, final_decision=observation.current_decision if observation else CurrentDecision(), grader_breakdown={"error": 0.999}
        )
    finally:
        log_end(success=success, steps=steps_taken, score=score, rewards=rewards, task_id=task.task_id)


def wait_for_server(base_url: str, retries: int = 5, delay: int = 2) -> bool:
    import httpx
    print(f"Waiting for server at {base_url}...", flush=True)
    for i in range(retries):
        try:
            r = httpx.get(f"{base_url}/health", timeout=5.0)
            if r.status_code == 200:
                print("Server is up!", flush=True)
                return True
        except Exception:
            pass
        print(f"Server not ready, retrying in {delay}s ({i+1}/{retries})...", flush=True)
        time.sleep(delay)
    return False


async def main() -> None:
    try:
        client, model = build_client(strict_submission_env=True)
    except Exception as exc:
        print(f"[ERROR] Inference failed to start client: {exc}", flush=True)
        client, model = None, "mock-model"

    import os
    base_url = os.environ.get("ENV_BASE_URL", "http://127.0.0.1:8000")
    if not wait_for_server(base_url):
        print(f"[ERROR] Target container not reachable at {base_url}, but continuing execution to emit logs.", flush=True)

    env = GuardianReviewEnvClient(base_url=base_url)
    results: list[BaselineEpisodeResult] = []

    try:
        for task in TASKS:
            results.append(await run_task(env, client, model, task))
    finally:
        if hasattr(env, "close") and callable(env.close):
            try:
                env.close()
            except Exception as e:
                print(f"[DEBUG] Failed to close env gracefully: {e}")

    summary = BaselineRunSummary(
        model=model,
        tasks=results,
        mean_score=min(max((sum(item.final_score for item in results) / len(results)) if results else 0.001, 0.001), 0.999),
    )

    output = Path(OUTPUT_PATH)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(summary.model_dump_json(indent=2), encoding="utf-8")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(f"[FATAL ERROR] Unexpected exception: {exc}", flush=True)
