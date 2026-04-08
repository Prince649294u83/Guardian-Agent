export type CheckoutPattern = {
  detected: boolean;
  evidence: string;
};

export type CheckoutAnalysisInput = {
  domain: string;
  url?: string;
  pageText?: string;
  timerElements?: string[];
  stockAlerts?: string[];
  variantUrgency?: string[];
  buttonLabels?: string[];
  priceStrings?: string[];
  productCandidates?: Array<{
    title?: string;
    listedPrice?: number | null;
    originalPrice?: number | null;
    dealSignals?: string[] | null;
    timerResetsOnRefresh?: boolean | null;
  }>;
};

export type ManipulationFlag = {
  type: string;
  severity: "high" | "medium" | "low";
  userMessage: string;
  evidence: string;
  actionAdvice: string;
};

export type CheckoutAnalysis = {
  isShoppingPage: boolean;
  pageType: "non_commerce" | "product" | "cart" | "checkout";
  categoryHint: "hotel" | "airline" | "marketplace" | "car_rental";
  trustScore: number;
  falseUrgency: CheckoutPattern & { isTimerFake: boolean | null };
  falseScarcity: CheckoutPattern;
  confirmShaming: { detected: boolean; shamingText: string; rewrittenText: string };
  hiddenFees: { detected: boolean; feeItems: Array<{ label: string; amount: number }>; totalExtra: number | null };
  preCheckedAddOns: { detected: boolean; fieldIds: string[]; addOnLabels: string[] };
  misdirection: { detected: boolean; hiddenDeclineText: string };
  manipulationFlags: ManipulationFlag[];
  totalPatternsDetected: number;
  summary: string;
  nonCommerceReason: string | null;
};

