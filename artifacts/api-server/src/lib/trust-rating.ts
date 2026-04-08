export type TrustTier = "gold" | "clean" | "neutral" | "suspicious" | "high_manipulation";

type ExistingTrustRating = {
  score: number;
  totalScans: number;
  patternsDetectedCount: number;
  hiddenFeesCount: number;
};

export function computeTrustTier(score: number): TrustTier {
  if (score >= 85) return "gold";
  if (score >= 65) return "clean";
  if (score >= 45) return "neutral";
  if (score >= 25) return "suspicious";
  return "high_manipulation";
}

export function computeTrustScoreDelta(patternsFound: number): number {
  return patternsFound === 0 ? 5 : -(patternsFound * 8);
}

export function buildTrustRatingMutation(input: {
  domain: string;
  scoreDelta: number;
  patternsFound: number;
  hiddenFeesFound: number;
  existing?: ExistingTrustRating | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (input.existing) {
    const score = Math.max(0, Math.min(100, input.existing.score + input.scoreDelta));
    return {
      score,
      tier: computeTrustTier(score),
      totalScans: input.existing.totalScans + 1,
      patternsDetectedCount: input.existing.patternsDetectedCount + input.patternsFound,
      hiddenFeesCount: input.existing.hiddenFeesCount + input.hiddenFeesFound,
      lastScannedAt: now,
    };
  }

  const score = Math.max(0, Math.min(100, 70 + input.scoreDelta));
  return {
    domain: input.domain,
    score,
    tier: computeTrustTier(score),
    totalScans: 1,
    patternsDetectedCount: input.patternsFound,
    hiddenFeesCount: input.hiddenFeesFound,
    lastScannedAt: now,
  };
}
