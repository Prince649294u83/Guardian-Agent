(function (root, factory) {
  const api = factory();
  root.GuardianPageHeuristics = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function normalizeText(text) {
    return String(text).replace(/\s+/g, " ").trim();
  }

  function uniqueTexts(values, limit) {
    const seen = new Set();
    const output = [];

    for (const value of values) {
      const normalized = normalizeText(value);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(normalized);
      if (output.length >= limit) break;
    }

    return output;
  }

  function createRedactionStats() {
    return {
      total: 0,
      counts: {
        email: 0,
        phone: 0,
        card: 0,
        address: 0,
      },
    };
  }

  function redactSensitiveText(text, stats = createRedactionStats()) {
    let output = normalizeText(text);
    if (!output) return "";

    const replacements = [
      {
        key: "email",
        placeholder: "[redacted-email]",
        pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      },
      {
        key: "card",
        placeholder: "[redacted-card]",
        pattern: /\b(?:\d[ -]*?){13,19}\b/g,
      },
      {
        key: "phone",
        placeholder: "[redacted-phone]",
        pattern: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}\b/g,
      },
      {
        key: "address",
        placeholder: "[redacted-address]",
        pattern: /\b\d{1,5}\s+[A-Z0-9][A-Z0-9.\s-]{2,40}\s(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|way|court|ct)\b/gi,
      },
    ];

    for (const replacement of replacements) {
      output = output.replace(replacement.pattern, (match) => {
        if (replacement.key === "phone" && !/[()\s-]/.test(match) && match.replace(/\D/g, "").length < 10) {
          return match;
        }
        stats.total += 1;
        stats.counts[replacement.key] += 1;
        return replacement.placeholder;
      });
    }

    return output;
  }

  function buildAutoScanSignature(signals) {
    return [
      signals.url || "",
      (signals.timerElements || []).slice(0, 3).join("|"),
      (signals.stockAlerts || []).slice(0, 3).join("|"),
      (signals.buttonLabels || []).slice(0, 6).join("|"),
      (signals.priceStrings || []).slice(0, 4).join("|"),
    ].join("::");
  }

  function isBookingPlatform(signals) {
    const url = String(signals?.url || (typeof window !== "undefined" ? window.location.href : "")).toLowerCase();
    const domain = String(signals?.domain || "").toLowerCase();
    const bookingPatterns = [
      /makemytrip\./,
      /goibibo\./,
      /cleartrip\./,
      /yatra\./,
      /booking\.com/,
      /expedia\./,
      /hotels\.com/,
      /airbnb\./,
      /agoda\./,
      /trivago\./,
      /kayak\./,
      /redbus\./,
      /abhibus\./,
      /zingbus\./,
      /ola\./,
      /uber\./,
      /rapido\./,
      /irctc\./,
      /12go\.asia/,
      /zomato\./,
      /swiggy\./,
      /dineout\./,
      /opentable\./,
      /eazydiner\./,
      /bookmyshow\./,
      /ticketmaster\./,
      /eventbrite\./,
      /\/book/,
      /\/reserve/,
      /\/payment/,
      /\/confirm/,
      /\/hotel/,
      /\/flight/,
    ];
    return bookingPatterns.some((pattern) => pattern.test(url) || pattern.test(domain));
  }

  function detectBookingType(signals) {
    const url = String(signals?.url || "").toLowerCase();
    const domain = String(signals?.domain || "").toLowerCase();
    const pageText = String(signals?.pageText || "").toLowerCase();

    if (/hotel|room|accommodation|stay/.test(url) || /booking\.com|hotels\.com|airbnb|agoda/.test(domain)) return "hotel";
    if (/flight|airline|airways/.test(url) || /makemytrip|goibibo|cleartrip|yatra/.test(domain)) return "flight";
    if (/redbus|abhibus|zingbus/.test(domain) || /bus|coach/.test(url)) return "bus";
    if (/irctc|train|rail/.test(domain) || /train/.test(url)) return "train";
    if (/zomato|swiggy|dineout|opentable|eazydiner/.test(domain) || /restaurant|dine|table/.test(url)) return "restaurant";
    if (/bookmyshow|ticketmaster|eventbrite/.test(domain) || /event|movie|show|concert|ticket/.test(url)) return "event";
    if (/ola|uber|rapido/.test(domain) || /cab|taxi/.test(pageText)) return "cab";
    return "unknown";
  }

  function detectPageType(signals) {
    const url = String(signals?.url || "").toLowerCase();
    const path = (() => {
      try {
        return new URL(url).pathname.toLowerCase();
      } catch {
        return url;
      }
    })();
    const pageText = String(signals?.pageText || "").toLowerCase();
    const buttonText = (signals?.buttonLabels || []).join(" ").toLowerCase();
    const priceScore = Array.isArray(signals?.priceStrings) ? signals.priceStrings.filter((value) => /\d/.test(value)).length : 0;
    const productScore = Array.isArray(signals?.productCandidates)
      ? signals.productCandidates.filter((candidate) => typeof candidate?.title === "string" && candidate.title.trim().length > 0).length
      : 0;
    const haystack = `${url} ${pageText} ${buttonText}`;

    if (/payment|pay-now|confirm.*payment/.test(haystack)) {
      return "payment";
    }

    if (/select.*seat|choose.*room|pick.*slot/.test(haystack)) {
      return "selection";
    }

    if (/checkout|cart|basket|bag|payment|reserve now|book now|place order/.test(haystack)) {
      return "checkout";
    }

    if (/myntra\.com.*\/\d+\/buy/i.test(url)) {
      return "product";
    }

    if (
      /\/dp\/|\/gp\/product\/|\/product\/|\/p\/|\/item\/|\/buy|\/catalog\//.test(path) ||
      (productScore >= 1 && (priceScore >= 1 || /add to cart|add to bag|buy now|select size|delivery options|mrp/.test(haystack)))
    ) {
      return "product";
    }

    if (/myntra\.com\/(men|women|kids|home|beauty)/i.test(url)) {
      return "listing";
    }

    if (
      /search|category|collection|shop|deals|offers|results/.test(haystack) ||
      productScore >= 2 ||
      (typeof document !== "undefined" && document.querySelectorAll("[class*='product-card'], [class*='product-item'], .product-base").length > 3)
    ) {
      return "listing";
    }

    return "unknown";
  }

  function isLikelyCommercePage(signals) {
    if (!signals) return false;

    const domain = String(signals.domain || "").toLowerCase();
    if (
      [
        "github.com",
        "stackoverflow.com",
        "wikipedia.org",
        "developer.mozilla.org",
        "docs.python.org",
        "medium.com",
        "notion.so",
      ].some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
    ) {
      return false;
    }

    if (isBookingPlatform(signals)) {
      return true;
    }

    const pageText = String(signals.pageText || "").toLowerCase();
    const buttonText = (signals.buttonLabels || []).join(" ").toLowerCase();
    const url = String(signals.url || "").toLowerCase();
    const productCandidates = Array.isArray(signals.productCandidates) ? signals.productCandidates : [];
    const pageType = detectPageType(signals);
    const commerceUrlPatterns = [
      /amazon\./,
      /ebay\./,
      /walmart\./,
      /target\./,
      /etsy\./,
      /shopify\./,
      /aliexpress\./,
      /flipkart\./,
      /myntra\./,
      /ajio\./,
      /meesho\./,
      /tatacliq\./,
      /nykaa\./,
      /booking\./,
      /expedia\./,
      /airbnb\./,
      /\/shop/,
      /\/product/,
      /\/item/,
      /\/cart/,
      /\/checkout/,
      /\/buy/,
      /\/store/,
      /\/deals/,
      /\/offer/,
      /\/hotel/,
      /\/flight/,
    ];
    const hasCommerceUrl = commerceUrlPatterns.some((pattern) => pattern.test(url) || pattern.test(domain));
    const keywordScore = [
      "add to cart",
      "add to bag",
      "checkout",
      "reserve now",
      "book now",
      "buy now",
      "place order",
      "shipping",
      "payment",
      "trip protection",
      "seat selection",
      "insurance",
      "subtotal",
      "tax",
      "order summary",
      "today's deals",
      "results",
      "customer review",
      "select size",
      "delivery options",
      "mrp",
      "% off",
      "shop",
    ].filter((keyword) => pageText.includes(keyword) || buttonText.includes(keyword) || url.includes(keyword)).length;
    const priceScore = Array.isArray(signals.priceStrings) ? signals.priceStrings.filter((value) => /\d/.test(value)).length : 0;
    const productScore = productCandidates.filter((candidate) => typeof candidate?.title === "string" && candidate.title.trim().length > 0).length;
    const pressureScore =
      (Array.isArray(signals.timerElements) ? signals.timerElements.length : 0) +
      (Array.isArray(signals.stockAlerts) ? signals.stockAlerts.length : 0);
    const hasProductUrlHint = /\/dp\/|\/gp\/product\/|\/product\/|\/p\/|\/buy|\/catalog\//.test(url);

    const result =
      hasCommerceUrl ||
      pageType === "checkout" ||
      pageType === "product" ||
      pageType === "listing" ||
      priceScore >= 2 ||
      keywordScore >= 2 ||
      productScore >= 2 ||
      (productScore >= 1 && (priceScore >= 1 || keywordScore >= 1 || hasProductUrlHint)) ||
      (hasProductUrlHint && (priceScore >= 1 || productScore >= 1 || keywordScore >= 1)) ||
      (keywordScore >= 1 && pressureScore >= 1);

    if (result) {
      console.debug("[Guardian] Commerce heuristic matched", {
        domain,
        pageType,
        hasCommerceUrl,
        priceScore,
        keywordScore,
        productScore,
        pressureScore,
      });
    }

    return result;
  }

  return {
    normalizeText,
    uniqueTexts,
    createRedactionStats,
    redactSensitiveText,
    buildAutoScanSignature,
    isBookingPlatform,
    detectBookingType,
    detectPageType,
    isLikelyCommercePage,
  };
});
