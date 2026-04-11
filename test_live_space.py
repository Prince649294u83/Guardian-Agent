"""Test the live HF Space grader endpoint with step+grade flow."""
import requests
import json

BASE = "https://prince9868-guardian-agent.hf.space"

tasks = [
    "value_hotel_budget_guard",
    "airline_seat_upsell_gauntlet", 
    "marketplace_ghost_checkout",
]

print("=== Test: reset -> submit -> grade flow ===")
for task_id in tasks:
    # Reset
    r = requests.post(f"{BASE}/reset", json={"task_id": task_id}, timeout=30)
    print(f"RESET {task_id}: {r.status_code}")
    
    # Immediately submit
    r = requests.post(f"{BASE}/step", json={"action_type": "submit_decision"}, timeout=30)
    step_data = r.json()
    reward = step_data.get("reward", {})
    score_val = reward.get("score")
    value_val = reward.get("value")
    done = step_data.get("done")
    info = step_data.get("info", {})
    final_score = info.get("final_score")
    
    print(f"  STEP: score={score_val}, value={value_val}, done={done}")
    print(f"  INFO final_score={final_score}")
    
    # Check ranges 
    if score_val is not None:
        if score_val <= 0.0 or score_val >= 1.0:
            print(f"  *** reward.score OUT OF RANGE: {score_val}")
    if value_val is not None:
        if value_val == 0.0:
            print(f"  ** reward.value is exactly 0.0 (might flag validator)")
    if final_score is not None:
        if final_score <= 0.0 or final_score >= 1.0:
            print(f"  *** final_score OUT OF RANGE: {final_score}")
    
    # Grade
    r = requests.post(f"{BASE}/grader", json={"task_id": task_id}, timeout=30)
    grade_data = r.json()
    gscore = grade_data.get("score")
    print(f"  GRADER: score={gscore}")
    if gscore is not None and (gscore <= 0.0 or gscore >= 1.0):
        print(f"  *** GRADER score OUT OF RANGE: {gscore}")
    
    breakdown = grade_data.get("grader_breakdown", {})
    for k, v in breakdown.items():
        if isinstance(v, (int, float)) and (v <= 0.0 or v >= 1.0):
            print(f"  *** breakdown.{k}={v} OUT OF RANGE")
    print()

print("=== Test: empty POST to /reset then /grader ===")
r = requests.post(f"{BASE}/reset", timeout=30)
print(f"RESET (empty): {r.status_code}")
r = requests.post(f"{BASE}/grader", timeout=30)
grade_data = r.json()
print(f"GRADER (empty): score={grade_data.get('score')}")

print()
print("=== Test: POST /grade (alias) ===")
for task_id in tasks:
    requests.post(f"{BASE}/reset", json={"task_id": task_id}, timeout=30)
    r = requests.post(f"{BASE}/grade", json={"task_id": task_id}, timeout=30)
    print(f"  /grade {task_id}: {r.status_code} score={r.json().get('score')}")

print()
print("ALL LIVE TESTS COMPLETE")
