export type BookingManipulation = {
  type: "payment_timer" | "fake_viewers" | "seat_pressure" | "price_surge" | "dynamic_pricing";
  severity: "critical" | "high" | "medium" | "low";
  reality: "REAL" | "FAKE" | "UNCERTAIN";
  confidence: number;
  evidence: string[];
  reasoning: string;
  userAdvice: string;
};

type TimerData = {
  hasTimer?: boolean;
  timerText?: string | null;
  timerValue?: string | null;
  timerResetsOnRefresh?: boolean | null;
};

type PriceData = {
  hasPrice?: boolean;
  currentPrice?: number | null;
  priceChanges?: number | null;
  priceHistory?: Array<{ price?: number | null; timestamp?: number }>;
};

type HistoryData = {
  viewerCountChanges?: boolean | null;
  previousPrice?: number | null;
  priceChanges?: number | null;
};

export function detectPaymentTimer(pageText: string, timerData?: TimerData | null, pageType?: string): BookingManipulation | null {
  const source = `${pageText || ""} ${timerData?.timerText || ""}`;
  const hasTimer = timerData?.hasTimer === true || /(\d+:\d+)|expires?\s*in|time.*left|hurry.*\d+\s*min/i.test(source);
  if (!hasTimer) return null;

  const evidence: string[] = [];
  let reality: BookingManipulation["reality"] = "UNCERTAIN";
  let confidence = 0.5;

  if (timerData?.timerResetsOnRefresh === true) {
    reality = "FAKE";
    confidence = 0.95;
    evidence.push("Timer resets to the same value on refresh.");
  }

  const timerMatch = source.match(/(\d+):(\d+)/);
  if (timerMatch) {
    const minutes = Number(timerMatch[1]);
    if (minutes < 5 && reality !== "FAKE") {
      reality = "FAKE";
      confidence = 0.8;
      evidence.push(`Timer is unusually short at ${timerMatch[0]}.`);
    } else if (minutes >= 10 && minutes <= 20 && reality === "UNCERTAIN") {
      reality = "REAL";
      confidence = 0.7;
      evidence.push("Timer length looks consistent with a real payment session timeout.");
    }
  }

  if (pageType && pageType !== "payment" && reality !== "FAKE") {
    reality = "FAKE";
    confidence = Math.max(confidence, 0.85);
    evidence.push("Timer appears before the payment stage, which is typical of manipulative pressure.");
  }

  return {
    type: "payment_timer",
    severity: reality === "FAKE" ? "high" : "medium",
    reality,
    confidence,
    evidence,
    reasoning:
      reality === "FAKE"
        ? "This timer looks like artificial urgency rather than a genuine payment timeout."
        : reality === "REAL"
          ? "This timer may be tied to a legitimate payment or reservation hold window."
          : "Guardian could not fully verify whether this timer is real or artificial.",
    userAdvice:
      reality === "FAKE"
        ? "Ignore the timer and refresh once to confirm it resets."
        : reality === "REAL"
          ? "Treat the timer as real and finish payment only if you are ready."
          : "Refresh once and compare the timer value before trusting it.",
  };
}

export function detectFakeViewers(pageText: string, historyData?: HistoryData | null): BookingManipulation | null {
  const match =
    pageText.match(/(\d+)\s*people?\s*(viewing|looking\s*at|watching)/i) ||
    pageText.match(/(\d+)\s*others?\s*are\s*considering/i) ||
    pageText.match(/(\d+)\s*travelers?\s*booked/i);
  if (!match) return null;

  const viewerCount = Number(match[1] || 0);
  const evidence = [`Viewer pressure copy detected: ${match[0]}`];
  let reality: BookingManipulation["reality"] = "UNCERTAIN";
  let confidence = 0.5;

  if (historyData?.viewerCountChanges) {
    reality = "FAKE";
    confidence = 0.95;
    evidence.push("Viewer count changed across refreshes.");
  } else if (viewerCount > 100 || viewerCount % 5 === 0) {
    reality = "FAKE";
    confidence = 0.72;
    evidence.push("Viewer count looks suspiciously rounded or unrealistically high.");
  }

  return {
    type: "fake_viewers",
    severity: reality === "FAKE" ? "medium" : "low",
    reality,
    confidence,
    evidence,
    reasoning:
      reality === "FAKE"
        ? "This viewer count likely exists to create competition pressure rather than reflect real users."
        : "Guardian cannot verify whether the viewer count is genuinely live.",
    userAdvice: reality === "FAKE" ? "Ignore the viewer count and focus on price and availability." : "Refresh once to see whether the count changes randomly.",
  };
}

