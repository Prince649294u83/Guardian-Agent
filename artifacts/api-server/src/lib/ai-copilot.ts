type ScanReport = Record<string, any>;
type FeeEstimate = Record<string, any>;
type MissionPayload = Record<string, any>;

function cleanText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMoney(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric == null) return "--";
  return `$${numeric.toFixed(2)}`;
}

export function buildScanCopilot(input: {
  domain: string;
  url?: string;
  pageText?: string;
  darkPatternReport: ScanReport;
  trustRating?: { score?: number; tier?: string } | null;
}) {
  const report = input.darkPatternReport ?? {};
  const detected: Array<{ label: string; explanation: string }> = [];

  if (report.falseUrgency?.detected) {
    detected.push({
      label: "False urgency",
      explanation: cleanText(report.falseUrgency?.evidence, "The page uses time pressure to rush the decision."),
    });
  }
  if (report.falseScarcity?.detected) {
    detected.push({
      label: "False scarcity",
      explanation: cleanText(report.falseScarcity?.evidence, "The page suggests stock pressure or crowd pressure."),
    });
  }
  if (report.confirmShaming?.detected) {
    detected.push({
      label: "Confirm shaming",
      explanation: cleanText(report.confirmShaming?.shamingText, "The decline path uses guilt-inducing copy."),
    });
  }
  if (report.hiddenFees?.detected) {
    const fees = Array.isArray(report.hiddenFees?.feeItems)
      ? report.hiddenFees.feeItems.map((fee: any) => `${fee.label} ${formatMoney(fee.amount)}`).join(", ")
      : "";
    detected.push({
      label: "Hidden fees",
      explanation: fees || "The page appears to hold back mandatory price information until later in checkout.",
    });
  }
  if (report.preCheckedAddOns?.detected) {
    detected.push({
      label: "Pre-checked add-ons",
      explanation: cleanText(
        Array.isArray(report.preCheckedAddOns?.addOnLabels) ? report.preCheckedAddOns.addOnLabels.join(", ") : "",
        "Optional extras are already selected for the shopper.",
      ),
    });
  }
  if (report.misdirection?.detected) {
    detected.push({
      label: "Misdirection",
      explanation: cleanText(report.misdirection?.hiddenDeclineText, "The safer or cheaper path is visually deprioritized."),
    });
  }

  const trustScore = report.trustScore ?? input.trustRating?.score ?? 50;
  const headline =
    detected.length === 0
      ? `Guardian thinks ${input.domain} looks relatively clean from the submitted checkout content.`
      : `Guardian thinks ${input.domain} is using ${detected.length} manipulation signal${detected.length === 1 ? "" : "s"}.`;

  const recommendation =
    detected.length === 0
      ? "Proceed, but keep Guardian active through the final confirmation step."
      : detected.length >= 3
        ? "Slow down, verify the total, and look for a cleaner alternative before buying."
        : "Proceed cautiously and remove optional extras before continuing.";

  return {
    mode: "scan",
    headline,
    confidence:
      detected.length === 0 ? "medium" : detected.length >= 3 ? "high" : "medium",
    inputSummary: `Input reviewed for ${input.domain}${input.url ? ` at ${input.url}` : ""}.`,
    reasoning: detected.length
      ? detected.map((item) => `${item.label}: ${item.explanation}`)
      : ["No major dark-pattern signature was triggered in the submitted checkout content."],
    recommendation,
    trustScore,
    followUps:
      detected.length === 0
        ? ["Keep watching for last-second fees at the payment step."]
        : [
            "Check whether the final payable amount matches the first quoted price.",
            "Look for a neutral decline path and remove any default-on add-ons.",
          ],
  };
}

