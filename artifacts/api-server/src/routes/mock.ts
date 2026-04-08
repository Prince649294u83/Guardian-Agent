import { Router, type IRouter } from "express";
import { buildAgenticMission } from "../lib/agentic-mission";
import { buildFeeCopilot, buildMissionCopilot } from "../lib/ai-copilot";
import { analyzeCheckoutContext } from "../lib/checkout-analysis";
import { analyzeBookingManipulation } from "../lib/booking-manipulation";
import { analyzeDealIntelligence } from "../lib/deal-intelligence";
import { buildScanArtifacts } from "../lib/scan-pipeline";
import { buildMockDetectionReport } from "../lib/scan-records";
import { computeTrustTier } from "../lib/trust-rating";

type ReportRecord = {
  id: number;
  domain: string;
  url: string;
  trustScore: number;
  falseUrgencyDetected: boolean;
  falseScarcityDetected: boolean;
  confirmShamingDetected: boolean;
  hiddenFeesDetected: boolean;
  preCheckedAddOnsDetected: boolean;
  misdirectionDetected: boolean;
  totalPatternsDetected: number;
  hiddenFeesTotal: number | null;
  summary: string;
  createdAt: string;
};

type TrustRatingRecord = {
  id: number;
  domain: string;
  score: number;
  tier: "gold" | "clean" | "neutral" | "suspicious" | "high_manipulation";
  totalScans: number;
  patternsDetectedCount: number;
  hiddenFeesCount: number;
  lastScannedAt: string;
};

const mockReports: ReportRecord[] = [
  {
    id: 101,
    domain: "booking.com",
    url: "https://booking.com/hotel/paradise-resort/checkout",
    trustScore: 24,
    falseUrgencyDetected: true,
    falseScarcityDetected: true,
    confirmShamingDetected: true,
    hiddenFeesDetected: true,
    preCheckedAddOnsDetected: true,
    misdirectionDetected: false,
    totalPatternsDetected: 5,
    hiddenFeesTotal: 78.5,
    summary: "Countdown pressure, fake scarcity, hidden fees, and pre-selected add-ons create a highly manipulative hotel checkout.",
    createdAt: "2026-04-07T09:15:00.000Z",
  },
  {
    id: 102,
    domain: "united.com",
    url: "https://united.com/checkout/seats",
    trustScore: 38,
    falseUrgencyDetected: true,
    falseScarcityDetected: true,
    confirmShamingDetected: true,
    hiddenFeesDetected: false,
    preCheckedAddOnsDetected: true,
    misdirectionDetected: true,
    totalPatternsDetected: 5,
    hiddenFeesTotal: null,
    summary: "The airline flow uses urgency copy, low-prominence decline paths, and default add-ons to steer users into extras.",
    createdAt: "2026-04-06T17:30:00.000Z",
  },
  {
    id: 103,
    domain: "amazon.com",
    url: "https://amazon.com/checkout",
    trustScore: 61,
    falseUrgencyDetected: false,
    falseScarcityDetected: false,
    confirmShamingDetected: false,
    hiddenFeesDetected: false,
    preCheckedAddOnsDetected: true,
    misdirectionDetected: true,
    totalPatternsDetected: 2,
    hiddenFeesTotal: null,
    summary: "Prime trial enrollment and protection plan defaults add friction to a clean opt-out experience.",
    createdAt: "2026-04-05T12:05:00.000Z",
  },
  {
    id: 104,
    domain: "etsy.com",
    url: "https://etsy.com/checkout",
    trustScore: 92,
    falseUrgencyDetected: false,
    falseScarcityDetected: false,
    confirmShamingDetected: false,
    hiddenFeesDetected: false,
    preCheckedAddOnsDetected: false,
    misdirectionDetected: false,
    totalPatternsDetected: 0,
    hiddenFeesTotal: null,
    summary: "Transparent pricing and neutral controls make this a clean checkout flow.",
    createdAt: "2026-04-04T10:20:00.000Z",
  },
];

