const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const missionGoalInput = document.getElementById("missionGoal");
const missionBudgetInput = document.getElementById("missionBudget");
const missionPreferencesInput = document.getElementById("missionPreferences");
const autoAnalyzeInput = document.getElementById("autoAnalyze");
const compareAcrossSitesInput = document.getElementById("compareAcrossSites");
const allowAutoDeclineUpsellsInput = document.getElementById("allowAutoDeclineUpsells");
const allowAccountCreationInput = document.getElementById("allowAccountCreation");
const saveSettingsButton = document.getElementById("saveSettings");
const runScanButton = document.getElementById("runScan");
const revealGhostCheckoutButton = document.getElementById("revealGhostCheckout");
const showSafePathButton = document.getElementById("showSafePath");
const runMissionButton = document.getElementById("runMission");
const status = document.getElementById("status");
const debugCommerceResult = document.getElementById("debugCommerceResult");
const debugPageType = document.getElementById("debugPageType");
const debugProductsCount = document.getElementById("debugProductsCount");
const debugUrlText = document.getElementById("debugUrlText");
const forceScanButton = document.getElementById("forceScanBtn");

init().catch((error) => {
  renderError(error instanceof Error ? error.message : String(error));
});

async function init() {
  const settingsResponse = await sendRuntimeMessage({ type: "guardian:get-settings" });
  if (settingsResponse?.ok) {
    apiBaseUrlInput.value = settingsResponse.settings.apiBaseUrl || "http://127.0.0.1:3001";
    missionGoalInput.value = settingsResponse.settings.missionGoal || "";
    missionBudgetInput.value = settingsResponse.settings.missionBudget || "";
    missionPreferencesInput.value = settingsResponse.settings.missionPreferences || "";
    autoAnalyzeInput.checked = settingsResponse.settings.autoAnalyze !== false;
    compareAcrossSitesInput.checked = settingsResponse.settings.compareAcrossSites !== false;
    allowAutoDeclineUpsellsInput.checked = settingsResponse.settings.allowAutoDeclineUpsells !== false;
    allowAccountCreationInput.checked = settingsResponse.settings.allowAccountCreation === true;
  }

  saveSettingsButton.addEventListener("click", saveSettings);
  runScanButton.addEventListener("click", runAnalysis);
  revealGhostCheckoutButton.addEventListener("click", revealGhostCheckout);
  showSafePathButton.addEventListener("click", showSafePath);
  runMissionButton.addEventListener("click", runMission);
  forceScanButton?.addEventListener("click", forceScan);

  const tab = await getActiveTab();
  if (!tab?.id) {
    renderInfo("Open a shopping page in the current tab to analyze it.");
    return;
  }
  if (debugUrlText) {
    debugUrlText.textContent = tab.url || "-";
  }

  const state = await sendMessageToTab(tab.id, { type: "guardian:get-page-state" }).catch(() => null);
  updateDebugPanel(state?.state);
  if (state?.ok && state.state?.lastMission) {
    renderMission(state.state.lastMission);
    return;
  }

  if (state?.ok && state.state?.lastResult) {
    renderScanResult(state.state.lastResult);
    return;
  }

  renderInfo("No mission has been run on this tab yet.");
}

async function forceScan() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    renderError("No active tab found.");
    return;
  }

  forceScanButton.disabled = true;
  renderInfo("Force-scanning current page...");

  try {
    const response = await sendMessageToTab(tab.id, { action: "forceScan" });
    if (!response?.ok) {
      throw new Error(response?.error || "Force scan failed.");
    }

    const state = await sendMessageToTab(tab.id, { type: "guardian:get-page-state" }).catch(() => null);
    updateDebugPanel(state?.state);
    renderScanResult(response.result);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    forceScanButton.disabled = false;
  }
}

async function saveSettings() {
  await sendRuntimeMessage({
    type: "guardian:update-settings",
    payload: {
      apiBaseUrl: apiBaseUrlInput.value.trim(),
      missionGoal: missionGoalInput.value.trim(),
      missionBudget: missionBudgetInput.value.trim(),
      missionPreferences: missionPreferencesInput.value,
      autoAnalyze: autoAnalyzeInput.checked,
      compareAcrossSites: compareAcrossSitesInput.checked,
      allowAutoDeclineUpsells: allowAutoDeclineUpsellsInput.checked,
      allowAccountCreation: allowAccountCreationInput.checked,
    },
  });
  renderInfo("Settings saved.");
}

