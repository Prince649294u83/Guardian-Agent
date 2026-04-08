import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, trustRatingsTable } from "@workspace/db";
import {
  GetTrustRatingParams,
  UpsertTrustRatingBody,
  UpsertTrustRatingParams,
} from "@workspace/api-zod";
import { buildTrustRatingMutation } from "../../lib/trust-rating";

const router: IRouter = Router();

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
    const nextValues = buildTrustRatingMutation({
      domain,
      scoreDelta,
      patternsFound,
      hiddenFeesFound,
      existing,
    });

    const [updated] = await db
      .update(trustRatingsTable)
      .set(nextValues)
      .where(eq(trustRatingsTable.domain, domain))
      .returning();

    res.json(updated);
  } else {
    const nextValues = buildTrustRatingMutation({
      domain,
      scoreDelta,
      patternsFound,
      hiddenFeesFound,
    });

    const [created] = await db
      .insert(trustRatingsTable)
      .values(nextValues)
      .returning();

    res.json(created);
  }
});

export default router;
