import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  DetectDarkPatternsBody,
  ClassifyUpsellBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DARK_PATTERN_SYSTEM_PROMPT = `You are Guardian Agent's dark pattern detection engine. Analyze webpage content and identify psychological manipulation tactics used by e-commerce sites.

For each analysis, return a JSON object with this exact structure:
{
  "falseUrgency": {
    "detected": boolean,
    "evidence": "explanation of what was found or empty string",
    "isTimerFake": boolean or null
  },
  "falseScarcity": {
    "detected": boolean,
    "evidence": "explanation or empty string"
  },
  "confirmShaming": {
    "detected": boolean,
    "shamingText": "the offending text or empty string",
    "rewrittenText": "neutral version like 'No thanks' or empty string"
  },
  "hiddenFees": {
    "detected": boolean,
    "feeItems": [{"label": "fee name", "amount": 12.99}],
    "totalExtra": number or null
  },
  "preCheckedAddOns": {
    "detected": boolean,
    "fieldIds": ["id1", "id2"],
    "addOnLabels": ["Travel Insurance", "Newsletter"]
  },
  "misdirection": {
    "detected": boolean,
    "hiddenDeclineText": "the hard-to-find decline option text or empty string"
  },
  "trustScore": number between 0 and 100 (100 = fully trustworthy, 0 = highly manipulative),
  "summary": "1-2 sentence human-readable summary of findings"
}

Be strict and accurate. Only flag genuine dark patterns, not normal UX. A score of 80+ means the site is mostly clean. 50-80 is neutral. Below 50 means significant manipulation detected.`;

const UPSELL_SYSTEM_PROMPT = `You are Guardian Agent's upsell classification engine. Identify what type of upsell screen is being shown so the extension can automatically decline it based on user preferences.

Return a JSON object with this exact structure:
{
  "type": one of: "insurance", "breakfast", "room_upgrade", "seat_selection", "newsletter", "sms_alerts", "warranty", "refundable_rate", "other",
  "confidence": number between 0 and 1,
  "recommendedAction": one of: "decline", "accept", "ask_user",
  "declineButtonHint": "the text on the decline button or link, or a description of where it might be"
}

For insurance, seat selection, newsletters, and sms_alerts: recommend "decline".
For refundable_rate: recommend "accept".
For room_upgrade and breakfast: recommend "ask_user".
For other: recommend "ask_user".`;

router.post("/analysis/detect", async (req, res): Promise<void> => {
  const parsed = DetectDarkPatternsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { domain, pageText, timerElements, stockAlerts, buttonLabels, formFields, priceStrings } = parsed.data;

  const userMessage = `
Domain: ${domain}

Page text (truncated to 3000 chars):
${pageText.slice(0, 3000)}

Timer elements found: ${JSON.stringify(timerElements ?? [])}
Stock/scarcity alerts: ${JSON.stringify(stockAlerts ?? [])}
Button labels: ${JSON.stringify(buttonLabels ?? [])}
Pre-checked form fields: ${JSON.stringify((formFields ?? []).filter(f => f.checked))}
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

  const result = JSON.parse(jsonMatch[0]);
  result.domain = domain;

  res.json(result);
});

router.post("/analysis/classify-upsell", async (req, res): Promise<void> => {
  const parsed = ClassifyUpsellBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { domain, pageText } = parsed.data;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: UPSELL_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Domain: ${domain}\n\nUpsell page text:\n${pageText.slice(0, 2000)}\n\nClassify this upsell and return JSON.`,
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

  res.json(JSON.parse(jsonMatch[0]));
});

export default router;