async function runAnalysis() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    renderError("No active tab found.");
    return;
  }

  runScanButton.disabled = true;
  renderInfo("Running Guardian quick scan...");

  try {
    await saveSettings();
    const response = await sendMessageToTab(tab.id, { type: "guardian:run-analysis" });
    if (!response?.ok) {
      throw new Error(response?.error || "Guardian scan failed.");
    }
    renderScanResult(response.result);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    runScanButton.disabled = false;
  }
}

async function runMission() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    renderError("No active tab found.");
    return;
  }

  runMissionButton.disabled = true;
  renderInfo("Running Guardian mission...");

  try {
    await saveSettings();
    const response = await sendMessageToTab(tab.id, { type: "guardian:run-mission" });
    if (!response?.ok) {
      throw new Error(response?.error || "Guardian mission failed.");
    }
    renderMission(response.result);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    runMissionButton.disabled = false;
  }
}

async function revealGhostCheckout() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    renderError("No active tab found.");
    return;
  }

  revealGhostCheckoutButton.disabled = true;
  renderInfo("Revealing the true total with Guardian Ghost Checkout...");

  try {
    await saveSettings();
    const response = await sendMessageToTab(tab.id, { type: "guardian:reveal-ghost-checkout" });
    if (!response?.ok) {
      throw new Error(response?.error || "Guardian Ghost Checkout failed.");
    }
    renderMission(response.result);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    revealGhostCheckoutButton.disabled = false;
  }
}

async function showSafePath() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    renderError("No active tab found.");
    return;
  }

  showSafePathButton.disabled = true;
  renderInfo("Marking the cheapest safe path on the current page...");

  try {
    await saveSettings();
    const response = await sendMessageToTab(tab.id, { type: "guardian:show-cheapest-safe-path" });
    if (!response?.ok) {
      throw new Error(response?.error || "Guardian could not mark the safe path.");
    }
    renderInfo(
      `${response.result?.summary || "Guardian marked the page."} Keep ${response.result?.keepCount ?? 0} • Strip ${response.result?.stripCount ?? 0}`,
    );
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    showSafePathButton.disabled = false;
  }
}

