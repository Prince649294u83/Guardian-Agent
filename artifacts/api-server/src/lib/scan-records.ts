type ScanReportLike = {
  trustScore: number;
  falseUrgency: { detected: boolean };
  falseScarcity: { detected: boolean };
  confirmShaming: { detected: boolean };
  hiddenFees: { detected: boolean };
  preCheckedAddOns: { detected: boolean };
  misdirection: { detected: boolean };
  summary: string;
};

export function buildDetectionReportInsert(input: {
  domain: string;
  url: string;
  darkPatternReport: ScanReportLike;
  totalPatternsDetected: number;
  hiddenFeesTotal: number | null;
}) {
  return {
    domain: input.domain,
    url: input.url,
    trustScore: input.darkPatternReport.trustScore,
    falseUrgencyDetected: input.darkPatternReport.falseUrgency.detected,
    falseScarcityDetected: input.darkPatternReport.falseScarcity.detected,
    confirmShamingDetected: input.darkPatternReport.confirmShaming.detected,
    hiddenFeesDetected: input.darkPatternReport.hiddenFees.detected,
    preCheckedAddOnsDetected: input.darkPatternReport.preCheckedAddOns.detected,
    misdirectionDetected: input.darkPatternReport.misdirection.detected,
    totalPatternsDetected: input.totalPatternsDetected,
    hiddenFeesTotal: input.hiddenFeesTotal,
    summary: input.darkPatternReport.summary,
  };
}

export function buildMockDetectionReport(input: {
  id: number;
  domain: string;
  url: string;
  darkPatternReport: ScanReportLike;
  totalPatternsDetected: number;
  hiddenFeesTotal: number | null;
  createdAt?: string;
}) {
  return {
    id: input.id,
    ...buildDetectionReportInsert(input),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
