import test from "node:test";
import assert from "node:assert/strict";

import { analyzeCheckoutContext } from "../src/lib/checkout-analysis";
import { buildScanArtifacts } from "../src/lib/scan-pipeline";
import { buildTrustRatingMutation, computeTrustScoreDelta, computeTrustTier } from "../src/lib/trust-rating";
import { buildAgenticMission } from "../src/lib/agentic-mission";
import { analyzeDealIntelligence } from "../src/lib/deal-intelligence";
import { checkoutFixtures } from "./fixtures/checkout-fixtures";

test("checkout analysis rejects known non-commerce domains", () => {
  const result = analyzeCheckoutContext({
    domain: "github.com",
    url: "https://github.com/openai/openai-python",
    pageText: "Repository home with issues, pull requests, and actions.",
    buttonLabels: ["Code", "Issues", "Pull requests"],
    priceStrings: [],
  });

  assert.equal(result.isShoppingPage, false);
  assert.equal(result.pageType, "non_commerce");
  assert.equal(result.trustScore, 95);
  assert.match(result.nonCommerceReason ?? "", /non-commerce/i);
});

test("checkout analysis detects commerce signals and baseline patterns", () => {
  const result = analyzeCheckoutContext({
    domain: "makemytrip.com",
    url: "https://www.makemytrip.com/hotels/checkout",
    pageText:
      "Flash sale ends in 04:59. Only 1 room left. Convenience fee applies at payment. Travel insurance is pre-checked.",
    buttonLabels: ["Continue to payment", "Book now"],
    priceStrings: ["Rs 4,999", "Rs 349"],
    timerElements: ["Deal ends in 04:59"],
    stockAlerts: ["Only 1 room left at this price"],
  });

  assert.equal(result.isShoppingPage, true);
  assert.equal(result.pageType, "checkout");
  assert.equal(result.falseUrgency.detected, true);
  assert.equal(result.falseScarcity.detected, true);
  assert.equal(result.hiddenFees.detected, true);
  assert.equal(result.preCheckedAddOns.detected, true);
  assert.ok(result.totalPatternsDetected >= 4);
});

test("checkout analysis treats product listing grids as shopping pages when product candidates are present", () => {
  const result = analyzeCheckoutContext({
    domain: "amazon.in",
    url: "https://www.amazon.in/s?k=multivitamin",
    pageText: "Results for multivitamin. Customer review filters and product cards.",
    buttonLabels: ["Customer Service", "Today's Deals"],
    priceStrings: [],
    productCandidates: [
      { title: "Centrum Women Multivitamin", listedPrice: 445, dealSignals: ["limited time deal"] },
      { title: "Tata 1mg Salmon Omega 3", listedPrice: 529, dealSignals: [] },
    ],
  });

  assert.equal(result.isShoppingPage, true);
  assert.equal(result.pageType, "product");
});

test("checkout analysis treats single product detail pages as shopping pages", () => {
  const result = analyzeCheckoutContext({
    domain: "amazon.in",
    url: "https://www.amazon.in/dp/B0D1234567",
    pageText: "Samsung Galaxy M36 5G. Limited time deal. Price 18,499. Add to Cart.",
    buttonLabels: ["Add to Cart", "Buy Now"],
    priceStrings: ["Rs 18,499"],
    productCandidates: [{ title: "Samsung Galaxy M36 5G", listedPrice: 18499, dealSignals: ["limited time deal"] }],
  });

  assert.equal(result.isShoppingPage, true);
  assert.ok(["product", "cart"].includes(result.pageType));
});

test("scan artifacts merge deterministic and AI signals consistently", () => {
  const baseAnalysis = analyzeCheckoutContext({
    domain: "booking.com",
    url: "https://booking.com/checkout",
    pageText: "Only 1 room left. Resort fee applies later.",
    buttonLabels: ["Reserve now"],
    priceStrings: ["$165.00", "$24.99"],
  });

  const merged = buildScanArtifacts({
    domain: "booking.com",
    url: "https://booking.com/checkout",
    pageText: "Only 1 room left. Resort fee applies later.",
    baseAnalysis,
    aiReport: {
      confirmShaming: {
        detected: true,
        shamingText: "No thanks, I prefer to miss the best deal",
        rewrittenText: "No thanks",
      },
      summary: "AI and rules both flagged manipulation.",
    },
    trustRating: { score: 33, tier: "suspicious" },
  });

  assert.equal(merged.darkPatternReport.confirmShaming.detected, true);
  assert.match(merged.darkPatternReport.summary, /AI and rules/i);
  assert.ok(merged.totalPatternsDetected >= baseAnalysis.totalPatternsDetected);
  assert.equal(typeof merged.aiCopilot.headline, "string");
});