function renderInfo(message) {
  status.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function renderError(message) {
  status.innerHTML = `<p style="color:#fecaca;">${escapeHtml(message)}</p>`;
}

function updateDebugPanel(state) {
  if (debugCommerceResult) {
    debugCommerceResult.textContent =
      typeof state?.currentSignalsSummary?.isCommerce === "boolean" ? String(state.currentSignalsSummary.isCommerce) : "-";
  }
  if (debugPageType) {
    debugPageType.textContent = state?.currentSignalsSummary?.pageType || "-";
  }
  if (debugProductsCount) {
    debugProductsCount.textContent =
      typeof state?.currentSignalsSummary?.productCount === "number" ? String(state.currentSignalsSummary.productCount) : "-";
  }
  if (debugUrlText && state?.currentSignalsSummary?.url) {
    debugUrlText.textContent = state.currentSignalsSummary.url;
  }
}

function renderScanResult(result) {
  if (result?.mode === "booking") {
    renderBookingAnalysis(result);
    return;
  }

  const report = result?.darkPatternReport;
  if (!report) {
    renderError("No report data returned from Guardian.");
    return;
  }

  const findings = [];
  const mapping = [
    ["falseUrgency", "False urgency", report.falseUrgency?.evidence],
    ["falseScarcity", "False scarcity", report.falseScarcity?.evidence],
    ["confirmShaming", "Confirm shaming", report.confirmShaming?.shamingText],
    [
      "hiddenFees",
      "Hidden fees",
      report.hiddenFees?.feeItems?.map((fee) => `${fee.label} (+$${Number(fee.amount).toFixed(2)})`).join(", "),
    ],
    ["preCheckedAddOns", "Pre-checked add-ons", report.preCheckedAddOns?.addOnLabels?.join(", ")],
    ["misdirection", "Misdirection", report.misdirection?.hiddenDeclineText],
  ];

  for (const [key, label, detail] of mapping) {
    if (report[key]?.detected) {
      findings.push({ label, detail: detail || "Detected from the visible checkout text." });
    }
  }

  status.innerHTML = `
    <div class="score">${escapeHtml(String(report.trustScore ?? "--"))}</div>
    <p>${escapeHtml(report.summary || "Guardian completed the scan.")}</p>
    ${
      findings.length === 0
        ? `<div class="finding"><strong>Clean result</strong><span>No dark-pattern signals were detected in the current tab.</span></div>`
        : findings
            .map(
              (finding) => `
              <div class="finding">
                <strong>${escapeHtml(finding.label)}</strong>
                <span>${escapeHtml(finding.detail)}</span>
              </div>`,
            )
            .join("")
    }
    ${renderDealIntelligenceBlock(result?.dealIntelligence)}
  `;
}

function renderMission(mission) {
  const alternatives = Array.isArray(mission?.alternatives) ? mission.alternatives.slice(0, 3) : [];
  const signals = Array.isArray(mission?.manipulativeSignals) ? mission.manipulativeSignals.slice(0, 3) : [];
  const ghostCheckout = mission?.ghostCheckout;
  const variantUrgencySignal = Array.isArray(mission?.manipulativeSignals)
    ? mission.manipulativeSignals.find((signal) => signal?.type === "variant_pressure")
    : null;
  const platformFeeRisk = ghostCheckout?.platformFeeRisk || null;
  const deliveryThreshold = ghostCheckout?.deliveryThreshold || null;
  const recommendationDetails = mission?.recommendationDetails || null;
  const platformFeeRiskClass = platformFeeRisk ? `risk-${String(platformFeeRisk.risk || "low").toLowerCase()}` : "";
  const variantUrgencyClass = variantUrgencySignal ? `risk-${String(variantUrgencySignal.severity || "medium").toLowerCase()}` : "";
  const deliveryThresholdClass =
    deliveryThreshold && !deliveryThreshold.hasFreeDelivery && typeof deliveryThreshold.needsMore === "number"
      ? "risk-medium"
      : "risk-low";

  status.innerHTML = `
    <div class="score">${escapeHtml(String(mission?.trust?.score ?? "--"))}</div>
    <p>${escapeHtml(mission?.summary || "Guardian completed the mission.")}</p>
    <div class="section">
      <strong>Recommendation</strong>
      <span>${escapeHtml((mission?.recommendation || "proceed").replaceAll("_", " "))}</span>
      ${
        recommendationDetails?.summary
          ? `<div class="finding">
              <strong>${escapeHtml(recommendationDetails.summary)}</strong>
              <span>${escapeHtml(Array.isArray(recommendationDetails.reasoning) ? recommendationDetails.reasoning.join(" ") : "")}</span>
            </div>`
          : ""
      }
    </div>
    ${
      mission?.commerceIntent?.isShoppingPage === false
        ? `<div class="section">
            <strong>Page type</strong>
            <span>${escapeHtml(mission.commerceIntent.reason)}</span>
          </div>`
        : ""
    }
    <div class="section">
      <strong>True total</strong>
      <span>${escapeHtml(formatCurrency(mission?.estimatedTrueTotal))}</span>
      <div class="pill">Listed ${escapeHtml(formatCurrency(mission?.listedPrice))}</div>
      ${
        mission?.budget != null
          ? `<div class="pill">${mission.withinBudget ? "Within" : "Over"} budget ${escapeHtml(formatCurrency(mission.budget))}</div>`
          : ""
      }
      ${
        deliveryThreshold?.threshold
          ? `<div class="pill ${deliveryThresholdClass}">${
              deliveryThreshold.hasFreeDelivery
                ? `Free delivery unlocked at ${formatCurrency(deliveryThreshold.threshold)}`
                : `Free delivery threshold: ${formatCurrency(deliveryThreshold.threshold)}, needs ${formatCurrency(deliveryThreshold.needsMore)} more`
            }</div>`
          : ""
      }
    </div>
    ${
      platformFeeRisk
        ? `<div class="section signal-card ${platformFeeRiskClass}">
            <strong>Platform fee risk</strong>
            <span class="signal-badge ${platformFeeRiskClass}">${escapeHtml(String(platformFeeRisk.risk || "low").toUpperCase())}</span>
            <span>${escapeHtml(`${platformFeeRisk.estimatedFee ? `Estimated fee ${formatCurrency(platformFeeRisk.estimatedFee)}` : "No fee estimate available yet"}`)}</span>
            <div class="finding">
              <strong>Likelihood ${escapeHtml(String(Math.round((platformFeeRisk.likelihood || 0) * 100)))}%</strong>
              <span>${escapeHtml(platformFeeRisk.reasoning || "No special platform fee pattern detected.")}</span>
            </div>
          </div>`
        : ""
    }
    ${
      variantUrgencySignal
        ? `<div class="section signal-card ${variantUrgencyClass}">
            <strong>Variant urgency detected</strong>
            <span class="signal-badge ${variantUrgencyClass}">${escapeHtml(String(variantUrgencySignal.severity || "medium").toUpperCase())}</span>
            <div class="finding">
              <strong>${escapeHtml(variantUrgencySignal.label || "Variant urgency")}</strong>
              <span>${escapeHtml(variantUrgencySignal.evidence || "Size or variant-specific pressure was detected on the page.")}</span>
            </div>
          </div>`
        : ""
    }
    ${
      ghostCheckout
        ? `<div class="section">
            <strong>Ghost checkout</strong>
            <span>${escapeHtml(ghostCheckout.status || "Guardian simulated the rest of the checkout path.")}</span>
            <div class="pill">Delta ${escapeHtml(formatCurrency(ghostCheckout.deltaFromHeadline))}</div>
            <div class="pill">${escapeHtml(ghostCheckout.saferPathMode?.label || "Cheapest safe path")}</div>
            ${
              Array.isArray(ghostCheckout.hiddenCostLanes)
                ? ghostCheckout.hiddenCostLanes
                    .map(
                      (lane) => `
                        <div class="finding">
                          <strong>${escapeHtml(lane.label)} • ${escapeHtml(formatCurrency(lane.amount))}</strong>
                          <span>${escapeHtml(lane.source)} • ${escapeHtml(lane.confidence)} confidence</span>
                        </div>`,
                    )
                    .join("")
                : ""
            }
            ${
              deliveryThreshold?.note
                ? `<div class="finding">
                    <strong>Delivery threshold</strong>
                    <span>${escapeHtml(deliveryThreshold.note)}</span>
                  </div>`
                : ""
            }
          </div>`
        : ""
    }
    <div class="section">
      <strong>Trust verdict</strong>
      <span>${escapeHtml(mission?.trust?.verdict || "No verdict available.")}</span>
    </div>
    ${
      signals.length
        ? `<div class="section">
            <strong>Why Guardian flagged it</strong>
            ${signals
              .map(
                (signal) => `
                  <div class="finding">
                    <strong>${escapeHtml(signal.label)}</strong>
                    <span>${escapeHtml(signal.evidence)}</span>
                  </div>`,
              )
              .join("")}
          </div>`
        : ""
    }
    ${
      alternatives.length
        ? `<div class="section">
            <strong>Alternatives</strong>
            ${alternatives
              .map(
                (alternative) => `
                  <div class="finding">
                    <strong>${escapeHtml(alternative.merchantName)}${alternative.bestValue ? " • best value" : ""}</strong>
                    <span>${escapeHtml(formatCurrency(alternative.estimatedTrueTotal))} • trust ${escapeHtml(String(alternative.trustScore))}</span>
                  </div>`,
              )
            .join("")}
          </div>`
        : ""
    }
    ${renderDealIntelligenceBlock(mission?.dealIntelligence)}
    <div class="section">
      <strong>Next best action</strong>
      <span>${escapeHtml(mission?.nextBestAction || "")}</span>
    </div>
  `;
}

function renderBookingAnalysis(data) {
  const bookingContext = data?.bookingContext || null;
  const mission = data?.mission || null;
  const manipulations = Array.isArray(data?.bookingManipulations)
    ? data.bookingManipulations
    : Array.isArray(data?.manipulations)
      ? data.manipulations
      : [];
  const trustScore = data?.trustScore ?? data?.checkoutAnalysis?.trustScore ?? mission?.trust?.score ?? 50;
  const trustClass = trustScore >= 75 ? "risk-low" : trustScore >= 50 ? "risk-medium" : "risk-high";
  const ghostCheckout = mission?.ghostCheckout || null;
  const alternatives = Array.isArray(mission?.alternatives) ? mission.alternatives.slice(0, 3) : [];
  const recommendation = mission?.recommendation || data?.recommendation || "proceed_with_caution";
  const recommendationClass =
    recommendation === "proceed" ? "success" : recommendation === "switch" || recommendation === "cancel" ? "warning" : "caution";
  const recommendationIcon = recommendation === "proceed" ? "✅" : recommendation === "switch" || recommendation === "cancel" ? "🔄" : "⚠️";
  const baseFare = bookingContext?.price ?? mission?.listedPrice ?? data?.bookingPrice?.currentPrice ?? null;

  status.innerHTML = `
    ${
      bookingContext
        ? `<div class="booking-header">
            <h3>${escapeHtml(getBookingEmoji(bookingContext.type))} ${escapeHtml(String(bookingContext.type || "booking").toUpperCase())} ANALYSIS</h3>
            ${
              bookingContext.route?.from || bookingContext.route?.to || bookingContext.route?.display
                ? `<div class="route-info">
                    <span class="route">${escapeHtml(
                      bookingContext.route?.display ||
                        `${bookingContext.route?.from || "Unknown"} → ${bookingContext.route?.to || "Unknown"}`,
                    )}</span>
                  </div>`
                : ""
            }
            ${bookingContext.operator ? `<div class="operator">Operator: ${escapeHtml(bookingContext.operator)}</div>` : ""}
            ${
              typeof baseFare === "number"
                ? `<div class="price-display">
                    <span class="label">Base Fare:</span>
                    <span class="amount">${escapeHtml(formatCurrency(baseFare, bookingContext?.currency || "INR"))}</span>
                  </div>`
                : ""
            }
            ${
              bookingContext.departureDate || bookingContext.departureTime
                ? `<div class="departure">
                    ${bookingContext.departureDate ? `📅 ${escapeHtml(bookingContext.departureDate)}` : ""}
                    ${bookingContext.departureTime ? `${bookingContext.departureDate ? " • " : ""}🕐 ${escapeHtml(bookingContext.departureTime)}` : ""}
                  </div>`
                : ""
            }
          </div>`
        : ""
    }
    <div class="trust-score-card ${trustClass}">
      <div class="score-circle">
        <span class="score-value">${escapeHtml(String(trustScore))}</span>
        <span class="score-label">Trust Score</span>
      </div>
      <p>${escapeHtml(data?.summary || mission?.summary || "Guardian completed the booking analysis.")}</p>
    </div>
    ${
      manipulations.length
        ? `<div class="manipulations-section">
            <h4>⚠️ Booking Pressure Detected (${manipulations.length})</h4>
            ${manipulations
              .map((entry) => {
                const severityClass =
                  entry?.severity === "critical" ? "critical" : entry?.severity === "high" ? "high" : "medium";
                const icon = entry?.reality === "FAKE" ? "🚨" : entry?.reality === "REAL" ? "⚠️" : "❓";
                return `
                  <div class="manipulation-card ${severityClass}">
                    <div class="manipulation-header">
                      <span class="icon">${icon}</span>
                      <span class="type">${escapeHtml(String(entry?.type || "booking_signal").replaceAll("_", " "))}</span>
                      <span class="reality ${escapeHtml(String(entry?.reality || "UNCERTAIN").toLowerCase())}">${escapeHtml(
                        String(entry?.reality || "UNCERTAIN"),
                      )}</span>
                    </div>
                    <div class="manipulation-confidence">Confidence: ${escapeHtml(String(Math.round((entry?.confidence || 0) * 100)))}%</div>
                    <div class="manipulation-reasoning">${escapeHtml(entry?.reasoning || "")}</div>
                    <div class="manipulation-advice">${escapeHtml(entry?.userAdvice || "")}</div>
                    ${
                      Array.isArray(entry?.evidence) && entry.evidence.length
                        ? `<details class="evidence-details">
                            <summary>Evidence (${entry.evidence.length})</summary>
                            <ul>${entry.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                          </details>`
                        : ""
                    }
                  </div>`;
              })
              .join("")}
          </div>`
        : `<div class="finding"><strong>Clean result</strong><span>No major booking pressure signals were detected.</span></div>`
    }
    ${
      ghostCheckout
        ? `<div class="ghost-checkout-section">
            <h4>💰 Ghost Checkout Analysis</h4>
            <div class="fee-breakdown">
              <div class="fee-row">
                <span>Base Fare</span>
                <span>${escapeHtml(formatCurrency(baseFare, bookingContext?.currency || "INR"))}</span>
              </div>
              ${
                Array.isArray(ghostCheckout.hiddenCostLanes)
                  ? ghostCheckout.hiddenCostLanes
                      .map(
                        (fee) => `
                          <div class="fee-row">
                            <span>${escapeHtml(fee.label)}</span>
                            <span>${escapeHtml(formatCurrency(fee.amount, bookingContext?.currency || "INR"))}</span>
                          </div>`,
                      )
                      .join("")
                  : ""
              }
              <div class="fee-row total">
                <span><strong>TRUE TOTAL</strong></span>
                <span><strong>${escapeHtml(
                  formatCurrency(ghostCheckout.revealedTotal ?? mission?.estimatedTrueTotal, bookingContext?.currency || "INR"),
                )}</strong></span>
              </div>
              ${
                typeof ghostCheckout.deltaFromHeadline === "number" && ghostCheckout.deltaFromHeadline > 0
                  ? `<div class="fee-delta">+${escapeHtml(
                      formatCurrency(ghostCheckout.deltaFromHeadline, bookingContext?.currency || "INR"),
                    )} more than headline price</div>`
                  : ""
              }
            </div>
          </div>`
        : ""
    }
    ${
      alternatives.length
        ? `<div class="alternatives-section">
            <h4>🔄 Better Alternatives</h4>
            ${alternatives
              .map((alternative) => {
                const savings =
                  typeof baseFare === "number" && typeof alternative?.estimatedTrueTotal === "number"
                    ? baseFare - alternative.estimatedTrueTotal
                    : null;
                const savingsPercent = savings && baseFare > 0 ? ((savings / baseFare) * 100).toFixed(1) : null;
                return `
                  <div class="alternative-card ${alternative?.bestValue ? "best-value" : ""}">
                    <div class="alt-header">
                      <span class="alt-name">${escapeHtml(alternative?.merchantName || "Alternative")}</span>
                      ${alternative?.bestValue ? '<span class="badge best">BEST VALUE</span>' : ""}
                    </div>
                    <div class="alt-price">${escapeHtml(formatCurrency(alternative?.estimatedTrueTotal, bookingContext?.currency || "INR"))}</div>
                    ${
                      savings != null && savings > 0
                        ? `<div class="alt-savings">Save ${escapeHtml(
                            formatCurrency(savings, bookingContext?.currency || "INR"),
                          )}${savingsPercent ? ` (${escapeHtml(savingsPercent)}%)` : ""}</div>`
                        : ""
                    }
                    <div class="alt-trust">Trust: ${escapeHtml(String(alternative?.trustScore ?? "--"))}/100</div>
                    <div class="alt-reasoning">${escapeHtml(Array.isArray(alternative?.why) ? alternative.why.join(" ") : "")}</div>
                    ${
                      alternative?.domain
                        ? `<a href="${escapeHtml(`https://${alternative.domain}`)}" target="_blank" class="alt-link">Check on ${escapeHtml(
                            alternative?.merchantName || alternative.domain,
                          )} →</a>`
                        : ""
                    }
                  </div>`;
              })
              .join("")}
          </div>`
        : ""
    }
    <div class="recommendation-card ${recommendationClass}">
      <div class="rec-header">
        <span class="rec-icon">${recommendationIcon}</span>
        <span class="rec-action">${escapeHtml(formatRecommendationLabel(recommendation))}</span>
      </div>
      <div class="rec-summary">${escapeHtml(mission?.summary || data?.summary || "Guardian completed the booking analysis.")}</div>
      ${
        Array.isArray(mission?.recommendationDetails?.nextSteps) && mission.recommendationDetails.nextSteps.length
          ? `<div class="next-actions">
              <strong>Next Steps:</strong>
              <ol>${mission.recommendationDetails.nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
            </div>`
          : Array.isArray(mission?.actionLog) && mission.actionLog.length
            ? `<div class="next-actions">
                <strong>Next Steps:</strong>
                <ol>${mission.actionLog.slice(0, 4).map((item) => `<li>${escapeHtml(item.detail || item.title || "")}</li>`).join("")}</ol>
              </div>`
            : ""
      }
    </div>
  `;
}

function renderDealIntelligenceBlockLegacy(dealIntelligence) {
  if (!dealIntelligence || !Array.isArray(dealIntelligence.items) || dealIntelligence.items.length === 0) {
    return "";
  }

  const items = dealIntelligence.items.slice(0, 6);
  const statusCounts = {
    verified: dealIntelligence.items.filter((item) => item.status === "verified").length,
    unverified: dealIntelligence.items.filter((item) => item.status === "unverified").length,
    likely_misleading: dealIntelligence.items.filter((item) => item.status === "likely_misleading").length,
  };
  return `
    <div class="section">
      <strong>Deal authenticity</strong>
      <span>${escapeHtml(dealIntelligence.summary || "Guardian evaluated limited-deal claims.")}</span>
      <span>Verified ${statusCounts.verified} • Unverified ${statusCounts.unverified} • Likely misleading ${statusCounts.likely_misleading}</span>
      ${items
        .map(
          (item) => `
            <div class="finding">
              <strong>${escapeHtml(item.productTitle || "Offer")} - ${escapeHtml((item.status || "unverified").replaceAll("_", " "))}</strong>
              <span>${escapeHtml(formatCurrency(item.listedPrice, item.currency))} • confidence ${escapeHtml(item.confidence || "low")}</span>
              <span>${escapeHtml(item.recommendation || item.rationale || "")}</span>
            </div>`,
        )
        .join("")}
    </div>
  `;
}

function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]);
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

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
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

function formatRecommendationLabel(value) {
  return String(value || "proceed_with_caution").replaceAll("_", " ").toUpperCase();
}

function getBookingEmoji(type) {
  switch (String(type || "").toLowerCase()) {
    case "bus":
      return "🚌";
    case "hotel":
      return "🏨";
    case "flight":
      return "✈️";
    case "restaurant":
      return "🍽️";
    case "event":
      return "🎟️";
    default:
      return "📅";
  }
}

function formatCurrency(value, currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency:
      currency ||
      (/myntra|flipkart|ajio|tatacliq|snapdeal|meesho|\.in$/i.test(globalThis.location?.hostname || "") ? "INR" : "USD"),
    maximumFractionDigits: 2,
  }).format(value);
}

