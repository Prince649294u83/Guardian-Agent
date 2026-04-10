"""Per-task grader entry-points consumed by the OpenEnv validator.

Each ``grade()`` function accepts the environment (or its state) and the
action/observation logs, evaluates the agent's final decision against the
gold-standard rubric, and returns a `float` strictly inside (0, 1).

The ``openenv.yaml`` references these as::

    grader: "guardian_openenv.task_graders:grade_<task_slug>"
"""

from __future__ import annotations

from typing import Any

from guardian_openenv.graders import grade_decision
from guardian_openenv.models import CurrentDecision
from guardian_openenv.tasks import TASKS_BY_ID


def _clamp(value: float) -> float:
    """Ensure a score is strictly between 0 and 1."""
    return min(max(value, 0.001), 0.999)


def _grade_task(task_id: str, *args: Any, environment: Any = None, logs: Any = None, **kwargs: Any) -> float:
    """Shared grading logic for any task.

    The function extracts the decision from the environment state (if
    available) and delegates to ``grade_decision``.  When the environment
    is not available (e.g. during static validation), a minimal empty
    decision is graded so the validator still receives a valid float score.
    """
    task = TASKS_BY_ID[task_id]

    # Try to extract the current decision from the environment.
    decision = CurrentDecision()
    opened_section_ids: set[str] = set()

    if environment is not None:
        # Support both raw env objects and state dicts
        state = None
        if hasattr(environment, "state") and callable(environment.state):
            state = environment.state()
        elif hasattr(environment, "_state"):
            state = environment._state
        elif isinstance(environment, dict):
            state = environment

        if state is not None:
            if hasattr(state, "decision"):
                decision = state.decision
            elif isinstance(state, dict) and "decision" in state:
                decision = CurrentDecision.model_validate(state["decision"])
            if hasattr(state, "opened_section_ids"):
                opened_section_ids = set(state.opened_section_ids)
            elif isinstance(state, dict) and "opened_section_ids" in state:
                opened_section_ids = set(state["opened_section_ids"])

    breakdown = grade_decision(task, decision, opened_section_ids)
    score = _clamp(breakdown["final_score"])

    return score


# ---------------------------------------------------------------------------
#  Per-task grader entry-points (referenced in openenv.yaml)
# ---------------------------------------------------------------------------

def grade_value_hotel_budget_guard(*args: Any, environment: Any = None, logs: Any = None, **kw: Any) -> float:
    """Grader for the easy hotel-budget task."""
    return _grade_task("value_hotel_budget_guard", *args, environment=environment, logs=logs, **kw)


def grade_airline_seat_upsell_gauntlet(*args: Any, environment: Any = None, logs: Any = None, **kw: Any) -> float:
    """Grader for the medium airline-upsell task."""
    return _grade_task("airline_seat_upsell_gauntlet", *args, environment=environment, logs=logs, **kw)


def grade_marketplace_ghost_checkout(*args: Any, environment: Any = None, logs: Any = None, **kw: Any) -> float:
    """Grader for the hard marketplace-checkout task."""
    return _grade_task("marketplace_ghost_checkout", *args, environment=environment, logs=logs, **kw)


# Also expose a generic ``grade`` entry-point that accepts a task_id kwarg.
def grade(*args: Any, environment: Any = None, logs: Any = None, task_id: str | None = None, **kw: Any) -> float:
    """Generic grader that dispatches to the correct task grader."""
    if task_id is None:
        # Default to the first task if none specified
        task_id = "value_hotel_budget_guard"
    return _grade_task(task_id, *args, environment=environment, logs=logs, **kw)
