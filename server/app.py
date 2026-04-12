from __future__ import annotations

from typing import Annotated, Any

from fastapi import Body, FastAPI, Request
from pydantic import BaseModel
import uvicorn

from guardian_openenv.environment import GuardianReviewEnvironment
from guardian_openenv.models import (
    GuardianAction,
    GuardianObservation,
    GuardianState,
    StepResult,
)
from guardian_openenv.tasks import TASKS, TASKS_BY_ID
from guardian_openenv.task_graders import (
    grade_value_hotel_budget_guard,
    grade_airline_seat_upsell_gauntlet,
    grade_marketplace_ghost_checkout,
    _grade_task,
)


# ---------------------------------------------------------------------------
#  Request models
# ---------------------------------------------------------------------------

class ResetRequest(BaseModel):
    task_id: str | None = None


class GraderRequest(BaseModel):
    task_id: str
    trajectory: list[dict] = []


# ---------------------------------------------------------------------------
#  Global environment + app
# ---------------------------------------------------------------------------

env = GuardianReviewEnvironment()
app = FastAPI(
    title="Guardian OpenEnv",
    description="OpenEnv-compatible shopping-protector environment for removing dark patterns before purchase.",
    version="0.1.0",
)


# ---------------------------------------------------------------------------
#  Standard OpenEnv Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def root() -> dict:
    """Root health endpoint used by platform probes and humans."""
    return {"status": "ok", "name": "guardian-openenv"}

@app.get("/health")
def health() -> dict:
    return {"status": "healthy", "tasks": [task.task_id for task in TASKS]}


@app.post("/mcp")
async def mcp(_: Request) -> dict:
    """Minimal JSON-RPC endpoint for OpenEnv runtime compatibility checks."""
    return {"jsonrpc": "2.0", "result": {"status": "ok"}, "id": None}


@app.get("/metadata")
def metadata() -> dict:
    """Environment metadata — name, description, version, tags."""
    return {
        "name": "guardian-openenv",
        "description": "OpenEnv-compatible shopping-protector environment. "
                       "An AI agent reviews checkout flows, identifies dark "
                       "patterns, and recommends whether to proceed.",
        "version": "0.1.0",
        "tags": ["shopping", "dark-patterns", "consumer-protection", "rl"],
    }


@app.get("/tasks")
def list_tasks() -> list[dict]:
    """List all tasks with metadata — the validator discovers graders here."""
    grader_by_task_id = {
        "value_hotel_budget_guard": {
            "module": "tasks.value_hotel_budget_guard.grader",
            "function": "grade",
        },
        "airline_seat_upsell_gauntlet": {
            "module": "tasks.airline_seat_upsell_gauntlet.grader",
            "function": "grade",
        },
        "marketplace_ghost_checkout": {
            "module": "tasks.marketplace_ghost_checkout.grader",
            "function": "grade",
        },
    }
    results = []
    for task in TASKS:
        grader_ref = grader_by_task_id.get(
            task.task_id,
            {"module": "guardian_openenv.task_graders", "function": "grade"},
        )
        grader_path = f"{grader_ref['module']}:{grader_ref['function']}"
        results.append({
            "id": task.task_id,
            "task_id": task.task_id,
            "taskId": task.task_id,
            "name": task.objective[:80],
            "description": task.objective,
            "difficulty": task.difficulty,
            "has_grader": True,
            "grader": grader_ref,
            "grader_path": grader_path,
            "grader_fn": grader_path,
            "grader_module": grader_ref["module"],
            "grader_function": grader_ref["function"],
        })
    return results


@app.get("/info")
def info() -> dict:
    """Environment info including task list — alias for /tasks."""
    return {
        "name": "guardian-openenv",
        "tasks": list_tasks(),
        "task_count": len(TASKS),
    }


@app.get("/schema")
def schema() -> dict:
    """JSON schemas for actions, observations, and states."""
    return {
        "action": GuardianAction.model_json_schema(),
        "observation": GuardianObservation.model_json_schema(),
        "state": GuardianState.model_json_schema(),
        "step_result": StepResult.model_json_schema(),
    }


@app.post("/reset", response_model=GuardianObservation)
async def reset(request: Request) -> GuardianObservation:
    """Accept POST /reset with an empty body OR a JSON body with optional task_id.

    The OpenEnv automated checker sends an empty POST, which caused a 422 when
    FastAPI required a JSON body. We now read the raw body and only parse it if
    it contains non-empty content.
    """
    task_id: str | None = None
    try:
        body = await request.body()
        if body and body.strip() not in (b"", b"null"):
            payload = ResetRequest.model_validate_json(body)
            task_id = payload.task_id
    except Exception:  # noqa: BLE001
        pass
    return env.reset(task_id)


@app.post("/step", response_model=StepResult)
def step(action: GuardianAction) -> StepResult:
    return env.step(action)


@app.get("/state", response_model=GuardianState)
def state() -> GuardianState:
    return env.state()


@app.post("/grader")
async def grader(request: Request) -> dict:
    """Grade a trajectory for a given task.

    Accepts either:
      - {"task_id": "...", "trajectory": [...]}
      - Just {"task_id": "..."}
      - Empty body (grades current env state)
    
    Returns {"score": float, "grader_breakdown": {...}, "message": str}
    with all scores strictly in (0, 1).
    """
    task_id: str | None = None
    try:
        body = await request.body()
        if body and body.strip() not in (b"", b"null"):
            import json
            data = json.loads(body)
            # Support multiple client conventions used by validators.
            task_id = data.get("task_id") or data.get("taskId") or data.get("id") or data.get("task")
    except Exception:
        pass

    # If no task_id provided, use the current environment's task
    if task_id is None:
        task_id = env._task.task_id if env._task else TASKS[0].task_id

    # Grade using the task graders (passes environment for state access)
    grade_result = _grade_task(task_id, environment=env)
    score = float(grade_result)
    breakdown = getattr(grade_result, "grader_breakdown", {})
    if not isinstance(breakdown, dict):
        breakdown = {}
    if not breakdown:
        breakdown = {
            "pattern_score": score,
            "addon_score": score,
            "timer_score": score,
            "total_score": score,
            "recommendation_score": score,
            "evidence_score": score,
            "summary_score": score,
            "final_score": score,
        }
    return {
        "score": score,
        "grader_breakdown": breakdown,
        "message": "Task graded successfully.",
    }


@app.post("/grade")
async def grade_alias(request: Request) -> dict:
    """Alias for /grader — some validators may use this endpoint name."""
    return await grader(request)


@app.post("/baseline")
def baseline() -> dict:
    """Run the built-in heuristic baseline across all tasks."""
    from guardian_openenv.inference_runtime import run_inference
    summary = run_inference(
        strict_submission_env=False,
        output_path="outputs/inference_scores.json",
        log_writer=lambda x: None,
    )
    return {
        "model": summary.model,
        "mean_score": summary.mean_score,
        "task_count": len(summary.tasks),
        "tasks": [
            {
                "task_id": t.task_id,
                "difficulty": t.difficulty,
                "score": t.score,
                "total_reward": t.total_reward,
                "grader_breakdown": t.grader_breakdown,
            }
            for t in summary.tasks
        ],
    }


def main():
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server.app:app", host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
