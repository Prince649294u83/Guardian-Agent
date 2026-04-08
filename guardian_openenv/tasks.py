from __future__ import annotations

from pydantic import BaseModel, Field

from guardian_openenv.models import (
    AlertSignal,
    PatternLabel,
    PriceLineItem,
    RecommendationDecision,
    SectionDetail,
    TimerSignal,
)


class TaskDefinition(BaseModel):
    task_id: str
    difficulty: str
    title: str
    objective: str
    merchant: str
    checkout_url: str
    category: str
    shopper_goal: str
    budget: float
    listed_price: float
    visible_cart: list[PriceLineItem]
    optional_addons: list[PriceLineItem]
    urgency_timers: list[TimerSignal]
    pressure_signals: list[AlertSignal]
    sections: list[SectionDetail]
    gold_patterns: list[PatternLabel]
    gold_removed_addon_ids: list[str]
    gold_fake_timer_ids: list[str]
    gold_true_total: float
    gold_recommendation: RecommendationDecision
    required_section_ids: list[str]
    summary_keywords: list[str] = Field(default_factory=list)
    max_steps: int = 10


TASKS: list[TaskDefinition] = [
    TaskDefinition(
        task_id="value-hotel-budget-guard",
        difficulty="easy",
        title="Protect a hotel shopper from hidden fees and FOMO",
        objective=(
            "Act like a manipulation blocker for a hotel shopper. Inspect the checkout, strip unnecessary add-ons, "
            "verify whether urgency claims are fake, estimate the true final price against the shopper budget, "
            "and decide if the shopper should proceed."
        ),
        merchant="booking.com",
        checkout_url="https://booking.com/hotel/paradise-resort/checkout",
        category="hotel",
        shopper_goal="Keep Sarah under a $200 one-night stay budget without missing mandatory costs.",
        budget=200.0,
        listed_price=165.0,
        visible_cart=[
            PriceLineItem(item_id="room", label="Standard Room", amount=165.0, mandatory=True, category="base"),
            PriceLineItem(item_id="tax", label="Tax", amount=22.0, mandatory=True, category="fee"),
        ],
        optional_addons=[
            PriceLineItem(item_id="insurance", label="Travel Insurance", amount=24.99, mandatory=False, category="addon"),
            PriceLineItem(item_id="newsletter", label="Marketing Newsletter Bundle", amount=0.0, mandatory=False, category="addon"),
        ],
        urgency_timers=[
            TimerSignal(timer_id="timer-checkout", label="Discount expires in 05:00"),
        ],
        pressure_signals=[
            AlertSignal(alert_id="scarcity", text="Only 1 room left at this price!"),
            AlertSignal(alert_id="social-proof", text="42 people are viewing this room right now."),
        ],
        sections=[
            SectionDetail(
                section_id="listing-banner",
                title="Listing banner",
                content=(
                    "The banner says 'Only 1 room left at this price' and '42 people are viewing this room right now'. "
                    "Inventory logs attached to the DOM comments show five rooms in the same class still available."
                ),
            ),
            SectionDetail(
                section_id="price-summary",
                title="Price summary",
                content=(
                    "The hotel is advertised at $165. The final payment drawer later adds a $15.40 sustainability fee "
                    "and a $10 city resort fee after guest details are entered."
                ),
            ),
            SectionDetail(
                section_id="addons",
                title="Upsell section",
                content=(
                    "Travel insurance for $24.99 is pre-checked. The newsletter bundle is also pre-selected by default."
                ),
            ),
            SectionDetail(
                section_id="timer-proof",
                title="Timer verification log",
                content=(
                    "The countdown resets to 05:00 on refresh and the same discount remains available for at least 30 minutes."
                ),
            ),
        ],
        gold_patterns=[
            PatternLabel.FALSE_URGENCY,
            PatternLabel.FALSE_SCARCITY,
            PatternLabel.HIDDEN_FEES,
            PatternLabel.PRECHECKED_ADDONS,
        ],
        gold_removed_addon_ids=["insurance", "newsletter"],
        gold_fake_timer_ids=["timer-checkout"],
        gold_true_total=212.39,
        gold_recommendation=RecommendationDecision.AVOID,
        required_section_ids=["listing-banner", "price-summary", "addons", "timer-proof"],
        summary_keywords=["budget", "hidden fee", "timer", "pre-checked"],
        max_steps=15,
    ),
    TaskDefinition(
        task_id="airline-seat-upsell-gauntlet",
        difficulty="medium",
        title="Navigate an airline upsell funnel before purchase",
        objective=(
            "Protect the traveler from a seat-selection upsell gauntlet. Identify dark patterns, remove unnecessary extras, "
            "judge whether the countdown is fake, calculate the true checkout total, and recommend whether to continue."
        ),
        merchant="united.com",
        checkout_url="https://united.com/checkout/seats",
        category="airline",
        shopper_goal="Keep the flight near a $260 trip budget while preserving refundable options.",
        budget=260.0,
        listed_price=189.0,
        visible_cart=[
            PriceLineItem(item_id="fare", label="Base Fare", amount=189.0, mandatory=True, category="base"),
            PriceLineItem(item_id="taxes", label="Taxes and Airport Fees", amount=42.98, mandatory=True, category="fee"),
            PriceLineItem(item_id="carryon", label="Carry-on Baggage", amount=45.0, mandatory=True, category="fee"),
        ],
        optional_addons=[
            PriceLineItem(item_id="travelguard", label="TravelGuard Premium Protection", amount=42.99, mandatory=False, category="addon"),
            PriceLineItem(item_id="fasttrack", label="Airport Fast Track", amount=19.99, mandatory=False, category="addon"),
            PriceLineItem(item_id="seatplus", label="Premium Seat Selection", amount=45.0, mandatory=False, category="addon"),
        ],
        urgency_timers=[
            TimerSignal(timer_id="fare-lock", label="Price lock ends in 12:34"),
        ],
        pressure_signals=[
            AlertSignal(alert_id="scarcity", text="Only 3 premium economy seats remaining."),
            AlertSignal(alert_id="shaming", text="I accept the risk of traveling without protection."),
        ],
        sections=[
            SectionDetail(
                section_id="fare-lock-panel",
                title="Fare lock panel",
                content=(
                    "The page claims the fare expires in 12:34, but QA replay shows the timer restarts and the same fare persists."
                ),
            ),
            SectionDetail(
                section_id="seat-map",
                title="Seat map and checkout CTA",
                content=(
                    "Premium seats are highlighted while the free basic seat is hidden in a small low-contrast link below the main CTA."
                ),
            ),
            SectionDetail(
                section_id="insurance-upsell",
                title="Insurance and fast-track options",
                content=(
                    "TravelGuard Premium Protection and Airport Fast Track both load pre-checked by default."
                ),
            ),
            SectionDetail(
                section_id="final-price",
                title="True price breakdown",
                content=(
                    "Mandatory price is $276.98 before optional add-ons. Accepting all extras pushes the total to $384.96."
                ),
            ),
        ],
        gold_patterns=[
            PatternLabel.FALSE_URGENCY,
            PatternLabel.FALSE_SCARCITY,
            PatternLabel.PRECHECKED_ADDONS,
            PatternLabel.MISDIRECTION,
            PatternLabel.CONFIRM_SHAMING,
        ],
        gold_removed_addon_ids=["travelguard", "fasttrack", "seatplus"],
        gold_fake_timer_ids=["fare-lock"],
        gold_true_total=276.98,
        gold_recommendation=RecommendationDecision.AVOID,
        required_section_ids=["fare-lock-panel", "seat-map", "insurance-upsell", "final-price"],
        summary_keywords=["budget", "seat", "protection", "fare lock"],
        max_steps=16,
    ),
    TaskDefinition(
        task_id="marketplace-ghost-checkout",
        difficulty="hard",
        title="Run a ghost checkout before the shopper commits",
        objective=(
            "Behave like a premium manipulation blocker. Use the checkout evidence to uncover late fees, spot fake scarcity, "
            "remove optional upsells, verify timers, and determine the real final total before the shopper falls for sunk-cost pressure."
        ),
        merchant="marketplace.example",
        checkout_url="https://marketplace.example/checkout",
        category="marketplace",
        shopper_goal="Help the shopper stay within a $150 gadget budget and avoid manipulative upsells.",
        budget=150.0,
        listed_price=129.99,
        visible_cart=[
            PriceLineItem(item_id="console", label="Refurbished Handheld Console", amount=129.99, mandatory=True, category="base"),
            PriceLineItem(item_id="shipping", label="Shipping and Handling", amount=9.99, mandatory=True, category="fee"),
        ],
        optional_addons=[
            PriceLineItem(item_id="protection-plan", label="2-Year Protection Plan", amount=18.0, mandatory=False, category="addon"),
            PriceLineItem(item_id="seller-donation", label="Round-up Donation", amount=3.0, mandatory=False, category="addon"),
            PriceLineItem(item_id="priority-support", label="Priority Support Trial", amount=7.5, mandatory=False, category="addon"),
        ],
        urgency_timers=[
            TimerSignal(timer_id="deal-timer", label="Flash deal ends in 03:00"),
        ],
        pressure_signals=[
            AlertSignal(alert_id="stock", text="Only 2 left in stock."),
            AlertSignal(alert_id="social", text="18 people purchased this in the last hour."),
            AlertSignal(alert_id="decline-copy", text="No thanks, I don't care about protecting my order."),
        ],
        sections=[
            SectionDetail(
                section_id="product-banner",
                title="Product banner",
                content=(
                    "The hero area claims 'Only 2 left in stock' and displays a three-minute flash-deal timer."
                ),
            ),
            SectionDetail(
                section_id="inventory-proof",
                title="Inventory proof",
                content=(
                    "The merchant API response embedded in a script tag lists 14 units still available. The timer resets when the cart drawer is reopened."
                ),
            ),
            SectionDetail(
                section_id="ghost-checkout",
                title="Ghost checkout result",
                content=(
                    "A hidden payment step reveals a mandatory marketplace buyer fee of $12.50 and payment processing fee of $4.25 that were absent earlier."
                ),
            ),
            SectionDetail(
                section_id="upsell-stack",
                title="Upsell stack",
                content=(
                    "Protection plan, seller donation, and priority support trial are all checked by default. The skip link is low-contrast and tucked below legal copy."
                ),
            ),
            SectionDetail(
                section_id="terms-review",
                title="Terms review",
                content=(
                    "The final total without optional add-ons is $156.73, which exceeds the shopper's stated budget."
                ),
            ),
        ],
        gold_patterns=[
            PatternLabel.FALSE_URGENCY,
            PatternLabel.FALSE_SCARCITY,
            PatternLabel.HIDDEN_FEES,
            PatternLabel.PRECHECKED_ADDONS,
            PatternLabel.MISDIRECTION,
            PatternLabel.CONFIRM_SHAMING,
        ],
        gold_removed_addon_ids=["protection-plan", "seller-donation", "priority-support"],
        gold_fake_timer_ids=["deal-timer"],
        gold_true_total=156.73,
        gold_recommendation=RecommendationDecision.AVOID,
        required_section_ids=["inventory-proof", "ghost-checkout", "upsell-stack", "terms-review"],
        summary_keywords=["budget", "ghost checkout", "buyer fee", "timer"],
        max_steps=18,
    ),
]


TASKS_BY_ID = {task.task_id: task for task in TASKS}