export function buildFeeCopilot(input: {
  domain: string;
  merchantType: string;
  listedPrice: number;
  result: FeeEstimate;
}) {
  const estimatedTotal = asNumber(input.result?.estimatedTotal) ?? input.listedPrice;
  const savingsOpportunity = asNumber(input.result?.savingsOpportunity) ?? Math.max(0, estimatedTotal - input.listedPrice);
  const breakdown = Array.isArray(input.result?.feeBreakdown)
    ? input.result.feeBreakdown.map((fee: any) => `${fee.label} ${formatMoney(fee.amount)}`)
    : [];

  return {
    mode: "fee_estimate",
    headline: `Guardian thinks the advertised ${formatMoney(input.listedPrice)} on ${input.domain} is likely to end closer to ${formatMoney(estimatedTotal)}.`,
    confidence: cleanText(input.result?.confidence, "medium"),
    inputSummary: `Input reviewed for ${input.domain} in the ${input.merchantType} category.`,
    reasoning: [
      breakdown.length
        ? `Likely hidden cost layers: ${breakdown.join(", ")}.`
        : "Guardian expects taxes, surcharges, or service fees beyond the headline price.",
      `Modeled uplift over headline price: ${formatMoney(savingsOpportunity)}.`,
    ],
    recommendation:
      savingsOpportunity <= 0
        ? "The listed price looks close to the real total."
        : savingsOpportunity / Math.max(input.listedPrice, 1) > 0.2
          ? "Treat this as a high-risk price gap and compare alternatives before checkout."
          : "Proceed with caution and verify the fee breakdown before paying.",
    trustScore: null,
    followUps: [
      "Try a full mission run on the merchant to verify the true payable amount.",
      "Look for the same product or booking on a cleaner alternative site.",
    ],
  };
}

export function buildMissionCopilot(input: {
  domain: string;
  purchaseGoal: string;
  mission: MissionPayload;
}) {
  const recommendation = cleanText(input.mission?.recommendation, "proceed");
  const trustScore = asNumber(input.mission?.trust?.score);
  const signals = Array.isArray(input.mission?.manipulativeSignals) ? input.mission.manipulativeSignals : [];
  const alternatives = Array.isArray(input.mission?.alternatives) ? input.mission.alternatives : [];
  const dealItems = Array.isArray(input.mission?.dealIntelligence?.items) ? input.mission.dealIntelligence.items : [];
  const misleadingDeals = dealItems.filter((item: any) => item?.status === "likely_misleading");
  const isShoppingPage = input.mission?.commerceIntent?.isShoppingPage !== false;

  return {
    mode: "mission",
    headline: isShoppingPage
      ? `Guardian thinks the best next move for ${input.domain} is to ${recommendation.replaceAll("_", " ")}.`
      : `Guardian thinks ${input.domain} is not a shopping flow, so it should not run checkout automation here.`,
    confidence: isShoppingPage ? "high" : "high",
    inputSummary: `Goal understood: ${input.purchaseGoal}`,
    reasoning: isShoppingPage
      ? [
          cleanText(input.mission?.trust?.verdict, "Guardian evaluated the trust posture of the current merchant."),
          signals.length
            ? `Main manipulation signals: ${signals.slice(0, 3).map((signal: any) => signal.label).join(", ")}.`
            : "No major manipulation signature was triggered for the current merchant profile.",
          alternatives.length
            ? `Guardian found ${alternatives.length} alternative site option${alternatives.length === 1 ? "" : "s"} for comparison.`
            : "No alternative sites were returned for this mission.",
          dealItems.length
            ? misleadingDeals.length
              ? `Deal-authenticity check flagged ${misleadingDeals.length} likely misleading limited-deal claim${misleadingDeals.length === 1 ? "" : "s"}.`
              : "Deal-authenticity check did not find high-confidence misleading claim patterns."
            : "No product-level deal cards were available for authenticity scoring.",
        ]
      : [cleanText(input.mission?.commerceIntent?.reason, "No checkout signals were detected on the current page.")],
    recommendation: cleanText(input.mission?.nextBestAction, "Keep Guardian active through checkout."),
    trustScore,
    followUps: isShoppingPage
      ? [
          "Approve account creation only if the site remains the best option after comparison.",
          "Keep Guardian active until the final payment step to catch late fees.",
        ]
      : ["Open a product, cart, booking, or checkout page before rerunning the mission."],
  };
}
