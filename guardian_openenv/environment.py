from __future__ import annotations

from guardian_openenv.graders import grade_decision
from guardian_openenv.models import (
    ActionType,
    CurrentDecision,
    GuardianAction,
    GuardianObservation,
    GuardianReward,
    GuardianState,
    SectionIndexItem,
    ShopperContext,
    RewardComponent,
    StepResult,
)
from guardian_openenv.tasks import TASKS, TASKS_BY_ID


class GuardianReviewEnvironment:
    def __init__(self, task_id: str | None = None):
        self._task_order = [task.task_id for task in TASKS]
        self._task_cursor = 0
        self._task = TASKS[0] if task_id is None else TASKS_BY_ID[task_id]
        self._state = GuardianState(
            task_id=self._task.task_id,
            difficulty=self._task.difficulty,
            step_count=0,
            max_steps=self._task.max_steps,
            opened_section_ids=[],
            decision=CurrentDecision(),
            done=False,
            cumulative_reward=0.0,
        )
        self._last_opened_section_id: str | None = None
        self._history: list[str] = []
        self._last_score = 0.0

    def reset(self, task_id: str | None = None) -> GuardianObservation:
        if task_id is None:
            if self._state.step_count > 0 or self._state.done:
                self._task_cursor = (self._task_cursor + 1) % len(self._task_order)
            task_id = self._task_order[self._task_cursor]
        self._task = TASKS_BY_ID[task_id]
        self._state = GuardianState(
            task_id=self._task.task_id,
            difficulty=self._task.difficulty,
            step_count=0,
            max_steps=self._task.max_steps,
            opened_section_ids=[],
            decision=CurrentDecision(),
            done=False,
            cumulative_reward=0.0,
        )
        self._last_opened_section_id = None
        self._history = []
        self._last_score = 0.0
        return self._build_observation("New checkout protection task loaded.")

    def state(self) -> GuardianState:
        return self._state.model_copy(deep=True)

    def step(self, action: GuardianAction) -> StepResult:
        if self._state.done:
            observation = self._build_observation("Episode already finished. Reset to start a new task.")
            reward = GuardianReward(
                value=0.0,
                score=self._last_score,
                components=[RewardComponent(name="blocked", value=0.0, reason="Episode already complete.")],
                reason="No-op after completion.",
            )
            return StepResult(observation=observation, reward=reward, done=True, info={"final_score": self._last_score})

        self._state.step_count += 1
        message = ""
        bonus = 0.0
        penalty = -0.01
        components = [RewardComponent(name="step_cost", value=-0.01, reason="Small cost to discourage looping.")]

        if action.action_type == ActionType.INSPECT_SECTION:
            message, bonus = self._handle_inspect_section(action.section_id or "")
            components.append(RewardComponent(name="inspect_section", value=bonus, reason=message))
        elif action.action_type == ActionType.REMOVE_ADDON:
            message, bonus = self._handle_remove_addon(action.addon_id or "")
            components.append(RewardComponent(name="remove_addon", value=bonus, reason=message))
        elif action.action_type == ActionType.KEEP_ADDON:
            message, bonus = self._handle_keep_addon(action.addon_id or "")
            components.append(RewardComponent(name="keep_addon", value=bonus, reason=message))
        elif action.action_type == ActionType.FLAG_PATTERN:
            message, bonus = self._handle_flag_pattern(action.pattern)
            components.append(RewardComponent(name="flag_pattern", value=bonus, reason=message))
        elif action.action_type == ActionType.UNFLAG_PATTERN:
            message, bonus = self._handle_unflag_pattern(action.pattern)
            components.append(RewardComponent(name="flag_pattern", value=bonus, reason=message))
        elif action.action_type == ActionType.VERIFY_TIMER:
            message, bonus = self._handle_verify_timer(action.timer_id or "", bool(action.timer_is_fake))
            components.append(RewardComponent(name="verify_timer", value=bonus, reason=message))
        elif action.action_type == ActionType.SET_TRUE_TOTAL:
            message, bonus = self._handle_set_true_total(action.estimated_true_total or 0.0)
            components.append(RewardComponent(name="set_true_total", value=bonus, reason=message))
        elif action.action_type == ActionType.SET_RECOMMENDATION:
            message, bonus = self._handle_set_recommendation(action.recommendation)
            components.append(RewardComponent(name="set_recommendation", value=bonus, reason=message))
        elif action.action_type == ActionType.WRITE_SUMMARY:
            message, bonus = self._handle_write_summary(action.summary or "")
            components.append(RewardComponent(name="write_summary", value=bonus, reason=message))
        elif action.action_type == ActionType.SUBMIT_DECISION:
            message = "Final shopper recommendation submitted."
        else:
            message = f"Unsupported action: {action.action_type}"
            penalty -= 0.05

        grade = grade_decision(self._task, self._state.decision, set(self._state.opened_section_ids))
        current_score = grade["final_score"]
        delta_score = current_score - self._last_score
        self._last_score = current_score

        reward_value = bonus + delta_score + penalty
        done = action.action_type == ActionType.SUBMIT_DECISION
        info = {"grader_breakdown": grade}

        if action.action_type == ActionType.SUBMIT_DECISION:
            missing_core = len(set(self._task.required_section_ids) - set(self._state.opened_section_ids))
            if missing_core > 0:
                premature_penalty = round(-0.05 * missing_core, 4)
                reward_value += premature_penalty
                components.append(
                    RewardComponent(
                        name="premature_submit_penalty",
                        value=premature_penalty,
                        reason="Decision submitted before reviewing the core checkout sections.",
                    )
                )
            reward_value = max(0.001, min(0.999, current_score + reward_value))
            self._state.done = True
            done = True
            info["final_score"] = current_score

        if self._state.step_count >= self._state.max_steps and not done:
            self._state.done = True
            done = True
            reward_value = max(0.001, current_score - 0.1)
            message = "Maximum step budget reached before submission."
            components.append(
                RewardComponent(
                    name="max_step_penalty",
                    value=-0.1,
                    reason="The agent ran out of steps before finalizing the shopper decision.",
                )
            )
            info["final_score"] = current_score

        reward_value = round(max(-1.0, min(1.0, reward_value)), 4)
        self._state.cumulative_reward = round(self._state.cumulative_reward + reward_value, 4)
        self._state.done = done

        self._history.append(self._describe_action(action))
        observation = self._build_observation(message)
        reward = GuardianReward(
            value=reward_value,
            score=current_score,
            components=components,
            reason=message,
        )
        return StepResult(observation=observation, reward=reward, done=done, info=info)

    def _build_observation(self, message: str) -> GuardianObservation:
        section_index = [
            SectionIndexItem(section_id=section.section_id, title=section.title)
            for section in self._task.sections
        ]
        opened = None
        if self._last_opened_section_id:
            opened = next(
                section for section in self._task.sections if section.section_id == self._last_opened_section_id
            )

        return GuardianObservation(
            task_id=self._task.task_id,
            difficulty=self._task.difficulty,
            objective=self._task.objective,
            shopper_context=ShopperContext(
                merchant=self._task.merchant,
                checkout_url=self._task.checkout_url,
                category=self._task.category,
                shopper_goal=self._task.shopper_goal,
                budget=self._task.budget,
                listed_price=self._task.listed_price,
            ),
            visible_cart=self._task.visible_cart,
            optional_addons=self._task.optional_addons,
            urgency_timers=self._task.urgency_timers,
            pressure_signals=self._task.pressure_signals,
            section_index=section_index,
            opened_section=opened,
            current_decision=self._state.decision.model_copy(deep=True),
            remaining_steps=max(self._state.max_steps - self._state.step_count, 0),
            last_action_message=message,
            action_history=list(self._history),
            done=self._state.done,
        )

    def _handle_inspect_section(self, section_id: str) -> tuple[str, float]:
        section = next((entry for entry in self._task.sections if entry.section_id == section_id), None)
        if section is None:
            return (f"Section '{section_id}' does not exist.", -0.08)
        self._last_opened_section_id = section_id
        if section_id in self._state.opened_section_ids:
            return (f"Re-opened section {section_id}.", -0.01)
        self._state.opened_section_ids.append(section_id)
        bonus = 0.05 if section_id in self._task.required_section_ids else 0.01
        return (f"Inspected section {section_id}: {section.title}", bonus)

    def _handle_remove_addon(self, addon_id: str) -> tuple[str, float]:
        known_ids = {item.item_id for item in self._task.optional_addons}
        if addon_id not in known_ids:
            return (f"Addon '{addon_id}' is not available.", -0.06)
        if addon_id in self._state.decision.removed_addon_ids:
            return (f"Addon '{addon_id}' was already removed.", -0.02)
        self._state.decision.removed_addon_ids.append(addon_id)
        if addon_id in self._state.decision.kept_addon_ids:
            self._state.decision.kept_addon_ids = [item for item in self._state.decision.kept_addon_ids if item != addon_id]
        if addon_id in self._task.gold_removed_addon_ids:
            return (f"Removed manipulative addon '{addon_id}'.", 0.06)
        return (f"Removed addon '{addon_id}', but it was not part of the optimal plan.", -0.03)

    def _handle_keep_addon(self, addon_id: str) -> tuple[str, float]:
        known_ids = {item.item_id for item in self._task.optional_addons}
        if addon_id not in known_ids:
            return (f"Addon '{addon_id}' is not available.", -0.06)
        if addon_id in self._state.decision.kept_addon_ids:
            return (f"Addon '{addon_id}' was already marked to keep.", -0.02)
        self._state.decision.kept_addon_ids.append(addon_id)
        if addon_id in self._state.decision.removed_addon_ids:
            self._state.decision.removed_addon_ids = [item for item in self._state.decision.removed_addon_ids if item != addon_id]
        if addon_id in self._task.gold_removed_addon_ids:
            return (f"Keeping addon '{addon_id}' increases shopper spend unnecessarily.", -0.06)
        return (f"Keeping addon '{addon_id}' is acceptable.", 0.02)

    def _handle_flag_pattern(self, pattern) -> tuple[str, float]:
        if pattern is None:
            return ("No pattern supplied.", -0.06)
        existing = [item.value for item in self._state.decision.flagged_patterns]
        if pattern.value in existing:
            return (f"Pattern '{pattern.value}' was already flagged.", -0.03)
        self._state.decision.flagged_patterns.append(pattern)
        if pattern in self._task.gold_patterns:
            return (f"Correctly flagged pattern '{pattern.value}'.", 0.05)
        return (f"Flagged unsupported pattern '{pattern.value}'.", -0.05)

    def _handle_unflag_pattern(self, pattern) -> tuple[str, float]:
        if pattern is None:
            return ("No pattern supplied.", -0.05)
        existing = [item.value for item in self._state.decision.flagged_patterns]
        if pattern.value not in existing:
            return (f"Pattern '{pattern.value}' was not currently flagged.", -0.02)
        self._state.decision.flagged_patterns = [
            item for item in self._state.decision.flagged_patterns if item.value != pattern.value
        ]
        if pattern in self._task.gold_patterns:
            return (f"Removed a real dark pattern '{pattern.value}'.", -0.06)
        return (f"Removed an incorrect pattern '{pattern.value}'.", 0.03)

    def _handle_verify_timer(self, timer_id: str, timer_is_fake: bool) -> tuple[str, float]:
        known_ids = {timer.timer_id for timer in self._task.urgency_timers}
        if timer_id not in known_ids:
            return (f"Timer '{timer_id}' does not exist.", -0.06)
        self._state.decision.timer_verdicts[timer_id] = timer_is_fake
        if timer_id in self._task.gold_fake_timer_ids and timer_is_fake:
            return (f"Correctly marked timer '{timer_id}' as fake.", 0.06)
        if timer_id not in self._task.gold_fake_timer_ids and not timer_is_fake:
            return (f"Correctly kept timer '{timer_id}' as legitimate.", 0.04)
        return (f"Timer verdict for '{timer_id}' does not match the evidence.", -0.05)

    def _handle_set_true_total(self, estimated_true_total: float) -> tuple[str, float]:
        self._state.decision.estimated_true_total = round(estimated_true_total, 2)
        delta = abs(self._task.gold_true_total - estimated_true_total)
        if delta <= 0.5:
            return (f"Estimated true total set accurately to ${estimated_true_total:.2f}.", 0.08)
        if delta <= 5.0:
            return (f"Estimated true total is close at ${estimated_true_total:.2f}.", 0.03)
        return (f"Estimated true total ${estimated_true_total:.2f} is too far from the real checkout cost.", -0.04)

    def _handle_set_recommendation(self, recommendation) -> tuple[str, float]:
        if recommendation is None:
            return ("No shopper recommendation supplied.", -0.05)
        self._state.decision.recommendation = recommendation
        if recommendation == self._task.gold_recommendation:
            return (f"Recommendation '{recommendation.value}' matches the shopper outcome.", 0.06)
        return (f"Recommendation '{recommendation.value}' does not protect the shopper correctly.", -0.05)

    def _handle_write_summary(self, summary: str) -> tuple[str, float]:
        self._state.decision.summary = summary.strip()
        if not self._state.decision.summary:
            return ("Summary cleared.", -0.03)
        keyword_hits = sum(1 for keyword in self._task.summary_keywords if keyword.lower() in summary.lower())
        bonus = min(0.05, 0.01 * keyword_hits)
        return ("Updated shopper-facing summary.", bonus)

    def _describe_action(self, action: GuardianAction) -> str:
        if action.action_type == ActionType.INSPECT_SECTION:
            return f"inspect_section:{action.section_id}"
        if action.action_type in {ActionType.REMOVE_ADDON, ActionType.KEEP_ADDON}:
            return f"{action.action_type.value}:{action.addon_id}"
        if action.action_type in {ActionType.FLAG_PATTERN, ActionType.UNFLAG_PATTERN} and action.pattern:
            return f"{action.action_type.value}:{action.pattern.value}"
        if action.action_type == ActionType.VERIFY_TIMER:
            return f"verify_timer:{action.timer_id}:{action.timer_is_fake}"
        if action.action_type == ActionType.SET_TRUE_TOTAL:
            return f"set_true_total:{action.estimated_true_total}"
        if action.action_type == ActionType.SET_RECOMMENDATION and action.recommendation:
            return f"set_recommendation:{action.recommendation.value}"
        if action.action_type == ActionType.WRITE_SUMMARY:
            return "write_summary"
        return action.action_type.value
