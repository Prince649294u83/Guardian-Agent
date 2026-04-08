import { analyzeCheckoutContext } from "./checkout-analysis";
import { computeTrustTier, type TrustTier } from "./trust-rating";
import { analyzeDealIntelligence, type ProductCandidateInput } from "./deal-intelligence";

type MissionCategory = "hotel" | "airline" | "marketplace" | "car_rental";
type MissionTier = TrustTier;
type Recommendation = "proceed" | "proceed_with_caution" | "switch";
type ActionStatus = "completed" | "recommended" | "approval_required";

export type AgenticMissionRequest = {
  domain: string;
  url?: string;
  pageType?: string;
  bookingType?: string;
  isBookingPlatform?: boolean;
  route?: { from?: string; to?: string; display?: string } | null;
  purchaseGoal: string;
  budget?: number;
  listedPrice?: number;
  category?: MissionCategory;
  preferences?: string[];
  allowAccountCreation?: boolean;
  allowAutoDeclineUpsells?: boolean;
  compareAcrossSites?: boolean;
  pageText?: string;
  priceStrings?: string[];
  buttonLabels?: string[];
  timerElements?: string[];
  stockAlerts?: string[];
  variantUrgency?: string[];
  productCandidates?: ProductCandidateInput[];
};

type MissionSignal = {
  type: string;
  label: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  evidence: string;
  whyItMatters: string;
  fix: string;
};

type MissionAction = {
  title: string;
  detail: string;
  status: ActionStatus;
};

type GhostCheckoutStep = {
  label: string;
  status: "completed" | "planned" | "watch";
  detail: string;
};

type GhostCheckoutLane = {
  label: string;
  amount: number;
  confidence: "high" | "medium" | "low";
  source: string;
};

type MissionAlternative = {
  domain: string;
  merchantName: string;
  listedPrice: number;
  estimatedTrueTotal: number;
  trustScore: number;
  trustTier: MissionTier;
  bestValue: boolean;
  why: string[];
};

type GhostCheckoutPlan = {
  mode: "disabled" | "simulated_supervised";
  status: string;
  revealedTotal: number | null;
  deltaFromHeadline: number | null;
  hiddenCostLanes: GhostCheckoutLane[];
  fakePressureSummary: string[];
  saferPathMode: {
    available: boolean;
    label: string;
    detail: string;
  };
  supervisedSteps: GhostCheckoutStep[];
  deliveryThreshold?: {
    threshold: number | null;
    needsMore: number | null;
    hasFreeDelivery: boolean;
    note: string;
  };
  platformFeeRisk?: {
    risk: "high" | "medium" | "low";
    likelihood: number;
    estimatedFee: number;
    reasoning: string;
  };
};

type MissionProfile = {
  merchantName: string;
  category: MissionCategory;
  trustScore: number;
  listedMarkupRate: number;
  hiddenFeeRate: number;
  alternativeDomains: string[];
  signals: MissionSignal[];
  credibilitySignals: string[];
};

type FeeEstimate = {
  fees: number;
  confidence: "high" | "medium" | "low";
  breakdown: GhostCheckoutLane[];
  platformFeeRisk: {
    risk: "high" | "medium" | "low";
    likelihood: number;
    estimatedFee: number;
    reasoning: string;
  };
};

type RecommendationDetails = {
  action: Recommendation;
  summary: string;
  reasoning: string[];
  nextSteps: string[];
};