test("trust mutation helper creates and updates trust records consistently", () => {
  const scoreDelta = computeTrustScoreDelta(3);
  const created = buildTrustRatingMutation({
    domain: "booking.com",
    scoreDelta,
    patternsFound: 3,
    hiddenFeesFound: 1,
  });

  assert.equal(created.tier, computeTrustTier(created.score));
  assert.equal(created.totalScans, 1);
  assert.equal(created.patternsDetectedCount, 3);
  assert.equal(created.hiddenFeesCount, 1);

  const updated = buildTrustRatingMutation({
    domain: "booking.com",
    scoreDelta: 5,
    patternsFound: 0,
    hiddenFeesFound: 0,
    existing: {
      score: 40,
      totalScans: 7,
      patternsDetectedCount: 15,
      hiddenFeesCount: 4,
    },
  });

  assert.equal(updated.score, 45);
  assert.equal(updated.tier, "neutral");
  assert.equal(updated.totalScans, 8);
  assert.equal(updated.patternsDetectedCount, 15);
});

test("agentic mission gates non-commerce pages", () => {
  const mission = buildAgenticMission({
    domain: "github.com",
    url: "https://github.com/openai/openai-python",
    purchaseGoal: "Check if this repo is safe to buy from",
    pageText: "Repository page with issues and pull requests.",
    buttonLabels: ["Code", "Issues"],
    priceStrings: [],
  });

  assert.equal(mission.commerceIntent.isShoppingPage, false);
  assert.equal(mission.trust.score, 95);
  assert.equal(mission.estimatedTrueTotal, null);
  assert.equal(mission.alternatives.length, 0);
  assert.match(mission.summary, /not a commerce page/i);
});

for (const fixture of checkoutFixtures) {
  test(`fixture corpus: ${fixture.id}`, () => {
    const result = analyzeCheckoutContext({
      domain: fixture.domain,
      url: fixture.url,
      pageText: fixture.pageText,
      buttonLabels: fixture.buttonLabels,
      priceStrings: fixture.priceStrings,
      timerElements: fixture.timerElements,
      stockAlerts: fixture.stockAlerts,
    });

    assert.equal(result.isShoppingPage, fixture.expected.isShoppingPage);
    assert.equal(result.pageType, fixture.expected.pageType);

    if (typeof fixture.expected.minPatterns === "number") {
      assert.ok(
        result.totalPatternsDetected >= fixture.expected.minPatterns,
        `expected at least ${fixture.expected.minPatterns} patterns, got ${result.totalPatternsDetected}`,
      );
    }
    if (typeof fixture.expected.trustScoreAtMost === "number") {
      assert.ok(
        result.trustScore <= fixture.expected.trustScoreAtMost,
        `expected trust <= ${fixture.expected.trustScoreAtMost}, got ${result.trustScore}`,
      );
    }
    if (typeof fixture.expected.trustScoreAtLeast === "number") {
      assert.ok(
        result.trustScore >= fixture.expected.trustScoreAtLeast,
        `expected trust >= ${fixture.expected.trustScoreAtLeast}, got ${result.trustScore}`,
      );
    }
    if (typeof fixture.expected.hiddenFees === "boolean") {
      assert.equal(result.hiddenFees.detected, fixture.expected.hiddenFees);
    }
    if (typeof fixture.expected.urgency === "boolean") {
      assert.equal(result.falseUrgency.detected, fixture.expected.urgency);
    }
    if (typeof fixture.expected.scarcity === "boolean") {
      assert.equal(result.falseScarcity.detected, fixture.expected.scarcity);
    }
    if (typeof fixture.expected.preCheckedAddOns === "boolean") {
      assert.equal(result.preCheckedAddOns.detected, fixture.expected.preCheckedAddOns);
    }
  });
}

test("fixture corpus mission uses safer alternatives on manipulative travel flows", () => {
  const hotelFixture = checkoutFixtures.find((fixture) => fixture.id === "hotel-manipulative-booking");
  assert.ok(hotelFixture, "missing hotel fixture");

  const mission = buildAgenticMission({
    domain: hotelFixture.domain,
    url: hotelFixture.url,
    purchaseGoal: "Find the safest hotel checkout path",
    budget: 200,
    listedPrice: 165,
    pageText: hotelFixture.pageText,
    buttonLabels: hotelFixture.buttonLabels,
    priceStrings: hotelFixture.priceStrings,
    compareAcrossSites: true,
    allowAutoDeclineUpsells: true,
  });

  assert.equal(mission.commerceIntent.isShoppingPage, true);
  assert.ok(mission.alternatives.length > 0);
  assert.ok(["switch", "proceed_with_caution"].includes(mission.recommendation));
  assert.equal(mission.ghostCheckout.mode, "simulated_supervised");
  assert.ok((mission.ghostCheckout.hiddenCostLanes?.length ?? 0) > 0);
  assert.equal(mission.ghostCheckout.saferPathMode.available, true);
  assert.ok(Array.isArray(mission.dealIntelligence?.items));
});

