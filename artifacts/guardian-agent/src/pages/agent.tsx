import { useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AiCopilotCard } from "@/components/ai-copilot-card";
import {
  Bot,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Loader2,
  ArrowRightLeft,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Ghost,
  Radar,
} from "lucide-react";

type MissionSignal = {
  type: string;
  label: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  evidence: string;
  whyItMatters: string;
  fix: string;
};

type MissionAction = {
  title: string;
  detail: string;
  status: "completed" | "recommended" | "approval_required";
};

type MissionAlternative = {
  domain: string;
  merchantName: string;
  listedPrice: number;
  estimatedTrueTotal: number;
  trustScore: number;
  trustTier: string;
  bestValue: boolean;
  why: string[];
};

type GhostCheckoutLane = {
  label: string;
  amount: number;
  confidence: "high" | "medium" | "low";
  source: string;
};

type GhostCheckoutStep = {
  label: string;
  status: "completed" | "planned" | "watch";
  detail: string;
};

type MissionResponse = {
  missionId: string;
  domain: string;
  url: string;
  category: string;
  objective: string;
  listedPrice: number | null;
  estimatedTrueTotal: number | null;
  savingsAtRisk: number | null;
  budget: number | null;
  withinBudget: boolean | null;
  recommendation: "proceed" | "proceed_with_caution" | "switch";
  commerceIntent?: {
    isShoppingPage: boolean;
    reason: string;
  };
  trust: {
    merchantName: string;
    score: number;
    tier: string;
    verdict: string;
    credibilitySignals: string[];
  };
  accountAutomation: {
    mode: string;
    status: string;
    guidance: string;
  };
  browserAutomation: {
    runtime: string;
    method: string;
    humanApprovalGates: string[];
  };
  ghostCheckout: {
    mode: "disabled" | "simulated_supervised";
    status: string;
    revealedTotal: number | null;
    deltaFromHeadline: number | null;
    hiddenCostLanes: GhostCheckoutLane[];
    fakePressureSummary: string[];
    saferPathMode: {
      available: boolean;
      label: string;
      detail: string;
    };
    supervisedSteps: GhostCheckoutStep[];
  };
  manipulativeSignals: MissionSignal[];
  alternatives: MissionAlternative[];
  bestAlternative: MissionAlternative | null;
  actionLog: MissionAction[];
  nextBestAction: string;
  summary: string;
  preferences: string[];
  aiCopilot?: {
    headline?: string;
    confidence?: string;
    inputSummary?: string;
    reasoning?: string[];
    recommendation?: string;
    trustScore?: number | null;
    followUps?: string[];
  };
};

const EXAMPLES = [
  {
    name: "Hotel hunt",
    domain: "booking.com",
    url: "https://booking.com/hotel/paradise-resort/checkout",
    purchaseGoal: "Find a one-night Chicago hotel under $200 without paying for junk add-ons.",
    budget: "200",
    listedPrice: "165",
    preferences: "skip breakfast\nprefer refundable booking\navoid insurance upsells",
  },
  {
    name: "Flight checkout",
    domain: "united.com",
    url: "https://united.com/checkout/seats",
    purchaseGoal: "Book the cheapest acceptable NYC to LAX itinerary and reject upsells automatically.",
    budget: "320",
    listedPrice: "189",
    preferences: "no seat upgrades\nno travel insurance\ncarry-on only",
  },
  {
    name: "India travel",
    domain: "makemytrip.com",
    url: "https://www.makemytrip.com/hotels/checkout",
    purchaseGoal: "Check whether this hotel still fits my budget once convenience fees and taxes land.",
    budget: "6500",
    listedPrice: "4999",
    preferences: "no breakfast bundle\nshow alternatives on Goibibo and Agoda\navoid fake urgency",
  },
];

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: value >= 1000 ? "INR" : "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function tierTone(tier: string) {
  if (tier === "gold" || tier === "clean") return "text-green-400";
  if (tier === "neutral") return "text-sky-400";
  if (tier === "suspicious") return "text-orange-400";
  return "text-destructive";
}