const PROFILE_MAP: Record<string, MissionProfile> = {
  "booking.com": {
    merchantName: "Booking.com",
    category: "hotel",
    trustScore: 29,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.24,
    alternativeDomains: ["hotels.com", "expedia.com", "airbnb.com"],
    credibilitySignals: ["Large inventory coverage", "Strong hotel selection depth", "Reliable confirmation flows"],
    signals: [
      {
        type: "false_urgency",
        label: "False Urgency",
        severity: "high",
        confidence: 0.93,
        evidence: "Countdown and price-lock language appears before taxes and mandatory charges are shown.",
        whyItMatters: "It pressures the shopper into committing before the true total is visible.",
        fix: "Show the timer only when the inventory event is verifiable for that session.",
      },
      {
        type: "hidden_fees",
        label: "Hidden Fees",
        severity: "high",
        confidence: 0.95,
        evidence: "Resort and sustainability charges often surface late in the booking path.",
        whyItMatters: "The shopper anchors on a low headline price and discovers the real total only after sunk cost kicks in.",
        fix: "Roll mandatory charges into the first quoted price and keep them visible all the way through checkout.",
      },
      {
        type: "prechecked_addons",
        label: "Pre-Checked Add-Ons",
        severity: "medium",
        confidence: 0.9,
        evidence: "Insurance and promotional extras are frequently shown as default-on options.",
        whyItMatters: "It converts inattention into extra spend.",
        fix: "Leave optional protection and upsells off by default.",
      },
    ],
  },
  "makemytrip.com": {
    merchantName: "MakeMyTrip",
    category: "hotel",
    trustScore: 34,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.19,
    alternativeDomains: ["goibibo.com", "booking.com", "agoda.com"],
    credibilitySignals: ["Wide India travel inventory", "Fast hotel and flight packaging", "Established checkout infrastructure"],
    signals: [
      {
        type: "false_scarcity",
        label: "False Scarcity",
        severity: "medium",
        confidence: 0.88,
        evidence: "Low-stock banners and recent-booking counters are commonly used near room selection.",
        whyItMatters: "It increases FOMO before taxes and extras are fully understood.",
        fix: "Use demand and availability messaging only when tied to verified live inventory.",
      },
      {
        type: "hidden_fees",
        label: "Late Fee Disclosure",
        severity: "high",
        confidence: 0.9,
        evidence: "Convenience fees and taxes can remain unclear until late in the flow.",
        whyItMatters: "The user may approve an option that is already over budget.",
        fix: "Promote the final payable amount earlier in the journey.",
      },
    ],
  },
  "united.com": {
    merchantName: "United Airlines",
    category: "airline",
    trustScore: 43,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.17,
    alternativeDomains: ["delta.com", "southwest.com", "jetblue.com"],
    credibilitySignals: ["Direct airline booking channel", "Stable reservation and refund records", "Clear post-purchase itinerary management"],
    signals: [
      {
        type: "misdirection",
        label: "Misdirection",
        severity: "high",
        confidence: 0.91,
        evidence: "Seat upgrades and baggage options dominate the flow while baseline choices are visually downplayed.",
        whyItMatters: "The cheapest acceptable path becomes harder to find than the upsell path.",
        fix: "Make the standard path equal in prominence to the upgraded path.",
      },
      {
        type: "prechecked_addons",
        label: "Default Extras",
        severity: "medium",
        confidence: 0.86,
        evidence: "Protection and expedited airport products are presented as default or strongly suggested add-ons.",
        whyItMatters: "The shopper can end up paying for extras that are not aligned with their preferences.",
        fix: "Ask for explicit consent before any optional add-on is applied.",
      },
    ],
  },
  "amazon.com": {
    merchantName: "Amazon",
    category: "marketplace",
    trustScore: 68,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.08,
    alternativeDomains: ["walmart.com", "bestbuy.com", "etsy.com"],
    credibilitySignals: ["Strong fulfillment reliability", "Fast delivery estimates", "Large seller ecosystem with reviews"],
    signals: [
      {
        type: "prechecked_addons",
        label: "Subscription Steering",
        severity: "medium",
        confidence: 0.79,
        evidence: "Prime trials and protection plans may be positioned as the default convenience path.",
        whyItMatters: "A low-friction checkout can still quietly nudge users into recurring spend.",
        fix: "Present trial and warranty options only after the baseline purchase path is complete.",
      },
    ],
  },
  "amazon.in": {
    merchantName: "Amazon India",
    category: "marketplace",
    trustScore: 80,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.04,
    alternativeDomains: ["flipkart.com", "ajio.com", "myntra.com"],
    credibilitySignals: ["Transparent tax display on most PDP flows", "Strong delivery and fulfillment reliability in India", "Lower pattern intensity than fashion-led marketplaces"],
    signals: [
      {
        type: "subscription_steering",
        label: "Subscription Steering",
        severity: "low",
        confidence: 0.71,
        evidence: "Prime and card-linked benefits may be highlighted before the baseline purchase choice.",
        whyItMatters: "Shoppers can be nudged into extra commitments while trying to secure a deal quickly.",
        fix: "Keep the buy path clear even when loyalty benefits are promoted.",
      },
    ],
  },
  "myntra.com": {
    merchantName: "Myntra",
    category: "marketplace",
    trustScore: 62,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.13,
    alternativeDomains: ["amazon.in", "flipkart.com", "ajio.com"],
    credibilitySignals: ["Strong fashion assortment", "Readable PDP pricing for headline offers", "Reasonably clear refund and delivery messaging on supported items"],
    signals: [
      {
        type: "false_scarcity",
        label: "Scarcity Pressure",
        severity: "medium",
        confidence: 0.84,
        evidence: "Low-stock chips and size-level urgency are used heavily around apparel variants.",
        whyItMatters: "It can push the shopper to rush before checking whether the price is genuinely competitive elsewhere.",
        fix: "Show variant inventory only when it is session-specific and validated against live stock.",
      },
      {
        type: "price_opacity",
        label: "Platform Fee Risk",
        severity: "medium",
        confidence: 0.76,
        evidence: "Fashion marketplaces can introduce platform or shipping fees late for lower-value carts.",
        whyItMatters: "The product page can look cheap while the payable total drifts upward at checkout.",
        fix: "Preview platform fees and delivery thresholds before the shopper reaches the bag.",
      },
    ],
  },
  "flipkart.com": {
    merchantName: "Flipkart",
    category: "marketplace",
    trustScore: 75,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.08,
    alternativeDomains: ["amazon.in", "myntra.com", "ajio.com"],
    credibilitySignals: ["Competitive marketplace pricing in India", "Better fee predictability on many standard carts", "Good delivery network coverage"],
    signals: [
      {
        type: "upsell_pressure",
        label: "Upsell Pressure",
        severity: "low",
        confidence: 0.68,
        evidence: "Protection and exchange nudges can be added around cart and delivery preference steps.",
        whyItMatters: "Shoppers can pay more than intended even when the headline deal is fine.",
        fix: "Keep optional protection and exchange upgrades off unless chosen explicitly.",
      },
    ],
  },
  "ajio.com": {
    merchantName: "Ajio",
    category: "marketplace",
    trustScore: 72,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.1,
    alternativeDomains: ["amazon.in", "flipkart.com", "myntra.com"],
    credibilitySignals: ["Relevant India fashion benchmark", "Competitive fashion discounts", "Moderate checkout complexity relative to peers"],
    signals: [
      {
        type: "discount_anchoring",
        label: "Heavy Discount Anchoring",
        severity: "medium",
        confidence: 0.74,
        evidence: "Large markdown percentages are frequently foregrounded in fashion listings.",
        whyItMatters: "Shoppers may focus on the size of the discount instead of the final payable value.",
        fix: "Pair discount claims with recent price history or payable total context.",
      },
    ],
  },
  "airbnb.com": {
    merchantName: "Airbnb",
    category: "hotel",
    trustScore: 63,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.22,
    alternativeDomains: ["booking.com", "vrbo.com", "hotels.com"],
    credibilitySignals: ["Strong listing depth", "Rich review data", "Good refund and host messaging history"],
    signals: [
      {
        type: "hidden_fees",
        label: "Cleaning and Service Fees",
        severity: "medium",
        confidence: 0.89,
        evidence: "Cleaning and platform fees can materially shift the final price.",
        whyItMatters: "The best-looking nightly rate may not be the best total price.",
        fix: "Sort and compare by full stay total rather than headline nightly price.",
      },
    ],
  },
  "etsy.com": {
    merchantName: "Etsy",
    category: "marketplace",
    trustScore: 90,
    listedMarkupRate: 1,
    hiddenFeeRate: 0.04,
    alternativeDomains: ["amazon.com", "ebay.com", "bestbuy.com"],
    credibilitySignals: ["Transparent checkout copy", "Generally neutral purchase path", "Low prevalence of aggressive conversion patterns"],
    signals: [],
  },
};

