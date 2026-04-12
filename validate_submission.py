from __future__ import annotations

import importlib
from pathlib import Path

import yaml

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

    manifest = yaml.safe_load(Path("openenv.yaml").read_text(encoding="utf-8")) or {}
    manifest_graders: dict[str, tuple[str, str]] = {}
    for task in manifest.get("tasks", []):
        task_id = task.get("id")
        grader = task.get("grader")
        if not task_id or not grader:
            continue
        if isinstance(grader, dict) and grader.get("module") and grader.get("function"):
            manifest_graders[str(task_id)] = (str(grader["module"]), str(grader["function"]))
        elif isinstance(grader, str) and ":" in grader:
            module_name, function_name = grader.rsplit(":", 1)
            manifest_graders[str(task_id)] = (module_name, function_name)

    env = GuardianReviewEnvironment()
    if len(TASKS) < 3:
        raise SystemExit("At least 3 tasks are required.")

    for task in TASKS:
        grader_ref = manifest_graders.get(task.task_id)
        if not grader_ref:
            raise SystemExit(f"Task {task.task_id} is missing a grader in openenv.yaml")
        module_name, function_name = grader_ref
        grader_fn = getattr(importlib.import_module(module_name), function_name)
        manifest_score = grader_fn()
        if not isinstance(manifest_score, (int, float)):
            raise SystemExit(
                f"Manifest grader for {task.task_id} must return a plain numeric score, got {type(manifest_score).__name__}"
            )
        if not (0.0 < float(manifest_score) < 1.0):
            raise SystemExit(
                f"Manifest grader score out of range for {task.task_id}: {manifest_score} "
                "(must be strictly between 0 and 1)"
            )

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
