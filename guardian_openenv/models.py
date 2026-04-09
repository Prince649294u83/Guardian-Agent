from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class PatternLabel(str, Enum):
    FALSE_URGENCY = "false_urgency"
    FALSE_SCARCITY = "false_scarcity"
    CONFIRM_SHAMING = "confirm_shaming"
    HIDDEN_FEES = "hidden_fees"
    PRECHECKED_ADDONS = "prechecked_addons"
    MISDIRECTION = "misdirection"


class RecommendationDecision(str, Enum):
    BUY = "buy"
    BUY_WITH_CAUTION = "buy_with_caution"
    AVOID = "avoid"


class ActionType(str, Enum):
    INSPECT_SECTION = "inspect_section"
    REMOVE_ADDON = "remove_addon"
    KEEP_ADDON = "keep_addon"
    FLAG_PATTERN = "flag_pattern"
    UNFLAG_PATTERN = "unflag_pattern"
    VERIFY_TIMER = "verify_timer"
    SET_TRUE_TOTAL = "set_true_total"
    SET_RECOMMENDATION = "set_recommendation"
    WRITE_SUMMARY = "write_summary"
    SUBMIT_DECISION = "submit_decision"


class RewardComponent(BaseModel):
    name: str
    value: float = Field(ge=-1.0, le=1.0)
    reason: str


class GuardianReward(BaseModel):
    value: float = Field(ge=-1.0, le=1.0)
    score: float = Field(gt=0.0, lt=1.0)
    components: list[RewardComponent] = Field(default_factory=list)
    reason: str


class PriceLineItem(BaseModel):
    item_id: str
    label: str
    amount: float = Field(ge=0.0)
    mandatory: bool
    category: Literal["base", "fee", "addon"]


class SectionIndexItem(BaseModel):
    section_id: str
    title: str


class SectionDetail(BaseModel):
    section_id: str
    title: str
    content: str


class TimerSignal(BaseModel):
    timer_id: str
    label: str


class AlertSignal(BaseModel):
    alert_id: str
    text: str


class ShopperContext(BaseModel):
    merchant: str
    checkout_url: str
    category: str
    shopper_goal: str
    budget: float = Field(gt=0.0)
    listed_price: float = Field(ge=0.0)


class CurrentDecision(BaseModel):
    flagged_patterns: list[PatternLabel] = Field(default_factory=list)
    removed_addon_ids: list[str] = Field(default_factory=list)
    kept_addon_ids: list[str] = Field(default_factory=list)
    timer_verdicts: dict[str, bool] = Field(default_factory=dict)
    estimated_true_total: float | None = Field(default=None, ge=0.0)
    recommendation: RecommendationDecision | None = None
    summary: str = ""


class GuardianObservation(BaseModel):
    task_id: str
    difficulty: Literal["easy", "medium", "hard"]
    objective: str
    shopper_context: ShopperContext
    visible_cart: list[PriceLineItem]
    optional_addons: list[PriceLineItem]
    urgency_timers: list[TimerSignal]
    pressure_signals: list[AlertSignal]
    section_index: list[SectionIndexItem]
    opened_section: SectionDetail | None = None
    current_decision: CurrentDecision
    remaining_steps: int = Field(ge=0)
    last_action_message: str
    action_history: list[str] = Field(default_factory=list)
    done: bool = False


class GuardianState(BaseModel):
    task_id: str
    difficulty: Literal["easy", "medium", "hard"]
    step_count: int = Field(ge=0)
    max_steps: int = Field(gt=0)
    opened_section_ids: list[str] = Field(default_factory=list)
    decision: CurrentDecision
    done: bool = False
    cumulative_reward: float = 0.0


class GuardianAction(BaseModel):
    action_type: ActionType
    section_id: str | None = None
    addon_id: str | None = None
    pattern: PatternLabel | None = None
    timer_id: str | None = None
    timer_is_fake: bool | None = None
    estimated_true_total: float | None = Field(default=None, ge=0.0)
    recommendation: RecommendationDecision | None = None
    summary: str | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "GuardianAction":
        if self.action_type == ActionType.INSPECT_SECTION and not self.section_id:
            raise ValueError("inspect_section requires section_id")
        if self.action_type in {ActionType.REMOVE_ADDON, ActionType.KEEP_ADDON} and not self.addon_id:
            raise ValueError(f"{self.action_type.value} requires addon_id")
        if self.action_type in {ActionType.FLAG_PATTERN, ActionType.UNFLAG_PATTERN} and not self.pattern:
            raise ValueError(f"{self.action_type.value} requires pattern")
        if self.action_type == ActionType.VERIFY_TIMER and (not self.timer_id or self.timer_is_fake is None):
            raise ValueError("verify_timer requires timer_id and timer_is_fake")
        if self.action_type == ActionType.SET_TRUE_TOTAL and self.estimated_true_total is None:
            raise ValueError("set_true_total requires estimated_true_total")
        if self.action_type == ActionType.SET_RECOMMENDATION and self.recommendation is None:
            raise ValueError("set_recommendation requires recommendation")
        if self.action_type == ActionType.WRITE_SUMMARY and self.summary is None:
            raise ValueError("write_summary requires summary")
        return self


class StepResult(BaseModel):
    observation: GuardianObservation
    reward: GuardianReward
    done: bool
    info: dict = Field(default_factory=dict)


class BaselineEpisodeResult(BaseModel):
    task_id: str
    difficulty: Literal["easy", "medium", "hard"]
    final_score: float = Field(gt=0.0, lt=1.0)
    total_reward: float
    steps_taken: int = Field(ge=0)
    final_decision: CurrentDecision
    grader_breakdown: dict[str, float]


class BaselineRunSummary(BaseModel):
    model: str
    tasks: list[BaselineEpisodeResult]
    mean_score: float = Field(gt=0.0, lt=1.0)

    @field_validator("mean_score")
    @classmethod
    def round_score(cls, value: float) -> float:
        return round(value, 4)
