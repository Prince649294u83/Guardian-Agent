(function () {
  const heuristics = globalThis.GuardianPageHeuristics || {};
  const normalizeText = heuristics.normalizeText || ((text) => String(text).replace(/\s+/g, " ").trim());
  const uniqueTexts = heuristics.uniqueTexts || ((values, limit) => values.slice(0, limit));
  const createRedactionStats =
    heuristics.createRedactionStats ||
    (() => ({ total: 0, counts: { email: 0, phone: 0, card: 0, address: 0 } }));
  const redactSensitiveText = heuristics.redactSensitiveText || ((text) => normalizeText(text));
  const buildAutoScanSignature =
    heuristics.buildAutoScanSignature ||
    ((signals) => [signals.url || "", ...(signals.priceStrings || []).slice(0, 4)].join("::"));
  const isBookingPlatform = heuristics.isBookingPlatform || (() => false);
  const detectBookingType = heuristics.detectBookingType || (() => "unknown");
  const detectPageType = heuristics.detectPageType || (() => "unknown");
  const isLikelyCommercePage = heuristics.isLikelyCommercePage || (() => false);

  const OVERLAY_ID = "guardian-agent-overlay";
  const HIGHLIGHT_ATTR = "data-guardian-highlight";
  const HIGHLIGHT_BADGE_ATTR = "data-guardian-highlight-badge";
  const STATE = {
    lastResult: null,
    lastMission: null,
    lastError: null,
    isAnalyzing: false,
    autoAnalyzeEnabled: false,
    lastObservedUrl: window.location.href,
    lastAutoScanSignature: "",
    routeCheckTimer: null,
    mutationTimer: null,
    observer: null,
  };

  init().catch((error) => {
    console.error("Guardian init failed", error);
  });

  async function init() {
    ensureOverlay();

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "guardian:run-analysis") {
        analyzePage(true)
          .then((result) => sendResponse({ ok: true, result }))
          .catch((error) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      }

      if (message?.type === "guardian:get-page-state") {
        const currentSignals = collectSignals();
        sendResponse({
          ok: true,
          state: {
            isAnalyzing: STATE.isAnalyzing,
            lastResult: STATE.lastResult,
            lastMission: STATE.lastMission,
            lastError: STATE.lastError,
            currentSignalsSummary: {
              url: currentSignals.url,
              pageType: currentSignals.pageType,
              isCommerce: isLikelyCommercePage(currentSignals),
              productCount: Array.isArray(currentSignals.productCandidates) ? currentSignals.productCandidates.length : 0,
            },
          },
        });
        return false;
      }

      if (message?.action === "forceScan") {
        analyzePage(true)
          .then((result) => sendResponse({ ok: true, result }))
          .catch((error) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      }

      if (message?.type === "guardian:run-mission") {
        runMission()
          .then((result) => sendResponse({ ok: true, result }))
          .catch((error) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      }

      if (message?.type === "guardian:reveal-ghost-checkout") {
        revealGhostCheckout()
          .then((result) => sendResponse({ ok: true, result }))
          .catch((error) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      }

      if (message?.type === "guardian:show-cheapest-safe-path") {
        showCheapestSafePath()
          .then((result) => sendResponse({ ok: true, result }))
          .catch((error) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      }

      return false;
    });

    const settings = await sendRuntimeMessage({ type: "guardian:get-settings" });
    STATE.autoAnalyzeEnabled = settings?.ok && settings.settings?.autoAnalyze === true;
    const initialSignals = collectSignals();
    if (STATE.autoAnalyzeEnabled && isLikelyCommercePage(initialSignals)) {
      queueAutoAnalyze("initial");
    }
    setupAutoRefresh();
  }

  function setupAutoRefresh() {
    installHistoryHooks();
    startUrlPolling();
    startDomObserver();
  }

  function installHistoryHooks() {
    const historyMethods = ["pushState", "replaceState"];
    for (const methodName of historyMethods) {
      const original = history[methodName];
      if (typeof original !== "function" || original.__guardianWrapped) continue;

      const wrapped = function (...args) {
        const result = original.apply(this, args);
        queueRouteRefresh();
        return result;
      };

      wrapped.__guardianWrapped = true;
      history[methodName] = wrapped;
    }

    window.addEventListener("popstate", queueRouteRefresh);
    window.addEventListener("hashchange", queueRouteRefresh);
  }

  function startUrlPolling() {
    window.setInterval(() => {
      if (window.location.href !== STATE.lastObservedUrl) {
        queueRouteRefresh();
      }
    }, 1200);
  }

  function startDomObserver() {
    if (!(window.MutationObserver && document.body)) return;

    STATE.observer = new MutationObserver((mutations) => {
      if (!STATE.autoAnalyzeEnabled || STATE.isAnalyzing) return;

      const hasMeaningfulChange = mutations.some((mutation) => {
        if (mutation.type === "childList") {
          return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0;
        }
        return mutation.type === "characterData";
      });

      if (!hasMeaningfulChange) return;

      window.clearTimeout(STATE.mutationTimer);
      STATE.mutationTimer = window.setTimeout(() => {
        queueAutoAnalyze("dom");
      }, 900);
    });

    STATE.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function queueRouteRefresh() {
    window.clearTimeout(STATE.routeCheckTimer);
    STATE.routeCheckTimer = window.setTimeout(() => {
      const nextUrl = window.location.href;
      if (nextUrl === STATE.lastObservedUrl) return;

      STATE.lastObservedUrl = nextUrl;
      STATE.lastResult = null;
      STATE.lastMission = null;
      STATE.lastError = null;
      STATE.lastAutoScanSignature = "";
      clearHighlights();

      if (!STATE.autoAnalyzeEnabled) {
        hideOverlay();
        return;
      }

      queueAutoAnalyze("route");
    }, 250);
  }

  function queueAutoAnalyze(reason) {
    if (!STATE.autoAnalyzeEnabled || STATE.isAnalyzing) return;

    const signals = collectSignals();
    if (!isLikelyCommercePage(signals)) {
      if (reason === "route") {
        hideOverlay();
      }
      return;
    }

    const signature = buildAutoScanSignature(signals);
    if (signature === STATE.lastAutoScanSignature) return;

    STATE.lastAutoScanSignature = signature;
    analyzePage(false).catch((error) => {
      console.warn("Guardian auto analyze failed", error);
    });
  }

  async function analyzePage(forceOpen) {
    STATE.isAnalyzing = true;
    STATE.lastError = null;
    renderLoadingOverlay();

    const payload = collectSignals();
    payload.tabId = await getCurrentTabId();

    if (!isLikelyCommercePage(payload)) {
      clearHighlights();
      const nonCommerceResult = buildNonCommerceScanResult(payload);
      STATE.lastResult = nonCommerceResult;
      renderResultOverlay(nonCommerceResult, true);
      STATE.isAnalyzing = false;
      return nonCommerceResult;
    }

    try {
      const response = await sendRuntimeMessage({
        type: "guardian:analyze-page",
        payload,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unknown Guardian error");
      }

      STATE.lastResult = response.result;
      renderResultOverlay(response.result, forceOpen);
      return response.result;
    } catch (error) {
      STATE.lastError = error instanceof Error ? error.message : String(error);
      renderErrorOverlay(STATE.lastError);
      throw error;
    } finally {
      STATE.isAnalyzing = false;
    }
  }

  async function runMission() {
    STATE.isAnalyzing = true;
    STATE.lastError = null;
    renderLoadingOverlay("Running Guardian mission", "Building a safer checkout plan, comparing sites, and checking trust...");

    const settings = await sendRuntimeMessage({ type: "guardian:get-settings" });
    const payload = collectSignals();
    payload.tabId = await getCurrentTabId();
    payload.purchaseGoal = settings?.settings?.missionGoal;
    payload.budget = settings?.settings?.missionBudget;
    payload.preferences = settings?.settings?.missionPreferences;
    payload.compareAcrossSites = settings?.settings?.compareAcrossSites;
    payload.allowAutoDeclineUpsells = settings?.settings?.allowAutoDeclineUpsells;
    payload.allowAccountCreation = settings?.settings?.allowAccountCreation;

    try {
      const response = await sendRuntimeMessage({
        type: "guardian:run-mission",
        payload,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unknown Guardian mission error");
      }

      STATE.lastMission = response.result;
      renderMissionOverlay(response.result);
      return response.result;
    } catch (error) {
      STATE.lastError = error instanceof Error ? error.message : String(error);
      renderErrorOverlay(STATE.lastError);
      throw error;
    } finally {
      STATE.isAnalyzing = false;
    }
  }

  async function revealGhostCheckout() {
    STATE.isAnalyzing = true;
    STATE.lastError = null;
    renderLoadingOverlay(
      "Revealing the true total",
      "Running Guardian Ghost Checkout to surface late fees, expose fake pressure, and hold the cheapest safe path open...",
    );

    const settings = await sendRuntimeMessage({ type: "guardian:get-settings" });
    const payload = collectSignals();
    payload.tabId = await getCurrentTabId();
    payload.purchaseGoal =
      settings?.settings?.missionGoal ||
      "Reveal the true final price, surface hidden fees, and keep me on the cheapest safe checkout path.";
    payload.budget = settings?.settings?.missionBudget;
    payload.preferences = settings?.settings?.missionPreferences;
    payload.compareAcrossSites = settings?.settings?.compareAcrossSites;
    payload.allowAutoDeclineUpsells = true;
    payload.allowAccountCreation = false;
    payload.ghostCheckoutMode = true;

    try {
      const response = await sendRuntimeMessage({
        type: "guardian:run-mission",
        payload,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Guardian Ghost Checkout failed");
      }

      STATE.lastMission = response.result;
      renderMissionOverlay(response.result);
      return response.result;
    } catch (error) {
      STATE.lastError = error instanceof Error ? error.message : String(error);
      renderErrorOverlay(STATE.lastError);
      throw error;
    } finally {
      STATE.isAnalyzing = false;
    }
  }

  async function showCheapestSafePath() {
    if (!STATE.lastMission) {
      await revealGhostCheckout();
    }

    if (!STATE.lastMission) {
      throw new Error("No Guardian mission is available for this page yet.");
    }

    const guidance = applyCheapestSafePathGuidance(STATE.lastMission);
    renderMissionOverlay(STATE.lastMission, guidance);
    return guidance;
  }

  function collectSignals() {
    const textNodes = collectCandidateTexts();
    const redactionStats = createRedactionStats();
    const redactedTextNodes = uniqueTexts(textNodes.map((text) => redactSensitiveText(text, redactionStats)), 80);
    const bodyText = redactedTextNodes.join(" ").replace(/\s+/g, " ").trim().slice(0, 2200);

    const timerElements = uniqueTexts(
      redactedTextNodes.filter((text) => /(\d{1,2}:\d{2}(:\d{2})?)|expires|countdown|ends in|price lock/i.test(text)),
      8,
    );

    const stockAlerts = uniqueTexts(
      redactedTextNodes.filter(
        (text) =>
          /only \d+|remaining|left at this price|\b\d+\s*left\b|only few left|few left|people viewing|selling fast|booked in the last/i.test(
            text,
          ),
      ),
      8,
    );
    const variantUrgency = detectVariantUrgency(redactionStats);

    const buttonLabels = Array.from(
      document.querySelectorAll("button, a, [role='button'], input[type='submit'], input[type='button']"),
    )
      .map((element) => {
        if (element instanceof HTMLInputElement) {
          return element.value?.trim() || "";
        }
        return element.textContent?.trim() || "";
      })
      .map((text) => redactSensitiveText(text, redactionStats))
      .filter(Boolean)
      .slice(0, 25);

    const priceStrings = uniqueTexts(
      textNodes.filter((text) => /(?:[$€£₹]|rs\.?|inr|usd|eur|gbp)\s?[0-9][0-9,]*(?:\.[0-9]{1,2})?/i.test(text)),
      20,
    );

    const checkedFields = Array.from(
      document.querySelectorAll("input[type='checkbox']:checked, input[type='radio']:checked"),
    ).map((element) => {
      const label =
        document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim() ||
        element.getAttribute("aria-label") ||
        element.name ||
        element.id;
      return {
        id: element.id || element.name || "field",
        label: redactSensitiveText(label, redactionStats),
      };
    });

    const productCandidates = collectProductCandidates(redactionStats);
    const inferredListedPrice = productCandidates.find((candidate) => typeof candidate.listedPrice === "number")?.listedPrice;
    const timerBehavior = detectTimerBehavior();
    const pageStockBehavior = detectStockBehavior(stockAlerts[0] || "");
    const bookingData = extractBookingData(redactionStats);
    const signals = {
      domain: window.location.hostname,
      url: window.location.href,
      pageText: bodyText,
      timerElements,
      stockAlerts,
      variantUrgency,
      buttonLabels,
      priceStrings,
      productCandidates,
      hasTimer: timerBehavior.hasTimer,
      timerResetsOnRefresh: timerBehavior.timerResetsOnRefresh,
      reloadStockChanges: pageStockBehavior,
      isBookingPlatform: bookingData.isBookingPlatform,
      bookingType: bookingData.bookingType,
      bookingTimer: bookingData.timer,
      bookingViewers: bookingData.viewers,
      bookingSeats: bookingData.seats,
      bookingPrice: bookingData.price,
      bookingDestination: bookingData.destination,
      bookingUrgencySignals: bookingData.urgencySignals,
    };

    return {
      ...signals,
      pageType: detectPageType(signals),
      formFields: checkedFields.map((field) => ({
        id: field.id,
        label: field.label,
        checked: true,
      })),
      likelyListedPrice: inferredListedPrice ?? parseLikelyListedPrice(priceStrings),
      privacy: {
        redacted: redactionStats.total > 0,
        redactionCounts: { ...redactionStats.counts },
      },
    };
  }

  function summarizeFindings(result) {
    if (result?.mode === "booking" && Array.isArray(result?.manipulations)) {
      return result.manipulations.map((entry) => ({
        label: `${String(entry.type || "booking_signal").replaceAll("_", " ")} • ${entry.reality || "UNCERTAIN"}`,
        detail: `${entry.reasoning || ""} ${entry.userAdvice || ""}`.trim(),
      }));
    }

    const report = result?.darkPatternReport;
    if (!report) return [];

    const findings = [];
    const mapping = [
      ["falseUrgency", "False urgency", report.falseUrgency?.evidence || "Countdown or expiry language detected."],
      ["falseScarcity", "False scarcity", report.falseScarcity?.evidence || "Low-stock or demand pressure language detected."],
      [
        "confirmShaming",
        "Confirm shaming",
        report.confirmShaming?.shamingText
          ? `Flagged decline copy: "${report.confirmShaming.shamingText}"`
          : "Manipulative decline language detected.",
      ],
      [
        "hiddenFees",
        "Hidden fees",
        report.hiddenFees?.feeItems?.length
          ? report.hiddenFees.feeItems.map((fee) => `${fee.label} (+$${Number(fee.amount).toFixed(2)})`).join(", ")
          : "Extra fees appeared late in the checkout flow.",
      ],
      [
        "preCheckedAddOns",
        "Pre-checked add-ons",
        report.preCheckedAddOns?.addOnLabels?.length
          ? `Default-selected extras: ${report.preCheckedAddOns.addOnLabels.join(", ")}`
          : "Optional extras were pre-selected.",
      ],
      [
        "misdirection",
        "Misdirection",
        report.misdirection?.hiddenDeclineText || "The decline path appears visually deprioritized.",
      ],
    ];

    for (const [key, label, detail] of mapping) {
      if (report[key]?.detected) {
        findings.push({ label, detail });
      }
    }

    return findings;
  }

  function ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      return;
    }

    const container = document.createElement("aside");
    container.id = OVERLAY_ID;
    container.style.position = "fixed";
    container.style.top = "16px";
    container.style.right = "16px";
    container.style.width = "320px";
    container.style.maxHeight = "80vh";
    container.style.overflow = "auto";
    container.style.zIndex = "2147483647";
    container.style.background = "rgba(15, 23, 42, 0.96)";
    container.style.color = "#f8fafc";
    container.style.border = "1px solid rgba(148, 163, 184, 0.25)";
    container.style.borderRadius = "16px";
    container.style.boxShadow = "0 20px 40px rgba(2, 6, 23, 0.35)";
    container.style.backdropFilter = "blur(10px)";
    container.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
    container.style.padding = "14px";
    container.style.display = "none";
    document.documentElement.appendChild(container);
  }

  function hideOverlay() {
    const container = document.getElementById(OVERLAY_ID);
    if (!container) return;
    container.style.display = "none";
    container.innerHTML = "";
  }

  function renderIdleOverlay() {
    const container = document.getElementById(OVERLAY_ID);
    if (!container) return;
    container.style.display = "block";

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#38bdf8;">Guardian Agent</div>
          <div style="font-size:16px;font-weight:700;margin-top:4px;">Ready to scan</div>
        </div>
        <button id="guardian-run-scan" style="border:none;border-radius:999px;background:#0ea5e9;color:white;padding:8px 12px;font-weight:600;cursor:pointer;">Scan page</button>
      </div>
      <p style="font-size:12px;line-height:1.5;color:#cbd5e1;margin-top:12px;">
        Guardian can inspect this checkout page for hidden fees, fake urgency, pre-selected add-ons, and other manipulative patterns.
      </p>
      <button id="guardian-reveal-total" style="margin-top:12px;border:none;border-radius:10px;background:#1d4ed8;color:white;padding:8px 12px;font-weight:600;cursor:pointer;width:100%;">Reveal true total now</button>
    `;

    container.querySelector("#guardian-run-scan")?.addEventListener("click", () => {
      analyzePage(true).catch(() => {});
    });
    container.querySelector("#guardian-reveal-total")?.addEventListener("click", () => {
      revealGhostCheckout().catch(() => {});
    });
  }

  function renderLoadingOverlay(title = "Analyzing this page", body = "Checking urgency signals, pricing disclosures, add-ons, and decline paths...") {
    const container = document.getElementById(OVERLAY_ID);
    if (!container) return;
    container.style.display = "block";

    container.innerHTML = `
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#38bdf8;">Guardian Agent</div>
      <div style="font-size:16px;font-weight:700;margin-top:6px;">${escapeHtml(title)}</div>
      <p style="font-size:12px;line-height:1.5;color:#cbd5e1;margin-top:10px;">
        ${escapeHtml(body)}
      </p>
    `;
  }

  function renderErrorOverlay(errorMessage) {
    const container = document.getElementById(OVERLAY_ID);
    if (!container) return;
    container.style.display = "block";

    container.innerHTML = `
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#fca5a5;">Guardian Agent</div>
      <div style="font-size:16px;font-weight:700;margin-top:6px;">Scan failed</div>
      <p style="font-size:12px;line-height:1.5;color:#fecaca;margin-top:10px;">${escapeHtml(errorMessage)}</p>
      <button id="guardian-retry-scan" style="margin-top:12px;border:none;border-radius:10px;background:#ef4444;color:white;padding:8px 12px;font-weight:600;cursor:pointer;">Retry</button>
    `;

    container.querySelector("#guardian-retry-scan")?.addEventListener("click", () => {
      analyzePage(true).catch(() => {});
    });
  }

  function renderResultOverlay(result, forceOpen) {
    const container = document.getElementById(OVERLAY_ID);
    if (!container) return;
    container.style.display = "block";

    const findings = summarizeFindings(result);
    applyHighlightsForResult(result);
    const trustScore = result?.darkPatternReport?.trustScore ?? result?.trustRating?.score ?? result?.trustScore ?? "--";
    const summary = result?.darkPatternReport?.summary || result?.summary || "Guardian finished analyzing the current page.";
    const dealIntelligenceHtml = renderDealIntelligenceHtml(result?.dealIntelligence);
    const borderColor = findings.length === 0 ? "#22c55e" : findings.length >= 3 ? "#ef4444" : "#f59e0b";
    const bookingMode = result?.mode === "booking";

    container.style.borderColor = borderColor;
    container.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#38bdf8;">Guardian Agent</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">
            ${
              bookingMode
                ? findings.length === 0
                  ? "Booking flow looks clean"
                  : `${findings.length} booking signal${findings.length === 1 ? "" : "s"} detected`
                : findings.length === 0
                  ? "Checkout looks clean"
                  : `${findings.length} pattern${findings.length === 1 ? "" : "s"} detected`
            }
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:800;line-height:1;">${trustScore}</div>
          <div style="font-size:11px;color:#cbd5e1;">Trust score</div>
        </div>
      </div>
      <p style="font-size:12px;line-height:1.55;color:#cbd5e1;margin-top:10px;">${escapeHtml(summary)}</p>
      ${bookingMode ? `<div style="margin-top:8px;font-size:12px;color:#cbd5e1;">Recommendation: ${escapeHtml(String(result?.recommendation || "proceed").replaceAll("_", " "))}</div>` : ""}
      <div style="margin-top:12px;display:grid;gap:8px;">
        ${
          findings.length === 0
            ? `<div style="border:1px solid rgba(34,197,94,.25);border-radius:12px;padding:10px;background:rgba(34,197,94,.08);font-size:12px;line-height:1.5;color:#dcfce7;">
                 ${escapeHtml(
                   result?.nonCommerceReason ||
                     "No fake urgency, deceptive scarcity, hidden fees, or pre-selected extras were detected in the visible page content.",
                 )}
               </div>`
            : findings
                .map(
                  (finding) => `
                <div style="border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:rgba(15,23,42,.5);">
                  <div style="font-size:12px;font-weight:700;color:white;">${escapeHtml(finding.label)}</div>
                  <div style="font-size:12px;line-height:1.5;color:#cbd5e1;margin-top:4px;">${escapeHtml(finding.detail)}</div>
                </div>`,
                )
                .join("")
        }
      </div>
      ${dealIntelligenceHtml}
      ${
        bookingMode && result?.timerVerification
          ? `<div style="margin-top:12px;border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:rgba(15,23,42,.45);">
               <div style="font-size:12px;font-weight:700;color:white;">Timer verification</div>
               <div style="font-size:12px;line-height:1.5;color:#cbd5e1;margin-top:4px;">${escapeHtml(result.timerVerification.userAdvice || result.timerVerification.reasoning || "")}</div>
             </div>`
          : ""
      }
      <button id="guardian-reveal-total" style="margin-top:12px;border:none;border-radius:10px;background:#1d4ed8;color:white;padding:8px 12px;font-weight:600;cursor:pointer;width:100%;">${bookingMode ? "Analyze booking again" : "Reveal true total now"}</button>
      <button id="guardian-run-again" style="margin-top:8px;border:none;border-radius:10px;background:#0ea5e9;color:white;padding:8px 12px;font-weight:600;cursor:pointer;width:100%;">Analyze again</button>
      ${bookingMode ? "" : `<button id="guardian-run-mission" style="margin-top:8px;border:none;border-radius:10px;background:#334155;color:white;padding:8px 12px;font-weight:600;cursor:pointer;width:100%;">Run full mission</button>`}
    `;

    container.querySelector("#guardian-reveal-total")?.addEventListener("click", () => {
      (bookingMode ? analyzePage(true) : revealGhostCheckout()).catch(() => {});
    });
    container.querySelector("#guardian-run-again")?.addEventListener("click", () => {
      analyzePage(true).catch(() => {});
    });
    container.querySelector("#guardian-run-mission")?.addEventListener("click", () => {
      runMission().catch(() => {});
    });

    if (!forceOpen) {
      container.style.opacity = "0.96";
    }
  }

  function renderMissionOverlay(mission, safePathGuidance) {
    const container = document.getElementById(OVERLAY_ID);
    if (!container) return;
    container.style.display = "block";
    clearHighlights();

    const signals = Array.isArray(mission?.manipulativeSignals) ? mission.manipulativeSignals.slice(0, 3) : [];
    const alternatives = Array.isArray(mission?.alternatives) ? mission.alternatives.slice(0, 2) : [];
    const ghostCheckout = mission?.ghostCheckout;
    const dealIntelligenceHtml = renderDealIntelligenceHtml(mission?.dealIntelligence);
    const guidance = safePathGuidance || null;
    const recommendationTone =
      mission?.recommendation === "switch"
        ? "#ef4444"
        : mission?.recommendation === "proceed_with_caution"
          ? "#f59e0b"
          : "#22c55e";

    container.style.borderColor = recommendationTone;
    container.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#38bdf8;">Guardian Mission</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(mission?.trust?.merchantName || "Mission result")}</div>
          <div style="font-size:11px;color:#cbd5e1;margin-top:3px;">${escapeHtml((mission?.recommendation || "proceed").replaceAll("_", " "))}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:800;line-height:1;">${escapeHtml(String(mission?.trust?.score ?? "--"))}</div>
          <div style="font-size:11px;color:#cbd5e1;">Trust score</div>
        </div>
      </div>
      <div style="margin-top:12px;border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:rgba(15,23,42,.45);">
        <div style="font-size:12px;color:#cbd5e1;">True total</div>
        <div style="font-size:20px;font-weight:800;color:#fff;margin-top:4px;">${escapeHtml(formatCurrency(mission?.estimatedTrueTotal))}</div>
        <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">${escapeHtml(mission?.nextBestAction || "")}</div>
      </div>
      ${
        ghostCheckout
          ? `<div style="margin-top:12px;border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:rgba(15,23,42,.45);">
               <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd;">Ghost checkout</div>
               <div style="font-size:12px;color:#e2e8f0;margin-top:8px;">${escapeHtml(ghostCheckout.status || "")}</div>
               <div style="font-size:12px;color:#cbd5e1;margin-top:8px;">Delta from headline: ${escapeHtml(formatCurrency(ghostCheckout.deltaFromHeadline))}</div>
               <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">${escapeHtml(ghostCheckout.saferPathMode?.detail || "")}</div>
               ${
                 Array.isArray(ghostCheckout.hiddenCostLanes) && ghostCheckout.hiddenCostLanes.length
                   ? `<div style="display:grid;gap:8px;margin-top:10px;">
                        ${ghostCheckout.hiddenCostLanes
                          .map(
                            (lane) => `
                              <div style="border:1px solid rgba(148,163,184,.14);border-radius:10px;padding:8px;background:rgba(2,6,23,.35);">
                                <div style="display:flex;justify-content:space-between;gap:8px;">
                                  <div style="font-size:12px;font-weight:700;color:white;">${escapeHtml(lane.label)}</div>
                                  <div style="font-size:12px;color:#e2e8f0;">${escapeHtml(formatCurrency(lane.amount))}</div>
                                </div>
                                <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">${escapeHtml(lane.source)} â€¢ ${escapeHtml(lane.confidence)} confidence</div>
                              </div>`,
                          )
                          .join("")}
                      </div>`
                   : ""
               }
             </div>`
          : ""
      }
      ${
        guidance
          ? `<div style="margin-top:12px;border:1px solid rgba(34,197,94,.18);border-radius:12px;padding:10px;background:rgba(15,23,42,.45);">
               <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#86efac;">Cheapest safe path</div>
               <div style="font-size:12px;color:#e2e8f0;margin-top:8px;">${escapeHtml(guidance.summary)}</div>
               <div style="font-size:12px;color:#cbd5e1;margin-top:8px;">Keep markers: ${guidance.keepCount} â€¢ Strip markers: ${guidance.stripCount}</div>
               ${
                 guidance.keepLabels.length
                   ? `<div style="margin-top:8px;font-size:12px;color:#bbf7d0;">Keep: ${escapeHtml(guidance.keepLabels.join(", "))}</div>`
                   : ""
               }
               ${
                 guidance.stripLabels.length
                   ? `<div style="margin-top:4px;font-size:12px;color:#fecaca;">Strip: ${escapeHtml(guidance.stripLabels.join(", "))}</div>`
                   : ""
               }
             </div>`
          : ""
      }
      ${
        mission?.commerceIntent?.isShoppingPage === false
          ? `<div style="margin-top:12px;border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:rgba(15,23,42,.45);font-size:12px;line-height:1.5;color:#cbd5e1;">
               ${escapeHtml(mission.commerceIntent.reason)}
             </div>`
          : ""
      }
      <p style="font-size:12px;line-height:1.55;color:#cbd5e1;margin-top:10px;">${escapeHtml(mission?.summary || "Guardian completed the mission.")}</p>
      ${
        signals.length
          ? `<div style="margin-top:12px;display:grid;gap:8px;">
              ${signals
                .map(
                  (signal) => `
                    <div style="border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:rgba(15,23,42,.5);">
                      <div style="font-size:12px;font-weight:700;color:white;">${escapeHtml(signal.label)}</div>
                      <div style="font-size:12px;line-height:1.5;color:#cbd5e1;margin-top:4px;">${escapeHtml(signal.evidence)}</div>
                    </div>`,
                )
                .join("")}
            </div>`
          : `<div style="margin-top:12px;border:1px solid rgba(34,197,94,.25);border-radius:12px;padding:10px;background:rgba(34,197,94,.08);font-size:12px;line-height:1.5;color:#dcfce7;">
               No major manipulation signature was triggered for this merchant profile.
             </div>`
      }
      ${
        alternatives.length
          ? `<div style="margin-top:12px;">
              <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd;">Alternatives</div>
              <div style="display:grid;gap:8px;margin-top:8px;">
                ${alternatives
                  .map(
                    (alternative) => `
                      <div style="border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:${alternative.bestValue ? "rgba(14,165,233,.12)" : "rgba(15,23,42,.5)"};">
                        <div style="display:flex;justify-content:space-between;gap:8px;">
                          <div style="font-size:12px;font-weight:700;color:white;">${escapeHtml(alternative.merchantName)}</div>
                          <div style="font-size:12px;color:#e2e8f0;">${escapeHtml(formatCurrency(alternative.estimatedTrueTotal))}</div>
                        </div>
                        <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">Trust ${escapeHtml(String(alternative.trustScore))}${alternative.bestValue ? " â€¢ best value" : ""}</div>
                      </div>`,
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
      ${dealIntelligenceHtml}
      <button id="guardian-show-safe-path" style="margin-top:12px;border:none;border-radius:10px;background:#16a34a;color:white;padding:8px 12px;font-weight:600;cursor:pointer;width:100%;">Stay on cheapest safe path</button>
      <button id="guardian-reveal-total" style="margin-top:8px;border:none;border-radius:10px;background:#0f766e;color:white;padding:8px 12px;font-weight:600;cursor:pointer;width:100%;">Reveal true total now</button>
      <button id="guardian-mission-refresh" style="margin-top:8px;border:none;border-radius:10px;background:#1d4ed8;color:white;padding:8px 12px;font-weight:600;cursor:pointer;width:100%;">Refresh mission</button>
    `;

    container.querySelector("#guardian-show-safe-path")?.addEventListener("click", () => {
      showCheapestSafePath().catch(() => {});
    });
    container.querySelector("#guardian-reveal-total")?.addEventListener("click", () => {
      revealGhostCheckout().catch(() => {});
    });
    container.querySelector("#guardian-mission-refresh")?.addEventListener("click", () => {
      runMission().catch(() => {});
    });
  }

  async function getCurrentTabId() {
    try {
      const response = await sendRuntimeMessage({ type: "guardian:get-current-tab-id" });
      return response?.tabId;
    } catch {
      return undefined;
    }
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function parseLikelyListedPrice(priceStrings) {
    const first = priceStrings.find((value) => /\d/.test(value));
    if (!first) return undefined;
    const numeric = Number(String(first).replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  function collectCandidateTexts() {
    const selectors = [
      "h1",
      "h2",
      "h3",
      "p",
      "span",
      "li",
      "button",
      "a",
      "label",
      "[role='button']",
      "[data-testid]",
    ];

    const texts = Array.from(document.querySelectorAll(selectors.join(",")))
      .map((element) => normalizeText(element.textContent || ""))
      .filter((text) => text.length >= 6 && text.length <= 180);

    return uniqueTexts(texts, 80);
  }

  function collectProductCandidates(redactionStats) {
    const bookingType = detectBookingType({ url: window.location.href, domain: window.location.hostname, pageText: document.body?.innerText || "" });
    if (bookingType && bookingType !== "unknown") {
      const bookingCandidate = extractBookingCandidate(redactionStats, bookingType);
      if (bookingCandidate?.listedPrice) {
        console.debug("[Guardian] Booking extracted", bookingCandidate.title);
        return [bookingCandidate];
      }
    }

    console.debug("[Guardian] Starting product collection...");
    const indiaCommerceSelectors = [
      ".product-base",
      ".product-productMetaInfo",
      "[class*='product-strike']",
      "[class*='product-discounted']",
      ".product-price",
      "[data-id]",
      "._1AtVbE",
      "._30jeq3",
      "._1fQZEK",
      ".item",
      ".product",
      "[class*='productCard']",
      "[class*='product-card']",
    ];
    const cards = Array.from(
      document.querySelectorAll(
        [
          "[data-component-type*='product']",
          "[data-testid*='product']",
          "[data-testid*='listing']",
          "[data-testid*='deal-card']",
          "[data-testid*='grid-product']",
          "[data-cel-widget*='deal']",
          "[data-csa-c-type='item']",
          "[data-asin]",
          "[data-component-type='s-search-result']",
          "[itemtype*='Product']",
          "[class*='product-card']",
          "[class*='product-item']",
          "[class*='productcard']",
          "[class*='product_card']",
          ".product",
          ".product-base",
          ".product-details",
          ".pdp-details",
          ".listing",
          ".hotel-card",
          ".flight-card",
          "article",
          "[role='listitem']",
        ].join(","),
      ),
    ).slice(0, 60);
    const candidates = [];
    const seenTitles = new Set();

    for (const product of extractSchemaProducts(redactionStats)) {
      const key = normalizeText(product.title).toLowerCase();
      if (!key || seenTitles.has(key)) continue;
      seenTitles.add(key);
      candidates.push(product);
    }

    const indiaCards = Array.from(document.querySelectorAll(indiaCommerceSelectors.join(","))).slice(0, 60);
    if (indiaCards.length > 0) {
      console.debug("[Guardian] India platform elements found", indiaCards.length);
    }

    const allCards = [...indiaCards, ...cards];
    console.debug("[Guardian] Candidate elements found", allCards.length);
    for (const card of allCards) {
      const candidate = extractProductCandidateFromElement(card, redactionStats);
      if (!candidate) continue;
      const titleKey = normalizeText(candidate.title).toLowerCase();
      if (!titleKey || seenTitles.has(titleKey)) continue;
      seenTitles.add(titleKey);
      candidates.push(candidate);
    }

    if (candidates.length > 0) {
      console.debug("[Guardian] Products collected", candidates.length);
      return candidates.slice(0, 16);
    }

    const fallbackSignals = collectSnippetCandidates([
      ...extractTextMatches(document.body.innerText || "", /limited time deal|limited deal|flash sale|deal ends|ends in|expires|lightning deal/gi),
      ...extractTextMatches(
        document.body.innerText || "",
        /only \d+ left|\b\d+\s*left\b|only few left|few left|people viewing|selling fast|bought in past month/gi,
      ),
    ]);

    if (!fallbackSignals.length) {
      return [];
    }

    const fallbackProduct = extractPrimaryPageProduct(redactionStats, fallbackSignals);
    return fallbackProduct ? [fallbackProduct] : [];
  }

  function extractBookingCandidate(redactionStats, bookingType) {
    const pageText = document.body?.innerText || "";
    if (bookingType === "bus") {
      const routeMatch =
        pageText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
        pageText.match(/([A-Z]{3})\s*[-→]\s*([A-Z]{3})/);
      const route = routeMatch
        ? {
            from: routeMatch[1],
            to: routeMatch[2],
            display: `${routeMatch[1]} → ${routeMatch[2]}`,
          }
        : null;
      const operator = normalizeText(
        document.querySelector("[class*='travels'], [class*='operator'], [class*='bus-name']")?.textContent || "",
      ) || "Bus operator";
      const price = parsePriceFromText(
        normalizeText(
          document.querySelector("[class*='fare'], [class*='price'], [class*='amount'], [data-price]")?.textContent || pageText,
        ),
      );
      return {
        title: redactSensitiveText(route ? `${operator} - ${route.display}` : operator, redactionStats),
        listedPrice: price,
        currency: "INR",
        url: window.location.href,
        bookingType: "bus",
        route,
        operator,
        departureTime: pageText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)?.[1] || null,
        departureDate: pageText.match(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i)?.[0] || null,
        seatType: pageText.match(/(sleeper|seater|semi-sleeper|AC|Non-AC)/i)?.[1] || null,
      };
    }

    if (bookingType === "hotel") {
      const hotelName = normalizeText(
        document.querySelector("h1, [class*='hotel-name'], [itemprop='name']")?.textContent || document.title,
      );
      const location = pageText.match(/in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)?.[1] || null;
      const price = parsePriceFromText(
        normalizeText(document.querySelector("[class*='price'], [data-price]")?.textContent || pageText),
      );
      return {
        title: redactSensitiveText(location ? `${hotelName}, ${location}` : hotelName, redactionStats),
        listedPrice: price,
        currency: "INR",
        url: window.location.href,
        bookingType: "hotel",
        hotelName,
        location,
        checkIn: pageText.match(/check.?in[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i)?.[1] || null,
        checkOut: pageText.match(/check.?out[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i)?.[1] || null,
      };
    }

    if (bookingType === "flight") {
      const route = pageText.match(/([A-Z]{3})\s*[-→]\s*([A-Z]{3})/);
      const airline = normalizeText(document.querySelector("[class*='airline'], [class*='carrier']")?.textContent || "Flight");
      const price = parsePriceFromText(
        normalizeText(document.querySelector("[class*='fare'], [class*='price']")?.textContent || pageText),
      );
      return {
        title: redactSensitiveText(route ? `${airline} ${route[1]} → ${route[2]}` : airline, redactionStats),
        listedPrice: price,
        currency: "INR",
        url: window.location.href,
        bookingType: "flight",
        route: route ? { from: route[1], to: route[2], display: `${route[1]} → ${route[2]}` } : null,
        airline,
        departureDate: pageText.match(/\d{1,2}\s+\w+\s+\d{4}/i)?.[0] || null,
      };
    }

    return null;
  }

  function detectTimerBehavior() {
    const timerSelectors = [
      "[class*='timer']",
      "[class*='countdown']",
      "[id*='timer']",
      "[id*='countdown']",
      "[class*='expire']",
      "[data-testid*='timer']",
    ];
    const timerElements = Array.from(document.querySelectorAll(timerSelectors.join(",")))
      .map((element) => normalizeText(element.textContent || ""))
      .filter(Boolean);

    if (timerElements.length === 0) {
      return { hasTimer: false, timerResetsOnRefresh: null, timerText: null };
    }

    const storedKey = `guardian_timer_${window.location.pathname}`;
    const storedRaw = sessionStorage.getItem(storedKey);
    let timerResetsOnRefresh = null;

    if (storedRaw) {
      try {
        const previous = JSON.parse(storedRaw);
        if (Array.isArray(previous?.values) && timerElements.some((value, index) => value === previous.values[index])) {
          timerResetsOnRefresh = true;
          console.debug("[Guardian] Timer reset detected");
        } else {
          timerResetsOnRefresh = false;
        }
      } catch {
        timerResetsOnRefresh = null;
      }
    }

    sessionStorage.setItem(
      storedKey,
      JSON.stringify({
        values: timerElements,
        timestamp: Date.now(),
      }),
    );

    return {
      hasTimer: true,
      timerResetsOnRefresh,
      timerText: timerElements[0] || null,
    };
  }

  function detectStockBehavior(stockText) {
    if (!stockText) return null;

    const storedKey = `guardian_stock_${window.location.pathname}`;
    const storedRaw = sessionStorage.getItem(storedKey);
    let reloadStockChanges = null;

    if (storedRaw) {
      try {
        const previous = JSON.parse(storedRaw);
        const currentNum = String(stockText).match(/\d+/)?.[0];
        const previousNum = String(previous?.text || "").match(/\d+/)?.[0];

        if (currentNum && previousNum) {
          if (Number(currentNum) > Number(previousNum)) {
            reloadStockChanges = true;
            console.debug("[Guardian] Stock increased on refresh");
          } else if (currentNum === previousNum) {
            reloadStockChanges = false;
          }
        }
      } catch {
        reloadStockChanges = null;
      }
    }

    sessionStorage.setItem(
      storedKey,
      JSON.stringify({
        text: stockText,
        timestamp: Date.now(),
      }),
    );

    return reloadStockChanges;
  }

  function extractBookingData(redactionStats) {
    const bookingSignals = {
      isBookingPlatform: isBookingPlatform({ url: window.location.href, domain: window.location.hostname, pageText: document.body?.innerText || "" }),
      bookingType: detectBookingType({ url: window.location.href, domain: window.location.hostname, pageText: document.body?.innerText || "" }),
      timer: extractBookingTimer(),
      viewers: extractViewerCount(),
      seats: extractSeatAvailability(),
      price: extractBookingPrice(),
      destination: extractDestination(redactionStats),
      urgencySignals: extractBookingUrgency(redactionStats),
    };
    return bookingSignals;
  }

  function extractBookingTimer() {
    const timerElements = document.querySelectorAll("[class*='timer'], [class*='countdown'], [class*='expires'], [id*='timer'], [data-testid*='timer'], [class*='session-expire']");
    let timerText = "";
    if (timerElements.length > 0) {
      timerText = normalizeText(timerElements[0].textContent || "");
    } else {
      timerText = normalizeText((document.body?.innerText || "").match(/(\d+:\d+)|expires?\s*in\s*\d+\s*min/i)?.[0] || "");
    }
    if (!timerText) {
      return { hasTimer: false, timerResetsOnRefresh: null, timerValue: null };
    }
    const key = `guardian_booking_timer_${window.location.pathname}`;
    const value = timerText.match(/\d+:\d+/)?.[0] || timerText;
    const storedRaw = sessionStorage.getItem(key);
    let timerResetsOnRefresh = null;
    if (storedRaw) {
      try {
        const stored = JSON.parse(storedRaw);
        if (stored?.value === value) {
          timerResetsOnRefresh = true;
        } else {
          timerResetsOnRefresh = false;
        }
      } catch {}
    }
    sessionStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
    return { hasTimer: true, timerText, timerValue: value, timerResetsOnRefresh };
  }

  function extractViewerCount() {
    const text = document.body?.innerText || "";
    const match = text.match(/(\d+)\s*people?\s*(viewing|looking|watching)|(\d+)\s*others?\s*are\s*considering|(\d+)\s*travelers?\s*booked/i);
    if (!match) return { hasViewerCount: false, countChanges: null };
    const count = Number(match[1] || match[3] || match[4] || 0);
    const key = `guardian_booking_viewers_${window.location.pathname}`;
    const storedRaw = sessionStorage.getItem(key);
    let countChanges = false;
    if (storedRaw) {
      try {
        const stored = JSON.parse(storedRaw);
        countChanges = stored?.count !== count;
      } catch {}
    }
    sessionStorage.setItem(key, JSON.stringify({ count, timestamp: Date.now() }));
    return { hasViewerCount: true, count, text: normalizeText(match[0]), countChanges };
  }

  function extractSeatAvailability() {
    const text = document.body?.innerText || "";
    const match =
      text.match(/only\s*(\d+)\s*(seat|room|table|ticket)s?\s*left/i) ||
      text.match(/(\d+)\s*(seat|room)s?\s*remaining/i) ||
      text.match(/last\s*(\d+)\s*available/i);
    if (match) {
      return { hasScarcity: true, count: Number(match[1]), type: match[2] || "inventory", text: normalizeText(match[0]) };
    }
    const vague = text.match(/almost\s*sold\s*out|high\s*demand|selling\s*fast|limited\s*availability/i);
    if (vague) {
      return { hasScarcity: true, count: null, isVague: true, text: normalizeText(vague[0]) };
    }
    return { hasScarcity: false };
  }

  function extractBookingPrice() {
    const priceText = normalizeText(
      document.querySelector("[class*='price'], [class*='fare'], [class*='total'], [data-price], [itemprop='price']")?.textContent || "",
    );
    const currentPrice = parsePriceFromText(priceText || document.body?.innerText || "");
    if (currentPrice == null) return { hasPrice: false };
    const key = `guardian_booking_price_${window.location.pathname}`;
    const storedRaw = sessionStorage.getItem(key);
    let history = [];
    let priceChanges = 0;
    if (storedRaw) {
      try {
        const stored = JSON.parse(storedRaw);
        history = Array.isArray(stored?.history) ? stored.history : [];
        if (typeof stored?.price === "number" && stored.price !== currentPrice) {
          priceChanges = Number(stored?.changes || 0) + 1;
        } else {
          priceChanges = Number(stored?.changes || 0);
        }
      } catch {}
    }
    history.push({ price: currentPrice, timestamp: Date.now() });
    history = history.slice(-5);
    sessionStorage.setItem(key, JSON.stringify({ price: currentPrice, changes: priceChanges, history }));
    return { hasPrice: true, currentPrice, priceChanges, priceHistory: history };
  }

  function extractDestination(redactionStats) {
    const text = document.body?.innerText || "";
    const destinationMatch = text.match(/to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    const dateMatch = text.match(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i);
    return {
      destination: destinationMatch ? redactSensitiveText(destinationMatch[1], redactionStats) : null,
      date: dateMatch ? normalizeText(dateMatch[0]) : null,
    };
  }

  function extractBookingUrgency(redactionStats) {
    const text = document.body?.innerText || "";
    const patterns = [
      /complete.*payment.*\d+\s*min|payment.*expires|session.*expires/i,
      /high.*demand|trending|popular\s*choice|most\s*booked/i,
      /price.*may.*increase|fares?.*going.*up|book.*now.*save/i,
    ];
    return uniqueTexts(
      patterns
        .map((pattern) => text.match(pattern)?.[0] || "")
        .filter(Boolean)
        .map((value) => redactSensitiveText(value, redactionStats)),
      6,
    );
  }

  function detectVariantUrgency(redactionStats) {
    const results = [];
    const variantContainers = document.querySelectorAll(
      [
        "[class*='size']",
        "[class*='variant']",
        ".size-buttons-size-button",
        "[data-testid*='size']",
        "[data-testid*='variant']",
      ].join(", "),
    );

    variantContainers.forEach((variant) => {
      const variantLabel = normalizeText(variant.textContent || "");
      if (!variantLabel) return;

      const parent =
        variant.closest("[class*='size'], [class*='variant'], [class*='product'], [class*='pdp'], section, article") || variant.parentElement;
      const parentText = normalizeText(parent?.textContent || "");
      const urgencyMatch =
        parentText.match(/only\s*\d+\s*left\s*in\s*(size|this size)/i) ||
        parentText.match(/only\s*\d+\s*left/i) ||
        parentText.match(/few\s*left/i) ||
        parentText.match(/hurry/i);

      if (urgencyMatch) {
        results.push(
          redactSensitiveText(`${variantLabel}: ${normalizeText(urgencyMatch[0])}`, redactionStats),
        );
      }
    });

    return uniqueTexts(results, 8);
  }

  function extractSchemaProducts(redactionStats) {
    const products = [];
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0, 12);

    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        const queue = Array.isArray(parsed) ? [...parsed] : [parsed];

        while (queue.length > 0 && products.length < 12) {
          const item = queue.shift();
          if (!item || typeof item !== "object") continue;

          if (Array.isArray(item)) {
            queue.push(...item);
            continue;
          }

          if (Array.isArray(item["@graph"])) {
            queue.push(...item["@graph"]);
          }
          if (Array.isArray(item.itemListElement)) {
            queue.push(...item.itemListElement.map((entry) => entry?.item || entry));
          }

          const type = String(item["@type"] || "");
          if (!/Product|Offer/i.test(type)) continue;

          const title = redactSensitiveText(normalizeText(item.name || item.title || document.title), redactionStats);
          if (!title || title.length < 3) continue;

          const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers || {};
          const priceSource = offers?.price ?? offers?.lowPrice ?? item.price ?? null;
          const originalPrice = offers?.highPrice ?? offers?.priceSpecification?.price ?? null;
          const product = {
            title: title.slice(0, 160),
            listedPrice: parsePriceFromText(priceSource),
            originalPrice: parsePriceFromText(originalPrice),
            currency: normalizeText(offers?.priceCurrency || item.priceCurrency) || detectCurrencyFromText(String(priceSource || "")),
            url: normalizeText(item.url) || window.location.href,
            urgencyText: extractUrgencyText(item.description || ""),
            stockText: extractStockText(item.description || ""),
            dealSignals: collectSnippetCandidates([item.description || "", item.availability || ""]).slice(0, 6),
          };
          if (product.listedPrice != null || product.stockText || product.urgencyText) {
            products.push(product);
          }
        }
      } catch (_error) {
        // Ignore invalid structured data blocks.
      }
    }

    return products;
  }

  function extractProductCandidateFromElement(element, redactionStats) {
    const cardText = normalizeText(element.textContent || "");
    if (cardText.length < 20 || cardText.length > 3000) return null;

    const titleElement = element.querySelector(
      [
        "h1",
        "h2",
        "h3",
        "h4",
        "[data-testid*='title']",
        "[data-a-color='base']",
        "a[title]",
        "[class*='title']",
        "[class*='name']",
        "[class*='product-product']",
        "[class*='productmetainfo']",
        ".a-size-base-plus",
        ".a-link-normal",
        ".product-name",
        ".item-name",
        ".product-brand",
        "[itemprop='name']",
      ].join(", "),
    );
    let rawTitle = normalizeText(titleElement?.textContent || titleElement?.getAttribute?.("title") || "");
    if (!rawTitle || rawTitle.length < 5) {
      const brand = normalizeText(element.querySelector(".product-brand")?.textContent || "");
      const product = normalizeText(element.querySelector(".product-product, [class*='product-product']")?.textContent || "");
      if (brand && product) {
        rawTitle = `${brand} ${product}`;
      }
    }
    if (!rawTitle) {
      rawTitle = cardText.slice(0, 140);
    }
    const title = redactSensitiveText(rawTitle, redactionStats);
    if (!title || title.length < 6) return null;
    if (
      /^[.#][\w-]+\s*\{/i.test(title) ||
      /\b(function|const|var|let)\b/i.test(title) ||
      /<[^>]+>/.test(title) ||
      title.length < 10 ||
      title.length > 300 ||
      (title === title.toUpperCase() && title.length < 30)
    ) {
      console.debug("[Guardian] Skipping invalid non-product title", title.slice(0, 80));
      return null;
    }

    const priceElement = element.querySelector(
      [
        "[class*='price-discounted']",
        "[class*='product-discountedprice']",
        "[class*='price-strike']",
        "[data-price]",
        "[itemprop='price']",
        "[class*='price']",
        "[data-testid*='price']",
        ".price",
        ".cost",
      ].join(", "),
    );
    let priceText = normalizeText(priceElement?.getAttribute?.("data-price") || priceElement?.textContent || "");
    let originalPriceText = normalizeText(
      element.querySelector("[class*='strike'], [class*='mrp'], [class*='original'], s, del")?.textContent || "",
    );
    const discountedEl = element.querySelector("[class*='discounted']");
    const strikeEl = element.querySelector("[class*='strike']");
    if (discountedEl) {
      priceText = normalizeText(discountedEl.textContent || priceText);
    }
    if (strikeEl) {
      originalPriceText = normalizeText(strikeEl.textContent || originalPriceText);
    }
    if (!priceText) {
      priceText = cardText;
    }
    const listedPrice = parsePriceFromText(priceText);
    const originalPrice = parsePriceFromText(originalPriceText);
    const linkEl = element.querySelector("a[href]");
    const url = linkEl?.getAttribute("href") ? new URL(linkEl.getAttribute("href"), window.location.origin).toString() : window.location.href;
    const urgencyText = extractUrgencyText(cardText);
    const stockText = extractStockText(cardText);
    const timerBehavior = detectTimerBehavior();
    const discountPercentMatch = cardText.match(/(\d+)%\s*off/i);
    const dealSignals = collectSnippetCandidates([
      ...extractTextMatches(cardText, /limited time deal|limited deal|flash sale|deal ends|ends in|expires|today only|lightning deal/gi),
      ...extractTextMatches(cardText, /only \d+ left|\b\d+\s*left\b|only few left|few left|few seats left|few rooms left|selling fast|people viewing|bought in past month/gi),
      urgencyText || "",
      stockText || "",
    ]);

    if (!listedPrice) {
      console.debug("[Guardian] Skipping product without price", title);
      return null;
    }

    if (!dealSignals.length && !/product|item|price|discount|mrp/i.test(cardText)) {
      return null;
    }

    return {
      title: title.slice(0, 160),
      listedPrice,
      originalPrice,
      currency: detectCurrencyFromText(priceText || cardText),
      url,
      urgencyText,
      stockText,
      discountPercent: discountPercentMatch ? Number(discountPercentMatch[1]) : null,
      hasTimer: timerBehavior.hasTimer,
      timerResetsOnRefresh: timerBehavior.timerResetsOnRefresh,
      reloadStockChanges: detectStockBehavior(stockText || ""),
      dealSignals: dealSignals.slice(0, 6),
    };
  }

  function extractPrimaryPageProduct(redactionStats, fallbackSignals) {
    console.debug("[Guardian] Attempting fallback page scan...");
    const titleElement = document.querySelector(
      "h1, [itemprop='name'], [class*='product-title'], [class*='pdp-title'], [class*='product-product'], .pdp-name, meta[property='og:title']",
    );
    const rawTitle = normalizeText(titleElement?.getAttribute?.("content") || titleElement?.textContent || document.title);
    const title = redactSensitiveText(rawTitle, redactionStats);
    const fullText = normalizeText(document.body?.innerText || "");
    const listedPrice = parsePriceFromText(fullText);
    if (!title || (listedPrice == null && fallbackSignals.length === 0)) {
      console.debug("[Guardian] Fallback page scan found no usable product");
      return null;
    }

    console.debug("[Guardian] Fallback page scan found product", title.slice(0, 80));
    return {
      title: title.slice(0, 160),
      listedPrice,
      originalPrice: parsePriceFromText(
        normalizeText(document.querySelector("[class*='strike'], [class*='mrp'], [class*='original'], s, del")?.textContent || ""),
      ),
      currency: detectCurrencyFromText(fullText),
      url: window.location.href,
      urgencyText: extractUrgencyText(fullText),
      stockText: extractStockText(fullText),
      hasTimer: detectTimerBehavior().hasTimer,
      timerResetsOnRefresh: detectTimerBehavior().timerResetsOnRefresh,
      reloadStockChanges: detectStockBehavior(extractStockText(fullText) || ""),
      dealSignals: collectSnippetCandidates([...(fallbackSignals || []), fullText]).slice(0, 6),
    };
  }

  function extractTextMatches(text, regex) {
    const matches = [];
    const source = String(text || "");
    let match;
    while ((match = regex.exec(source)) && matches.length < 8) {
      matches.push(match[0]);
    }
    return matches;
  }

  function parsePriceFromText(text) {
    if (text == null) return null;
    const raw = String(text).trim();
    if (/^\d[\d,]*(\.\d{1,2})?$/.test(raw)) {
      const numeric = Number(raw.replace(/,/g, ""));
      return Number.isFinite(numeric) ? numeric : null;
    }
    const currencyMatch = raw.match(/(?:₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP|¥|JPY)\s*([0-9][0-9,]*\.?[0-9]{0,2})/i);
    if (currencyMatch?.[1]) {
      const numeric = Number(currencyMatch[1].replace(/,/g, ""));
      return Number.isFinite(numeric) ? numeric : null;
    }
    const rupeeMatch = raw.match(/[₹Rs\.?\s]*\s*([\d,]+)/i);
    if (rupeeMatch?.[1]) {
      const cleaned = rupeeMatch[1].replace(/,/g, "");
      const numeric = Number(cleaned);
      return Number.isFinite(numeric) ? numeric : null;
    }

    const genericMatch = raw.replace(/[,\s]/g, "").match(/([\d.]+)/);
    if (!genericMatch?.[1]) return null;
    const numeric = Number(genericMatch[1]);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function extractUrgencyText(text) {
    const source = String(text || "");
    const match =
      source.match(/\d+\s*(hours?|mins?|minutes?|seconds?|days?)\s*(left|remaining)/i) ||
      source.match(/ends?\s*(in|soon|today|tonight)/i) ||
      source.match(/limited\s*time/i) ||
      source.match(/hurry/i) ||
      source.match(/act\s*fast/i) ||
      source.match(/expires?\s*(soon|today)/i);
    return match ? normalizeText(match[0]) : null;
  }

  function extractStockText(text) {
    const source = String(text || "");
    const match =
      source.match(/only\s*\d+\s*left/i) ||
      source.match(/\d+\s*left\s*in\s*stock/i) ||
      source.match(/\d+\s*remaining/i) ||
      source.match(/low\s*stock/i) ||
      source.match(/almost\s*gone/i) ||
      source.match(/few\s*left/i) ||
      source.match(/limited\s*stock/i);
    return match ? normalizeText(match[0]) : null;
  }

  function detectCurrencyFromText(text) {
    const raw = String(text || "");
    if (/myntra|flipkart|ajio|tatacliq|snapdeal|meesho|\.in$/i.test(window.location.hostname)) return "INR";
    if (/amazon\.com|walmart|target|ebay\.com/i.test(window.location.hostname)) return "USD";
    if (/amazon\.co\.uk|\.uk$/i.test(window.location.hostname)) return "GBP";
    if (/\.eu$/i.test(window.location.hostname)) return "EUR";
    if (!raw) return "INR";
    if (/₹|rs\.?|inr/i.test(raw)) return "INR";
    if (/\$/i.test(raw)) return "USD";
    if (/€|eur/i.test(raw)) return "EUR";
    if (/£|gbp/i.test(raw)) return "GBP";
    if (/¥|jpy/i.test(raw)) return "JPY";
    return "INR";
  }

  function buildNonCommerceScanResult(payload) {
    return {
      nonCommerceReason: "This page does not look like a shopping or checkout flow, so Guardian skipped the quick scan.",
      darkPatternReport: {
        falseUrgency: { detected: false, evidence: "", isTimerFake: null },
        falseScarcity: { detected: false, evidence: "" },
        confirmShaming: { detected: false, shamingText: "", rewrittenText: "" },
        hiddenFees: { detected: false, feeItems: [], totalExtra: null },
        preCheckedAddOns: { detected: false, fieldIds: [], addOnLabels: [] },
        misdirection: { detected: false, hiddenDeclineText: "" },
        trustScore: 95,
        summary: "Guardian detected that this is not a commerce page, so it did not run a shopping-pattern scan.",
        domain: payload.domain,
        url: payload.url,
      },
      trustRating: {
        score: 95,
      },
    };
  }

  function applyHighlightsForResult(result) {
    clearHighlights();

    const report = result?.darkPatternReport;
    if (!report) return;

    const snippets = [];
    if (report.falseUrgency?.detected) {
      snippets.push(...collectSnippetCandidates([report.falseUrgency.evidence, ...(result?.pageSignals?.timerElements || [])]));
    }
    if (report.falseScarcity?.detected) {
      snippets.push(...collectSnippetCandidates([report.falseScarcity.evidence, ...(result?.pageSignals?.stockAlerts || [])]));
    }
    if (report.confirmShaming?.detected) {
      snippets.push(...collectSnippetCandidates([report.confirmShaming.shamingText]));
    }
    if (report.hiddenFees?.detected) {
      snippets.push(
        ...collectSnippetCandidates([
          ...(report.hiddenFees.feeItems || []).map((fee) => fee.label),
          "service fee",
          "resort fee",
          "processing fee",
          "convenience fee",
        ]),
      );
    }
    if (report.preCheckedAddOns?.detected) {
      snippets.push(...collectSnippetCandidates(report.preCheckedAddOns.addOnLabels || []));
    }
    if (report.misdirection?.detected) {
      snippets.push(...collectSnippetCandidates([report.misdirection.hiddenDeclineText, "no thanks", "decline"]));
    }

    highlightMatchingElements(snippets);
  }

  function renderDealIntelligenceHtml(dealIntelligence) {
    if (!dealIntelligence || !Array.isArray(dealIntelligence.items) || dealIntelligence.items.length === 0) {
      return "";
    }

    const topItems = dealIntelligence.items.slice(0, 8);
    const statusCounts = {
      verified: dealIntelligence.items.filter((item) => item.status === "verified").length,
      unverified: dealIntelligence.items.filter((item) => item.status === "unverified").length,
      likely_misleading: dealIntelligence.items.filter((item) => item.status === "likely_misleading").length,
    };
    return `
      <div style="margin-top:12px;">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd;">Deal authenticity</div>
        <div style="font-size:12px;line-height:1.45;color:#cbd5e1;margin-top:6px;">${escapeHtml(dealIntelligence.summary || "")}</div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:6px;">Verified: ${statusCounts.verified} • Unverified: ${statusCounts.unverified} • Likely misleading: ${statusCounts.likely_misleading}</div>
        <div style="display:grid;gap:8px;margin-top:8px;">
          ${topItems
            .map((item) => {
              const tone =
                item.status === "verified"
                  ? "rgba(34,197,94,.14)"
                  : item.status === "likely_misleading"
                    ? "rgba(239,68,68,.14)"
                    : "rgba(148,163,184,.14)";
              const trust = item.trustVerification || {};
              const checks = trust.checks || {};
              const checkLine = [
                `pattern ${checks.pattern_check || "inconclusive"}`,
                `stability ${checks.stability_check || "inconclusive"}`,
                `reset ${checks.reset_check || "inconclusive"}`,
                `external ${checks.external_validation || "inconclusive"}`,
                `price ${checks.price_truth_check || "inconclusive"}`,
              ].join(" • ");
              return `
                <div style="border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px;background:${tone};">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                    <div style="font-size:12px;font-weight:700;color:white;">${escapeHtml(item.productTitle || "Offer")}</div>
                    <div style="font-size:11px;color:#e2e8f0;text-transform:uppercase;">${escapeHtml((item.status || "unverified").replaceAll("_", " "))}</div>
                  </div>
                  <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">Price: ${escapeHtml(formatCurrency(item.listedPrice, item.currency))}</div>
                  <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">Confidence: ${escapeHtml(item.confidence || "low")}</div>
                  <div style="font-size:11px;color:#e2e8f0;margin-top:4px;">Reality: ${escapeHtml(trust.reality || "UNCERTAIN")} • Deal: ${escapeHtml(trust.deal_quality || "AVERAGE")} • Advice: ${escapeHtml(trust.final_advice || "COMPARE_OPTIONS")}</div>
                  <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">Trust score: ${escapeHtml(String(trust.confidence_score ?? 0.5))} • fake ${escapeHtml(String(trust.signal_tally?.strong_fake ?? 0))} / real ${escapeHtml(String(trust.signal_tally?.strong_real ?? 0))}</div>
                  <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">Checks: ${escapeHtml(checkLine.replaceAll("_", " "))}</div>
                  <div style="font-size:12px;line-height:1.45;color:#cbd5e1;margin-top:6px;">${escapeHtml(item.rationale || "")}</div>
                  <div style="font-size:12px;line-height:1.45;color:#e2e8f0;margin-top:4px;">${escapeHtml(item.recommendation || "")}</div>
                </div>`;
            })
            .join("")}
        </div>
      </div>`;
  }

  function applyCheapestSafePathGuidance(mission) {
    clearHighlights();

    const signals = collectSignals();
    const keepSnippets = collectSnippetCandidates([
      "no thanks",
      "decline",
      "skip",
      "continue",
      "continue without",
      "basic",
      "standard",
      mission?.ghostCheckout?.saferPathMode?.label,
      ...(signals.buttonLabels || []),
    ]).slice(0, 10);

    const stripSnippets = collectSnippetCandidates([
      ...(signals.formFields || []).map((field) => field.label),
      ...(Array.isArray(mission?.manipulativeSignals)
        ? mission.manipulativeSignals.flatMap((signal) => [signal.label, signal.evidence, signal.fix])
        : []),
      ...(mission?.ghostCheckout?.hiddenCostLanes || []).map((lane) => lane.label),
      "insurance",
      "protection",
      "warranty",
      "premium support",
      "add-on",
      "newsletter",
      "travel protection",
    ]).slice(0, 16);

    const keepCount = highlightMatchingElements(keepSnippets, {
      tone: "keep",
      label: "KEEP",
    });
    const stripCount = highlightMatchingElements(stripSnippets, {
      tone: "strip",
      label: "STRIP",
    });

    return {
      keepCount,
      stripCount,
      keepLabels: keepSnippets.slice(0, 4),
      stripLabels: stripSnippets.slice(0, 5),
      summary:
        keepCount || stripCount
          ? "Guardian marked the safer buttons and the likely upsells directly on the page."
          : "Guardian could not confidently map the cheapest safe path to visible DOM elements on this page.",
    };
  }

  function collectSnippetCandidates(values) {
    return values
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => normalizeSnippet(value))
      .filter(Boolean)
      .slice(0, 12);
  }

  function normalizeSnippet(value) {
    const normalized = normalizeText(value)
      .replace(/^flagged decline copy:\s*/i, "")
      .replace(/^detected .*?:\s*/i, "")
      .replace(/\(\+\$?[0-9.,]+\)/g, "")
      .replace(/["']/g, "")
      .trim();

    if (!normalized || normalized.length < 4) {
      return "";
    }

    return normalized.slice(0, 80).toLowerCase();
  }

  function highlightMatchingElements(snippets, options = { tone: "strip", label: "FLAG" }) {
    if (!snippets.length) return 0;

    const candidates = Array.from(document.querySelectorAll("button, a, label, p, span, div, li"));
    const used = new Set();
    let count = 0;

    for (const element of candidates) {
      const text = normalizeText(element.textContent || "").toLowerCase();
      if (!text || text.length > 220) continue;

      const matchedSnippet = snippets.find((snippet) => text.includes(snippet) || snippet.includes(text));
      if (!matchedSnippet || used.has(matchedSnippet)) continue;

      used.add(matchedSnippet);
      applyHighlightMarker(element, options);
      count += 1;
      if (used.size >= 6) break;
    }

    return count;
  }

  function applyHighlightMarker(element, options) {
    const isKeep = options?.tone === "keep";
    const outline = isKeep ? "rgba(74, 222, 128, 0.95)" : "rgba(248, 113, 113, 0.95)";
    const shadow = isKeep ? "rgba(74, 222, 128, 0.18)" : "rgba(248, 113, 113, 0.18)";
    const badgeBg = isKeep ? "#166534" : "#991b1b";

    element.setAttribute(HIGHLIGHT_ATTR, "true");
    element.style.outline = `2px solid ${outline}`;
    element.style.outlineOffset = "2px";
    element.style.borderRadius = "6px";
    element.style.boxShadow = `0 0 0 4px ${shadow}`;

    if (element.querySelector(`[${HIGHLIGHT_BADGE_ATTR}]`)) {
      return;
    }

    const badge = document.createElement("span");
    badge.setAttribute(HIGHLIGHT_BADGE_ATTR, "true");
    badge.textContent = options?.label || "FLAG";
    badge.style.position = "absolute";
    badge.style.top = "-10px";
    badge.style.right = "-6px";
    badge.style.zIndex = "2147483647";
    badge.style.background = badgeBg;
    badge.style.color = "#ffffff";
    badge.style.fontSize = "10px";
    badge.style.fontWeight = "800";
    badge.style.padding = "2px 6px";
    badge.style.borderRadius = "999px";
    badge.style.letterSpacing = ".08em";
    badge.style.textTransform = "uppercase";
    badge.style.pointerEvents = "none";

    const computedPosition = window.getComputedStyle(element).position;
    if (!computedPosition || computedPosition === "static") {
      element.style.position = "relative";
    }

    element.appendChild(badge);
  }

  function clearHighlights() {
    const nodes = Array.from(document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`));
    for (const node of nodes) {
      node.querySelectorAll(`[${HIGHLIGHT_BADGE_ATTR}]`).forEach((badge) => badge.remove());
      node.removeAttribute(HIGHLIGHT_ATTR);
      node.style.outline = "";
      node.style.outlineOffset = "";
      node.style.borderRadius = "";
      node.style.boxShadow = "";
    }
  }

  function formatCurrency(value, currency) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "--";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || detectCurrencyFromText(""),
      maximumFractionDigits: 2,
    }).format(value);
  }
})();


