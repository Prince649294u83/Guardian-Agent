type VerificationStatus = "verified" | "unverified" | "likely_misleading";
type Confidence = "high" | "medium" | "low";
type Reality = "REAL" | "FAKE" | "UNCERTAIN";
type DealQuality = "GOOD" | "AVERAGE" | "BAD";
type FinalAdvice = "ACT_FAST" | "COMPARE_OPTIONS" | "RELAX_IGNORE";
type CheckOutcome = "real_signal" | "fake_signal" | "inconclusive";

export type DealSignalType = "limited_time" | "limited_stock" | "high_demand" | "flash_sale";

export type ProductCandidateInput = {
  title: string;
  listedPrice?: number | null;
  originalPrice?: number | null;
  historicalMinPrice?: number | null;
  currency?: string | null;
  url?: string | null;
  dealSignals?: string[] | null;
  stockText?: string | null;
  urgencyText?: string | null;
  hasTimer?: boolean | null;
  timerResetsOnRefresh?: boolean | null;
  reloadStockChanges?: boolean | null;
  crossPlatformMatch?: boolean | null;
  historySnapshot?: {
    observations?: number;
    scarcityClaimRate?: number;
    uniquePricePoints?: number;
    lastSeenAt?: string | null;
  } | null;
};

export type DealItemResult = {
  productTitle: string;
  listedPrice: number | null;
  currency: string;
  status: VerificationStatus;
  confidence: Confidence;
  claimSignals: DealSignalType[];
  evidence: string[];
  rationale: string;
  recommendation: string;
  saferAlternatives: string[];
  trustVerification: {
    reality: Reality;
    confidence: Confidence;
    confidence_score: number;
    fomo_detected: boolean;
    deal_quality: DealQuality;
    final_advice: FinalAdvice;
    checks: {
      pattern_check: CheckOutcome;
      stability_check: CheckOutcome;
      reset_check: CheckOutcome;
      external_validation: CheckOutcome;
      price_truth_check: CheckOutcome;
    };
    signal_tally: {
      strong_fake: number;
      strong_real: number;
    };
    reasoning: string[];
  };
};

export type DealIntelligenceResult = {
  summary: string;
  researchMode: "page_evidence_only" | "provider_verified";
  items: DealItemResult[];
};

