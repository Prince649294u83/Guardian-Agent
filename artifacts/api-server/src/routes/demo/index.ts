import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, detectionReportsTable, trustRatingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DemoScanBody, DemoFeeEstimateBody } from "@workspace/api-zod";
import { buildFeeCopilot } from "../../lib/ai-copilot";
import { buildAgenticMission } from "../../lib/agentic-mission";
import { analyzeBookingManipulation } from "../../lib/booking-manipulation";
import { analyzeCheckoutContext } from "../../lib/checkout-analysis";
import { buildScanArtifacts } from "../../lib/scan-pipeline";
import { buildDetectionReportInsert } from "../../lib/scan-records";
import { buildTrustRatingMutation, computeTrustScoreDelta, computeTrustTier } from "../../lib/trust-rating";
import { analyzeDealIntelligence } from "../../lib/deal-intelligence";

const router: IRouter = Router();

const DARK_PATTERN_SYSTEM_PROMPT = `You are Guardian Agent's dark pattern detection engine. Analyze webpage content and identify psychological manipulation tactics used by e-commerce sites.

Return a JSON object with this exact structure:
{
  "falseUrgency": { "detected": boolean, "evidence": "explanation or empty string", "isTimerFake": boolean or null },
  "falseScarcity": { "detected": boolean, "evidence": "explanation or empty string" },
  "confirmShaming": { "detected": boolean, "shamingText": "offending text or empty string", "rewrittenText": "neutral version or empty string" },
  "hiddenFees": { "detected": boolean, "feeItems": [{"label": "name", "amount": 12.99}], "totalExtra": number or null },
  "preCheckedAddOns": { "detected": boolean, "fieldIds": [], "addOnLabels": ["Label"] },
  "misdirection": { "detected": boolean, "hiddenDeclineText": "text or empty string" },
  "trustScore": integer 0-100,
  "summary": "1-2 sentence human-readable summary"
}

Be strict but accurate. 100 = fully trustworthy, 0 = highly manipulative.`;

const FEE_ESTIMATE_SYSTEM_PROMPT = `You are Guardian Agent's hidden fee estimation engine. Given a merchant domain, type, and listed price, estimate what the true final checkout price will be after all mandatory fees are added.

Return a JSON object with this exact structure:
{
  "estimatedTotal": number,
  "feeBreakdown": [{"label": "Tax (8.5%)", "amount": 14.03}, {"label": "Resort Fee", "amount": 35.00}],
  "confidence": "high" | "medium" | "low",
  "warningLevel": "green" | "orange" | "red",
  "explanation": "One sentence explaining the estimate and primary fee drivers"
}

Base estimates on known industry practices:
- Hotels: typically add 15-35% for taxes, resort fees, destination charges
- Airlines: typically add 15-30% for taxes, fees, and hidden baggage costs
- Vacation rentals (Airbnb/VRBO): typically add 20-40% for cleaning, service, taxes
- Car rentals: typically add 30-60% for taxes, insurance, airport fees
- E-commerce: typically add 0-15% for shipping, handling, taxes
warningLevel: green if <10% extra, orange if 10-25% extra, red if >25% extra`;

