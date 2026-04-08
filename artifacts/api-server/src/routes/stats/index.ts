import { Router, type IRouter } from "express";
import { desc, count, sum, avg } from "drizzle-orm";
import { db, detectionReportsTable, trustRatingsTable } from "@workspace/db";
import { GetTopOffendersQueryParams } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [reportsAgg] = await db
    .select({
      totalScans: count(detectionReportsTable.id),
      totalHiddenFeesBlocked: sum(detectionReportsTable.hiddenFeesTotal),
    })
    .from(detectionReportsTable);

  const [trustAgg] = await db
    .select({
      totalDomainsTracked: count(trustRatingsTable.id),
      avgTrustScore: avg(trustRatingsTable.score),
    })
    .from(trustRatingsTable);

  const [patternCounts] = await db
    .select({
      totalPatternsDetected: sum(detectionReportsTable.totalPatternsDetected),
    })
    .from(detectionReportsTable);

  const [last30Days] = await db
    .select({ total: count(detectionReportsTable.id) })
    .from(detectionReportsTable)
    .where(
      sql`${detectionReportsTable.createdAt} > NOW() - INTERVAL '30 days'`
    );

  const goldDomains = await db
    .select({ total: count(trustRatingsTable.id) })
    .from(trustRatingsTable)
    .where(sql`${trustRatingsTable.tier} = 'gold'`);

  const highManipDomains = await db
    .select({ total: count(trustRatingsTable.id) })
    .from(trustRatingsTable)
    .where(sql`${trustRatingsTable.tier} = 'high_manipulation'`);

  res.json({
    totalScans: Number(reportsAgg?.totalScans ?? 0),
    totalPatternsDetected: Number(patternCounts?.totalPatternsDetected ?? 0),
    totalHiddenFeesBlocked: Number(reportsAgg?.totalHiddenFeesBlocked ?? 0),
    totalDomainsTracked: Number(trustAgg?.totalDomainsTracked ?? 0),
    totalReportsLast30Days: Number(last30Days?.total ?? 0),
    avgTrustScore: Number(trustAgg?.avgTrustScore ?? 50),
    goldTierDomains: Number(goldDomains[0]?.total ?? 0),
    highManipulationDomains: Number(highManipDomains[0]?.total ?? 0),
  });
});

router.get("/stats/pattern-breakdown", async (_req, res): Promise<void> => {
  const [result] = await db
    .select({
      falseUrgency: sum(
        sql<number>`CASE WHEN ${detectionReportsTable.falseUrgencyDetected} = true THEN 1 ELSE 0 END`
      ),
      falseScarcity: sum(
        sql<number>`CASE WHEN ${detectionReportsTable.falseScarcityDetected} = true THEN 1 ELSE 0 END`
      ),
      confirmShaming: sum(
        sql<number>`CASE WHEN ${detectionReportsTable.confirmShamingDetected} = true THEN 1 ELSE 0 END`
      ),
      hiddenFees: sum(
        sql<number>`CASE WHEN ${detectionReportsTable.hiddenFeesDetected} = true THEN 1 ELSE 0 END`
      ),
      preCheckedAddOns: sum(
        sql<number>`CASE WHEN ${detectionReportsTable.preCheckedAddOnsDetected} = true THEN 1 ELSE 0 END`
      ),
      misdirection: sum(
        sql<number>`CASE WHEN ${detectionReportsTable.misdirectionDetected} = true THEN 1 ELSE 0 END`
      ),
    })
    .from(detectionReportsTable);

  res.json({
    falseUrgency: Number(result?.falseUrgency ?? 0),
    falseScarcity: Number(result?.falseScarcity ?? 0),
    confirmShaming: Number(result?.confirmShaming ?? 0),
    hiddenFees: Number(result?.hiddenFees ?? 0),
    preCheckedAddOns: Number(result?.preCheckedAddOns ?? 0),
    misdirection: Number(result?.misdirection ?? 0),
  });
});

router.get("/stats/top-offenders", async (req, res): Promise<void> => {
  const queryParams = GetTopOffendersQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const limit = queryParams.data.limit ?? 10;

  const offenders = await db
    .select({
      domain: trustRatingsTable.domain,
      totalPatternsDetected: trustRatingsTable.patternsDetectedCount,
      trustScore: trustRatingsTable.score,
      tier: trustRatingsTable.tier,
      totalScans: trustRatingsTable.totalScans,
    })
    .from(trustRatingsTable)
    .orderBy(desc(trustRatingsTable.patternsDetectedCount))
    .limit(limit);

  res.json(offenders);
});

export default router;
