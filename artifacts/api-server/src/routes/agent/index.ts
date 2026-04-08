import { Router, type IRouter } from "express";
import { buildAgenticMission } from "../../lib/agentic-mission";
import { buildMissionCopilot } from "../../lib/ai-copilot";

const router: IRouter = Router();

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
    variantUrgency: Array.isArray(req.body?.variantUrgency)
      ? req.body.variantUrgency.filter((value: unknown): value is string => typeof value === "string")
      : undefined,
    productCandidates: Array.isArray(req.body?.productCandidates)
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

export default router;
