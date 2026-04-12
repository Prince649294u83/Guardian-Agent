from typing import Any
from guardian_openenv.task_graders import grade_airline_seat_upsell_gauntlet

def grade(*args: Any, **kwargs: Any):
    """Grader function mapped for the OpenEnv Phase 2 validator."""
    try:
        return float(grade_airline_seat_upsell_gauntlet(*args, **kwargs))
    except Exception:
        return 0.001
