from __future__ import annotations

from fastapi import FastAPI
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
def reset(payload: ResetRequest) -> GuardianObservation:
    return env.reset(payload.task_id)


@app.post("/step", response_model=StepResult)
def step(action: GuardianAction) -> StepResult:
    return env.step(action)


@app.get("/state", response_model=GuardianState)
def state() -> GuardianState:
    return env.state()