const ALTERNATIVE_MAP: Record<string, { merchantName: string; trustScore: number; baseDelta: number; feeRate: number }> = {
  "hotels.com": { merchantName: "Hotels.com", trustScore: 72, baseDelta: -0.04, feeRate: 0.14 },
  "expedia.com": { merchantName: "Expedia", trustScore: 58, baseDelta: -0.03, feeRate: 0.17 },
  "agoda.com": { merchantName: "Agoda", trustScore: 61, baseDelta: -0.02, feeRate: 0.16 },
  "goibibo.com": { merchantName: "Goibibo", trustScore: 56, baseDelta: -0.05, feeRate: 0.15 },
  "delta.com": { merchantName: "Delta", trustScore: 74, baseDelta: -0.01, feeRate: 0.11 },
  "southwest.com": { merchantName: "Southwest", trustScore: 81, baseDelta: 0.02, feeRate: 0.09 },
  "jetblue.com": { merchantName: "JetBlue", trustScore: 70, baseDelta: -0.02, feeRate: 0.1 },
  "walmart.com": { merchantName: "Walmart", trustScore: 73, baseDelta: -0.05, feeRate: 0.05 },
  "bestbuy.com": { merchantName: "Best Buy", trustScore: 77, baseDelta: -0.03, feeRate: 0.03 },
  "vrbo.com": { merchantName: "Vrbo", trustScore: 66, baseDelta: -0.06, feeRate: 0.19 },
  "ebay.com": { merchantName: "eBay", trustScore: 64, baseDelta: -0.04, feeRate: 0.06 },
  "amazon.in": { merchantName: "Amazon India", trustScore: 80, baseDelta: -0.02, feeRate: 0.04 },
  "flipkart.com": { merchantName: "Flipkart", trustScore: 75, baseDelta: -0.03, feeRate: 0.08 },
  "myntra.com": { merchantName: "Myntra", trustScore: 62, baseDelta: 0, feeRate: 0.13 },
  "ajio.com": { merchantName: "Ajio", trustScore: 72, baseDelta: 0.01, feeRate: 0.1 },
};

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "example.com";
}

function inferCategory(domain: string, requested?: MissionCategory): MissionCategory {
  if (requested) return requested;
  const profile = PROFILE_MAP[domain];
  if (profile) return profile.category;
  if (domain.includes("air") || domain.includes("flight")) return "airline";
  if (domain.includes("hotel") || domain.includes("trip") || domain.includes("stay")) return "hotel";
  if (domain.includes("rental")) return "car_rental";
  return "marketplace";
}