test("deal intelligence marks generic countdown-based claims as likely misleading", () => {
  const result = analyzeDealIntelligence({
    domain: "amazon.com",
    url: "https://www.amazon.com/s?k=headphones",
    pageText: "Limited time deal ends in 01:59. 400+ bought in the last month.",
    timerElements: ["Deal ends in 01:59"],
    stockAlerts: ["Only 2 left in stock", "21 people viewing this item right now"],
    productCandidates: [
      {
        title: "Wireless Headphones X200",
        listedPrice: 49.99,
        currency: "USD",
        dealSignals: ["limited time deal", "only 2 left in stock"],
      },
    ],
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.status, "likely_misleading");
  assert.ok(result.items[0]?.evidence?.length > 0);
  assert.ok(result.items[0]?.trustVerification);
  assert.ok(["REAL", "FAKE", "UNCERTAIN"].includes(result.items[0]!.trustVerification.reality));
  assert.ok(["GOOD", "AVERAGE", "BAD"].includes(result.items[0]!.trustVerification.deal_quality));
  assert.ok(["ACT_FAST", "COMPARE_OPTIONS", "RELAX_IGNORE"].includes(result.items[0]!.trustVerification.final_advice));
  assert.equal(typeof result.items[0]!.trustVerification.confidence_score, "number");
  assert.ok(result.items[0]!.trustVerification.confidence_score >= 0 && result.items[0]!.trustVerification.confidence_score <= 1);
  assert.ok(result.items[0]!.trustVerification.checks?.pattern_check);
  assert.equal(typeof result.items[0]!.trustVerification.signal_tally?.strong_fake, "number");
});

test("deal intelligence downgrades repeated limited-deal pressure across multiple products", () => {
  const result = analyzeDealIntelligence({
    domain: "amazon.in",
    url: "https://www.amazon.in/gp/goldbox",
    pageText: "Limited time deal offers across product grid.",
    timerElements: ["Ends in 11:07:48"],
    stockAlerts: ["Selling fast"],
    productCandidates: [
      { title: "OnePlus Pad Go 2", listedPrice: 33499, currency: "INR", dealSignals: ["limited time deal"] },
      { title: "OnePlus Pad Lite", listedPrice: 17999, currency: "INR", dealSignals: ["limited time deal"] },
      { title: "iQOO 15R", listedPrice: 47998, currency: "INR", dealSignals: ["limited time deal"] },
    ],
  });

  const misleading = result.items.filter((item) => item.status === "likely_misleading");
  assert.ok(misleading.length >= 2);
});

test("deal intelligence uses historical scarcity repetition as evidence of likely FOMO manipulation", () => {
  const result = analyzeDealIntelligence({
    domain: "myntra.com",
    url: "https://www.myntra.com/men-tshirts",
    pageText: "Only few left! Limited time deal.",
    productCandidates: [
      {
        title: "Highlander Men T-shirt",
        listedPrice: 174,
        currency: "INR",
        dealSignals: ["only few left", "limited time deal"],
        historySnapshot: {
          observations: 6,
          scarcityClaimRate: 0.92,
          uniquePricePoints: 4,
        },
      },
    ],
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.status, "likely_misleading");
  assert.ok(result.items[0]?.evidence.some((item: string) => /history/i.test(item)));
});

test("mission recommendation de-risks when deal authenticity is likely misleading", () => {
  const mission = buildAgenticMission({
    domain: "amazon.com",
    url: "https://www.amazon.com/s?k=headphones",
    purchaseGoal: "Find the safest and most genuine deal",
    listedPrice: 49.99,
    pageText: "Limited time deal ends in 01:59. 20 people viewing this right now.",
    timerElements: ["Deal ends in 01:59"],
    stockAlerts: ["Only 1 left at this price", "20 people viewing this now"],
    productCandidates: [
      {
        title: "Wireless Headphones X200",
        listedPrice: 49.99,
        currency: "USD",
        dealSignals: ["limited time deal", "only 1 left"],
      },
    ],
  });

  assert.ok(mission.dealIntelligence.items.some((item: any) => item.status === "likely_misleading"));
  assert.ok(["switch", "proceed_with_caution"].includes(mission.recommendation));
});
