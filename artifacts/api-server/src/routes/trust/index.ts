import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, trustRatingsTable } from "@workspace/db";
import {
  GetTrustRatingParams,
  UpsertTrustRatingBody,
  UpsertTrustRatingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function computeTier(score: number): string {
  if (score >= 85) return "gold";
  if (score >= 65) return "clean";
  if (score >= 45) return "neutral";
  if (score >= 25) return "suspicious";
  return "high_manipulation";
}

router.get("/trust", async (_req, res): Promise<void> => {
  const ratings = await db
    .select()
    .from(trustRatingsTable)
    .orderBy(trustRatingsTable.score);
  res.json(ratings);
});

router.get("/trust/:domain", async (req, res): Promise<void> => {
  const params = GetTrustRatingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [rating] = await db
    .select()
    .from(trustRatingsTable)
    .where(eq(trustRatingsTable.domain, params.data.domain));

  if (!rating) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  res.json(rating);
});

router.put("/trust/:domain", async (req, res): Promise<void> => {
  const params = UpsertTrustRatingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpsertTrustRatingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { domain } = params.data;
  const { scoreDelta, patternsFound, hiddenFeesFound } = body.data;

  const [existing] = await db
    .select()
    .from(trustRatingsTable)
    .where(eq(trustRatingsTable.domain, domain));

  if (existing) {
    const newScore = Math.max(0, Math.min(100, existing.score + scoreDelta));
    const newTier = computeTier(newScore);

    const [updated] = await db
      .update(trustRatingsTable)
      .set({
        score: newScore,
        tier: newTier,
        totalScans: existing.totalScans + 1,
        patternsDetectedCount: existing.patternsDetectedCount + patternsFound,
        hiddenFeesCount: existing.hiddenFeesCount + hiddenFeesFound,
        lastScannedAt: new Date(),
      })
      .where(eq(trustRatingsTable.domain, domain))
      .returning();

    res.json(updated);
  } else {
    const initialScore = Math.max(0, Math.min(100, 70 + scoreDelta));
    const tier = computeTier(initialScore);

    const [created] = await db
      .insert(trustRatingsTable)
      .values({
        domain,
        score: initialScore,
        tier,
        totalScans: 1,
        patternsDetectedCount: patternsFound,
        hiddenFeesCount: hiddenFeesFound,
        lastScannedAt: new Date(),
      })
      .returning();

    res.json(created);
  }
});

export default router;