function fallbackProfile(domain: string, category: MissionCategory): MissionProfile {
  const trustScore = category === "hotel" ? 46 : category === "airline" ? 54 : category === "car_rental" ? 41 : 62;
  const hiddenFeeRate = category === "hotel" ? 0.18 : category === "airline" ? 0.14 : category === "car_rental" ? 0.28 : 0.07;
  return {
    merchantName: domain,
    category,
    trustScore,
    listedMarkupRate: 1,
    hiddenFeeRate,
    alternativeDomains:
      category === "hotel"
        ? ["hotels.com", "expedia.com", "airbnb.com"]
        : category === "airline"
          ? ["delta.com", "southwest.com", "jetblue.com"]
          : ["walmart.com", "bestbuy.com", "etsy.com"],
    credibilitySignals: ["Functional checkout path", "No verified catastrophic trust signal in the current profile"],
    signals: [
      {
        type: "price_opacity",
        label: "Price Opacity Risk",
        severity: hiddenFeeRate >= 0.15 ? "high" : "medium",
        confidence: 0.71,
        evidence: "This category commonly adds fees late in checkout.",
        whyItMatters: "The first price quote may not represent the final amount the shopper pays.",
        fix: "Run ghost checkout before committing time or emotional energy to the flow.",
      },
    ],
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function isKnownNonCommerceDomain(domain: string): boolean {
  return [
    "github.com",
    "stackoverflow.com",
    "wikipedia.org",
    "docs.python.org",
    "developer.mozilla.org",
    "medium.com",
    "notion.so",
    "vercel.com",
  ].some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
}

function isIndianCommerceDomain(domain: string): boolean {
  return [
    "myntra.com",
    "flipkart.com",
    "ajio.com",
    "tatacliq.com",
    "nykaa.com",
    "meesho.com",
    "amazon.in",
    "makemytrip.com",
    "goibibo.com",
  ].some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
}

function detectFreeDeliveryThreshold(domain: string, currentPrice: number, pageText?: string) {
  const normalizedDomain = normalizeDomain(domain);
  let threshold: number | null = null;

  if (normalizedDomain === "myntra.com" || normalizedDomain === "ajio.com") {
    threshold = 999;
  } else if (normalizedDomain === "flipkart.com") {
    threshold = 500;
  } else if (normalizedDomain === "amazon.in") {
    threshold = 499;
  }

  if (threshold == null && pageText) {
    const match = pageText.match(/₹\s*(\d+)\s*(more)?\s*for\s*free\s*(delivery|shipping)/i);
    if (match?.[1]) {
      threshold = Number(match[1]);
    }
  }

  const hasFreeDelivery = threshold != null ? currentPrice >= threshold : false;
  const needsMore = threshold != null && !hasFreeDelivery ? roundCurrency(threshold - currentPrice) : null;

  return {
    threshold,
    needsMore,
    hasFreeDelivery,
    note:
      threshold == null
        ? "No delivery threshold was confirmed from the current merchant profile."
        : hasFreeDelivery
          ? `The current cart is already past the free-delivery threshold of ${threshold}.`
          : `The current cart is below the free-delivery threshold of ${threshold}.`,
  };
}

function assessPlatformFeeRisk(domain: string, cartValue: number) {
  const normalizedDomain = normalizeDomain(domain);

  if (normalizedDomain === "myntra.com") {
    if (cartValue < 500) {
      return {
        risk: "high" as const,
        likelihood: 0.8,
        estimatedFee: 20,
        reasoning: "Myntra frequently adds platform-fee pressure on low-value carts.",
      };
    }
    if (cartValue < 999) {
      return {
        risk: "medium" as const,
        likelihood: 0.55,
        estimatedFee: 20,
        reasoning: "Myntra carts below the delivery threshold often carry extra platform or shipping friction.",
      };
    }
  }

  if (normalizedDomain === "ajio.com") {
    return {
      risk: cartValue < 999 ? ("medium" as const) : ("low" as const),
      likelihood: cartValue < 999 ? 0.6 : 0.2,
      estimatedFee: cartValue < 999 ? 20 : 0,
      reasoning: "Ajio can add shipping and convenience pressure below the main free-delivery threshold.",
    };
  }

  if (normalizedDomain === "amazon.in") {
    return {
      risk: "low" as const,
      likelihood: 0.1,
      estimatedFee: 0,
      reasoning: "Amazon India usually keeps platform-fee surprises relatively low.",
    };
  }

  if (normalizedDomain === "flipkart.com") {
    return {
      risk: cartValue < 500 ? ("medium" as const) : ("low" as const),
      likelihood: cartValue < 500 ? 0.35 : 0.15,
      estimatedFee: 0,
      reasoning: "Flipkart has lower fee opacity than fashion-first marketplaces, though lower carts may still absorb shipping.",
    };
  }

  return {
    risk: "low" as const,
    likelihood: 0.2,
    estimatedFee: 0,
    reasoning: "No strong merchant-specific late-fee pattern is currently modeled.",
  };
}

function inferShoppingIntent(domain: string, input: AgenticMissionRequest, category: MissionCategory): { isShoppingPage: boolean; reason: string } {
  if (PROFILE_MAP[domain]) {
    return { isShoppingPage: true, reason: "Recognized commerce domain profile." };
  }

  if (isKnownNonCommerceDomain(domain)) {
    return { isShoppingPage: false, reason: "Known non-commerce domain." };
  }

  const pageText = String(input.pageText ?? "").toLowerCase();
  const buttonLabels = Array.isArray(input.buttonLabels) ? input.buttonLabels.join(" ").toLowerCase() : "";
  const priceStrings = Array.isArray(input.priceStrings) ? input.priceStrings : [];
  const productCandidates = Array.isArray(input.productCandidates) ? input.productCandidates : [];
  const keywordMatches = [
    "add to cart",
    "checkout",
    "reserve now",
    "book now",
    "buy now",
    "place order",
    "payment",
    "shipping",
    "tax",
    "insurance",
    "seat selection",
    "trip protection",
  ].filter((keyword) => pageText.includes(keyword) || buttonLabels.includes(keyword)).length;
  const priceSignalCount = priceStrings.filter((value) => /\d/.test(value)).length;
  const productSignalCount = productCandidates.filter((candidate) => typeof candidate?.title === "string" && candidate.title.trim().length > 0).length;
  const hasProductUrlHint = /\/dp\/|\/gp\/product\/|\/product\//.test(String(input.url ?? "").toLowerCase());

  if (
    priceSignalCount >= 2 ||
    keywordMatches >= 2 ||
    productSignalCount >= 2 ||
    (productSignalCount >= 1 && (priceSignalCount >= 1 || keywordMatches >= 1 || hasProductUrlHint))
  ) {
    return { isShoppingPage: true, reason: "Detected commerce language or price signals in the current page context." };
  }

  if (category === "marketplace" && priceSignalCount === 0 && keywordMatches === 0) {
    return { isShoppingPage: false, reason: "No meaningful commerce or checkout signals were found on the current page." };
  }

  return { isShoppingPage: true, reason: "Falling back to a generic commerce heuristic." };
}

function estimateGhostCheckoutCosts(
  domain: string,
  profile: MissionProfile,
  listedPrice: number,
  pageType?: string,
): FeeEstimate {
  const normalizedDomain = normalizeDomain(domain);
  const breakdown: GhostCheckoutLane[] = [];
  let totalFees = 0;
  const platformFeeRisk = assessPlatformFeeRisk(normalizedDomain, listedPrice);

  if (normalizedDomain === "amazon.in" && profile.category === "marketplace") {
    breakdown.push({
      label: listedPrice >= 499 ? "Free delivery" : "Shipping charges",
      amount: listedPrice >= 499 ? 0 : 40,
      confidence: "high",
      source:
        listedPrice >= 499
          ? "Amazon India free-delivery threshold reached"
          : "Amazon India shipping threshold estimate for lower-value carts",
    });

    if (pageType === "checkout") {
      breakdown.push({
        label: "Cash-on-delivery risk",
        amount: 40,
        confidence: "low",
        source: "Optional COD fee estimate if pay-on-delivery is selected",
      });
      totalFees += 40;
    }

    totalFees += listedPrice >= 499 ? 0 : 40;
    breakdown.push({
      label: "Prime membership suggestion",
      amount: 0,
      confidence: "medium",
      source: "Optional Prime upsell may appear, but it is not required for the baseline purchase path",
    });

    return {
      fees: roundCurrency(totalFees),
      confidence: "high",
      breakdown,
      platformFeeRisk,
    };
  }

  if (isIndianCommerceDomain(normalizedDomain) && profile.category === "marketplace") {
    if (listedPrice < 500) {
      if (platformFeeRisk.estimatedFee > 0) {
        breakdown.push({
          label: "Platform fee",
          amount: platformFeeRisk.estimatedFee,
          confidence: platformFeeRisk.risk === "high" ? "high" : "medium",
          source: platformFeeRisk.reasoning,
        });
        totalFees += platformFeeRisk.estimatedFee;
      }
    }

    if (listedPrice < 999 && normalizedDomain !== "flipkart.com" && normalizedDomain !== "amazon.in") {
      breakdown.push({
        label: "Shipping charges",
        amount: 50,
        confidence: "medium",
        source: "Merchant free-delivery threshold estimate for India fashion marketplaces",
      });
      totalFees += 50;
    }

    if (pageType === "checkout") {
      breakdown.push({
        label: "Cash-on-delivery risk",
        amount: 40,
        confidence: "low",
        source: "Optional COD fee estimate if the shopper chooses pay-on-delivery",
      });
      totalFees += 40;
    }

    if (breakdown.length === 0) {
      const fallbackFee = roundCurrency(listedPrice * profile.hiddenFeeRate);
      if (fallbackFee > 0) {
        breakdown.push({
          label: "Estimated platform and tax drift",
          amount: fallbackFee,
          confidence: "medium",
          source: "Fallback India marketplace fee model",
        });
        totalFees += fallbackFee;
      }
    }

    return {
      fees: roundCurrency(totalFees),
      confidence: breakdown.some((lane) => lane.confidence === "high") ? "high" : "medium",
      breakdown,
      platformFeeRisk,
    };
  }

  const defaultTax = roundCurrency(listedPrice * (profile.category === "marketplace" ? 0.08 : profile.hiddenFeeRate * 0.55));
  if (defaultTax > 0) {
    breakdown.push({
      label: profile.category === "marketplace" ? "Taxes and platform fees" : "Taxes and mandatory fees",
      amount: defaultTax,
      confidence: profile.hiddenFeeRate >= 0.18 ? "high" : "medium",
      source: "Category fee model + merchant trust profile",
    });
    totalFees += defaultTax;
  }

  const surcharge = roundCurrency(Math.max(0, listedPrice * profile.hiddenFeeRate - defaultTax));
  if (surcharge > 0) {
    breakdown.push({
      label:
        profile.category === "hotel"
          ? "Mandatory service or resort fees"
          : profile.category === "airline"
            ? "Ancillary checkout pressure"
            : "Late checkout surcharges",
      amount: surcharge,
      confidence: profile.hiddenFeeRate >= 0.18 ? "medium" : "low",
      source: "Ghost-checkout simulation and shared checkout signals",
    });
    totalFees += surcharge;
  }

  return {
    fees: roundCurrency(totalFees),
    confidence: breakdown.some((lane) => lane.confidence === "high") ? "high" : "medium",
    breakdown,
    platformFeeRisk,
  };
}

function buildAlternatives(
  profile: MissionProfile,
  listedPrice: number,
  budget?: number,
  context?: { isBookingPlatform?: boolean; bookingType?: string; route?: { display?: string } | null },
): MissionAlternative[] {
  if (context?.isBookingPlatform) {
    if (context.bookingType === "bus") {
      const busOptions: MissionAlternative[] = [
        {
          domain: "abhibus.com",
          merchantName: "Abhibus",
          listedPrice: roundCurrency(listedPrice * 0.96),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.96 + 15),
          trustScore: 78,
          trustTier: computeTrustTier(78),
          bestValue: false,
          why: ["Lower platform-fee pressure than many aggregator flows", "Often competitive on India intercity bus routes"],
        },
        {
          domain: "zingbus.com",
          merchantName: "Zingbus",
          listedPrice: roundCurrency(listedPrice * 0.95),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.95),
          trustScore: 75,
          trustTier: computeTrustTier(75),
          bestValue: false,
          why: ["Own-fleet pricing can avoid some aggregator fee layering", "Good benchmark when RedBus feels overpriced"],
        },
        {
          domain: "makemytrip.com",
          merchantName: "MakeMyTrip Bus",
          listedPrice: roundCurrency(listedPrice * 0.98),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.98 + 30),
          trustScore: 76,
          trustTier: computeTrustTier(76),
          bestValue: false,
          why: ["Reasonable backup marketplace for route comparison", "Useful if support and route integration matter more than lowest fare"],
        },
      ];
      const best = [...busOptions].sort((a, b) => a.estimatedTrueTotal - b.estimatedTrueTotal)[0];
      return busOptions.map((option) => ({ ...option, bestValue: option.domain === best.domain }));
    }

    if (context.bookingType === "hotel") {
      const hotelOptions: MissionAlternative[] = [
        {
          domain: "booking.com",
          merchantName: "Booking.com",
          listedPrice: roundCurrency(listedPrice * 0.97),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.97),
          trustScore: 82,
          trustTier: computeTrustTier(82),
          bestValue: false,
          why: ["Useful as a broad hotel benchmark", "Often clearer cancellation and property comparison flow"],
        },
        {
          domain: "agoda.com",
          merchantName: "Agoda",
          listedPrice: roundCurrency(listedPrice * 0.95),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.95),
          trustScore: 79,
          trustTier: computeTrustTier(79),
          bestValue: false,
          why: ["Often competitive in Asia-focused hotel pricing", "Worth checking when nightly rates look inflated elsewhere"],
        },
        {
          domain: "makemytrip.com",
          merchantName: "MakeMyTrip Hotels",
          listedPrice: roundCurrency(listedPrice * 0.98),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.98),
          trustScore: 77,
          trustTier: computeTrustTier(77),
          bestValue: false,
          why: ["Useful local support benchmark", "Good fallback when international OTAs feel opaque"],
        },
      ];
      const best = [...hotelOptions].sort((a, b) => a.estimatedTrueTotal - b.estimatedTrueTotal)[0];
      return hotelOptions.map((option) => ({ ...option, bestValue: option.domain === best.domain }));
    }

    if (context.bookingType === "flight") {
      const flightOptions: MissionAlternative[] = [
        {
          domain: "google.com/travel/flights",
          merchantName: "Google Flights",
          listedPrice: roundCurrency(listedPrice * 0.98),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.98),
          trustScore: 85,
          trustTier: computeTrustTier(85),
          bestValue: false,
          why: ["Strong benchmark for fare transparency", "Useful to validate whether aggregator urgency is real"],
        },
        {
          domain: "cleartrip.com",
          merchantName: "Cleartrip",
          listedPrice: roundCurrency(listedPrice * 0.97),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.97),
          trustScore: 78,
          trustTier: computeTrustTier(78),
          bestValue: false,
          why: ["Cleaner UI and fee structure than some travel aggregators", "Worth checking before trusting a rising fare"],
        },
        {
          domain: "direct-airline.example",
          merchantName: "Airline Direct",
          listedPrice: roundCurrency(listedPrice * 0.99),
          estimatedTrueTotal: roundCurrency(listedPrice * 0.99),
          trustScore: 88,
          trustTier: computeTrustTier(88),
          bestValue: false,
          why: ["Direct airline channels are often the most reliable reference", "Helpful to check whether an OTA is layering extra friction"],
        },
      ];
      const best = [...flightOptions].sort((a, b) => a.estimatedTrueTotal - b.estimatedTrueTotal)[0];
      return flightOptions.map((option) => ({ ...option, bestValue: option.domain === best.domain }));
    }
  }

  const options = profile.alternativeDomains.map((domain) => {
    const model = ALTERNATIVE_MAP[domain] ?? {
      merchantName: domain,
      trustScore: 60,
      baseDelta: -0.03,
      feeRate: 0.09,
    };
    const altListed = roundCurrency(listedPrice * (1 + model.baseDelta));
    const estimatedTrueTotal = roundCurrency(altListed * (1 + model.feeRate));
    const trustTier = computeTrustTier(model.trustScore);
    const cheaperThanBudget = typeof budget !== "number" || estimatedTrueTotal <= budget;

    return {
      domain,
      merchantName: model.merchantName,
      listedPrice: altListed,
      estimatedTrueTotal,
      trustScore: model.trustScore,
      trustTier,
      bestValue: false,
      why: [
        model.trustScore >= profile.trustScore ? "Higher trust profile than the current site" : "Useful as a competitive benchmark",
        estimatedTrueTotal < listedPrice ? "Lower expected total than the current headline price" : "Comparable pricing with clearer trust characteristics",
        cheaperThanBudget ? "Still inside the stated budget" : "Worth reviewing if the current site pushes you over budget",
      ],
    };
  });

  const best = [...options].sort((a, b) => {
    const scoreA = a.estimatedTrueTotal - a.trustScore * 0.45;
    const scoreB = b.estimatedTrueTotal - b.trustScore * 0.45;
    return scoreA - scoreB;
  })[0];

  return options.map((option) => ({
    ...option,
    bestValue: option.domain === best.domain,
  }));
}