export function detectSeatPressure(pageText: string, bookingType: string): BookingManipulation | null {
  const match =
    pageText.match(/only\s*(\d+)\s*(seat|room|table|spot|ticket)s?\s*left/i) ||
    pageText.match(/(\d+)\s*(seat|room|table)s?\s*remaining/i) ||
    pageText.match(/last\s*(\d+)\s*(available|left)/i) ||
    pageText.match(/almost\s*sold\s*out|high\s*demand|selling\s*fast/i);
  if (!match) return null;

  const count = match[1] ? Number(match[1]) : null;
  const evidence = [`Scarcity claim detected: ${match[0]}`];
  let reality: BookingManipulation["reality"] = count == null ? "FAKE" : "UNCERTAIN";
  let confidence = count == null ? 0.7 : 0.55;

  if (count != null) {
    reality = "REAL";
    confidence = 0.6;
    if (bookingType === "bus" && count > 20) {
      reality = "FAKE";
      confidence = 0.72;
      evidence.push("Claimed scarcity does not look meaningful for a bus-sized inventory.");
    }
  } else {
    evidence.push("The claim is vague rather than based on a specific count.");
  }

  return {
    type: "seat_pressure",
    severity: reality === "FAKE" ? "medium" : "low",
    reality,
    confidence,
    evidence,
    reasoning:
      reality === "FAKE"
        ? "The scarcity claim appears exaggerated or too vague to trust."
        : "The scarcity claim is more specific and may reflect real inventory pressure.",
    userAdvice: reality === "FAKE" ? "Do not rush solely because of this scarcity banner." : "Cross-check availability if the booking matters and the count is low.",
  };
}

export function detectDynamicPricing(currentPrice?: number | null, historyData?: HistoryData | null): BookingManipulation | null {
  if (typeof currentPrice !== "number" || typeof historyData?.previousPrice !== "number" || historyData.previousPrice <= 0) {
    return null;
  }

  const percentChange = ((currentPrice - historyData.previousPrice) / historyData.previousPrice) * 100;
  if (Math.abs(percentChange) < 2) {
    return null;
  }

  const reality: BookingManipulation["reality"] = percentChange > 0 ? "REAL" : "UNCERTAIN";
  const confidence = percentChange > 10 || (historyData.priceChanges || 0) > 2 ? 0.85 : 0.65;
  const evidence = [`Price changed by ${percentChange.toFixed(1)}% compared with the previous observed value.`];

  return {
    type: percentChange > 0 ? "price_surge" : "dynamic_pricing",
    severity: percentChange > 10 ? "high" : "medium",
    reality,
    confidence,
    evidence,
    reasoning:
      percentChange > 0
        ? "Dynamic pricing appears active, so the price may continue to move."
        : "Price movement was detected, but Guardian cannot confirm whether it is a meaningful surge.",
    userAdvice:
      percentChange > 0
        ? "Compare across platforms and decide whether the increase is worth accepting."
        : "Track one more refresh before treating this as a real trend.",
  };
}

export function analyzeBookingManipulation(input: {
  pageText: string;
  bookingType: string;
  pageType?: string;
  timer?: TimerData | null;
  viewers?: { countChanges?: boolean | null } | null;
  seats?: { hasScarcity?: boolean; text?: string | null } | null;
  price?: PriceData | null;
}) {
  const historyData: HistoryData = {
    viewerCountChanges: input.viewers?.countChanges ?? null,
    previousPrice:
      Array.isArray(input.price?.priceHistory) && input.price.priceHistory.length > 1
        ? (input.price.priceHistory[input.price.priceHistory.length - 2]?.price ?? null)
        : null,
    priceChanges: input.price?.priceChanges ?? null,
  };

  return [
    detectPaymentTimer(input.pageText, input.timer, input.pageType),
    detectFakeViewers(input.pageText, historyData),
    detectSeatPressure(`${input.pageText} ${input.seats?.text || ""}`, input.bookingType),
    detectDynamicPricing(input.price?.currentPrice ?? null, historyData),
  ].filter(Boolean) as BookingManipulation[];
}
