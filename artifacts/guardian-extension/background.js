const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001";

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get([
    "apiBaseUrl",
    "autoAnalyze",
    "missionGoal",
    "missionBudget",
    "missionPreferences",
    "compareAcrossSites",
    "allowAutoDeclineUpsells",
    "allowAccountCreation",
  ]);
  const nextValues = {};

  if (!current.apiBaseUrl) {
    nextValues.apiBaseUrl = DEFAULT_API_BASE_URL;
  }
  if (typeof current.autoAnalyze !== "boolean") {
    nextValues.autoAnalyze = true;
  }
  if (!current.missionGoal) {
    nextValues.missionGoal = "Find the safest checkout path, expose hidden fees, and recommend whether I should switch sites.";
  }
  if (!current.missionBudget) {
    nextValues.missionBudget = "";
  }
  if (!current.missionPreferences) {
    nextValues.missionPreferences = "avoid insurance upsells\nshow cheaper trustworthy alternatives";
  }
  if (typeof current.compareAcrossSites !== "boolean") {
    nextValues.compareAcrossSites = true;
  }
  if (typeof current.allowAutoDeclineUpsells !== "boolean") {
    nextValues.allowAutoDeclineUpsells = true;
  }
  if (typeof current.allowAccountCreation !== "boolean") {
    nextValues.allowAccountCreation = false;
  }

  if (Object.keys(nextValues).length > 0) {
    await chrome.storage.sync.set(nextValues);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (message.type === "guardian:analyze-page") {
    handleAnalyzePage(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }

  if (message.type === "guardian:run-mission") {
    handleMission(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }

  if (message.type === "guardian:get-settings") {
    chrome.storage.sync
      .get([
        "apiBaseUrl",
        "autoAnalyze",
        "missionGoal",
        "missionBudget",
        "missionPreferences",
        "compareAcrossSites",
        "allowAutoDeclineUpsells",
        "allowAccountCreation",
      ])
      .then((settings) =>
        sendResponse({
          ok: true,
          settings: {
            apiBaseUrl: settings.apiBaseUrl || DEFAULT_API_BASE_URL,
            autoAnalyze: settings.autoAnalyze !== false,
            missionGoal:
              settings.missionGoal ||
              "Find the safest checkout path, expose hidden fees, and recommend whether I should switch sites.",
            missionBudget: settings.missionBudget || "",
            missionPreferences: settings.missionPreferences || "",
            compareAcrossSites: settings.compareAcrossSites !== false,
            allowAutoDeclineUpsells: settings.allowAutoDeclineUpsells !== false,
            allowAccountCreation: settings.allowAccountCreation === true,
          },
        }),
      );
    return true;
  }

  if (message.type === "guardian:update-settings") {
    chrome.storage.sync
      .set(message.payload || {})
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }

  if (message.type === "guardian:get-last-analysis") {
    const tabId = sender?.tab?.id ?? message.tabId;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "No tab id available" });
      return false;
    }

    chrome.storage.session
      .get(`analysis:${tabId}`)
      .then((entry) => sendResponse({ ok: true, result: entry[`analysis:${tabId}`] || null }));
    return true;
  }

  if (message.type === "guardian:get-last-mission") {
    const tabId = sender?.tab?.id ?? message.tabId;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "No tab id available" });
      return false;
    }

    chrome.storage.session
      .get(`mission:${tabId}`)
      .then((entry) => sendResponse({ ok: true, result: entry[`mission:${tabId}`] || null }));
    return true;
  }

  if (message.type === "guardian:get-current-tab-id") {
    sendResponse({ ok: true, tabId: sender?.tab?.id ?? null });
    return false;
  }

  return false;
});

