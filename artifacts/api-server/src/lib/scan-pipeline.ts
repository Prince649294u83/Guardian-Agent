import { buildScanCopilot } from "./ai-copilot";
import type { CheckoutAnalysis } from "./checkout-analysis";

type ScanTrustRating = {
  score?: number;
  tier?: string;
} | null | undefined;

type ScanReportLike = CheckoutAnalysis & {
  domain?: string;
  url?: string;
  [key: string]: any;
};

export function mergeScanReports(base: CheckoutAnalysis, ai: Record<string, any> | null | undefined, domain: string, url: string): ScanReportLike {
  const merged: ScanReportLike = {
    ...base,
    ...ai,
    domain,
    url,
    falseUrgency: {
      ...base.falseUrgency,
      ...ai?.falseUrgency,
    },
    falseScarcity: {
      ...base.falseScarcity,
      ...ai?.falseScarcity,
    },
    confirmShaming: {
      ...base.confirmShaming,
      ...ai?.confirmShaming,
    },
    hiddenFees: {
      ...base.hiddenFees,
      ...ai?.hiddenFees,
      feeItems:
        Array.isArray(ai?.hiddenFees?.feeItems) && ai.hiddenFees.feeItems.length > 0
          ? ai.hiddenFees.feeItems
          : base.hiddenFees?.feeItems ?? [],
    },
    preCheckedAddOns: {
      ...base.preCheckedAddOns,
      ...ai?.preCheckedAddOns,
      addOnLabels:
        Array.isArray(ai?.preCheckedAddOns?.addOnLabels) && ai.preCheckedAddOns.addOnLabels.length > 0
          ? ai.preCheckedAddOns.addOnLabels
          : base.preCheckedAddOns?.addOnLabels ?? [],
    },
    misdirection: {
      ...base.misdirection,
      ...ai?.misdirection,
    },
  };

  const totalPatternsDetected = countDetectedPatterns(merged);

  return {
    ...merged,
    totalPatternsDetected,
    trustScore:
      typeof merged.trustScore === "number"
        ? merged.trustScore
        : Math.max(20, 92 - totalPatternsDetected * 12),
    summary:
      typeof merged.summary === "string" && merged.summary.trim()
        ? merged.summary
        : base.summary,
  };
}

export function countDetectedPatterns(report: ScanReportLike): number {
  return [
    report.falseUrgency?.detected,
    report.falseScarcity?.detected,
    report.confirmShaming?.detected,
    report.hiddenFees?.detected,
    report.preCheckedAddOns?.detected,
    report.misdirection?.detected,
  ].filter(Boolean).length;
}

export function buildScanArtifacts(input: {
  domain: string;
  url: string;
  pageText?: string;
  baseAnalysis: CheckoutAnalysis;
  aiReport?: Record<string, any> | null;
  trustRating?: ScanTrustRating;
}) {
  const darkPatternReport = input.aiReport
    ? mergeScanReports(input.baseAnalysis, input.aiReport, input.domain, input.url)
    : {
        ...input.baseAnalysis,
        domain: input.domain,
        url: input.url,
      };

  const totalPatternsDetected = countDetectedPatterns(darkPatternReport);
  const hiddenFeesTotal = darkPatternReport.hiddenFees?.totalExtra ?? null;
  const trustScore =
    typeof darkPatternReport.trustScore === "number"
      ? darkPatternReport.trustScore
      : input.trustRating?.score ?? 50;

  return {
    darkPatternReport: {
      ...darkPatternReport,
      trustScore,
      totalPatternsDetected,
    },
    totalPatternsDetected,
    hiddenFeesTotal,
    aiCopilot: buildScanCopilot({
      domain: input.domain,
      url: input.url,
      pageText: input.pageText,
      darkPatternReport: {
        ...darkPatternReport,
        trustScore,
        totalPatternsDetected,
      },
      trustRating: input.trustRating,
    }),
  };
}