const NON_COMMERCE_DOMAINS = [
  "github.com",
  "stackoverflow.com",
  "wikipedia.org",
  "developer.mozilla.org",
  "docs.python.org",
  "medium.com",
  "notion.so",
  "vercel.com",
];

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "example.com";
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function joinTexts(values: unknown[] | undefined): string {
  return (values ?? [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function detectMarketplaceContextSignals(domain: string, haystack: string, variantUrgencyText: string) {
  const isFashionMarketplace = /myntra|ajio|tatacliq|nykaa|meesho/i.test(domain);
  const sizeUrgencyMatch =
    /only\s*\d+\s*left\s*in\s*(size|this size)|few\s*left\s*in\s*(size|this size)|size\s*[a-z0-9]+\s*.*only\s*\d+\s*left/i.exec(
      `${variantUrgencyText} ${haystack}`,
    );
  const variantPressureMatch = /hurry.*selling\s*fast|running\s*out\s*fast|selling\s*fast/i.exec(`${variantUrgencyText} ${haystack}`);
  const freeDeliveryNudgeMatch =
    /add\s*₹?\s*\d+\s*(more)?\s*for\s*free\s*(shipping|delivery)|₹\s*\d+\s*more\s*for\s*free\s*(shipping|delivery)/i.exec(haystack);
  const platformFeeMatch = /convenience\s*fee|platform\s*fee/i.exec(haystack);

  return {
    isFashionMarketplace,
    sizeUrgencyMatch,
    variantPressureMatch,
    freeDeliveryNudgeMatch,
    platformFeeMatch,
  };
}

function analyzeManipulationFlags(input: CheckoutAnalysisInput, haystack: string): ManipulationFlag[] {
  const products = Array.isArray(input.productCandidates) ? input.productCandidates : [];
  const flags: ManipulationFlag[] = [];

  if (products.some((product) => product?.timerResetsOnRefresh === true)) {
    flags.push({
      type: "timer_reset",
      severity: "high",
      userMessage: "Fake Countdown Detected",
      evidence: "A countdown or timed pressure signal appears to reset on refresh.",
      actionAdvice: "Ignore the timer until the offer survives a refresh and remains consistent.",
    });
  }

  if (
    products.some((product) =>
      typeof product?.originalPrice === "number" &&
      typeof product?.listedPrice === "number" &&
      product.originalPrice > 0 &&
      product.listedPrice >= product.originalPrice * 0.95,
    )
  ) {
    flags.push({
      type: "price_inflation",
      severity: "medium",
      userMessage: "Inflated Original Price",
      evidence: "The advertised discount looks weak because the current price is very close to the original price.",
      actionAdvice: "Treat the markdown carefully and compare with recent price history or alternative merchants.",
    });
  }

  if (/prime|membership|subscribe\s*to\s*save|join.*prime/i.test(haystack)) {
    flags.push({
      type: "subscription_steering",
      severity: "low",
      userMessage: "Membership Pressure",
      evidence: "Subscription or membership benefits are being promoted alongside the purchase path.",
      actionAdvice: "Verify the baseline price without the membership prompt before deciding.",
    });
  }

  return flags;
}

function inferCategoryHint(domain: string, haystack: string): CheckoutAnalysis["categoryHint"] {
  if (domain.includes("air") || haystack.includes("seat selection") || haystack.includes("flight")) return "airline";
  if (domain.includes("hotel") || domain.includes("trip") || haystack.includes("resort fee") || haystack.includes("check-in")) return "hotel";
  if (domain.includes("rental") || haystack.includes("airport pickup") || haystack.includes("daily rate")) return "car_rental";
  return "marketplace";
}

function isKnownNonCommerceDomain(domain: string): boolean {
  return NON_COMMERCE_DOMAINS.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
}

function detectPageType(
  domain: string,
  url: string,
  haystack: string,
  priceCount: number,
  productCandidateCount: number,
): Pick<CheckoutAnalysis, "isShoppingPage" | "pageType" | "nonCommerceReason"> {
  if (isKnownNonCommerceDomain(domain)) {
    return {
      isShoppingPage: false,
      pageType: "non_commerce",
      nonCommerceReason: "Known non-commerce domain.",
    };
  }

  const checkoutSignals = [
    "checkout",
    "place order",
    "payment",
    "reserve now",
    "book now",
    "trip protection",
    "insurance",
    "shipping",
    "subtotal",
    "tax",
    "order summary",
  ].filter((keyword) => haystack.includes(keyword) || url.includes(keyword));

  const cartSignals = ["cart", "basket", "bag", "order summary"].filter((keyword) => haystack.includes(keyword) || url.includes(keyword));
  const productSignals = [
    "add to cart",
    "add to bag",
    "buy now",
    "product details",
    "price",
    "results",
    "ratings",
    "customer review",
    "delivery options",
    "select size",
    "mrp",
    "sponsored",
    "today's deals",
  ].filter((keyword) => haystack.includes(keyword) || url.includes(keyword));

  if (checkoutSignals.length >= 2 || (checkoutSignals.length >= 1 && priceCount >= 2)) {
    return { isShoppingPage: true, pageType: "checkout", nonCommerceReason: null };
  }

  if (cartSignals.length >= 1 && priceCount >= 1) {
    return { isShoppingPage: true, pageType: "cart", nonCommerceReason: null };
  }

  const hasProductUrlHint = /\/dp\/|\/gp\/product\/|\/product\/|\/p\/|\/buy|\/catalog\//.test(url);

  if (productCandidateCount >= 2) {
    return { isShoppingPage: true, pageType: "product", nonCommerceReason: null };
  }

  if (productCandidateCount >= 1 && (priceCount >= 1 || productSignals.length >= 1 || hasProductUrlHint)) {
    return { isShoppingPage: true, pageType: "product", nonCommerceReason: null };
  }

  if (productSignals.length >= 1 && priceCount >= 1) {
    return { isShoppingPage: true, pageType: "product", nonCommerceReason: null };
  }

  return {
    isShoppingPage: false,
    pageType: "non_commerce",
    nonCommerceReason: "No meaningful commerce or checkout signals were found on the current page.",
  };
}

export function analyzeCheckoutContext(input: CheckoutAnalysisInput): CheckoutAnalysis {
  const domain = normalizeDomain(input.domain);
  const url = normalizeText(input.url).toLowerCase();
  const priceText = joinTexts(input.priceStrings);
  const timerText = joinTexts(input.timerElements);
  const stockText = joinTexts(input.stockAlerts);
  const buttonText = joinTexts(input.buttonLabels);
  const variantUrgencyText = joinTexts(input.variantUrgency);
  const bodyText = normalizeText(input.pageText).toLowerCase();
  const haystack = [bodyText, timerText, stockText, variantUrgencyText, buttonText, priceText].filter(Boolean).join(" ");
  const priceCount = (input.priceStrings ?? []).filter((value) => /\d/.test(String(value))).length;
  const productCandidateCount = (input.productCandidates ?? []).filter((candidate) => normalizeText(candidate?.title).length > 0).length;

  const pageInfo = detectPageType(domain, url, haystack, priceCount, productCandidateCount);
  const categoryHint = inferCategoryHint(domain, haystack);

  if (!pageInfo.isShoppingPage) {
    return {
      ...pageInfo,
      categoryHint,
      trustScore: 95,
      falseUrgency: { detected: false, evidence: "", isTimerFake: null },
      falseScarcity: { detected: false, evidence: "" },
      confirmShaming: { detected: false, shamingText: "", rewrittenText: "" },
      hiddenFees: { detected: false, feeItems: [], totalExtra: null },
      preCheckedAddOns: { detected: false, fieldIds: [], addOnLabels: [] },
      misdirection: { detected: false, hiddenDeclineText: "" },
      manipulationFlags: [],
      totalPatternsDetected: 0,
      summary: "Guardian detected that this is not a commerce page, so it did not run checkout analysis.",
    };
  }

  const falseUrgencyDetected =
    /expires|countdown|ends in|price lock|deal ends|last chance/i.test(timerText || haystack);
  const falseScarcityDetected =
    /only \d+|remaining|left at this price|people viewing|selling fast|booked in the last/i.test(stockText || haystack);
  const marketplaceSignals = detectMarketplaceContextSignals(domain, haystack, variantUrgencyText);
  const shamingTextMatch =
    /no thanks[^.]*|i accept the risk[^.]*|i don't care[^.]*|prefer to miss the best deal[^.]*/i.exec(haystack);
  const hiddenFeesDetected =
    /resort fee|service fee|processing fee|convenience fee|destination fee|mandatory fee|platform fee/i.test(haystack);
  const preCheckedAddOnDetected =
    /pre-checked|prechecked|\[pre-checked\]|\[prechecked\]|travel insurance|trip protection|protection plan/i.test(haystack);
  const misdirectionTextMatch =
    /tiny link|below fold|low-contrast|gray text|hidden decline|small text/i.exec(haystack);

  const totalPatternsDetected = [
    falseUrgencyDetected,
    falseScarcityDetected || Boolean(marketplaceSignals.sizeUrgencyMatch) || Boolean(marketplaceSignals.variantPressureMatch),
    Boolean(shamingTextMatch),
    hiddenFeesDetected || Boolean(marketplaceSignals.platformFeeMatch),
    preCheckedAddOnDetected,
    Boolean(misdirectionTextMatch),
    Boolean(marketplaceSignals.freeDeliveryNudgeMatch),
  ].filter(Boolean).length;

  const trustScore = Math.max(
    20,
    92 -
      totalPatternsDetected * 12 -
      (pageInfo.pageType === "checkout" ? 0 : 6) -
      (marketplaceSignals.isFashionMarketplace && marketplaceSignals.sizeUrgencyMatch ? 4 : 0),
  );
  const hiddenFeeAmount =
    hiddenFeesDetected || marketplaceSignals.platformFeeMatch
      ? categoryHint === "hotel"
        ? 24.99
        : categoryHint === "airline"
          ? 19.99
          : marketplaceSignals.platformFeeMatch
            ? 20
            : 12.99
      : null;
  const defaultAddOnLabel =
    categoryHint === "airline" ? "Trip Protection" : categoryHint === "hotel" ? "Travel Insurance" : "Protection Plan";
  const falseScarcityEvidenceParts = [
    falseScarcityDetected ? "Detected scarcity or crowd-pressure copy suggesting limited stock or high demand." : "",
    marketplaceSignals.sizeUrgencyMatch ? `Variant-level urgency detected: ${marketplaceSignals.sizeUrgencyMatch[0]}.` : "",
    marketplaceSignals.variantPressureMatch ? `Fast-moving apparel pressure detected: ${marketplaceSignals.variantPressureMatch[0]}.` : "",
  ].filter(Boolean);
  const hiddenFeeEvidenceParts = [
    hiddenFeesDetected ? "Late fee disclosure language was detected in the checkout copy." : "",
    marketplaceSignals.platformFeeMatch ? `Platform fee warning detected: ${marketplaceSignals.platformFeeMatch[0]}.` : "",
    marketplaceSignals.freeDeliveryNudgeMatch ? `Free-delivery threshold nudge detected: ${marketplaceSignals.freeDeliveryNudgeMatch[0]}.` : "",
  ].filter(Boolean);
  const manipulationFlags = analyzeManipulationFlags(input, haystack);

  return {
    ...pageInfo,
    categoryHint,
    trustScore,
    falseUrgency: {
      detected: falseUrgencyDetected,
      evidence: falseUrgencyDetected ? "Detected countdown or expiry language that pressures faster checkout decisions." : "",
      isTimerFake: falseUrgencyDetected ? true : null,
    },
    falseScarcity: {
      detected: falseScarcityDetected || Boolean(marketplaceSignals.sizeUrgencyMatch) || Boolean(marketplaceSignals.variantPressureMatch),
      evidence: falseScarcityEvidenceParts.join(" "),
    },
    confirmShaming: {
      detected: Boolean(shamingTextMatch),
      shamingText: shamingTextMatch?.[0] ?? "",
      rewrittenText: shamingTextMatch ? "No thanks" : "",
    },
    hiddenFees: {
      detected: hiddenFeesDetected || Boolean(marketplaceSignals.platformFeeMatch) || Boolean(marketplaceSignals.freeDeliveryNudgeMatch),
      feeItems:
        hiddenFeeAmount != null
          ? [
              {
                label: marketplaceSignals.platformFeeMatch
                  ? "Platform fee risk"
                  : marketplaceSignals.freeDeliveryNudgeMatch
                    ? "Delivery threshold pressure"
                    : "Mandatory service fee",
                amount: hiddenFeeAmount,
              },
            ]
          : [],
      totalExtra: hiddenFeeAmount,
    },
    preCheckedAddOns: {
      detected: preCheckedAddOnDetected,
      fieldIds: preCheckedAddOnDetected ? ["default-addon"] : [],
      addOnLabels: preCheckedAddOnDetected ? [defaultAddOnLabel] : [],
    },
    misdirection: {
      detected: Boolean(misdirectionTextMatch),
      hiddenDeclineText: misdirectionTextMatch?.[0] ?? "",
    },
    manipulationFlags,
    totalPatternsDetected,
    summary:
      totalPatternsDetected === 0
        ? "No major dark patterns were detected in this checkout flow."
        : `Detected ${totalPatternsDetected} dark pattern signal${totalPatternsDetected === 1 ? "" : "s"} in this checkout flow.${hiddenFeeEvidenceParts.length ? ` ${hiddenFeeEvidenceParts.join(" ")}` : ""}`,
  };
}
