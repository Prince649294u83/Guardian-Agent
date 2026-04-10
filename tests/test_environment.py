from guardian_openenv.environment import GuardianReviewEnvironment
from guardian_openenv.models import (
    ActionType,
    GuardianAction,
    PatternLabel,
    RecommendationDecision,
)
from guardian_openenv.tasks import TASKS, TASKS_BY_ID


# ── Basic API contract ────────────────────────────────────────────────────

def test_reset_returns_expected_task():
    env = GuardianReviewEnvironment()
    observation = env.reset("value-hotel-budget-guard")

    task = TASKS_BY_ID["value-hotel-budget-guard"]
    assert observation.task_id == "value-hotel-budget-guard"
    # remaining_steps equals the task's max_steps right after reset
    assert observation.remaining_steps == task.max_steps
    assert observation.current_decision.flagged_patterns == []
    assert observation.shopper_context.budget == 200.0


def test_state_reflects_task_after_reset():
    env = GuardianReviewEnvironment()
    env.reset("airline-seat-upsell-gauntlet")
    state = env.state()
    assert state.task_id == "airline-seat-upsell-gauntlet"
    assert state.difficulty == "medium"
    assert state.step_count == 0
    assert state.done is False


def test_step_increases_step_count():
    env = GuardianReviewEnvironment()
    obs = env.reset("value-hotel-budget-guard")
    task = TASKS_BY_ID["value-hotel-budget-guard"]

    result = env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id=task.sections[0].section_id))
    assert env.state().step_count == 1
    assert result.reward.score > 0.0
    assert result.reward.score < 1.0


def test_reward_score_always_in_open_range():
    """Reward scores must be strictly > 0 and < 1 at every step."""
    env = GuardianReviewEnvironment()
    for task in TASKS:
        obs = env.reset(task.task_id)
        for section in task.sections:
            if obs.done:
                break
            result = env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id=section.section_id))
            assert 0.0 < result.reward.score < 1.0, (
                f"[{task.task_id}] score out of range: {result.reward.score}"
            )


def test_invalid_section_penalised():
    env = GuardianReviewEnvironment()
    env.reset("value-hotel-budget-guard")
    result = env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id="NONEXISTENT"))
    assert result.reward.value < 0.0


# ── Full perfect episode — easy task ──────────────────────────────────────

def test_dense_progress_and_final_grade():
    env = GuardianReviewEnvironment()
    env.reset("value-hotel-budget-guard")

    env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id="listing-banner"))
    env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id="price-summary"))
    env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id="addons"))
    env.step(GuardianAction(action_type=ActionType.INSPECT_SECTION, section_id="timer-proof"))
    env.step(GuardianAction(action_type=ActionType.FLAG_PATTERN, pattern=PatternLabel.FALSE_URGENCY))
    env.step(GuardianAction(action_type=ActionType.FLAG_PATTERN, pattern=PatternLabel.FALSE_SCARCITY))
    env.step(GuardianAction(action_type=ActionType.FLAG_PATTERN, pattern=PatternLabel.HIDDEN_FEES))
    env.step(GuardianAction(action_type=ActionType.FLAG_PATTERN, pattern=PatternLabel.PRECHECKED_ADDONS))
    env.step(GuardianAction(action_type=ActionType.REMOVE_ADDON, addon_id="insurance"))
    env.step(GuardianAction(action_type=ActionType.REMOVE_ADDON, addon_id="newsletter"))
    env.step(GuardianAction(action_type=ActionType.VERIFY_TIMER, timer_id="timer-checkout", timer_is_fake=True))
    env.step(GuardianAction(action_type=ActionType.SET_TRUE_TOTAL, estimated_true_total=212.39))
    env.step(GuardianAction(action_type=ActionType.SET_RECOMMENDATION, recommendation=RecommendationDecision.AVOID))
    env.step(
        GuardianAction(
            action_type=ActionType.WRITE_SUMMARY,
            summary="Hidden fees, a fake timer, and pre-checked add-ons push the stay over budget.",
        )
    )
    result = env.step(GuardianAction(action_type=ActionType.SUBMIT_DECISION))

    assert result.done is True
    assert result.info["final_score"] >= 0.95


# ── Minimum smoke test — medium and hard tasks ────────────────────────────

def test_medium_task_completes():
    env = GuardianReviewEnvironment()
    env.reset("airline-seat-upsell-gauntlet")
    result = env.step(GuardianAction(action_type=ActionType.SUBMIT_DECISION))
    assert result.done is True
    assert 0.0 < result.reward.score < 1.0


def test_hard_task_completes():
    env = GuardianReviewEnvironment()
    env.reset("marketplace-ghost-checkout")
    result = env.step(GuardianAction(action_type=ActionType.SUBMIT_DECISION))
    assert result.done is True
    assert 0.0 < result.reward.score < 1.0


# ── Post-done behaviour ───────────────────────────────────────────────────

def test_actions_after_done_return_reward_zero():
    env = GuardianReviewEnvironment()
    env.reset("value-hotel-budget-guard")
    env.step(GuardianAction(action_type=ActionType.SUBMIT_DECISION))
    # Further steps should be no-ops with value=0
    noop = env.step(GuardianAction(action_type=ActionType.SUBMIT_DECISION))
    assert noop.done is True
    assert noop.reward.value == 0.0