export default function AgentMissionPage() {
  const [domain, setDomain] = useState("booking.com");
  const [url, setUrl] = useState("https://booking.com/hotel/paradise-resort/checkout");
  const [purchaseGoal, setPurchaseGoal] = useState("Find the safest hotel checkout under my budget and tell me if I should switch.");
  const [budget, setBudget] = useState("200");
  const [listedPrice, setListedPrice] = useState("165");
  const [preferences, setPreferences] = useState("skip breakfast\nprefer refundable booking\navoid insurance upsells");
  const [allowAccountCreation, setAllowAccountCreation] = useState(false);
  const [allowAutoDeclineUpsells, setAllowAutoDeclineUpsells] = useState(true);
  const [compareAcrossSites, setCompareAcrossSites] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mission, setMission] = useState<MissionResponse | null>(null);

  const parsedPreferences = useMemo(
    () =>
      preferences
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    [preferences],
  );

  async function runMission() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/mission", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          domain,
          url,
          purchaseGoal,
          budget: budget ? Number(budget) : undefined,
          listedPrice: listedPrice ? Number(listedPrice) : undefined,
          preferences: parsedPreferences,
          allowAccountCreation,
          allowAutoDeclineUpsells,
          compareAcrossSites,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(payload.error ?? "Request failed");
      }

      const payload = (await response.json()) as MissionResponse;
      setMission(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Mission failed");
    } finally {
      setIsLoading(false);
    }
  }

  function applyExample(index: number) {
    const example = EXAMPLES[index];
    setDomain(example.domain);
    setUrl(example.url);
    setPurchaseGoal(example.purchaseGoal);
    setBudget(example.budget);
    setListedPrice(example.listedPrice);
    setPreferences(example.preferences);
    setMission(null);
    setError(null);
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-7xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-5 w-5 text-primary" />
              <span className="text-xs font-mono text-primary uppercase tracking-widest">Agentic Copilot</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
            <p className="text-muted-foreground mt-1 max-w-3xl">
              Give Guardian a website, a buying goal, and a budget. It plans the checkout investigation, estimates the true total, compares alternatives, and tells you whether to trust the current site or switch.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example, index) => (
              <Button key={example.name} variant="outline" size="sm" onClick={() => applyExample(index)}>
                {example.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Mission Brief</CardTitle>
              <CardDescription>
                This is the input the browser agent would use before opening tabs, ghost-checking the flow, and deciding whether the current merchant deserves your trust.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target domain</label>
                  <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="booking.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Checkout URL</label>
                  <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mission objective</label>
                <Textarea
                  value={purchaseGoal}
                  onChange={(event) => setPurchaseGoal(event.target.value)}
                  className="min-h-24"
                  placeholder="Describe what you want Guardian to accomplish."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Budget</label>
                  <Input value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="200" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Headline price</label>
                  <Input value={listedPrice} onChange={(event) => setListedPrice(event.target.value)} placeholder="165" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Preferences</label>
                <Textarea
                  value={preferences}
                  onChange={(event) => setPreferences(event.target.value)}
                  className="min-h-28"
                  placeholder="One preference per line"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Create accounts</div>
                    <div className="text-xs text-muted-foreground">Only behind an approval gate</div>
                  </div>
                  <Switch checked={allowAccountCreation} onCheckedChange={setAllowAccountCreation} />
                </div>
                <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Strip upsells</div>
                    <div className="text-xs text-muted-foreground">Auto-decline optional extras</div>
                  </div>
                  <Switch checked={allowAutoDeclineUpsells} onCheckedChange={setAllowAutoDeclineUpsells} />
                </div>
                <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Compare sites</div>
                    <div className="text-xs text-muted-foreground">Find safer alternatives</div>
                  </div>
                  <Switch checked={compareAcrossSites} onCheckedChange={setCompareAcrossSites} />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button className="gap-2" onClick={runMission} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Run mission
                </Button>
                <Badge variant="outline" className="px-3 py-1 border-primary/30 text-primary">
                  Supervised automation only
                </Badge>
              </div>

              {error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>
          </Card>

            <div className="space-y-6">
              {mission ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ghost className="h-4 w-4 text-primary" />
                      Ghost checkout trace
                    </CardTitle>
                    <CardDescription>How Guardian simulates the rest of the checkout path before asking the shopper to trust it.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Revealed total</div>
                        <div className="mt-1 text-xl font-semibold">{formatCurrency(mission.ghostCheckout.revealedTotal)}</div>
                      </div>
                      <div className="rounded-xl border border-border p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Delta from headline</div>
                        <div className="mt-1 text-xl font-semibold text-destructive">{formatCurrency(mission.ghostCheckout.deltaFromHeadline)}</div>
                      </div>
                      <div className="rounded-xl border border-border p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Mode</div>
                        <div className="mt-1 text-sm font-semibold">{mission.ghostCheckout.saferPathMode.label}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border p-4">
                      <div className="font-medium">Stay on cheapest safe path</div>
                      <div className="mt-1 text-muted-foreground">{mission.ghostCheckout.saferPathMode.detail}</div>
                    </div>

                    <div className="grid gap-3">
                      {mission.ghostCheckout.hiddenCostLanes.map((lane) => (
                        <div key={lane.label} className="rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{lane.label}</div>
                            <Badge variant="outline">{lane.confidence} confidence</Badge>
                          </div>
                          <div className="mt-2 text-lg font-semibold">{formatCurrency(lane.amount)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{lane.source}</div>
                        </div>
                      ))}
                    </div>

                    {mission.ghostCheckout.fakePressureSummary.length ? (
                      <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                        <div className="font-medium">Fake pressure surfaced during ghost checkout</div>
                        <ul className="mt-2 space-y-2 text-muted-foreground">
                          {mission.ghostCheckout.fakePressureSummary.map((item) => (
                            <li key={item} className="flex gap-2">
                              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-400 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radar className="h-4 w-4 text-primary" />
                    Ghost checkout result
                  </CardTitle>
                  <CardDescription>See the real payable amount, the hidden-cost lanes, and the safest low-friction path before the shopper commits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-medium text-foreground">Revealed total before commitment</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {mission ? formatCurrency(mission.ghostCheckout.revealedTotal) : "--"}
                    </div>
                    <div className="mt-1">
                      {mission ? mission.ghostCheckout.status : "Run a mission to reveal the ghost-checkout total and safer path."}
                    </div>
                  </div>
                  {mission ? (
                    <>
                      <div className="rounded-xl border border-border p-4">
                        <div className="font-medium text-foreground">{mission.ghostCheckout.saferPathMode.label}</div>
                        <div className="mt-1">{mission.ghostCheckout.saferPathMode.detail}</div>
                      </div>
                      <div className="grid gap-3">
                        {mission.ghostCheckout.hiddenCostLanes.map((lane) => (
                          <div key={lane.label} className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-foreground">{lane.label}</div>
                              <Badge variant="outline">{lane.confidence} confidence</Badge>
                            </div>
                            <div className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(lane.amount)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{lane.source}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>

            {mission?.aiCopilot ? (
              <AiCopilotCard
                title="Guardian Thinking"
                description="Guardian interprets your goal and shopper constraints first, then builds the mission plan below."
                payload={mission.aiCopilot}
              />
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ghost className="h-4 w-4 text-primary" />
                  Guardian Ghost Checkout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border p-4">
                  <div className="font-medium text-foreground mb-1">1. Simulated checkout before commitment</div>
                  Guardian opens a supervised ghost path, estimates the real total, and surfaces late fees before the shopper burns time or emotional energy.
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="font-medium text-foreground mb-1">2. Pressure pattern exposure</div>
                  It highlights fake urgency, fake scarcity, and manipulative upsell placement while the ghost path is running.
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="font-medium text-foreground mb-1">3. Cheapest-safe-path mode</div>
                  Guardian can hold only the cheapest acceptable path open, strip optional extras, and still stop at approval gates before anything sensitive.
                </div>
              </CardContent>
            </Card>

            {mission ? (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle>Top-line verdict</CardTitle>
                  <CardDescription>{mission.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border p-4">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Listed</div>
                      <div className="mt-1 text-xl font-semibold">{formatCurrency(mission.listedPrice)}</div>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">True total</div>
                      <div className="mt-1 text-xl font-semibold text-destructive">{formatCurrency(mission.estimatedTrueTotal)}</div>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Trust</div>
                      <div className={`mt-1 text-xl font-semibold ${tierTone(mission.trust.tier)}`}>{mission.trust.score}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border p-4 text-sm">
                    <div className="font-medium">{mission.nextBestAction}</div>
                    <div className="mt-2 text-muted-foreground">{mission.trust.verdict}</div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        {mission ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Manipulation signals
                  </CardTitle>
                  <CardDescription>Why Guardian thinks this checkout may be safe, risky, or worth abandoning.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mission.manipulativeSignals.length === 0 ? (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
                      No major manipulation signature was triggered for this merchant profile.
                    </div>
                  ) : (
                    mission.manipulativeSignals.map((signal) => (
                      <div key={signal.type} className="rounded-xl border border-border p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{signal.label}</div>
                          <Badge variant="outline">{Math.round(signal.confidence * 100)}% confidence</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{signal.evidence}</div>
                        <div className="text-sm">
                          <span className="font-medium">Why it matters:</span> {signal.whyItMatters}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">What to fix:</span> {signal.fix}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                    Alternative sites
                  </CardTitle>
                  <CardDescription>Guardian compares likely outcomes across nearby merchants so you do not get trapped by the first checkout path.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mission.alternatives.length === 0 ? (
                    <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                      Cross-site comparison is disabled for this mission.
                    </div>
                  ) : (
                    mission.alternatives.map((alternative) => (
                      <div key={alternative.domain} className={`rounded-xl border p-4 ${alternative.bestValue ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{alternative.merchantName}</div>
                            <div className="text-sm text-muted-foreground">{alternative.domain}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(alternative.estimatedTrueTotal)}</div>
                            <div className={`text-xs ${tierTone(alternative.trustTier)}`}>Trust {alternative.trustScore}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {alternative.bestValue ? <Badge>Best value</Badge> : null}
                          {alternative.why.map((reason) => (
                            <Badge key={reason} variant="outline">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Budget and trust verdict
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl border border-border p-4">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Recommendation</div>
                    <div className="mt-1 text-lg font-semibold capitalize">{mission.recommendation.replaceAll("_", " ")}</div>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-medium">Budget status</div>
                    <div className="mt-1 text-muted-foreground">
                      {mission.withinBudget === null
                        ? "No budget was provided, so Guardian focused on trust and price opacity."
                        : mission.withinBudget
                          ? `Estimated total ${formatCurrency(mission.estimatedTrueTotal)} remains within the stated budget.`
                          : `Estimated total ${formatCurrency(mission.estimatedTrueTotal)} breaks the stated budget.`}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-medium">Credibility signals</div>
                    <ul className="mt-2 space-y-2 text-muted-foreground">
                      {mission.trust.credibilitySignals.map((signal) => (
                        <li key={signal} className="flex gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                          <span>{signal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Automation guardrails
                  </CardTitle>
                  <CardDescription>This keeps the agent helpful without turning it into an unsafe black box.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-medium">Account creation</div>
                    <div className="mt-1 text-muted-foreground">{mission.accountAutomation.guidance}</div>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-medium">Browser method</div>
                    <div className="mt-1 text-muted-foreground">{mission.browserAutomation.method}</div>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-medium">Approval gates</div>
                    <ul className="mt-2 space-y-2 text-muted-foreground">
                      {mission.browserAutomation.humanApprovalGates.map((gate) => (
                        <li key={gate} className="flex gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-orange-400 mt-0.5" />
                          <span>{gate}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Agent action log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mission.ghostCheckout.supervisedSteps.map((step) => (
                    <div key={step.label} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{step.label}</div>
                        <Badge variant={step.status === "completed" ? "default" : "outline"}>{step.status}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{step.detail}</div>
                    </div>
                  ))}
                  {mission.actionLog.map((action) => (
                    <div key={action.title} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{action.title}</div>
                        <Badge variant={action.status === "completed" ? "default" : "outline"}>
                          {action.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{action.detail}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