// Override with multi-check trust rendering (declared later intentionally).
function renderDealIntelligenceBlock(dealIntelligence) {
  if (!dealIntelligence || !Array.isArray(dealIntelligence.items) || dealIntelligence.items.length === 0) {
    return "";
  }

  const items = dealIntelligence.items.slice(0, 6);
  const statusCounts = {
    verified: dealIntelligence.items.filter((item) => item.status === "verified").length,
    unverified: dealIntelligence.items.filter((item) => item.status === "unverified").length,
    likely_misleading: dealIntelligence.items.filter((item) => item.status === "likely_misleading").length,
  };

  return `
    <div class="section">
      <strong>Deal authenticity</strong>
      <span>${escapeHtml(dealIntelligence.summary || "Guardian evaluated limited-deal claims.")}</span>
      <span>Verified ${statusCounts.verified} | Unverified ${statusCounts.unverified} | Likely misleading ${statusCounts.likely_misleading}</span>
      ${items
        .map((item) => {
          const trust = item.trustVerification || {};
          const checks = trust.checks || {};
          const checkLine = [
            `pattern ${checks.pattern_check || "inconclusive"}`,
            `stability ${checks.stability_check || "inconclusive"}`,
            `reset ${checks.reset_check || "inconclusive"}`,
            `external ${checks.external_validation || "inconclusive"}`,
            `price ${checks.price_truth_check || "inconclusive"}`,
          ].join(" | ");

          return `
            <div class="finding">
              <strong>${escapeHtml(item.productTitle || "Offer")} - ${escapeHtml((item.status || "unverified").replaceAll("_", " "))}</strong>
              <span>${escapeHtml(formatCurrency(item.listedPrice, item.currency))} | confidence ${escapeHtml(item.confidence || "low")}</span>
              <span>${escapeHtml(`Reality ${trust.reality || "UNCERTAIN"} | Deal ${trust.deal_quality || "AVERAGE"} | Advice ${trust.final_advice || "COMPARE_OPTIONS"}`)}</span>
              <span>${escapeHtml(`Trust score ${String(trust.confidence_score ?? 0.5)} | fake ${String(trust.signal_tally?.strong_fake ?? 0)} / real ${String(trust.signal_tally?.strong_real ?? 0)}`)}</span>
              <span>${escapeHtml(`Checks: ${checkLine.replaceAll("_", " ")}`)}</span>
              <span>${escapeHtml(item.recommendation || item.rationale || "")}</span>
            </div>`;
        })
        .join("")}
    </div>
  `;
}
