from guardian_openenv.environment import GuardianReviewEnvironment
from guardian_openenv.models import (
    ActionType,
    GuardianAction,
    PatternLabel,
    RecommendationDecision,
)


def test_reset_returns_expected_task():
    env = GuardianReviewEnvironment()
    observation = env.reset("value-hotel-budget-guard")

    assert observation.task_id == "value-hotel-budget-guard"
    assert observation.remaining_steps == 10
    assert observation.current_decision.flagged_patterns == []
    assert observation.shopper_context.budget == 200.0


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