export type DealIntelligenceInput = {
  domain: string;
  url?: string;
  pageType?: "non_commerce" | "product" | "cart" | "checkout" | "listing" | "unknown" | string;
  pageText?: string;
  hasTimer?: boolean | null;
  timerResetsOnRefresh?: boolean | null;
  reloadStockChanges?: boolean | null;
  timerElements?: string[];
  stockAlerts?: string[];
  variantUrgency?: string[];
  productCandidates?: ProductCandidateInput[];
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function toLowerJoined(values: unknown[] | undefined): string {
  return (values ?? [])
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function parseSignalsFromText(text: string): DealSignalType[] {
  const signals: DealSignalType[] = [];
  if (/limited time|deal ends|ends in|expires|flash sale|today only|offer ends/i.test(text)) {
    signals.push("limited_time");
  }
  if (/only \d+|remaining|left at this price|few seats left|few rooms left/i.test(text)) {
    signals.push("limited_stock");
  }
  if (/people viewing|booked in the last|sold in last|high demand|trending now/i.test(text)) {
    signals.push("high_demand");
  }
  if (/flash sale|lightning deal|mega deal|limited deal/i.test(text)) {
    signals.push("flash_sale");
  }
  return Array.from(new Set(signals));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function defaultAlternativeDomains(domain: string): string[] {
  const key = normalizeText(domain).toLowerCase();
  if (key.includes("amazon")) return ["walmart.com", "bestbuy.com", "target.com"];
  if (key.includes("booking") || key.includes("trip") || key.includes("makemytrip")) return ["agoda.com", "goibibo.com", "hotels.com"];
  if (key.includes("air") || key.includes("flight")) return ["skyscanner.com", "kayak.com", "google.com/travel/flights"];
  return [];
}

function parseStockNumber(text: string): number | null {
  const match = text.match(/\bonly\s+(\d+)\b|\b(\d+)\s+(left|remaining)\b/i);
  if (!match) return null;
  const value = Number(match[1] || match[2]);
  return Number.isFinite(value) ? value : null;
}

function inferPriceFluctuation(uniquePricePoints: number): "high" | "medium" | "low" {
  if (uniquePricePoints >= 3) return "high";
  if (uniquePricePoints === 2) return "medium";
  return "low";
}

function inferHistoricalScarcityFrequency(scarcityClaimRate: number): "high" | "medium" | "low" {
  if (scarcityClaimRate >= 0.7) return "high";
  if (scarcityClaimRate >= 0.35) return "medium";
  return "low";
}

function mapTrustVerification(input: {
  urgency_text: string;
  stock_text: string;
  stock_number: number | null;
  has_timer: boolean;
  timer_resets_on_refresh: boolean | null;
  same_urgency_count: number;
  same_discount_count: number;
  appears_in_listing: boolean;
  appears_in_product_page: boolean;
  reload_stock_changes: boolean | null;
  cross_platform_match: boolean | null;
  price_current: number | null;
  price_original: number | null;
  price_history_min: number | null;
  price_fluctuation: "high" | "medium" | "low";
  historical_scarcity_frequency: "high" | "medium" | "low";
  page_type?: string | null;
}): DealItemResult["trustVerification"] {
  const reasons: string[] = [];
  let strongFakeSignals = 0;
  let strongRealSignals = 0;
  const checks: DealItemResult["trustVerification"]["checks"] = {
    pattern_check: "inconclusive",
    stability_check: "inconclusive",
    reset_check: "inconclusive",
    external_validation: "inconclusive",
    price_truth_check: "inconclusive",
  };

  // 1. Pattern check
  if (input.same_urgency_count >= 3 || input.same_discount_count >= 3) {
    strongFakeSignals += 1;
    checks.pattern_check = "fake_signal";
    reasons.push("The same urgency/discount framing appears across many products, which is a strong manufactured-pressure signal.");
  } else if (input.same_urgency_count <= 1 && input.same_discount_count <= 1 && (input.stock_number ?? 0) > 0) {
    strongRealSignals += 1;
    checks.pattern_check = "real_signal";
    reasons.push("Urgency appears item-specific instead of being repeated across many products.");
  }

  // 2. Specificity check
  if (input.stock_number !== null) {
    strongRealSignals += 1;
    reasons.push("The scarcity claim includes an exact stock count, which is more concrete than vague pressure text.");
  } else if (/\bfew left|selling fast|hurry|almost gone\b/i.test(input.stock_text)) {
    strongFakeSignals += 1;
    reasons.push("The scarcity text is vague ('few left' / 'selling fast') and not tied to a verifiable count.");
  }

  // 3. Time/stability check
  if (input.reload_stock_changes === false) {
    strongFakeSignals += 1;
    checks.stability_check = "fake_signal";
    reasons.push("Scarcity/urgency signals stayed static across observations, which weakens authenticity.");
  } else if (input.reload_stock_changes === true) {
    strongRealSignals += 1;
    checks.stability_check = "real_signal";
    reasons.push("Stock/urgency changed over time in a way that can indicate real inventory dynamics.");
  }

  // 4. Reset check
  if (input.timer_resets_on_refresh === true) {
    strongFakeSignals += 2;
    checks.reset_check = "fake_signal";
    reasons.push("The timer appears to reset on refresh, which is a very strong fake-urgency behavior.");
  } else if (input.has_timer && input.timer_resets_on_refresh === false) {
    strongRealSignals += 1;
    checks.reset_check = "real_signal";
    reasons.push("The timer does not reset across refresh checks, which supports authenticity.");
  }

  // 5. Cross-page check
  if (input.appears_in_listing && !input.appears_in_product_page) {
    strongFakeSignals += 1;
    reasons.push("Urgency appears in listing context but not on the product detail page, suggesting promo framing rather than item-specific scarcity.");
  } else if (input.appears_in_product_page) {
    strongRealSignals += 1;
    reasons.push("The urgency/scarcity signal is present on the product detail page, not only in listing cards.");
  }

  // 6. Cross-platform check
  if (input.cross_platform_match === false) {
    strongFakeSignals += 1;
    checks.external_validation = "fake_signal";
    reasons.push("Cross-platform checks did not confirm the same scarcity narrative.");
  } else if (input.cross_platform_match === true) {
    strongRealSignals += 1;
    checks.external_validation = "real_signal";
    reasons.push("Cross-platform checks show similar scarcity signals, which supports authenticity.");
  }

  // 7. Price validation
  let dealQuality: DealQuality = "AVERAGE";
  if (input.price_current !== null && input.price_history_min !== null) {
    const delta = input.price_current - input.price_history_min;
    if (delta <= Math.max(1, input.price_history_min * 0.05)) {
      dealQuality = "GOOD";
      checks.price_truth_check = "real_signal";
      reasons.push("Current price is close to the observed historical minimum, so the deal quality looks strong.");
    } else if (input.price_fluctuation === "high") {
      dealQuality = "BAD";
      checks.price_truth_check = "fake_signal";
      reasons.push("Price behavior is highly volatile, reducing reliability of the advertised discount.");
    }
  } else if (input.price_fluctuation === "high") {
    dealQuality = "BAD";
    checks.price_truth_check = "fake_signal";
    reasons.push("Price fluctuations are high and historical floor is unclear, so this deal is not reliably strong.");
  }

  if (input.price_current !== null && input.price_original !== null && input.price_current >= input.price_original * 0.9) {
    strongFakeSignals += 1;
    dealQuality = "BAD";
    checks.price_truth_check = "fake_signal";
    reasons.push("The claimed original price is close to current price, which weakens the credibility of the discount framing.");
  }

  // 8. History check
  if (input.historical_scarcity_frequency === "high") {
    strongFakeSignals += 1;
    reasons.push("Historical observations show frequent recurring scarcity claims for this item, indicating likely persistent pressure tactics.");
  } else if (input.historical_scarcity_frequency === "low" && input.stock_number !== null) {
    strongRealSignals += 1;
    reasons.push("Scarcity signaling is not continuously repeated in history and includes specific stock information.");
  }

  // Positive trust signals for clean product/checkout flows.
  if ((input.page_type === "checkout" || input.page_type === "product") && !input.urgency_text && !input.stock_text) {
    strongRealSignals += 1;
    reasons.push("Clean product/checkout flow with no pressure tactics detected on the page.");
  }
  if (!input.has_timer) {
    strongRealSignals += 1;
    reasons.push("No countdown timer was detected, which reduces the chance of artificial urgency.");
  }
  if (input.timer_resets_on_refresh === false) {
    strongRealSignals += 1;
    reasons.push("Timer behavior stayed consistent across refresh checks.");
  }
  if (input.reload_stock_changes === false && input.stock_text) {
    strongRealSignals += 1;
    reasons.push("Stock message stayed stable across reload checks instead of fluctuating upward.");
  }

  const reality: Reality =
    strongFakeSignals >= 3 ? "FAKE" : strongRealSignals > strongFakeSignals && strongFakeSignals === 0 ? "REAL" : "UNCERTAIN";

  const confidence: Confidence =
    Math.abs(strongRealSignals - strongFakeSignals) >= 3 ? "high" : Math.abs(strongRealSignals - strongFakeSignals) >= 1 ? "medium" : "low";
  const confidenceScore = Math.min(1, Math.max(0, 0.5 + (strongRealSignals - strongFakeSignals) * 0.12));

  const fomoDetected =
    /\blimited|hurry|few left|last chance|selling fast|ends in|expires|only \d+\b/i.test(`${input.urgency_text} ${input.stock_text}`) ||
    input.has_timer;

  const finalAdvice: FinalAdvice =
    reality === "REAL" && dealQuality !== "BAD"
      ? "ACT_FAST"
      : reality === "FAKE"
        ? "RELAX_IGNORE"
        : "COMPARE_OPTIONS";

  if (reasons.length === 0) {
    reasons.push("Evidence is insufficient to verify whether urgency is genuine, so this is treated as uncertain.");
  }

  return {
    reality,
    confidence,
    confidence_score: Number(confidenceScore.toFixed(2)),
    fomo_detected: fomoDetected,
    deal_quality: dealQuality,
    final_advice: finalAdvice,
    checks,
    signal_tally: {
      strong_fake: strongFakeSignals,
      strong_real: strongRealSignals,
    },
    reasoning: reasons.slice(0, 6),
  };
}

function evaluateSingleDeal(input: {
  productTitle: string;
  listedPrice: number | null;
  currency: string;
  url?: string | null;
  candidateSignals: DealSignalType[];
  urgencyText: string;
  pageSignals: DealSignalType[];
  timerText: string;
  stockText: string;
  pageText: string;
  domain: string;
  repeatedClaimPressure: boolean;
  historySignalPressure: boolean;
  priceInstabilitySignal: boolean;
  sameUrgencyCount: number;
  sameDiscountCount: number;
  hasTimer: boolean;
  crossPlatformMatch: boolean | null;
  priceOriginal: number | null;
  priceHistoryMin: number | null;
  priceFluctuation: "high" | "medium" | "low";
  historicalScarcityFrequency: "high" | "medium" | "low";
  reloadStockChanges: boolean | null;
  timerResetsOnRefresh: boolean | null;
  pageType?: string | null;
}): DealItemResult {
  const combinedSignals = unique([...input.candidateSignals, ...input.pageSignals]);
  const hasDealClaim = combinedSignals.length > 0;
  const hasSpecificAbsoluteExpiry =
    /\b(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(input.timerText) &&
    /\b(\d{1,2}:\d{2}|\d{1,2}(am|pm))\b/i.test(input.timerText);
  const hasOnlyGenericCountdown = /\b\d{1,2}:\d{2}(:\d{2})?\b/.test(input.timerText) && !hasSpecificAbsoluteExpiry;
  const hasCrowdPressure = /people viewing|booked in the last|sold in last|high demand/i.test(input.stockText);
  const hasWeakEvidence =
    hasOnlyGenericCountdown ||
    hasCrowdPressure ||
    input.repeatedClaimPressure ||
    input.historySignalPressure ||
    input.priceInstabilitySignal;

  let status: VerificationStatus = "unverified";
  let confidence: Confidence = "low";
  const evidence: string[] = [];

  if (!hasDealClaim) {
    status = "unverified";
    confidence = "low";
    evidence.push("No explicit limited-deal or scarcity claim was detected for this item.");
  } else if (hasSpecificAbsoluteExpiry && !hasCrowdPressure) {
    status = "verified";
    confidence = "medium";
    evidence.push("The deal includes a concrete expiry window (date/time), which is more auditable than generic urgency copy.");
  } else if (hasWeakEvidence) {
    status = "likely_misleading";
    confidence = "medium";
    if (hasOnlyGenericCountdown) {
      evidence.push("Claim relies on a generic countdown timer without independently verifiable expiration context.");
    }
    if (hasCrowdPressure) {
      evidence.push("Claim includes crowd-pressure language (for example, 'people viewing/booked') that is often unverifiable.");
    }
    if (input.repeatedClaimPressure) {
      evidence.push("The same limited-deal pressure appears across many products, which often indicates promotional framing rather than item-specific scarcity.");
    }
    if (input.historySignalPressure) {
      evidence.push("Guardian history shows this product repeatedly carries scarcity language across multiple observations.");
    }
    if (input.priceInstabilitySignal) {
      evidence.push("Guardian history shows unstable price points for this product while scarcity pressure remains active.");
    }
  } else {
    status = "unverified";
    confidence = "low";
    evidence.push("The page includes urgency/scarcity language, but there is not enough hard evidence to verify the claim.");
  }

  const saferAlternatives = defaultAlternativeDomains(input.domain);
  const trustVerification = mapTrustVerification({
    urgency_text: input.urgencyText || input.timerText,
    stock_text: input.stockText,
    stock_number: parseStockNumber(`${input.timerText} ${input.stockText}`),
    has_timer: input.hasTimer,
    timer_resets_on_refresh: input.timerResetsOnRefresh,
    same_urgency_count: input.sameUrgencyCount,
    same_discount_count: input.sameDiscountCount,
    appears_in_listing: /\/s\?|search|deals|goldbox|category|collections?/i.test(input.url ?? ""),
    appears_in_product_page: /\/dp\/|\/p\/|\/product|\/gp\/product/i.test(input.url ?? ""),
    reload_stock_changes: input.reloadStockChanges,
    cross_platform_match: input.crossPlatformMatch,
    price_current: input.listedPrice,
    price_original: input.priceOriginal,
    price_history_min: input.priceHistoryMin,
    price_fluctuation: input.priceFluctuation,
    historical_scarcity_frequency: input.historicalScarcityFrequency,
    page_type: input.pageType || null,
  });

  const rationale =
    trustVerification.reality === "REAL" || status === "verified"
      ? "Guardian found stronger-than-usual expiry evidence, but the user should still compare the final payable amount."
      : trustVerification.reality === "FAKE" || status === "likely_misleading"
        ? "Guardian found deal pressure patterns that are common in manufactured FOMO flows."
        : "Guardian cannot prove this deal claim from page evidence alone.";

  const recommendation =
    trustVerification.final_advice === "ACT_FAST"
      ? "Proceed, but verify final payable amount and terms before payment."
      : trustVerification.final_advice === "RELAX_IGNORE"
        ? "This looks like manipulative pressure; relax and compare alternatives before deciding."
        : "Compare options and verify stock/deal persistence before committing.";

  return {
    productTitle: input.productTitle,
    listedPrice: input.listedPrice,
    currency: input.currency,
    status,
    confidence,
    claimSignals: combinedSignals,
    evidence,
    rationale,
    recommendation,
    saferAlternatives,
    trustVerification,
  };
}

export function analyzeDealIntelligence(input: DealIntelligenceInput): DealIntelligenceResult {
  const timerText = toLowerJoined(input.timerElements);
  const stockText = toLowerJoined(input.stockAlerts);
  const pageText = normalizeText(input.pageText).toLowerCase();
  const pageSignals = parseSignalsFromText(`${timerText} ${stockText} ${pageText}`);
  const candidates = (input.productCandidates ?? [])
    .map((candidate) => ({
      title: normalizeText(candidate.title),
      listedPrice: typeof candidate.listedPrice === "number" && Number.isFinite(candidate.listedPrice) ? candidate.listedPrice : null,
      originalPrice: typeof candidate.originalPrice === "number" && Number.isFinite(candidate.originalPrice) ? candidate.originalPrice : null,
      historicalMinPrice:
        typeof candidate.historicalMinPrice === "number" && Number.isFinite(candidate.historicalMinPrice) ? candidate.historicalMinPrice : null,
      currency: normalizeText(candidate.currency) || "USD",
      url: normalizeText(candidate.url) || null,
      stockText: normalizeText(candidate.stockText) || null,
      urgencyText: normalizeText(candidate.urgencyText) || null,
      hasTimer: candidate.hasTimer === true,
      timerResetsOnRefresh: typeof candidate.timerResetsOnRefresh === "boolean" ? candidate.timerResetsOnRefresh : null,
      reloadStockChanges: typeof candidate.reloadStockChanges === "boolean" ? candidate.reloadStockChanges : null,
      crossPlatformMatch: typeof candidate.crossPlatformMatch === "boolean" ? candidate.crossPlatformMatch : null,
      dealSignals: unique(
        (candidate.dealSignals ?? [])
          .map((signal) => normalizeText(signal).toLowerCase())
          .filter(Boolean),
      ),
      historySnapshot:
        candidate.historySnapshot && typeof candidate.historySnapshot === "object"
          ? {
              observations: typeof candidate.historySnapshot.observations === "number" ? candidate.historySnapshot.observations : 0,
              scarcityClaimRate:
                typeof candidate.historySnapshot.scarcityClaimRate === "number" ? candidate.historySnapshot.scarcityClaimRate : 0,
              uniquePricePoints:
                typeof candidate.historySnapshot.uniquePricePoints === "number" ? candidate.historySnapshot.uniquePricePoints : 0,
            }
          : null,
    }))
    .filter((candidate) => candidate.title.length > 0)
    .slice(0, 12);

  const normalizedCandidates = candidates.length
    ? candidates
    : [
      {
        title: "Current page offer",
        listedPrice: null,
        originalPrice: null,
        historicalMinPrice: null,
        currency: "USD",
        url: normalizeText(input.url) || null,
        stockText: null,
        urgencyText: null,
        hasTimer: input.hasTimer === true,
        timerResetsOnRefresh: null,
        reloadStockChanges: null,
        crossPlatformMatch: null,
        dealSignals: parseSignalsFromText(pageText),
        historySnapshot: null,
      },
    ];

  const broadDealPressureCount = normalizedCandidates.filter((candidate) =>
    candidate.dealSignals.some((signal) => /limited|flash|lightning|deal|ends in|expires|only \d+ left/.test(signal)),
  ).length;

  const urgencyBucket = new Map<string, number>();
  const discountBucket = new Map<string, number>();
  for (const candidate of normalizedCandidates) {
    for (const signal of candidate.dealSignals) {
      const normalized = normalizeText(signal).toLowerCase();
      if (!normalized) continue;
      if (/limited|ends in|expires|few left|only \d+ left|selling fast|flash|lightning/.test(normalized)) {
        urgencyBucket.set(normalized, (urgencyBucket.get(normalized) ?? 0) + 1);
      }
      if (/%\s*off|discount|save|m\.?r\.?p/i.test(normalized)) {
        discountBucket.set(normalized, (discountBucket.get(normalized) ?? 0) + 1);
      }
    }
  }

  const items = normalizedCandidates.map((candidate) =>
    evaluateSingleDeal({
      productTitle: candidate.title,
      listedPrice: candidate.listedPrice,
      currency: candidate.currency,
      url: candidate.url,
      candidateSignals: parseSignalsFromText(candidate.dealSignals.join(" ")),
      urgencyText: candidate.urgencyText || candidate.dealSignals.join(" "),
      pageSignals,
      timerText,
      stockText: candidate.stockText || stockText,
      pageText,
      domain: input.domain,
      repeatedClaimPressure:
        broadDealPressureCount >= 3 &&
        candidate.dealSignals.some((signal) => /limited|flash|lightning|deal|ends in|expires|only \d+ left/.test(signal)),
      historySignalPressure:
        Number(candidate?.historySnapshot?.observations || 0) >= 3 &&
        Number(candidate?.historySnapshot?.scarcityClaimRate || 0) >= 0.75,
      priceInstabilitySignal:
        Number(candidate?.historySnapshot?.observations || 0) >= 4 &&
        Number(candidate?.historySnapshot?.uniquePricePoints || 0) >= 3,
      sameUrgencyCount: Math.max(
        1,
        ...candidate.dealSignals
          .map((signal) => urgencyBucket.get(normalizeText(signal).toLowerCase()) ?? 1)
          .filter((count) => Number.isFinite(count)),
      ),
      sameDiscountCount: Math.max(
        1,
        ...candidate.dealSignals
          .map((signal) => discountBucket.get(normalizeText(signal).toLowerCase()) ?? 1)
          .filter((count) => Number.isFinite(count)),
      ),
      hasTimer: candidate.hasTimer === true || input.hasTimer === true || /\b\d{1,2}:\d{2}(:\d{2})?\b|ends in|expires|countdown/i.test(timerText),
      crossPlatformMatch: candidate.crossPlatformMatch ?? null,
      priceOriginal: candidate.originalPrice ?? null,
      priceHistoryMin: candidate.historicalMinPrice ?? null,
      priceFluctuation: inferPriceFluctuation(Number(candidate?.historySnapshot?.uniquePricePoints || 1)),
      historicalScarcityFrequency: inferHistoricalScarcityFrequency(
        Number(candidate?.historySnapshot?.scarcityClaimRate || 0),
      ),
      reloadStockChanges:
        candidate.reloadStockChanges ??
        input.reloadStockChanges ??
        (Number(candidate?.historySnapshot?.observations || 0) >= 3
          ? Number(candidate?.historySnapshot?.scarcityClaimRate || 0) < 0.95
          : null),
      timerResetsOnRefresh: candidate.timerResetsOnRefresh ?? input.timerResetsOnRefresh ?? null,
      pageType: input.pageType || null,
    }),
  );

  const likelyMisleadingCount = items.filter((item) => item.status === "likely_misleading").length;
  const verifiedCount = items.filter((item) => item.status === "verified").length;

  const summary =
    likelyMisleadingCount > 0
      ? `Guardian reviewed ${items.length} offer(s) and found ${likelyMisleadingCount} likely misleading limited-deal claim(s).`
      : verifiedCount > 0
        ? `Guardian reviewed ${items.length} offer(s) and found ${verifiedCount} claim(s) with moderate verification evidence.`
        : `Guardian reviewed ${items.length} offer(s), but the limited-deal claims remain unverified from page evidence alone.`;

  return {
    summary,
    researchMode: "page_evidence_only",
    items,
  };
}
