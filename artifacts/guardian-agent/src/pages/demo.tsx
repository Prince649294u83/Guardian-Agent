import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useDemoScan } from "@workspace/api-client-react";
import { AiCopilotCard } from "@/components/ai-copilot-card";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Package,
  MessageSquareWarning,
  DollarSign,
  CheckSquare,
  EyeOff,
  Loader2,
  Play,
  ChevronRight,
  Zap,
  AlertTriangle,
  Brain,
} from "lucide-react";

const SCENARIOS = [
  {
    id: "hotel-booking",
    name: "Booking.com Hotel Checkout",
    domain: "booking.com",
    url: "https://booking.com/hotel/paradise-resort/checkout",
    emoji: "🏨",
    description: "Classic hotel booking with 5 dark patterns",
    pageText: `Paradise Resort - Checkout
Book Your Stay: Dec 15-18 (3 nights)

⏰ DEAL EXPIRES IN: 00:04:59

Standard Room - $165/night × 3 nights = $495.00

⚠️ ONLY 1 ROOM LEFT AT THIS PRICE! 14 other people are viewing this room right now.

[ Reserve Now ]

No, I don't care about getting the best deal [decline link in tiny gray text below fold]

---
Travel Protection Insurance: ✅ [PRE-CHECKED] $24.99/stay — Protect your trip from unexpected cancellations
Newsletter updates: ✅ [PRE-CHECKED] Stay informed about deals

---
Price Summary:
Room: $495.00
[Additional fees shown at final page only]

Cancel button text: "No thanks, I prefer to risk losing my money"`,
    timerElements: ["00:04:59", "Deal expires in 4 minutes!"],
    stockAlerts: ["ONLY 1 ROOM LEFT AT THIS PRICE!", "14 other people are viewing this room right now"],
    buttonLabels: ["Reserve Now", "No, I don't care about getting the best deal", "No thanks, I prefer to risk losing my money"],
    priceStrings: ["$165/night", "$495.00", "$24.99"],
  },
  {
    id: "airline",
    name: "United Airlines Seat Selection",
    domain: "united.com",
    url: "https://united.com/checkout/seats",
    emoji: "✈️",
    description: "Airline upsell gauntlet with misdirection",
    pageText: `United Airlines - Your Flight
NYC → LAX | Jan 12 | 1 passenger
Base Fare: $189

STEP 2 OF 6: Seat Selection

⚡ PRICE LOCK ENDS IN 12:34 - Book now before this fare expires!

Premium Economy seats — ONLY 3 REMAINING: Row 14-16 $45/seat
Basic seat (middle, back row): Available — [tiny link, hard to find]

TravelGuard Premium Protection ✅ [PRE-CHECKED] $42.99 — "Most travelers choose this for peace of mind"
Airport Fast Track ✅ [PRE-CHECKED] $19.99

Button: "Continue to Baggage" (large, blue)
Alternative text: "I accept the risk of traveling without protection" (gray, very small, 8px)

⚠️ WARNING: Opting out may result in loss of all purchased fares.`,
    timerElements: ["12:34", "PRICE LOCK ENDS IN 12:34"],
    stockAlerts: ["ONLY 3 REMAINING", "⚡ PRICE LOCK ENDS"],
    buttonLabels: ["Continue to Baggage", "I accept the risk of traveling without protection"],
    priceStrings: ["$189", "$45/seat", "$42.99", "$19.99"],
  },
  {
    id: "amazon",
    name: "Amazon Checkout",
    domain: "amazon.com",
    url: "https://amazon.com/checkout",
    emoji: "📦",
    description: "Subtle pre-checked Prime trial and add-ons",
    pageText: `Amazon Checkout
Order Summary - 1 item: Wireless Headphones $49.99

✅ [PRE-CHECKED] Start your FREE Amazon Prime 30-day trial 
  After 30 days: $14.99/month. Cancel anytime.
  Prime shipping saves you $5.99 on this order.

✅ [PRE-CHECKED] Add 2-year protection plan: $7.99

Shipping: Standard (5-7 days) FREE | Prime (2-day) $5.99 [Prime option displayed first, larger]

Order Total: $49.99 + applicable taxes

[Place your order] button — large, orange
[No thanks, skip Prime] — light gray text, very small`,
    timerElements: [],
    stockAlerts: [],
    buttonLabels: ["Place your order", "No thanks, skip Prime"],
    priceStrings: ["$49.99", "$14.99/month", "$5.99", "$7.99"],
  },
  {
    id: "clean-site",
    name: "Etsy - Honest Checkout",
    domain: "etsy.com",
    url: "https://etsy.com/checkout",
    emoji: "✅",
    description: "A clean checkout — see Guardian give it a green seal",
    pageText: `Etsy Checkout
Handmade Ceramic Mug by CeramicsByJane

Item price: $28.00
Shipping: $4.50 (USPS First Class, 3-5 days)
Tax (CA): $2.38
Order Total: $34.88

Payment: Visa ending 4242

[Place Order] button
[Go back to cart] link

By placing this order, you agree to Etsy's Terms of Use.
No subscriptions. No add-ons. No surprises.`,
    timerElements: [],
    stockAlerts: [],
    buttonLabels: ["Place Order", "Go back to cart"],
    priceStrings: ["$28.00", "$4.50", "$2.38", "$34.88"],
  },
];

