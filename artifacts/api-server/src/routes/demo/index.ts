import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, detectionReportsTable, trustRatingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DemoScanBody, DemoFeeEstimateBody } from "@workspace/api-zod";

const router: IRouter = Router();

const DARK_PATTERN_SYSTEM_PROMPT = `You are Guardian Agent's dark pattern detection engine. Analyze webpage content and identify psychological manipulation tactics used by e-commerce sites.

Return a JSON object with this exact structure:
{
  "falseUrgency": { "detected": boolean, "evidence": "explanation or empty string", "isTimerFake": boolean or null },
  "falseScarcity": { "detected": boolean, "evidence": "explanation or empty string" },
  "confirmShaming": { "detected": boolean, "shamingText": "offending text or empty string", "rewrittenText": "neutral version or empty string" },
  "hiddenFees": { "detected": boolean, "feeItems": [{"label": "name", "amount": 12.99}], "totalExtra": number or null },
  "preCheckedAddOns": { "detected": boolean, "fieldIds": [], "addOnLabels": ["Label"] },
  "misdirection": { "detected": boolean, "hiddenDeclineText": "text or empty string" },
  "trustScore": integer 0-100,
  "summary": "1-2 sentence human-readable summary"
}

Be strict but accurate. 100 = fully trustworthy, 0 = highly manipulative.`;

const FEE_ESTIMATE_SYSTEM_PROMPT = `You are Guardian Agent's hidden fee estimation engine. Given a merchant domain, type, and listed price, estimate what the true final checkout price will be after all mandatory fees are added.

Return a JSON object with this exact structure:
{
  "estimatedTotal": number,
  "feeBreakdown": [{"label": "Tax (8.5%)", "amount": 14.03}, {"label": "Resort Fee", "amount": 35.00}],
  "confidence": "high" | "medium" | "low",
  "warningLevel": "green" | "orange" | "red",
  "explanation": "One sentence explaining the estimate and primary fee drivers"
}

Base estimates on known industry practices:
- Hotels: typically add 15-35% for taxes, resort fees, destination charges
- Airlines: typically add 15-30% for taxes, fees, and hidden baggage costs
- Vacation rentals (Airbnb/VRBO): typically add 20-40% for cleaning, service, taxes
- Car rentals: typically add 30-60% for taxes, insurance, airport fees
- E-commerce: typically add 0-15% for shipping, handling, taxes
warningLevel: green if <10% extra, orange if 10-25% extra, red if >25% extra`;

function computeTier(score: number): string {
  if (score >= 85) return "gold";
  if (score >= 65) return "clean";
  if (score >= 45) return "neutral";
  if (score >= 25) return "suspicious";
  return "high_manipulation";
}

router.post("/demo/scan", async (req, res): Promise<void> => {
  const parsed = DemoScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { domain, url, pageText, timerElements, stockAlerts, buttonLabels, priceStrings } = parsed.data;

  const userMessage = `
Domain: ${domain}
Page text (truncated to 3000 chars):
${pageText.slice(0, 3000)}

Timer elements found: ${JSON.stringify(timerElements ?? [])}
Stock/scarcity alerts: ${JSON.stringify(stockAlerts ?? [])}
Button labels: ${JSON.stringify(buttonLabels ?? [])}
Price strings found: ${JSON.stringify(priceStrings ?? [])}

Analyze this page for dark patterns and return the JSON analysis.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: DARK_PATTERN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  const rawText = block.type === "text" ? block.text : "{}";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  const darkPatternReport = { ...JSON.parse(jsonMatch[0]), domain };

  const totalPatternsDetected = [
    darkPatternReport.falseUrgency?.detected,
    darkPatternReport.falseScarcity?.detected,
    darkPatternReport.confirmShaming?.detected,
    darkPatternReport.hiddenFees?.detected,
    darkPatternReport.preCheckedAddOns?.detected,
    darkPatternReport.misdirection?.detected,
  ].filter(Boolean).length;

  const hiddenFeesTotal = darkPatternReport.hiddenFees?.totalExtra ?? null;

  const [report] = await db
    .insert(detectionReportsTable)
    .values({
      domain,
      url,
      trustScore: darkPatternReport.trustScore ?? 50,
      falseUrgencyDetected: darkPatternReport.falseUrgency?.detected ?? false,
      falseScarcityDetected: darkPatternReport.falseScarcity?.detected ?? false,
      confirmShamingDetected: darkPatternReport.confirmShaming?.detected ?? false,
      hiddenFeesDetected: darkPatternReport.hiddenFees?.detected ?? false,
      preCheckedAddOnsDetected: darkPatternReport.preCheckedAddOns?.detected ?? false,
      misdirectionDetected: darkPatternReport.misdirection?.detected ?? false,
      totalPatternsDetected,
      hiddenFeesTotal,
      summary: darkPatternReport.summary ?? "",
    })
    .returning();

  const [existing] = await db
    .select()
    .from(trustRatingsTable)
    .where(eq(trustRatingsTable.domain, domain));

  let trustRating;
  const scoreDelta = totalPatternsDetected === 0 ? 5 : -(totalPatternsDetected * 8);

  if (existing) {
    const newScore = Math.max(0, Math.min(100, existing.score + scoreDelta));
    const [updated] = await db
      .update(trustRatingsTable)
      .set({
        score: newScore,
        tier: computeTier(newScore),
        totalScans: existing.totalScans + 1,
        patternsDetectedCount: existing.patternsDetectedCount + totalPatternsDetected,
        hiddenFeesCount: existing.hiddenFeesCount + (darkPatternReport.hiddenFees?.detected ? 1 : 0),
        lastScannedAt: new Date(),
      })
      .where(eq(trustRatingsTable.domain, domain))
      .returning();
    trustRating = updated;
  } else {
    const initialScore = Math.max(0, Math.min(100, 70 + scoreDelta));
    const [created] = await db
      .insert(trustRatingsTable)
      .values({
        domain,
        score: initialScore,
        tier: computeTier(initialScore),
        totalScans: 1,
        patternsDetectedCount: totalPatternsDetected,
        hiddenFeesCount: darkPatternReport.hiddenFees?.detected ? 1 : 0,
        lastScannedAt: new Date(),
      })
      .returning();
    trustRating = created;
  }

  res.json({ report, darkPatternReport, trustRating });
});

router.post("/demo/fee-estimate", async (req, res): Promise<void> => {
  const parsed = DemoFeeEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { domain, merchantType, listedPrice, itemDescription } = parsed.data;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: FEE_ESTIMATE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Domain: ${domain}
Merchant type: ${merchantType}
Listed price: $${listedPrice}
${itemDescription ? `Item description: ${itemDescription}` : ""}

Estimate the true final price with all mandatory fees and return JSON.`,
      },
    ],
  });

  const block = message.content[0];
  const rawText = block.type === "text" ? block.text : "{}";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  const result = JSON.parse(jsonMatch[0]);
  const savingsOpportunity = result.estimatedTotal - listedPrice;

  res.json({ listedPrice, ...result, savingsOpportunity });
});

export default router;
