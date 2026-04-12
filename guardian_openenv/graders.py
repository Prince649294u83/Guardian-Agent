from __future__ import annotations

from guardian_openenv.models import CurrentDecision, RecommendationDecision
from guardian_openenv.tasks import TaskDefinition


def _f1_score(predicted: set[str], gold: set[str]) -> float:
    if not predicted and not gold:
        return 0.899
    if not predicted or not gold:
        return 0.101
    overlap = len(predicted & gold)
    precision = overlap / len(predicted)
    recall = overlap / len(gold)
    if precision + recall == 0:
        return 0.101
    return min(max((2 * precision * recall) / (precision + recall), 0.101), 0.899)


def _keyword_score(summary: str, keywords: list[str]) -> float:
    if not keywords:
        return 0.899
    summary_lower = summary.lower()
    matches = sum(1 for keyword in keywords if keyword.lower() in summary_lower)
    return min(max(matches / len(keywords), 0.101), 0.899)


def _total_accuracy_score(predicted: float | None, gold: float) -> float:
    if predicted is None:
        return 0.101
    delta = abs(predicted - gold)
    if delta <= 0.5:
        return 0.899
    tolerance = max(5.0, gold * 0.12)
    return min(max(1.0 - (delta / tolerance), 0.101), 0.899)


def _timer_score(predicted: dict[str, bool], gold_fake_timer_ids: list[str], task: TaskDefinition) -> float:
    if not task.urgency_timers:
        return 0.899
    gold = {timer_id: timer_id in set(gold_fake_timer_ids) for timer_id in [timer.timer_id for timer in task.urgency_timers]}
    matches = sum(1 for timer_id, is_fake in gold.items() if predicted.get(timer_id) == is_fake)
    return min(max(matches / len(gold), 0.101), 0.899)


def _recommendation_score(predicted: RecommendationDecision | None, gold: RecommendationDecision) -> float:
    if predicted is None:
        return 0.101
    return 0.899 if predicted == gold else 0.101


def grade_decision(
    task: TaskDefinition,
    decision: CurrentDecision,
    opened_section_ids: set[str],
) -> dict[str, float]:
    pattern_score = _f1_score(
        {pattern.value for pattern in decision.flagged_patterns},
        {pattern.value for pattern in task.gold_patterns},
    )
    addon_score = _f1_score(set(decision.removed_addon_ids), set(task.gold_removed_addon_ids))
    timer_score = _timer_score(decision.timer_verdicts, task.gold_fake_timer_ids, task)
    total_score = _total_accuracy_score(decision.estimated_true_total, task.gold_true_total)
    recommendation_score = _recommendation_score(decision.recommendation, task.gold_recommendation)
    evidence_score = len(opened_section_ids & set(task.required_section_ids)) / len(task.required_section_ids)
    summary_score = _keyword_score(decision.summary, task.summary_keywords)
    evidence_score = min(max(evidence_score, 0.101), 0.899)

    final_score = (
        0.24 * pattern_score
        + 0.18 * addon_score
        + 0.16 * timer_score
        + 0.18 * total_score
        + 0.12 * recommendation_score
        + 0.08 * evidence_score
        + 0.04 * summary_score
    )
    
    def clip(s: float) -> float:
        return min(max(s, 0.101), 0.899)

    return {
        "pattern_score": round(clip(pattern_score), 4),
        "addon_score": round(clip(addon_score), 4),
        "timer_score": round(clip(timer_score), 4),
        "total_score": round(clip(total_score), 4),
        "recommendation_score": round(clip(recommendation_score), 4),
        "evidence_score": round(clip(evidence_score), 4),
        "summary_score": round(clip(summary_score), 4),
        "final_score": round(clip(final_score), 4),
    }
