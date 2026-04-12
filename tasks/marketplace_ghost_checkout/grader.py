from typing import Any
from guardian_openenv.task_graders import grade_marketplace_ghost_checkout

def grade(*args: Any, **kwargs: Any):
    """Grader function mapped for the OpenEnv Phase 2 validator."""
    try:
        return grade_marketplace_ghost_checkout(*args, **kwargs)
    except Exception:
        return 0.001