function buildRecommendation(
  profile: MissionProfile,
  trustTier: MissionTier,
  sharedAnalysis: ReturnType<typeof analyzeCheckoutContext>,
  dealIntelligence: ReturnType<typeof analyzeDealIntelligence>,
  estimatedTrueTotal: number,
  listedPrice: number,
  withinBudget: boolean | null,
  alternatives: MissionAlternative[],
): RecommendationDetails {
  const bestAlternative = alternatives.find((alternative) => alternative.bestValue);
  const misleadingItems = dealIntelligence.items.filter(
    (item) => item.status === "likely_misleading" && item.confidence !== "low",
  );
  const flags = Array.isArray(sharedAnalysis.manipulationFlags) ? sharedAnalysis.manipulationFlags : [];
  const hasTimerReset = flags.some((flag) => flag.type === "timer_reset");
  const hasPriceInflation = flags.some((flag) => flag.type === "price_inflation");
  const hasSubscriptionSteering = flags.some((flag) => flag.type === "subscription_steering");
  const delta = roundCurrency(estimatedTrueTotal - listedPrice);

  if (
    bestAlternative &&
    bestAlternative.estimatedTrueTotal < estimatedTrueTotal * 0.95 &&
    bestAlternative.trustScore >= profile.trustScore + 5
  ) {
    return {
      action: "switch",
      summary: `${bestAlternative.merchantName} offers better value after fees`,
      reasoning: [
        `${bestAlternative.merchantName} looks meaningfully cheaper after fees than ${profile.merchantName}.`,
        `${bestAlternative.merchantName} also carries a stronger trust score (${bestAlternative.trustScore} vs ${profile.trustScore}).`,
      ],
      nextSteps: [
        `Open ${bestAlternative.merchantName} and compare the same product there.`,
        "Re-run Guardian Mission before buying.",
      ],
    };
  }

  if (trustTier === "high_manipulation" || misleadingItems.length > 0 || withinBudget === false) {
    return {
      action: "switch",
      summary: "The current path looks too risky to trust",
      reasoning: [
        "The current merchant or offer path shows strong manipulation or misleading-deal signals.",
        ...(withinBudget === false ? ["The estimated final total also exceeds the stated budget."] : []),
      ],
      nextSteps: [
        "Treat the current deal claims cautiously.",
        "Compare at least one alternative merchant before committing.",
      ],
    };
  }

  if (profile.trustScore >= 75 && (hasTimerReset || hasPriceInflation || hasSubscriptionSteering)) {
    return {
      action: "proceed_with_caution",
      summary: "Trustworthy merchant, but manipulative tactics are still present",
      reasoning: [
        `${profile.merchantName} is generally a stronger merchant in this category.`,
        ...(hasTimerReset ? ["A countdown or urgency signal appears to reset, which makes the urgency hard to trust."] : []),
        ...(hasPriceInflation ? ["The discount framing may be overstated because the original price is too close to the current price."] : []),
        ...(hasSubscriptionSteering ? ["Membership or subscription benefits are being pushed before the baseline purchase path is settled."] : []),
      ],
      nextSteps: [
        "Verify the final total before purchase.",
        "Ignore optional subscription pressure unless you truly want it.",
        "Refresh once and re-check whether the urgency claim remains consistent.",
      ],
    };
  }

  if (profile.trustScore >= 75 && delta < 50 && misleadingItems.length === 0) {
    return {
      action: "proceed",
      summary: "Cleaner checkout path with limited hidden-cost drift",
      reasoning: [
        "The merchant trust profile is solid for this category.",
        "Guardian did not find strong misleading-deal evidence on the current offer.",
        "The hidden-cost drift looks relatively contained.",
      ],
      nextSteps: ["Proceed, but keep Guardian active through the final payment step."],
    };
  }

  return {
    action: "proceed_with_caution",
    summary: "Usable path, but some verification is still needed",
    reasoning: [
      "The current path is not clearly unsafe, but Guardian cannot fully verify every claim yet.",
      "Optional extras and final checkout charges still deserve a closer look.",
    ],
    nextSteps: [
      "Verify the final total at checkout.",
      "Avoid optional add-ons unless they match your preferences.",
      "Compare one alternative if the deal still feels rushed or unclear.",
    ],
  };
}

