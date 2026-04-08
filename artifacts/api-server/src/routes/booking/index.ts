import { Router, type IRouter } from "express";
import { buildAgenticMission } from "../../lib/agentic-mission";
import { analyzeBookingManipulation } from "../../lib/booking-manipulation";
import { analyzeCheckoutContext } from "../../lib/checkout-analysis";

const router: IRouter = Router();

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

export default router;
