from __future__ import annotations

from pathlib import Path

from guardian_openenv.environment import GuardianReviewEnvironment
from guardian_openenv.models import ActionType, GuardianAction
from guardian_openenv.tasks import TASKS


def main() -> None:
    required_files = [
        "openenv.yaml",
        "Dockerfile",
        "inference.py",
        "README.md",
        "server/app.py",
    ]
    missing = [path for path in required_files if not Path(path).exists()]
    if missing:
        raise SystemExit(f"Missing required files: {', '.join(missing)}")

    env = GuardianReviewEnvironment()
    if len(TASKS) < 3:
        raise SystemExit("At least 3 tasks are required.")

    for task in TASKS:
        observation = env.reset(task.task_id)
        if observation.task_id != task.task_id:
            raise SystemExit(f"reset() returned wrong task for {task.task_id}")
        state = env.state()
        if state.task_id != task.task_id:
            raise SystemExit(f"state() returned wrong task for {task.task_id}")
        step_result = env.step(
            GuardianAction(
                action_type=ActionType.INSPECT_SECTION,
                section_id=task.sections[0].section_id,
            )
        )
        score = step_result.reward.score
        if not (0.0 < score < 1.0):
            raise SystemExit(f"Reward score out of range for {task.task_id}: {score} (must be strictly between 0 and 1)")

    print("Submission validation passed.")


if __name__ == "__main__":
    main()
