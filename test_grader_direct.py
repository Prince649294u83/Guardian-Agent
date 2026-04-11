"""Test grader functions the way the OpenEnv validator would call them."""
from guardian_openenv.task_graders import (
    grade_value_hotel_budget_guard,
    grade_airline_seat_upsell_gauntlet,
    grade_marketplace_ghost_checkout,
)

GRADERS = [
    ("value_hotel_budget_guard", grade_value_hotel_budget_guard),
    ("airline_seat_upsell_gauntlet", grade_airline_seat_upsell_gauntlet),
    ("marketplace_ghost_checkout", grade_marketplace_ghost_checkout),
]

print("=== Test 1: Called with no arguments ===")
for task_id, fn in GRADERS:
    result = fn()
    score = result["score"]
    valid = 0 < score < 1
    print(f"  {task_id}: score={score}  valid={valid}")
    if not valid:
        print(f"    *** FAIL: score is out of (0,1) range!")
    # Check breakdown
    for k, v in result.get("grader_breakdown", {}).items():
        if isinstance(v, float) and (v <= 0.0 or v >= 1.0):
            print(f"    *** breakdown {k}={v} OUT OF RANGE")

print()
print("=== Test 2: Called with trajectory=[] ===")
for task_id, fn in GRADERS:
    result = fn(trajectory=[])
    score = result["score"]
    valid = 0 < score < 1
    print(f"  {task_id}: score={score}  valid={valid}")

print()
print("=== Test 3: Called with environment=None, trajectory=[] ===")
for task_id, fn in GRADERS:
    result = fn(environment=None, trajectory=[])
    score = result["score"]
    valid = 0 < score < 1
    print(f"  {task_id}: score={score}  valid={valid}")

print()
print("=== Test 4: Run full episode then grade ===")
from guardian_openenv.environment import GuardianReviewEnvironment
from guardian_openenv.models import GuardianAction, ActionType

env = GuardianReviewEnvironment()
for task_id, fn in GRADERS:
    env.reset(task_id)
    # Take a few actions
    env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id=env._task.sections[0].section_id))
    env.step(GuardianAction(action_type=ActionType.SUBMIT_DECISION))
    
    # Now grade using the environment
    result = fn(environment=env)
    score = result["score"]
    valid = 0 < score < 1
    print(f"  {task_id}: score={score}  valid={valid}")
    if not valid:
        print(f"    *** FAIL: score is out of (0,1) range!")
    for k, v in result.get("grader_breakdown", {}).items():
        if isinstance(v, float) and (v <= 0.0 or v >= 1.0):
            print(f"    *** breakdown {k}={v} OUT OF RANGE")

print()
print("=== Test 5: Grade with state dict (as validator might pass) ===")
for task_id, fn in GRADERS:
    env.reset(task_id)
    state_dict = env.state().model_dump()
    result = fn(environment=state_dict)
    score = result["score"]
    valid = 0 < score < 1
    print(f"  {task_id}: score={score}  valid={valid}")

print()
print("=== Test 6: inference_scores.json check ===")
import json
from pathlib import Path
scores_path = Path("outputs/inference_scores.json")
if scores_path.exists():
    data = json.loads(scores_path.read_text())
    for task in data.get("tasks", []):
        tid = task["task_id"]
        fs = task.get("score")
        if fs is not None:
            valid = 0 < fs < 1
            print(f"  {tid}: score={fs}  valid={valid}")
        else:
            print(f"  {tid}: MISSING score FIELD")
            valid = False
        if not valid:
            print(f"    *** FAIL!")
        for k, v in task.get("grader_breakdown", {}).items():
            if isinstance(v, float) and (v <= 0.0 or v >= 1.0):
                print(f"    *** breakdown {k}={v} OUT OF RANGE")
    ms = data.get("mean_score")
    print(f"  mean_score={ms}  valid={0 < ms < 1}")
else:
    print("  (file not found)")

print()
print("ALL TESTS COMPLETE")
