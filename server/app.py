from __future__ import annotations

from typing import Annotated

from fastapi import Body, FastAPI, Request
from pydantic import BaseModel

from guardian_openenv.environment import GuardianReviewEnvironment
from guardian_openenv.models import GuardianAction, GuardianObservation, GuardianState, StepResult
from guardian_openenv.tasks import TASKS


class ResetRequest(BaseModel):
    task_id: str | None = None


env = GuardianReviewEnvironment()
app = FastAPI(
    title="Guardian OpenEnv",
    description="OpenEnv-compatible shopping-protector environment for removing dark patterns before purchase.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "tasks": [task.task_id for task in TASKS]}


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