export function buildAgenticMission(input: AgenticMissionRequest) {
  const domain = normalizeDomain(input.domain);
  const category = inferCategory(domain, input.category);
  const sharedAnalysis = analyzeCheckoutContext({
    domain,
    url: input.url,
    pageText: input.pageText,
    priceStrings: input.priceStrings,
    buttonLabels: input.buttonLabels,
    timerElements: input.timerElements,
    stockAlerts: input.stockAlerts,
    variantUrgency: input.variantUrgency,
    productCandidates: input.productCandidates,
  });
  const dealIntelligence = analyzeDealIntelligence({
    domain,
    url: input.url,
    pageType: input.pageType,
    pageText: input.pageText,
    hasTimer: input.timerElements?.length ? true : undefined,
    timerElements: input.timerElements,
    stockAlerts: input.stockAlerts,
    productCandidates: input.productCandidates,
  });
  const shoppingIntent = sharedAnalysis.isShoppingPage
    ? { isShoppingPage: true, reason: "Shared checkout pipeline classified this page as commerce." }
    : inferShoppingIntent(domain, input, category);

  if (!shoppingIntent.isShoppingPage) {
    return {
      missionId: `mission-${domain.replace(/[^a-z0-9]+/g, "-")}`,
      domain,
      url: input.url ?? `https://${domain}`,
      category: "non_commerce",
      objective: input.purchaseGoal,
      listedPrice: null,
      estimatedTrueTotal: null,
      savingsAtRisk: null,
      budget: typeof input.budget === "number" ? roundCurrency(input.budget) : null,
      withinBudget: null,
      recommendation: "proceed",
      commerceIntent: shoppingIntent,
      trust: {
        merchantName: domain,
        score: 95,
        tier: "gold",
        verdict: "This page does not look like a shopping or checkout flow, so Guardian is not estimating a purchase total here.",
        credibilitySignals: ["No checkout signals found", "No price or order flow detected", "Likely non-commerce page"],
      },
      accountAutomation: {
        mode: "disabled",
        status: "Account creation is not relevant on this page.",
        guidance: "Guardian only activates checkout automation on pages that look like real shopping or booking flows.",
      },
      browserAutomation: {
        runtime: "Chrome extension + supervised browser worker",
        method: "Guardian first verifies that the current page is a commerce flow before attempting any price or trust mission.",
        humanApprovalGates: [],
      },
      ghostCheckout: {
        mode: "disabled",
        status: "Ghost checkout is disabled because this page is not a live product, cart, booking, or checkout flow.",
        revealedTotal: null,
        deltaFromHeadline: null,
        hiddenCostLanes: [],
        fakePressureSummary: [],
        saferPathMode: {
          available: false,
          label: "Stay on cheapest safe path",
          detail: "Guardian only enables cheapest-safe-path guidance after it finds a real commerce flow.",
        },
        supervisedSteps: [],
      },
      manipulativeSignals: [],
      alternatives: [],
      bestAlternative: null,
      actionLog: [
        {
          title: "Mission gated",
          detail: `Skipped checkout mission on ${domain} because the page does not appear to be a shopping flow.`,
          status: "completed",
        },
      ],
      nextBestAction: "Open a product, booking, cart, or checkout page before running Guardian Mission.",
      summary: "Guardian detected that this is not a commerce page, so it did not estimate a price or compare shopping alternatives.",
      recommendationDetails: {
        action: "proceed",
        summary: "No shopping flow detected",
        reasoning: ["Guardian did not find a live commerce flow on this page."],
        nextSteps: ["Open a product, booking, cart, or checkout page before running the mission again."],
      },
      preferences: input.preferences ?? [],
      dealIntelligence,
    };
  }

  const profile = PROFILE_MAP[domain] ?? fallbackProfile(domain, category);
  const listedPrice = roundCurrency(
    typeof input.listedPrice === "number" && Number.isFinite(input.listedPrice)
      ? input.listedPrice
      : category === "hotel"
        ? 165
        : category === "airline"
          ? 189
          : category === "car_rental"
            ? 72
            : 49.99,
  );
  const feeEstimate = estimateGhostCheckoutCosts(domain, profile, listedPrice, input.pageType);
  const deliveryThreshold = detectFreeDeliveryThreshold(domain, listedPrice, input.pageText);
  const estimatedTrueTotal = roundCurrency(listedPrice * profile.listedMarkupRate + feeEstimate.fees);
  const savingsAtRisk = roundCurrency(estimatedTrueTotal - listedPrice);
  const tier = computeTrustTier(profile.trustScore);
  const withinBudget = typeof input.budget !== "number" ? null : estimatedTrueTotal <= input.budget;
  const alternatives =
    input.compareAcrossSites === false
      ? []
      : buildAlternatives(profile, listedPrice, input.budget, {
          isBookingPlatform: input.isBookingPlatform,
          bookingType: input.bookingType,
          route: input.route,
        });
  const bestAlternative = alternatives.find((alternative) => alternative.bestValue);
  const recommendationDecision = buildRecommendation(
    profile,
    tier,
    sharedAnalysis,
    dealIntelligence,
    estimatedTrueTotal,
    listedPrice,
    withinBudget,
    alternatives,
  );
  const recommendation = recommendationDecision.action;

  const accountAutomation =
    input.allowAccountCreation
      ? {
          mode: "allowed_with_approval",
          status: "Approval gate required before any signup or credential submission.",
          guidance: "Guardian can draft the signup path, generate an email alias, and stop for user approval before creating an account or storing session state.",
        }
      : {
          mode: "manual_only",
          status: "Account creation disabled for this mission.",
          guidance: "Guardian will analyze the flow, compare alternatives, and prepare the safest next step without creating an account.",
      };

  const hiddenCostLanes: GhostCheckoutLane[] = feeEstimate.breakdown.filter((lane) => lane.amount > 0);

  const fakePressureSummary = [
    ...(sharedAnalysis.falseUrgency.detected ? ["Flagged countdown or price-lock pressure before the real total was visible."] : []),
    ...(sharedAnalysis.falseScarcity.detected ? ["Flagged scarcity or crowd-pressure copy that could manufacture FOMO."] : []),
    ...profile.signals
      .filter((signal) => signal.type === "false_urgency" || signal.type === "false_scarcity")
      .map((signal) => signal.evidence),
  ].slice(0, 3);

  const ghostCheckout: GhostCheckoutPlan = {
    mode: "simulated_supervised",
    status:
      recommendation === "switch"
        ? "Ghost checkout found that the current path is too expensive or manipulative relative to available alternatives."
        : "Ghost checkout estimated the final payable amount before the shopper commits time or account details.",
    revealedTotal: estimatedTrueTotal,
    deltaFromHeadline: savingsAtRisk,
    hiddenCostLanes,
    fakePressureSummary,
    saferPathMode: {
      available: true,
      label: "Stay on cheapest safe path",
      detail:
        recommendation === "switch" && bestAlternative
          ? `Guardian would keep only the lowest-risk path active and redirect the shopper to ${bestAlternative.merchantName} after approval.`
          : "Guardian would keep optional add-ons off, reject upsells, and continue only on the cheapest acceptable path.",
    },
    supervisedSteps: [
      {
        label: "Open a parallel ghost cart",
        status: "completed",
        detail: "Mirror the checkout flow in a supervised browser context without committing payment or account creation.",
      },
      {
        label: "Reveal late fees and total",
        status: "completed",
        detail: `Estimate the real total at ${roundCurrency(estimatedTrueTotal)} before the shopper invests more effort.`,
      },
      ...(deliveryThreshold.threshold != null
        ? [
            {
              label: "Check delivery threshold",
              status: "completed" as const,
              detail: deliveryThreshold.hasFreeDelivery
                ? `Current cart already clears the free-delivery threshold of ${deliveryThreshold.threshold}.`
                : `Current cart is ${deliveryThreshold.needsMore} away from the free-delivery threshold of ${deliveryThreshold.threshold}.`,
            },
          ]
        : []),
      {
        label: "Strip optional extras",
        status: input.allowAutoDeclineUpsells ? "completed" : "planned",
        detail: input.allowAutoDeclineUpsells
          ? "Guardian is prepared to reject optional insurance, upgrades, and bundles."
          : "Guardian will wait for approval before auto-declining optional extras.",
      },
      {
        label: "Hold approval gates",
        status: "watch",
        detail: "Credentials, account creation, merchant switching, and payment remain blocked until the user explicitly approves them.",
      },
    ],
    deliveryThreshold: {
      threshold: deliveryThreshold.threshold,
      needsMore: deliveryThreshold.needsMore,
      hasFreeDelivery: deliveryThreshold.hasFreeDelivery,
      note: deliveryThreshold.note,
    },
    platformFeeRisk: feeEstimate.platformFeeRisk,
  };

  const actionLog: MissionAction[] = [
    {
      title: "Mission scoped",
      detail: `Targeted ${profile.merchantName} for ${category.replace("_", " ")} checkout analysis with the goal: ${input.purchaseGoal}.`,
      status: "completed",
    },
    {
      title: "Ghost checkout planned",
      detail: `Reveal the true total beyond the headline price by walking the checkout path and capturing mandatory fees.`,
      status: "completed",
    },
    {
      title: "Manipulation review",
      detail: profile.signals.length
        ? `Flagged ${profile.signals.length} pressure pattern${profile.signals.length === 1 ? "" : "s"} that can distort the buying decision.`
        : "No major dark-pattern profile was triggered for this site archetype.",
      status: "completed",
    },
    {
      title: "Platform fee risk",
      detail: `${feeEstimate.platformFeeRisk.risk.toUpperCase()} risk: ${feeEstimate.platformFeeRisk.reasoning}`,
      status: "completed",
    },
    {
      title: "Cross-site comparison",
      detail: alternatives.length
        ? `Compared the current offer against ${alternatives.length} alternative checkout paths.`
        : "Alternative comparison skipped because cross-site checking was disabled.",
      status: alternatives.length ? "completed" : "recommended",
    },
    {
      title: "Upsell stripping",
      detail: input.allowAutoDeclineUpsells
        ? "Prepared the agent to reject unnecessary add-ons and stay on the cheapest acceptable path."
        : "Waiting for permission before the agent auto-declines optional upsells.",
      status: input.allowAutoDeclineUpsells ? "completed" : "approval_required",
    },
    {
      title: "Account creation guardrail",
      detail: accountAutomation.status,
      status: input.allowAccountCreation ? "approval_required" : "recommended",
    },
  ];

  const credibilityVerdict =
    tier === "gold" || tier === "clean"
      ? "This merchant looks broadly credible, but Guardian still recommends verifying the final payable amount before checkout."
      : tier === "neutral"
        ? "This merchant is usable, but the pricing path deserves a full review before trusting the headline deal."
        : "This merchant shows enough manipulation risk that Guardian recommends checking alternatives before committing.";

  return {
    missionId: `mission-${domain.replace(/[^a-z0-9]+/g, "-")}`,
    domain,
    url: input.url ?? `https://${domain}/checkout`,
    category,
    objective: input.purchaseGoal,
    listedPrice,
    estimatedTrueTotal,
    savingsAtRisk,
    budget: typeof input.budget === "number" ? roundCurrency(input.budget) : null,
    withinBudget,
    recommendation,
    commerceIntent: shoppingIntent,
    trust: {
      merchantName: profile.merchantName,
      score: profile.trustScore,
      tier,
      verdict: credibilityVerdict,
      credibilitySignals: profile.credibilitySignals,
    },
    accountAutomation,
    browserAutomation: {
      runtime: "Chrome extension + supervised browser worker",
      method: "Use a persistent user-approved browser context for session continuity, then compare checkout paths with ghost-checkout reads before any buy action.",
      humanApprovalGates: [
        "Before creating accounts or submitting credentials",
        "Before purchasing or saving payment methods",
        "Before switching to an alternative merchant",
      ],
    },
    ghostCheckout,
    manipulativeSignals: [
      ...profile.signals,
      ...(sharedAnalysis.falseUrgency.detected
        ? [
            {
              type: "false_urgency",
              label: "False Urgency",
              severity: "high" as const,
              confidence: 0.82,
              evidence: sharedAnalysis.falseUrgency.evidence,
              whyItMatters: "The shopper may rush into the flow before the final price is understood.",
              fix: "Verify whether the timer represents a real expiring offer.",
            },
          ]
        : []),
      ...(sharedAnalysis.falseScarcity.detected
        ? [
            {
              type: "false_scarcity",
              label: "False Scarcity",
              severity: "medium" as const,
              confidence: 0.79,
              evidence: sharedAnalysis.falseScarcity.evidence,
              whyItMatters: "Artificial scarcity increases FOMO and pushes earlier commitment.",
              fix: "Validate stock claims against real inventory before trusting them.",
            },
          ]
        : []),
      ...(sharedAnalysis.hiddenFees.detected
        ? [
            {
              type: "hidden_fees",
              label: "Hidden Fees",
              severity: "high" as const,
              confidence: 0.84,
              evidence: sharedAnalysis.hiddenFees.feeItems.length
                ? `Shared analysis found ${sharedAnalysis.hiddenFees.feeItems.map((item) => item.label).join(", ")}.`
                : "Shared analysis found late fee disclosure risk.",
              whyItMatters: "The headline deal may materially understate the final payable amount.",
              fix: "Force a true-total estimate before recommending the current merchant.",
            },
          ]
        : []),
      ...(input.variantUrgency?.length
        ? [
            {
              type: "variant_pressure",
              label: "Variant urgency",
              severity: "medium" as const,
              confidence: 0.78,
              evidence: input.variantUrgency.slice(0, 2).join(" | "),
              whyItMatters: "Size-level scarcity can create apparel-specific FOMO that feels more real than it actually is.",
              fix: "Verify whether the urgency is variant-specific and persistent before treating it as a reason to rush.",
            },
          ]
        : []),
    ],
    alternatives,
    bestAlternative: bestAlternative ?? null,
    actionLog,
    recommendationDetails: recommendationDecision,
    nextBestAction:
      recommendation === "switch" && bestAlternative
        ? `Switch to ${bestAlternative.merchantName} and re-run the ghost checkout there before buying.`
        : dealIntelligence.items.some((item) => item.status === "likely_misleading")
          ? "Treat the current limited deal claims as potentially misleading and compare at least one alternative before purchase."
        : recommendation === "proceed_with_caution"
          ? "Proceed only after Guardian verifies the final price and strips optional extras."
          : "Proceed, but keep Guardian active through the final payment step for last-second fee changes.",
    summary:
      recommendation === "switch"
        ? `${profile.merchantName} looks costly or manipulative relative to alternatives. Guardian recommends switching before you sink more time into this checkout.`
        : recommendation === "proceed_with_caution"
          ? `${profile.merchantName} may still be usable, but the shopper should not trust the headline price or the conversion nudges without verification. ${recommendationDecision.summary}`
          : `${profile.merchantName} is one of the safer available options, though Guardian should still verify the final price before purchase. ${recommendationDecision.summary}`,
    preferences: input.preferences ?? [],
    dealIntelligence,
  };
}