async function handleAnalyzePage(payload) {
  const storage = await chrome.storage.sync.get(["apiBaseUrl"]);
  const apiBaseUrl = (storage.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  const safePayload = sanitizeOutboundPayload(payload);
  safePayload.productCandidates = await enrichProductCandidatesWithHistory(safePayload.domain, safePayload.productCandidates);
  const endpoint = safePayload.isBookingPlatform ? "/api/booking/analyze" : "/api/demo/scan";

  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(safePayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Guardian API error ${response.status}: ${text || response.statusText}`);
  }

  const result = await response.json();

  if (typeof safePayload.tabId === "number") {
    await chrome.storage.session.set({
      [`analysis:${safePayload.tabId}`]: {
        ...result,
        analyzedAt: new Date().toISOString(),
        pageUrl: safePayload.url,
        pageDomain: safePayload.domain,
      },
    });
  }

  return result;
}

async function handleMission(payload) {
  const storage = await chrome.storage.sync.get([
    "apiBaseUrl",
    "missionGoal",
    "missionBudget",
    "missionPreferences",
    "compareAcrossSites",
    "allowAutoDeclineUpsells",
    "allowAccountCreation",
  ]);
  const apiBaseUrl = (storage.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  const safePayload = sanitizeOutboundPayload(payload);
  safePayload.productCandidates = await enrichProductCandidatesWithHistory(safePayload.domain, safePayload.productCandidates);
  const missionPayload = {
    domain: safePayload.domain,
    url: safePayload.url,
    pageType: safePayload.pageType,
    bookingType: safePayload.bookingType,
    isBookingPlatform: safePayload.isBookingPlatform,
    route: safePayload.productCandidates?.[0]?.route || null,
    purchaseGoal:
      safePayload.purchaseGoal ||
      storage.missionGoal ||
      "Find the safest checkout path, expose hidden fees, and recommend whether I should switch sites.",
    budget: parseNumericValue(safePayload.budget ?? storage.missionBudget),
    listedPrice: parseNumericValue(safePayload.listedPrice ?? safePayload.likelyListedPrice),
    preferences: normalizePreferences(safePayload.preferences ?? storage.missionPreferences),
    compareAcrossSites: safePayload.compareAcrossSites ?? storage.compareAcrossSites !== false,
    allowAutoDeclineUpsells: safePayload.allowAutoDeclineUpsells ?? storage.allowAutoDeclineUpsells !== false,
    allowAccountCreation: safePayload.allowAccountCreation ?? storage.allowAccountCreation === true,
    pageText: safePayload.pageText,
    timerElements: safePayload.timerElements,
    stockAlerts: safePayload.stockAlerts,
    variantUrgency: safePayload.variantUrgency,
    priceStrings: safePayload.priceStrings,
    buttonLabels: safePayload.buttonLabels,
    productCandidates: safePayload.productCandidates,
  };

  const response = await fetch(`${apiBaseUrl}/api/agent/mission`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(missionPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Guardian mission error ${response.status}: ${text || response.statusText}`);
  }

  const result = await response.json();

  if (typeof safePayload.tabId === "number") {
    await chrome.storage.session.set({
      [`mission:${safePayload.tabId}`]: {
        ...result,
        analyzedAt: new Date().toISOString(),
        pageUrl: safePayload.url,
        pageDomain: safePayload.domain,
      },
    });
  }

  return result;
}

async function enrichProductCandidatesWithHistory(domain, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const historyKey = `deal-history:${String(domain || "").toLowerCase()}`;
  const current = await chrome.storage.local.get(historyKey);
  const history = current?.[historyKey] && typeof current[historyKey] === "object" ? current[historyKey] : {};
  const now = Date.now();
  const nextHistory = { ...history };

  const enriched = candidates.map((candidate) => {
    const title = typeof candidate?.title === "string" ? candidate.title.trim() : "";
    if (!title) return candidate;
    const key = normalizeProductKey(title);
    const existing = nextHistory[key] && typeof nextHistory[key] === "object"
      ? nextHistory[key]
      : {
          observations: 0,
          scarcitySignalsSeen: 0,
          recentPrices: [],
          firstSeenAt: now,
          lastSeenAt: now,
        };

    const dealSignals = Array.isArray(candidate?.dealSignals) ? candidate.dealSignals : [];
    const hasScarcityLikeClaim = dealSignals.some((signal) =>
      /limited|few left|only \d+ left|selling fast|ends in|expires|flash|lightning/i.test(String(signal)),
    );
    const price = typeof candidate?.listedPrice === "number" && Number.isFinite(candidate.listedPrice) ? candidate.listedPrice : null;
    const nextPrices = Array.isArray(existing.recentPrices) ? [...existing.recentPrices] : [];
    if (price != null) {
      nextPrices.push(price);
    }

    const compactPrices = nextPrices.slice(-20);
    const uniquePricePoints = Array.from(new Set(compactPrices.map((value) => Number(value.toFixed(2))))).length;
    const observations = Number(existing.observations || 0) + 1;
    const scarcitySignalsSeen = Number(existing.scarcitySignalsSeen || 0) + (hasScarcityLikeClaim ? 1 : 0);
    const scarcityClaimRate = observations > 0 ? scarcitySignalsSeen / observations : 0;

    nextHistory[key] = {
      observations,
      scarcitySignalsSeen,
      recentPrices: compactPrices,
      firstSeenAt: Number(existing.firstSeenAt || now),
      lastSeenAt: now,
    };

    return {
      ...candidate,
      historySnapshot: {
        observations,
        scarcityClaimRate: Number(scarcityClaimRate.toFixed(2)),
        uniquePricePoints,
        lastSeenAt: new Date(now).toISOString(),
      },
    };
  });

  await chrome.storage.local.set({ [historyKey]: nextHistory });
  return enriched;
}

function normalizeProductKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function parseNumericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) {
    return undefined;
  }

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizePreferences(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sanitizeOutboundPayload(payload) {
  const nextPayload = {
    ...payload,
    pageText: redactSensitiveText(payload?.pageText),
    pageType: typeof payload?.pageType === "string" ? payload.pageType : undefined,
    hasTimer: payload?.hasTimer === true,
    timerResetsOnRefresh: typeof payload?.timerResetsOnRefresh === "boolean" ? payload.timerResetsOnRefresh : null,
    reloadStockChanges: typeof payload?.reloadStockChanges === "boolean" ? payload.reloadStockChanges : null,
    isBookingPlatform: payload?.isBookingPlatform === true,
    bookingType: typeof payload?.bookingType === "string" ? payload.bookingType : undefined,
    bookingTimer:
      payload?.bookingTimer && typeof payload.bookingTimer === "object"
        ? {
            hasTimer: payload.bookingTimer.hasTimer === true,
            timerText: typeof payload.bookingTimer.timerText === "string" ? redactSensitiveText(payload.bookingTimer.timerText) : null,
            timerValue: typeof payload.bookingTimer.timerValue === "string" ? payload.bookingTimer.timerValue : null,
            timerResetsOnRefresh:
              typeof payload.bookingTimer.timerResetsOnRefresh === "boolean" ? payload.bookingTimer.timerResetsOnRefresh : null,
          }
        : null,
    bookingViewers:
      payload?.bookingViewers && typeof payload.bookingViewers === "object"
        ? {
            hasViewerCount: payload.bookingViewers.hasViewerCount === true,
            count: typeof payload.bookingViewers.count === "number" ? payload.bookingViewers.count : null,
            text: typeof payload.bookingViewers.text === "string" ? redactSensitiveText(payload.bookingViewers.text) : null,
            countChanges: typeof payload.bookingViewers.countChanges === "boolean" ? payload.bookingViewers.countChanges : null,
          }
        : null,
    bookingSeats:
      payload?.bookingSeats && typeof payload.bookingSeats === "object"
        ? {
            hasScarcity: payload.bookingSeats.hasScarcity === true,
            count: typeof payload.bookingSeats.count === "number" ? payload.bookingSeats.count : null,
            type: typeof payload.bookingSeats.type === "string" ? payload.bookingSeats.type : null,
            text: typeof payload.bookingSeats.text === "string" ? redactSensitiveText(payload.bookingSeats.text) : null,
            isVague: payload.bookingSeats.isVague === true,
          }
        : null,
    bookingPrice:
      payload?.bookingPrice && typeof payload.bookingPrice === "object"
        ? {
            hasPrice: payload.bookingPrice.hasPrice === true,
            currentPrice: typeof payload.bookingPrice.currentPrice === "number" ? payload.bookingPrice.currentPrice : null,
            priceChanges: typeof payload.bookingPrice.priceChanges === "number" ? payload.bookingPrice.priceChanges : null,
            priceHistory: Array.isArray(payload.bookingPrice.priceHistory)
              ? payload.bookingPrice.priceHistory
                  .filter((entry) => entry && typeof entry === "object")
                  .map((entry) => ({
                    price: typeof entry.price === "number" ? entry.price : null,
                    timestamp: typeof entry.timestamp === "number" ? entry.timestamp : null,
                  }))
              : [],
          }
        : null,
    bookingDestination:
      payload?.bookingDestination && typeof payload.bookingDestination === "object"
        ? {
            destination:
              typeof payload.bookingDestination.destination === "string"
                ? redactSensitiveText(payload.bookingDestination.destination)
                : null,
            date: typeof payload.bookingDestination.date === "string" ? payload.bookingDestination.date : null,
          }
        : null,
    bookingUrgencySignals: sanitizeStringArray(payload?.bookingUrgencySignals, 8),
    timerElements: sanitizeStringArray(payload?.timerElements, 8),
    stockAlerts: sanitizeStringArray(payload?.stockAlerts, 8),
    variantUrgency: sanitizeStringArray(payload?.variantUrgency, 8),
    buttonLabels: sanitizeStringArray(payload?.buttonLabels, 25),
    priceStrings: sanitizeStringArray(payload?.priceStrings, 12),
    preferences: Array.isArray(payload?.preferences)
      ? sanitizeStringArray(payload.preferences, payload.preferences.length || 6)
      : payload?.preferences,
    formFields: Array.isArray(payload?.formFields)
      ? payload.formFields.map((field) => ({
          id: typeof field?.id === "string" ? field.id : "field",
          label: redactSensitiveText(field?.label),
          checked: field?.checked === true,
        }))
      : [],
    productCandidates: Array.isArray(payload?.productCandidates)
      ? payload.productCandidates
          .filter((candidate) => candidate && typeof candidate === "object")
          .map((candidate) => ({
            title: redactSensitiveText(candidate?.title),
            listedPrice: typeof candidate?.listedPrice === "number" ? candidate.listedPrice : null,
            originalPrice: typeof candidate?.originalPrice === "number" ? candidate.originalPrice : null,
            historicalMinPrice: typeof candidate?.historicalMinPrice === "number" ? candidate.historicalMinPrice : null,
            currency: typeof candidate?.currency === "string" ? candidate.currency : "USD",
            url: typeof candidate?.url === "string" ? candidate.url : null,
            stockText: typeof candidate?.stockText === "string" ? redactSensitiveText(candidate.stockText) : null,
            urgencyText: typeof candidate?.urgencyText === "string" ? redactSensitiveText(candidate.urgencyText) : null,
            hasTimer: candidate?.hasTimer === true,
            timerResetsOnRefresh:
              typeof candidate?.timerResetsOnRefresh === "boolean" ? candidate.timerResetsOnRefresh : null,
            reloadStockChanges: typeof candidate?.reloadStockChanges === "boolean" ? candidate.reloadStockChanges : null,
            crossPlatformMatch: typeof candidate?.crossPlatformMatch === "boolean" ? candidate.crossPlatformMatch : null,
            dealSignals: sanitizeStringArray(candidate?.dealSignals, 8),
            historySnapshot:
              candidate?.historySnapshot && typeof candidate.historySnapshot === "object"
                ? {
                    observations:
                      typeof candidate.historySnapshot.observations === "number"
                        ? candidate.historySnapshot.observations
                        : 0,
                    scarcityClaimRate:
                      typeof candidate.historySnapshot.scarcityClaimRate === "number"
                        ? candidate.historySnapshot.scarcityClaimRate
                        : 0,
                    uniquePricePoints:
                      typeof candidate.historySnapshot.uniquePricePoints === "number"
                        ? candidate.historySnapshot.uniquePricePoints
                        : 0,
                    lastSeenAt:
                      typeof candidate.historySnapshot.lastSeenAt === "string"
                        ? candidate.historySnapshot.lastSeenAt
                        : null,
                  }
                : null,
          }))
          .slice(0, 12)
      : [],
  };

  nextPayload.privacy = {
    ...(payload?.privacy || {}),
    sanitizedInBackground: true,
  };

  return nextPayload;
}

function sanitizeStringArray(value, limit) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => redactSensitiveText(entry))
    .slice(0, limit);
}

function redactSensitiveText(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card]")
    .replace(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}\b/g, (match) => {
      if (!/[()\s-]/.test(match) && match.replace(/\D/g, "").length < 10) {
        return match;
      }
      return "[redacted-phone]";
    })
    .replace(/\b\d{1,5}\s+[A-Z0-9][A-Z0-9.\s-]{2,40}\s(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|way|court|ct)\b/gi, "[redacted-address]");
}
