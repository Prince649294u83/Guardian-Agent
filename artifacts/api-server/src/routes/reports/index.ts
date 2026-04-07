import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, detectionReportsTable } from "@workspace/db";
import {
  CreateReportBody,
  GetReportParams,
  ListReportsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports", async (req, res): Promise<void> => {
  const queryParams = ListReportsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { domain, limit } = queryParams.data;
  const maxLimit = limit ?? 50;

  let query = db
    .select()
    .from(detectionReportsTable)
    .orderBy(desc(detectionReportsTable.createdAt))
    .$dynamic();

  if (domain) {
    query = query.where(eq(detectionReportsTable.domain, domain));
  }

  const reports = await query.limit(maxLimit);
  res.json(reports);
});

router.post("/reports", async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [report] = await db
    .insert(detectionReportsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(report);
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(detectionReportsTable)
    .where(eq(detectionReportsTable.id, params.data.id));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json(report);
});

export default router;
