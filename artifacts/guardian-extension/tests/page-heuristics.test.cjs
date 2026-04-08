const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const heuristics = require(path.resolve(__dirname, "..", "page-heuristics.js"));

test("shared commerce heuristic rejects non-commerce domains", () => {
  const result = heuristics.isLikelyCommercePage({
    domain: "github.com",
    url: "https://github.com/openai/openai-node",
    pageText: "Repository page with pull requests and issues.",
    buttonLabels: ["Code", "Issues", "Pull requests"],
    priceStrings: [],
  });

  assert.equal(result, false);
});

test("shared commerce heuristic accepts checkout-like pages", () => {
  const result = heuristics.isLikelyCommercePage({
    domain: "makemytrip.com",
    url: "https://www.makemytrip.com/hotels/checkout",
    pageText: "Checkout with order summary, tax, travel insurance, and payment details.",
    buttonLabels: ["Continue to payment", "Book now"],
    priceStrings: ["Rs 4,999", "Rs 349"],
    timerElements: ["Deal ends in 04:59"],
    stockAlerts: ["Only 1 room left"],
  });

  assert.equal(result, true);
});

test("shared commerce heuristic accepts product listing pages when multiple product candidates exist", () => {
  const result = heuristics.isLikelyCommercePage({
    domain: "amazon.in",
    url: "https://www.amazon.in/gp/goldbox",
    pageText: "Today deals results with product cards and customer reviews.",
    buttonLabels: ["Today's Deals", "Shop deals"],
    priceStrings: [],
    productCandidates: [
      { title: "OnePlus Pad Go 2", listedPrice: 33499, dealSignals: ["limited time deal"] },
      { title: "OnePlus Pad Lite", listedPrice: 17999, dealSignals: ["limited time deal"] },
    ],
  });

  assert.equal(result, true);
});

test("shared commerce heuristic accepts single product detail pages with one product candidate", () => {
  const result = heuristics.isLikelyCommercePage({
    domain: "amazon.in",
    url: "https://www.amazon.in/dp/B0D1234567",
    pageText: "Samsung Galaxy M36 5G limited time deal and pricing details.",
    buttonLabels: ["Add to Cart", "Buy Now"],
    priceStrings: ["Rs 18,499"],
    productCandidates: [{ title: "Samsung Galaxy M36 5G", listedPrice: 18499, dealSignals: ["limited time deal"] }],
  });

  assert.equal(result, true);
});

test("shared redaction removes obvious PII patterns", () => {
  const stats = heuristics.createRedactionStats();
  const result = heuristics.redactSensitiveText(
    "Email me at traveler@example.com or call +1 415 555 1212. Card 4111 1111 1111 1111. 123 Main Street.",
    stats,
  );

  assert.match(result, /\[redacted-email\]/);
  assert.match(result, /\[redacted-phone\]/);
  assert.match(result, /\[redacted-card\]/);
  assert.match(result, /\[redacted-address\]/);
  assert.ok(stats.total >= 4);
});

test("auto scan signature changes when meaningful checkout signals change", () => {
  const base = heuristics.buildAutoScanSignature({
    url: "https://booking.com/checkout",
    timerElements: ["Deal ends in 04:59"],
    stockAlerts: ["Only 1 room left"],
    buttonLabels: ["Reserve now"],
    priceStrings: ["$165.00"],
  });

  const changed = heuristics.buildAutoScanSignature({
    url: "https://booking.com/checkout",
    timerElements: ["Deal ends in 01:00"],
    stockAlerts: ["Only 1 room left"],
    buttonLabels: ["Reserve now"],
    priceStrings: ["$165.00"],
  });

  assert.notEqual(base, changed);
});