type PatternKey = "falseUrgency" | "falseScarcity" | "confirmShaming" | "hiddenFees" | "preCheckedAddOns" | "misdirection";

const PATTERN_CONFIG: Record<PatternKey, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  falseUrgency: { label: "False Urgency", icon: Clock, color: "text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/20" },
  falseScarcity: { label: "False Scarcity", icon: Package, color: "text-yellow-400", bgColor: "bg-yellow-500/10 border-yellow-500/20" },
  confirmShaming: { label: "Confirm Shaming", icon: MessageSquareWarning, color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
  hiddenFees: { label: "Hidden Fees", icon: DollarSign, color: "text-destructive", bgColor: "bg-destructive/10 border-destructive/20" },
  preCheckedAddOns: { label: "Pre-Checked Add-Ons", icon: CheckSquare, color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20" },
  misdirection: { label: "Misdirection", icon: EyeOff, color: "text-pink-400", bgColor: "bg-pink-500/10 border-pink-500/20" },
};

function buildReasoningCards(report: any, patternsDetected: PatternKey[]) {
  if (!report) return [];

  if (patternsDetected.length === 0) {
    return [
      {
        title: "Clean outcome",
        confidence: "high",
        quote: "No dark-pattern signals detected in the submitted checkout text.",
        detail:
          "Guardian did not find the usual dark-pattern signals here: fake urgency, deceptive scarcity, hidden fees, pre-selected extras, or shaming decline copy.",
        fix: "Keep showing the full price upfront, use neutral button copy, and leave optional extras unchecked by default.",
      },
    ];
  }

  return patternsDetected.map((key) => {
    const config = PATTERN_CONFIG[key];
    const result = report[key];
    const hasRichEvidence =
      Boolean(result?.evidence) ||
      Boolean(result?.shamingText) ||
      Boolean(result?.hiddenDeclineText) ||
      Boolean(result?.feeItems?.length) ||
      Boolean(result?.addOnLabels?.length);
    const confidence = hasRichEvidence ? "high" : "medium";

    if (key === "hiddenFees" && result?.feeItems?.length) {
      const labels = result.feeItems.map((fee: any) => `${fee.label} (+$${fee.amount.toFixed(2)})`).join(", ");
      return {
        title: config.label,
        confidence,
        quote: labels,
        detail: `Guardian found extra charges outside the headline price: ${labels}.`,
        fix: "Show mandatory fees in the first price quote and keep them visible through the full checkout flow.",
      };
    }

    if (key === "confirmShaming" && result?.shamingText) {
      return {
        title: config.label,
        confidence,
        quote: result.shamingText,
        detail: `Guardian flagged manipulative decline language: "${result.shamingText}".`,
        fix: 'Replace guilt-inducing language with a neutral alternative such as "No thanks".',
      };
    }

    if (key === "preCheckedAddOns" && result?.addOnLabels?.length) {
      return {
        title: config.label,
        confidence,
        quote: result.addOnLabels.join(", "),
        detail: `Guardian detected optional extras already selected for the user: ${result.addOnLabels.join(", ")}.`,
        fix: "Default optional add-ons to unchecked and ask for explicit opt-in.",
      };
    }

    if (key === "misdirection" && result?.hiddenDeclineText) {
      return {
        title: config.label,
        confidence,
        quote: result.hiddenDeclineText,
        detail: `Guardian found a visually de-emphasized decline path: ${result.hiddenDeclineText}`,
        fix: "Give accept and decline actions equal prominence, contrast, and placement.",
      };
    }

    return {
      title: config.label,
      confidence,
      quote: result?.evidence || "Matched language and layout cues in the checkout text.",
      detail: result?.evidence || "Guardian matched concrete checkout text to this dark-pattern category.",
      fix:
        key === "falseUrgency"
          ? "Remove fake timers unless the offer truly expires for the current shopper."
          : key === "falseScarcity"
            ? "Use inventory messaging only when it reflects real, current availability."
            : "Simplify the flow so the safer or cheaper option is easy to see and choose.",
    };
  });
}

export default function Demo() {
  const [selectedScenario, setSelectedScenario] = useState<typeof SCENARIOS[number] | null>(null);
  const [customDomain, setCustomDomain] = useState("example.com");
  const [customUrl, setCustomUrl] = useState("https://example.com/checkout");
  const [customText, setCustomText] = useState("");
  const [mode, setMode] = useState<"scenario" | "custom">("scenario");
  const [scanResult, setScanResult] = useState<any>(null);

  const { mutate: runScan, isPending } = useDemoScan({
    mutation: {
      onSuccess: (data) => {
        setScanResult(data);
      },
    },
  });

  function handleRunScenario(scenario: typeof SCENARIOS[number]) {
    setSelectedScenario(scenario);
    setScanResult(null);
    runScan({
      data: {
        domain: scenario.domain,
        url: scenario.url,
        pageText: scenario.pageText,
        timerElements: scenario.timerElements,
        stockAlerts: scenario.stockAlerts,
        buttonLabels: scenario.buttonLabels,
        priceStrings: scenario.priceStrings,
      },
    });
  }

  function handleRunCustom() {
    setScanResult(null);
    setSelectedScenario(null);
    runScan({
      data: {
        domain: customDomain,
        url: customUrl,
        pageText: customText,
      },
    });
  }

  const report = scanResult?.darkPatternReport;
  const savedReport = scanResult?.report;
  const trustRating = scanResult?.trustRating;
  const aiCopilot = scanResult?.aiCopilot;
  const patternsDetected = report
    ? (["falseUrgency", "falseScarcity", "confirmShaming", "hiddenFees", "preCheckedAddOns", "misdirection"] as PatternKey[]).filter(
        (k) => report[k]?.detected
      )
    : [];
  const reasoningCards = buildReasoningCards(report, patternsDetected);

  const trustColor =
    trustRating?.tier === "gold" || trustRating?.tier === "clean"
      ? "text-green-400"
      : trustRating?.tier === "high_manipulation"
      ? "text-destructive"
      : "text-orange-400";

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-xs font-mono text-primary uppercase tracking-widest">Live Demo</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Guardian Scanner</h1>
            <p className="text-muted-foreground mt-1">
              Run real AI analysis on any checkout text. Watch Guardian detect dark patterns in real time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel - input */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={mode === "scenario" ? "default" : "outline"}
                size="sm"
                onClick={() => { setMode("scenario"); setScanResult(null); }}
              >
                Preset Scenarios
              </Button>
              <Button
                variant={mode === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => { setMode("custom"); setScanResult(null); setSelectedScenario(null); }}
              >
                Custom Input
              </Button>
            </div>

            {mode === "scenario" ? (
              <div className="space-y-3">
                {SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => handleRunScenario(scenario)}
                    disabled={isPending}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedScenario?.id === scenario.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{scenario.emoji}</span>
                        <div>
                          <div className="font-semibold text-sm">{scenario.name}</div>
                          <div className="text-xs text-muted-foreground">{scenario.description}</div>
                        </div>
                      </div>
                      {selectedScenario?.id === scenario.id && isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Play className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Paste Checkout Text</CardTitle>
                  <CardDescription>Copy and paste the text from any checkout page</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Domain</label>
                    <Input
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="booking.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Page URL</label>
                    <Input
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Page Text Content</label>
                    <Textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Paste any checkout page text here — button labels, urgency messages, price strings, form fields..."
                      className="h-48 font-mono text-xs resize-none"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleRunCustom}
                    disabled={isPending || !customText.trim()}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing with Claude AI...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Run Guardian Scan
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right panel - results */}
          <div className="space-y-4">
            {!isPending && aiCopilot && (
              <AiCopilotCard
                title="Guardian Thinking"
                description="Guardian first interprets your checkout input, then turns that reasoning into the structured scan below."
                payload={aiCopilot}
              />
            )}
            {isPending && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-8 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <Shield className="h-12 w-12 text-primary" />
                    <div className="absolute inset-0 animate-ping opacity-20">
                      <Shield className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">Guardian is scanning...</div>
                    <div className="text-sm text-muted-foreground mt-1">Claude AI is analyzing for manipulation patterns</div>
                  </div>
                  <div className="w-full space-y-2">
                    {["Scanning for false urgency timers...", "Checking scarcity claims...", "Analyzing button language...", "Detecting hidden fees..."].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        {step}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!isPending && !scanResult && (
              <Card className="border-dashed">
                <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <Shield className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">Select a scenario or paste custom text to run the live Guardian AI scan</p>
                </CardContent>
              </Card>
            )}

            {!isPending && report && (
              <div className="space-y-4">
                {/* Guardian Seal */}
                <Card className={`border-2 ${patternsDetected.length === 0 ? "border-green-500/40 bg-green-500/5" : patternsDetected.length >= 3 ? "border-destructive/40 bg-destructive/5" : "border-orange-500/40 bg-orange-500/5"}`}>
                  <CardContent className="py-4 flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${patternsDetected.length === 0 ? "bg-green-500/20" : "bg-destructive/20"}`}>
                      {patternsDetected.length === 0 ? (
                        <ShieldCheck className="h-6 w-6 text-green-400" />
                      ) : (
                        <ShieldAlert className="h-6 w-6 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">
                        {patternsDetected.length === 0
                          ? "Guardian Seal: Safe to Proceed"
                          : `${patternsDetected.length} Dark Pattern${patternsDetected.length > 1 ? "s" : ""} Detected`}
                      </div>
                      <div className="text-sm text-muted-foreground">{report.summary}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold font-mono ${trustColor}`}>{report.trustScore}</div>
                      <div className="text-xs text-muted-foreground">Trust Score</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trust Rating Updated */}
                {trustRating && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <ChevronRight className="h-3 w-3" />
                    <span>
                      Trust rating for <strong className="text-foreground">{trustRating.domain}</strong> updated:{" "}
                      <span className={trustColor}>{trustRating.score}/100 ({trustRating.tier.replace("_", " ")})</span>
                    </span>
                  </div>
                )}

                {/* Pattern Results */}
                <div className="space-y-2">
                  {(["falseUrgency", "falseScarcity", "confirmShaming", "hiddenFees", "preCheckedAddOns", "misdirection"] as PatternKey[]).map((key) => {
                    const config = PATTERN_CONFIG[key];
                    const result = report[key];
                    if (!result) return null;
                    const Icon = config.icon;

                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border ${result.detected ? config.bgColor : "border-border bg-card/30"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 shrink-0 ${result.detected ? config.color : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${result.detected ? config.color : "text-muted-foreground"}`}>
                            {config.label}
                          </span>
                          <Badge
                            variant={result.detected ? "destructive" : "secondary"}
                            className="ml-auto text-[10px] px-1.5 py-0"
                          >
                            {result.detected ? "DETECTED" : "CLEAN"}
                          </Badge>
                        </div>
                        {result.detected && (
                          <div className="mt-2 ml-6 space-y-1">
                            {result.evidence && (
                              <p className="text-xs text-muted-foreground">{result.evidence}</p>
                            )}
                            {key === "confirmShaming" && result.shamingText && (
                              <div className="space-y-1">
                                <p className="text-xs">
                                  <span className="text-destructive font-mono">"{result.shamingText}"</span>
                                </p>
                                <p className="text-xs text-green-400">
                                  Guardian rewrites to: <span className="font-mono">"{result.rewrittenText}"</span>
                                </p>
                              </div>
                            )}
                            {key === "hiddenFees" && result.feeItems?.length > 0 && (
                              <div className="space-y-1">
                                {result.feeItems.map((fee: any, i: number) => (
                                  <div key={i} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">{fee.label}</span>
                                    <span className="text-destructive font-mono">+${fee.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                                {result.totalExtra && (
                                  <div className="flex justify-between text-xs font-bold border-t border-border pt-1 mt-1">
                                    <span>Total hidden</span>
                                    <span className="text-destructive">+${result.totalExtra.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {key === "preCheckedAddOns" && result.addOnLabels?.length > 0 && (
                              <div className="space-y-1">
                                {result.addOnLabels.map((label: string, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <AlertTriangle className="h-3 w-3 text-orange-400" />
                                    <span>{label} — auto-unchecked by Guardian</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Why Guardian Reached This Conclusion
                    </CardTitle>
                    <CardDescription>
                      These are the specific signals in the checkout text that pushed the scan toward a dark-pattern finding.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {reasoningCards.map((reason, index) => (
                      <div key={`${reason.title}-${index}`} className="rounded-lg border border-primary/10 bg-background/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-foreground">{reason.title}</div>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            {reason.confidence} confidence
                          </Badge>
                        </div>
                        <div className="mt-2 rounded-md border border-border/70 bg-card/80 px-2.5 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quoted Signal</div>
                          <p className="mt-1 text-xs font-mono text-foreground/90">{reason.quote}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{reason.detail}</p>
                        <p className="mt-2 text-xs text-primary/90">
                          <span className="font-medium text-primary">What to fix:</span> {reason.fix}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {savedReport && (
                  <p className="text-xs text-muted-foreground text-center">
                    Report #{savedReport.id} saved to database
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
