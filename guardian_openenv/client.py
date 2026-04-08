from __future__ import annotations

import httpx

from guardian_openenv.models import GuardianAction, GuardianObservation, GuardianState, StepResult


class GuardianReviewEnvClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self._client = httpx.Client(base_url=base_url, timeout=30.0)

    def close(self) -> None:
        self._client.close()

    def reset(self, task_id: str | None = None) -> GuardianObservation:
        response = self._client.post("/reset", json={"task_id": task_id})
        response.raise_for_status()
        return GuardianObservation.model_validate(response.json())

    def step(self, action: GuardianAction) -> StepResult:
        response = self._client.post("/step", json=action.model_dump(mode="json"))
        response.raise_for_status()
        return StepResult.model_validate(response.json())

    def state(self) -> GuardianState:
        response = self._client.get("/state")
        response.raise_for_status()
        return GuardianState.model_validate(response.json())