const mockTrustRatings: TrustRatingRecord[] = [
  {
    id: 1,
    domain: "booking.com",
    score: 24,
    tier: "high_manipulation",
    totalScans: 12,
    patternsDetectedCount: 34,
    hiddenFeesCount: 7,
    lastScannedAt: "2026-04-07T09:15:00.000Z",
  },
  {
    id: 2,
    domain: "united.com",
    score: 38,
    tier: "suspicious",
    totalScans: 9,
    patternsDetectedCount: 22,
    hiddenFeesCount: 1,
    lastScannedAt: "2026-04-06T17:30:00.000Z",
  },
  {
    id: 3,
    domain: "amazon.com",
    score: 61,
    tier: "neutral",
    totalScans: 14,
    patternsDetectedCount: 11,
    hiddenFeesCount: 0,
    lastScannedAt: "2026-04-05T12:05:00.000Z",
  },
  {
    id: 4,
    domain: "etsy.com",
    score: 92,
    tier: "clean",
    totalScans: 6,
    patternsDetectedCount: 0,
    hiddenFeesCount: 0,
    lastScannedAt: "2026-04-04T10:20:00.000Z",
  },
];

function computePatternBreakdown(reports: ReportRecord[]) {
  return reports.reduce(
    (acc, report) => {
      acc.falseUrgency += report.falseUrgencyDetected ? 1 : 0;
      acc.falseScarcity += report.falseScarcityDetected ? 1 : 0;
      acc.confirmShaming += report.confirmShamingDetected ? 1 : 0;
      acc.hiddenFees += report.hiddenFeesDetected ? 1 : 0;
      acc.preCheckedAddOns += report.preCheckedAddOnsDetected ? 1 : 0;
      acc.misdirection += report.misdirectionDetected ? 1 : 0;
      return acc;
    },
    {
      falseUrgency: 0,
      falseScarcity: 0,
      confirmShaming: 0,
      hiddenFees: 0,
      preCheckedAddOns: 0,
      misdirection: 0,
    },
  );
}