router.post("/demo/scan", async (req, res): Promise<void> => {
  if (req.body?.isBookingPlatform === true) {
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
          .map((candidate: Record<string, unknown>) => ({
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
          : null;

    const bookingManipulations = analyzeBookingManipulation({
      pageText,
      bookingType,
      pageType,
      timer: req.body?.bookingTimer ?? req.body?.timer ?? null,
      viewers: req.body?.bookingViewers ?? req.body?.viewers ?? null,
      seats: req.body?.bookingSeats ?? req.body?.seats ?? null,
      price: req.body?.bookingPrice ?? req.body?.price ?? null,
    });

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

    const hasCritical = bookingManipulations.some((entry) => entry.severity === "critical");
    const hasFake = bookingManipulations.some((entry) => entry.reality === "FAKE");
    if (hasCritical || (hasFake && mission.recommendation === "proceed")) {
      mission.recommendation = hasCritical ? "switch" : "proceed_with_caution";
      mission.summary = hasCritical
        ? "Critical booking manipulation was detected. Compare alternatives before continuing."
        : "Fake booking pressure tactics were detected. Proceed only with awareness.";
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
      checkoutAnalysis,
      mission,
      bookingManipulations,
      bookingContext,
      summary: mission.summary,
      trustScore: checkoutAnalysis.trustScore,
    });
    return;
  }

  const parsed = DemoScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { domain, url, pageText, timerElements, stockAlerts, buttonLabels, priceStrings } = parsed.data;
  const variantUrgency = Array.isArray(req.body?.variantUrgency)
    ? req.body.variantUrgency.filter((value: unknown): value is string => typeof value === "string")
    : undefined;
  const pageType = typeof req.body?.pageType === "string" ? req.body.pageType : undefined;
  const hasTimer = req.body?.hasTimer === true;
  const timerResetsOnRefresh = typeof req.body?.timerResetsOnRefresh === "boolean" ? req.body.timerResetsOnRefresh : undefined;
  const reloadStockChanges = typeof req.body?.reloadStockChanges === "boolean" ? req.body.reloadStockChanges : undefined;
  const productCandidates = Array.isArray(req.body?.productCandidates)
    ? req.body.productCandidates
        .filter((value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
        .map((candidate: Record<string, unknown>) => ({
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
          historySnapshot:
            candidate.historySnapshot && typeof candidate.historySnapshot === "object"
              ? (() => {
                  const historySnapshot = candidate.historySnapshot as Record<string, unknown>;
                  return {
                    observations:
                      typeof historySnapshot.observations === "number"
                        ? historySnapshot.observations
                        : 0,
                    scarcityClaimRate:
                      typeof historySnapshot.scarcityClaimRate === "number"
                        ? historySnapshot.scarcityClaimRate
                        : 0,
                    uniquePricePoints:
                      typeof historySnapshot.uniquePricePoints === "number"
                        ? historySnapshot.uniquePricePoints
                        : 0,
                    lastSeenAt:
                      typeof historySnapshot.lastSeenAt === "string"
                        ? historySnapshot.lastSeenAt
                        : null,
                  };
                })()
              : null,
        }))
    : undefined;
  const dealIntelligence = analyzeDealIntelligence({
    domain,
    url,
    pageType,
    pageText,
    hasTimer,
    timerResetsOnRefresh,
    reloadStockChanges,
    timerElements,
    stockAlerts,
    variantUrgency,
    productCandidates,
  });
  const sharedAnalysis = analyzeCheckoutContext({
    domain,
    url,
    pageText,
    timerElements,
    stockAlerts,
    variantUrgency,
    buttonLabels,
    priceStrings,
    productCandidates,
  });

  if (!sharedAnalysis.isShoppingPage) {
    const { darkPatternReport, totalPatternsDetected, hiddenFeesTotal } = buildScanArtifacts({
      domain,
      url,
      pageText,
      baseAnalysis: sharedAnalysis,
    });
    const [report] = await db
      .insert(detectionReportsTable)
      .values(buildDetectionReportInsert({
        domain,
        url,
        darkPatternReport,
        totalPatternsDetected,
        hiddenFeesTotal,
      }))
      .returning();

    const trustRating = {
      domain,
      score: darkPatternReport.trustScore ?? 95,
      tier: computeTrustTier(darkPatternReport.trustScore ?? 95),
    };
    const { aiCopilot } = buildScanArtifacts({
      domain,
      url,
      pageText,
      baseAnalysis: sharedAnalysis,
      trustRating,
    });

    res.json({ report, darkPatternReport, trustRating, aiCopilot, dealIntelligence });
    return;
  }

  const userMessage = `
Domain: ${domain}
Page text (truncated to 3000 chars):
${pageText.slice(0, 3000)}

Timer elements found: ${JSON.stringify(timerElements ?? [])}
Stock/scarcity alerts: ${JSON.stringify(stockAlerts ?? [])}
Button labels: ${JSON.stringify(buttonLabels ?? [])}
Price strings found: ${JSON.stringify(priceStrings ?? [])}

Analyze this page for dark patterns and return the JSON analysis.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: DARK_PATTERN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  const rawText = block.type === "text" ? block.text : "{}";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  const aiReport = JSON.parse(jsonMatch[0]);
  const { darkPatternReport, totalPatternsDetected, hiddenFeesTotal } = buildScanArtifacts({
    domain,
    url,
    pageText,
    baseAnalysis: sharedAnalysis,
    aiReport,
  });

  const [report] = await db
    .insert(detectionReportsTable)
    .values(buildDetectionReportInsert({
      domain,
      url,
      darkPatternReport,
      totalPatternsDetected,
      hiddenFeesTotal,
    }))
    .returning();

  const [existing] = await db
    .select()
    .from(trustRatingsTable)
    .where(eq(trustRatingsTable.domain, domain));

  let trustRating;
  const scoreDelta = computeTrustScoreDelta(totalPatternsDetected);
  const hiddenFeesFound = darkPatternReport.hiddenFees?.detected ? 1 : 0;

  if (existing) {
    const nextValues = buildTrustRatingMutation({
      domain,
      scoreDelta,
      patternsFound: totalPatternsDetected,
      hiddenFeesFound,
      existing,
    });
    const [updated] = await db
      .update(trustRatingsTable)
      .set(nextValues)
      .where(eq(trustRatingsTable.domain, domain))
      .returning();
    trustRating = updated;
  } else {
    const nextValues = buildTrustRatingMutation({
      domain,
      scoreDelta,
      patternsFound: totalPatternsDetected,
      hiddenFeesFound,
    });
    const [created] = await db
      .insert(trustRatingsTable)
      .values(nextValues)
      .returning();
    trustRating = created;
  }

  const { aiCopilot } = buildScanArtifacts({
    domain,
    url,
    pageText,
    baseAnalysis: sharedAnalysis,
    aiReport,
    trustRating,
  });

  res.json({ report, darkPatternReport, trustRating, aiCopilot, dealIntelligence });
});

router.post("/demo/fee-estimate", async (req, res): Promise<void> => {
  const parsed = DemoFeeEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { domain, merchantType, listedPrice, itemDescription } = parsed.data;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: FEE_ESTIMATE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Domain: ${domain}
Merchant type: ${merchantType}
Listed price: $${listedPrice}
${itemDescription ? `Item description: ${itemDescription}` : ""}

Estimate the true final price with all mandatory fees and return JSON.`,
      },
    ],
  });

  const block = message.content[0];
  const rawText = block.type === "text" ? block.text : "{}";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  const result = JSON.parse(jsonMatch[0]);
  const savingsOpportunity = result.estimatedTotal - listedPrice;

  const payload = { listedPrice, ...result, savingsOpportunity };
  const aiCopilot = buildFeeCopilot({
    domain,
    merchantType,
    listedPrice,
    result: payload,
  });

  res.json({ ...payload, aiCopilot });
});

export default router;
