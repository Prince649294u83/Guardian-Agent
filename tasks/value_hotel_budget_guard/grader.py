from typing import Any
from guardian_openenv.task_graders import grade_value_hotel_budget_guard

def grade(*args: Any, **kwargs: Any):
    """Grader function mapped for the OpenEnv Phase 2 validator."""
    try:
        return float(grade_value_hotel_budget_guard(*args, **kwargs))
    except Exception:
        # Fallback to a valid score if evaluation throws to avoid full crash
        return 0.001