export function createMockRouter(): IRouter {
  const router: IRouter = Router();

  router.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/trust", (_req, res) => {
    res.json(mockTrustRatings);
  });

  router.get("/trust/:domain", (req, res) => {
    const rating = mockTrustRatings.find((entry) => entry.domain === req.params.domain);
    if (!rating) {
      res.status(404).json({ error: "Trust rating not found" });
      return;
    }
    res.json(rating);
  });

  router.patch("/trust/:domain", (req, res) => {
    const rating = mockTrustRatings.find((entry) => entry.domain === req.params.domain);
    if (!rating) {
      res.status(404).json({ error: "Trust rating not found" });
      return;
    }
    const nextScore = typeof req.body?.score === "number" ? req.body.score : rating.score;
    rating.score = nextScore;
    res.json(rating);
  });

  router.get("/reports", (req, res) => {
    const domain = typeof req.query.domain === "string" ? req.query.domain : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    let reports = domain
      ? mockReports.filter((report) => report.domain.includes(domain))
      : [...mockReports];
    if (limit && !Number.isNaN(limit)) {
      reports = reports.slice(0, limit);
    }
    res.json(reports);
  });

  router.get("/reports/:id", (req, res) => {
    const report = mockReports.find((entry) => entry.id === Number(req.params.id));
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json(report);
  });

  router.get("/stats/summary", (_req, res) => {
    res.json({
      totalPatternsDetected: mockReports.reduce((sum, report) => sum + report.totalPatternsDetected, 0),
      totalHiddenFeesBlocked: mockReports.reduce((sum, report) => sum + (report.hiddenFeesTotal ?? 0), 0),
      totalDomainsTracked: mockTrustRatings.length,
      highManipulationDomains: mockTrustRatings.filter((entry) => entry.tier === "high_manipulation").length,
      totalScans: mockReports.length,
    });
  });

  router.get("/stats/pattern-breakdown", (_req, res) => {
    res.json(computePatternBreakdown(mockReports));
  });

  router.get("/stats/top-offenders", (req, res) => {
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 5;
    const offenders = mockTrustRatings
      .map((rating) => ({
        domain: rating.domain,
        trustScore: rating.score,
        totalPatternsDetected: rating.patternsDetectedCount,
      }))
      .sort((a, b) => a.trustScore - b.trustScore)
      .slice(0, Number.isNaN(limit) ? 5 : limit);
    res.json(offenders);
  });

  router.post("/analysis/detect", (req, res) => {
    const domain = req.body?.domain ?? "example.com";
    const pageText = req.body?.pageText ?? "";
    const result = analyzeCheckoutContext({
      domain,
      url: req.body?.url ?? "",
      pageText,
      timerElements: req.body?.timerElements,
      stockAlerts: req.body?.stockAlerts,
      buttonLabels: req.body?.buttonLabels,
      priceStrings: req.body?.priceStrings,
      productCandidates: Array.isArray(req.body?.productCandidates) ? req.body.productCandidates : [],
    });
    res.json(result);
  });

  router.post("/analysis/classify-upsell", (req, res) => {
    const pageText = String(req.body?.pageText ?? "").toLowerCase();
    const type = pageText.includes("insurance")
      ? "insurance"
      : pageText.includes("seat")
        ? "seat_selection"
        : pageText.includes("newsletter")
          ? "newsletter"
          : "other";
    res.json({
      type,
      confidence: 0.82,
      recommendedAction: type === "other" ? "ask_user" : "decline",
      declineButtonHint: "Look for a secondary text link near the main CTA.",
    });
  });

  router.post("/demo/scan", (req, res) => {
    const domain = req.body?.domain ?? "example.com";
    const url = req.body?.url ?? `https://${domain}/checkout`;
    const pageText = req.body?.pageText ?? "";
    const sharedAnalysis = analyzeCheckoutContext({
      domain,
      url,
      pageText,
      timerElements: req.body?.timerElements,
      stockAlerts: req.body?.stockAlerts,
      buttonLabels: req.body?.buttonLabels,
      priceStrings: req.body?.priceStrings,
      productCandidates: Array.isArray(req.body?.productCandidates) ? req.body.productCandidates : [],
    });
    const { darkPatternReport, totalPatternsDetected, hiddenFeesTotal } = buildScanArtifacts({
      domain,
      url,
      pageText,
      baseAnalysis: sharedAnalysis,
    });
    const dealIntelligence = analyzeDealIntelligence({
      domain,
      url,
      pageType: typeof req.body?.pageType === "string" ? req.body.pageType : undefined,
      pageText,
      hasTimer: req.body?.hasTimer === true,
      timerResetsOnRefresh: typeof req.body?.timerResetsOnRefresh === "boolean" ? req.body.timerResetsOnRefresh : undefined,
      reloadStockChanges: typeof req.body?.reloadStockChanges === "boolean" ? req.body.reloadStockChanges : undefined,
      timerElements: req.body?.timerElements,
      stockAlerts: req.body?.stockAlerts,
      productCandidates: Array.isArray(req.body?.productCandidates) ? req.body.productCandidates : [],
    });
    const report: ReportRecord = buildMockDetectionReport({
      id: 1000 + mockReports.length + 1,
      domain,
      url,
      darkPatternReport,
      totalPatternsDetected,
      hiddenFeesTotal,
    });
    const trustRating: TrustRatingRecord = {
      id: mockTrustRatings.length + 100,
      domain,
      score: darkPatternReport.trustScore,
      tier: computeTrustTier(darkPatternReport.trustScore),
      totalScans: 1,
      patternsDetectedCount: report.totalPatternsDetected,
      hiddenFeesCount: report.hiddenFeesDetected ? 1 : 0,
      lastScannedAt: report.createdAt,
    };
    const { aiCopilot } = buildScanArtifacts({
      domain,
      url,
      pageText,
      baseAnalysis: sharedAnalysis,
      trustRating,
    });
    res.json({ report, darkPatternReport, trustRating, aiCopilot, dealIntelligence });
  });

  router.post("/booking/analyze", (req, res) => {
    const rawUrl = typeof req.body?.url === "string" ? req.body.url : "https://example.com/booking";
    let domain = "example.com";
    try {
      domain = new URL(rawUrl).hostname.toLowerCase();
    } catch {
      domain = "example.com";
    }
    const pageText = typeof req.body?.pageText === "string" ? req.body.pageText : "";
    const bookingType = typeof req.body?.bookingType === "string" ? req.body.bookingType : "unknown";
    const pageType = typeof req.body?.pageType === "string" ? req.body.pageType : "unknown";
    const route =
      req.body?.route && typeof req.body.route === "object"
        ? {
            from: typeof req.body.route.from === "string" ? req.body.route.from : undefined,
            to: typeof req.body.route.to === "string" ? req.body.route.to : undefined,
            display: typeof req.body.route.display === "string" ? req.body.route.display : undefined,
          }
        : null;
    const operator = typeof req.body?.operator === "string" ? req.body.operator : null;
    const departureTime = typeof req.body?.departureTime === "string" ? req.body.departureTime : null;
    const departureDate = typeof req.body?.departureDate === "string" ? req.body.departureDate : null;
    const productCandidates = Array.isArray(req.body?.productCandidates)
      ? req.body.productCandidates
          .filter((value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
          .map((candidate) => ({
            title: typeof candidate.title === "string" ? candidate.title : "",
            listedPrice: typeof candidate.listedPrice === "number" ? candidate.listedPrice : null,
            originalPrice: typeof candidate.originalPrice === "number" ? candidate.originalPrice : null,
            historicalMinPrice: typeof candidate.historicalMinPrice === "number" ? candidate.historicalMinPrice : null,
            currency: typeof candidate.currency === "string" ? candidate.currency : null,
            url: typeof candidate.url === "string" ? candidate.url : null,
            stockText: typeof candidate.stockText === "string" ? candidate.stockText : null,
            urgencyText: typeof candidate.urgencyText === "string" ? candidate.urgencyText : null,
            hasTimer: candidate.hasTimer === true,
            timerResetsOnRefresh:
              typeof candidate.timerResetsOnRefresh === "boolean" ? candidate.timerResetsOnRefresh : null,
            reloadStockChanges: typeof candidate.reloadStockChanges === "boolean" ? candidate.reloadStockChanges : null,
            crossPlatformMatch: typeof candidate.crossPlatformMatch === "boolean" ? candidate.crossPlatformMatch : null,
            dealSignals: Array.isArray(candidate.dealSignals)
              ? candidate.dealSignals.filter((value: unknown): value is string => typeof value === "string")
              : [],
          }))
      : [];
    const currentPrice =
      typeof productCandidates[0]?.listedPrice === "number"
        ? productCandidates[0].listedPrice
        : typeof req.body?.bookingPrice?.currentPrice === "number"
          ? req.body.bookingPrice.currentPrice
          : typeof req.body?.price?.currentPrice === "number"
            ? req.body.price.currentPrice
            : null;
    const manipulations = analyzeBookingManipulation({
      pageText,
      bookingType,
      pageType,
      timer: req.body?.bookingTimer ?? req.body?.timer ?? null,
      viewers: req.body?.bookingViewers ?? req.body?.viewers ?? null,
      seats: req.body?.bookingSeats ?? req.body?.seats ?? null,
      price: req.body?.bookingPrice ?? req.body?.price ?? null,
    });
    const fakeCount = manipulations.filter((entry) => entry.reality === "FAKE").length;
    const criticalCount = manipulations.filter((entry) => entry.severity === "critical").length;
    const trustScore = Math.max(0, 100 - fakeCount * 15 - criticalCount * 25);
    const recommendation =
      criticalCount > 0 ? "switch" : fakeCount >= 1 ? "proceed_with_caution" : "proceed";
    const checkoutAnalysis = analyzeCheckoutContext({
      domain,
      url: rawUrl,
      pageText,
      timerElements:
        typeof req.body?.bookingTimer?.timerText === "string" ? [req.body.bookingTimer.timerText] : undefined,
      stockAlerts:
        typeof req.body?.bookingSeats?.text === "string"
          ? [req.body.bookingSeats.text]
          : typeof req.body?.seats?.text === "string"
            ? [req.body.seats.text]
            : undefined,
      priceStrings: typeof currentPrice === "number" ? [`${currentPrice}`] : undefined,
      productCandidates,
    });
    const mission = buildAgenticMission({
      domain,
      url: rawUrl,
      pageType,
      bookingType,
      isBookingPlatform: true,
      route,
      purchaseGoal: `Verify whether this ${bookingType} booking is trustworthy and compare safer alternatives.`,
      listedPrice: currentPrice ?? undefined,
      pageText,
      productCandidates,
      compareAcrossSites: true,
    });

    if (recommendation !== "proceed" && mission.recommendation === "proceed") {
      mission.recommendation = recommendation;
      mission.summary =
        recommendation === "switch"
          ? "Critical booking pressure was detected. Compare alternatives before continuing."
          : "Booking pressure tactics were detected. Proceed only if the final total still makes sense.";
      mission.recommendationDetails = {
        action: recommendation,
        summary:
          recommendation === "switch" ? "Booking pressure outweighs the current path" : "Proceed only with awareness",
        reasoning: manipulations.slice(0, 3).map((entry) => entry.reasoning),
        nextSteps:
          recommendation === "switch"
            ? [
                "Compare the same itinerary on the suggested alternatives.",
                "Ignore countdown or viewer pressure until the fare is verified.",
                "Only return if the current platform still wins on true total and trust.",
              ]
            : [
                "Ignore any fake urgency or crowd-pressure copy.",
                "Check the final payable amount before confirming.",
                "Compare one alternative booking path before you pay.",
              ],
      };
    }

    const bookingContext = {
      type: bookingType,
      route,
      operator,
      price: currentPrice,
      currency: typeof productCandidates[0]?.currency === "string" ? productCandidates[0].currency : "INR",
      departureDate,
      departureTime,
      seatType: typeof req.body?.seatType === "string" ? req.body.seatType : null,
    };
    res.json({
      mode: "booking",
      bookingType,
      pageType,
      trustScore,
      recommendation: mission.recommendation ?? recommendation,
      manipulations,
      bookingManipulations: manipulations,
      bookingContext,
      checkoutAnalysis,
      mission,
      summary:
        manipulations.length === 0
          ? `No major booking manipulation was detected on this ${bookingType} flow.`
          : `Detected ${manipulations.length} booking pressure signal${manipulations.length === 1 ? "" : "s"} on this ${bookingType} flow.`,
      timerVerification:
        manipulations.find((entry) => entry.type === "payment_timer") ?? null,
      priceTracking:
        manipulations.find((entry) => entry.type === "price_surge" || entry.type === "dynamic_pricing") ?? null,
    });
  });

  router.post("/demo/fee-estimate", (req, res) => {
    const listedPrice = Number(req.body?.listedPrice ?? 0);
    const merchantType = String(req.body?.merchantType ?? "ecommerce");
    const multiplier =
      merchantType === "hotel"
        ? 1.24
        : merchantType === "airline"
          ? 1.18
          : merchantType === "vacation_rental"
            ? 1.32
            : merchantType === "car_rental"
              ? 1.41
              : 1.08;
    const estimatedTotal = Number((listedPrice * multiplier).toFixed(2));
    const savingsOpportunity = Number((estimatedTotal - listedPrice).toFixed(2));
    const payload = {
      listedPrice,
      estimatedTotal,
      feeBreakdown: [
        { label: "Taxes and platform fees", amount: Number((savingsOpportunity * 0.55).toFixed(2)) },
        { label: "Service or checkout surcharges", amount: Number((savingsOpportunity * 0.45).toFixed(2)) },
      ],
      confidence: merchantType === "ecommerce" ? "medium" : "high",
      warningLevel: savingsOpportunity < listedPrice * 0.1 ? "green" : savingsOpportunity < listedPrice * 0.25 ? "orange" : "red",
      explanation: "Local mock mode is estimating final cost from typical fee patterns for this merchant category.",
      savingsOpportunity,
    };
    const aiCopilot = buildFeeCopilot({
      domain: String(req.body?.domain ?? "unknown.com"),
      merchantType,
      listedPrice,
      result: payload,
    });
    res.json({ ...payload, aiCopilot });
  });

  router.post("/agent/mission", (req, res) => {
    const domain = typeof req.body?.domain === "string" ? req.body.domain.trim() : "";
    const purchaseGoal = typeof req.body?.purchaseGoal === "string" ? req.body.purchaseGoal.trim() : "";

    if (!domain) {
      res.status(400).json({ error: "domain is required" });
      return;
    }

    if (!purchaseGoal) {
      res.status(400).json({ error: "purchaseGoal is required" });
      return;
    }

    const mission = buildAgenticMission({
        domain,
        url: typeof req.body?.url === "string" ? req.body.url : undefined,
        pageType: typeof req.body?.pageType === "string" ? req.body.pageType : undefined,
        bookingType: typeof req.body?.bookingType === "string" ? req.body.bookingType : undefined,
        isBookingPlatform: req.body?.isBookingPlatform === true,
        route:
          req.body?.route && typeof req.body.route === "object"
            ? {
                from: typeof req.body.route.from === "string" ? req.body.route.from : undefined,
                to: typeof req.body.route.to === "string" ? req.body.route.to : undefined,
                display: typeof req.body.route.display === "string" ? req.body.route.display : undefined,
              }
            : undefined,
        purchaseGoal,
        category: req.body?.category,
        budget: typeof req.body?.budget === "number" ? req.body.budget : undefined,
        listedPrice: typeof req.body?.listedPrice === "number" ? req.body.listedPrice : undefined,
        pageText: typeof req.body?.pageText === "string" ? req.body.pageText : undefined,
        priceStrings: Array.isArray(req.body?.priceStrings)
          ? req.body.priceStrings.filter((value: unknown): value is string => typeof value === "string")
          : undefined,
        buttonLabels: Array.isArray(req.body?.buttonLabels)
          ? req.body.buttonLabels.filter((value: unknown): value is string => typeof value === "string")
          : undefined,
        timerElements: Array.isArray(req.body?.timerElements)
          ? req.body.timerElements.filter((value: unknown): value is string => typeof value === "string")
          : undefined,
        stockAlerts: Array.isArray(req.body?.stockAlerts)
          ? req.body.stockAlerts.filter((value: unknown): value is string => typeof value === "string")
          : undefined,
        productCandidates: Array.isArray(req.body?.productCandidates)
          ? req.body.productCandidates
              .filter((value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
              .map((candidate) => ({
                title: typeof candidate.title === "string" ? candidate.title : "",
                listedPrice: typeof candidate.listedPrice === "number" ? candidate.listedPrice : null,
                originalPrice: typeof candidate.originalPrice === "number" ? candidate.originalPrice : null,
                historicalMinPrice: typeof candidate.historicalMinPrice === "number" ? candidate.historicalMinPrice : null,
                currency: typeof candidate.currency === "string" ? candidate.currency : null,
                url: typeof candidate.url === "string" ? candidate.url : null,
                stockText: typeof candidate.stockText === "string" ? candidate.stockText : null,
                urgencyText: typeof candidate.urgencyText === "string" ? candidate.urgencyText : null,
                timerResetsOnRefresh:
                  typeof candidate.timerResetsOnRefresh === "boolean" ? candidate.timerResetsOnRefresh : null,
                reloadStockChanges: typeof candidate.reloadStockChanges === "boolean" ? candidate.reloadStockChanges : null,
                crossPlatformMatch: typeof candidate.crossPlatformMatch === "boolean" ? candidate.crossPlatformMatch : null,
                dealSignals: Array.isArray(candidate.dealSignals)
                  ? candidate.dealSignals.filter((value: unknown): value is string => typeof value === "string")
                  : [],
              }))
          : undefined,
        preferences: Array.isArray(req.body?.preferences)
          ? req.body.preferences.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
          : undefined,
        allowAccountCreation: Boolean(req.body?.allowAccountCreation),
        allowAutoDeclineUpsells: Boolean(req.body?.allowAutoDeclineUpsells),
        compareAcrossSites: req.body?.compareAcrossSites !== false,
      });
    const aiCopilot = buildMissionCopilot({
      domain,
      purchaseGoal,
      mission,
    });
    res.json({ ...mission, aiCopilot });
  });

  return router;
}
