import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemoFeeEstimate } from "@workspace/api-client-react";
import { AiCopilotCard } from "@/components/ai-copilot-card";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Calculator,
  Info,
  Brain,
} from "lucide-react";

const MERCHANT_TYPES = [
  { id: "hotel", label: "Hotel", icon: "🏨", example: "booking.com, hotels.com, marriott.com" },
  { id: "airline", label: "Airline", icon: "✈️", example: "united.com, delta.com, spirit.com" },
  { id: "vacation_rental", label: "Vacation Rental", icon: "🏠", example: "airbnb.com, vrbo.com" },
  { id: "car_rental", label: "Car Rental", icon: "🚗", example: "enterprise.com, hertz.com" },
  { id: "ecommerce", label: "E-Commerce", icon: "📦", example: "amazon.com, bestbuy.com" },
];

const KNOWN_OFFENDERS = [
  { domain: "booking.com", type: "hotel", listed: 165, description: "3-night stay" },
  { domain: "spirit.com", type: "airline", listed: 89, description: "NYC → Miami" },
  { domain: "airbnb.com", type: "vacation_rental", listed: 120, description: "Per night, weekend" },
  { domain: "enterprise.com", type: "car_rental", listed: 45, description: "Daily compact rate" },
];

function buildFeeReasoning(result: any, merchantType: string) {
  if (!result) return [];

  const merchantLabel =
    MERCHANT_TYPES.find((item) => item.id === merchantType)?.label ?? merchantType;

  return [
    {
      title: "Merchant pattern baseline",
      confidence: "medium",
      quote: merchantLabel,
      detail: `Guardian started from typical ${merchantLabel.toLowerCase()} checkout behavior, where mandatory fees often show up after the initial headline price.`,
      fix: "If you control the checkout, move taxes, platform fees, and service charges into the earliest visible price summary.",
    },
    {
      title: "Likely hidden cost layers",
      confidence: result.feeBreakdown?.length > 1 ? "high" : "medium",
      quote:
        result.feeBreakdown?.length > 0
          ? result.feeBreakdown.map((fee: any) => `${fee.label} (+$${fee.amount.toFixed(2)})`).join(", ")
          : "Taxes, surcharges, and service fees",
      detail:
        result.feeBreakdown?.length > 0
          ? `The estimate includes added cost categories such as ${result.feeBreakdown
              .map((fee: any) => fee.label.toLowerCase())
              .join(" and ")}.`
          : "The estimate assumes extra taxes, service charges, or checkout surcharges beyond the listed price.",
      fix: "Break out each mandatory fee line item before the shopper reaches final payment.",
    },
    {
      title: "How the risk was judged",
      confidence: "high",
      quote: `+$${result.savingsOpportunity.toFixed(2)} vs listed price`,
      detail: `Guardian marked this as ${result.warningLevel} risk because the modeled total is $${result.savingsOpportunity.toFixed(2)} above the advertised amount.`,
      fix: "Flag large uplifts over the headline price and warn users before they commit more time to checkout.",
    },
    {
      title: "Confidence note",
      confidence: result.confidence,
      quote: `${result.confidence} confidence`,
      detail: `Confidence is ${result.confidence} because this is a category-based estimate rather than a full live checkout capture.`,
      fix: "For a stronger estimate, capture the actual checkout steps and fee disclosures instead of relying only on merchant-type heuristics.",
    },
  ];
}

export default function FeeCalc() {
  const [domain, setDomain] = useState("");
  const [merchantType, setMerchantType] = useState("hotel");
  const [listedPrice, setListedPrice] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<any>(null);

  const { mutate: estimate, isPending } = useDemoFeeEstimate({
    mutation: {
      onSuccess: (data) => setResult(data),
    },
  });

  function handleEstimate() {
    setResult(null);
    estimate({
      data: {
        domain: domain || "unknown.com",
        merchantType,
        listedPrice: parseFloat(listedPrice),
        itemDescription: description || undefined,
      },
    });
  }

  function handleQuick(offender: typeof KNOWN_OFFENDERS[number]) {
    setDomain(offender.domain);
    setMerchantType(offender.type);
    setListedPrice(String(offender.listed));
    setDescription(offender.description);
    setResult(null);
    estimate({
      data: {
        domain: offender.domain,
        merchantType: offender.type,
        listedPrice: offender.listed,
        itemDescription: offender.description,
      },
    });
  }

  const warningColor =
    result?.warningLevel === "green"
      ? "border-green-500/40 bg-green-500/5 text-green-400"
      : result?.warningLevel === "red"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : "border-orange-500/40 bg-orange-500/5 text-orange-400";

  const percentageExtra = result
    ? (((result.estimatedTotal - result.listedPrice) / result.listedPrice) * 100).toFixed(0)
    : null;
  const feeReasoning = buildFeeReasoning(result, merchantType);
  const aiCopilot = result?.aiCopilot;

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="h-5 w-5 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-widest">Price Truth Engine</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Fee Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Enter any listed price and Guardian's AI estimates the true final total before you waste 20 minutes in checkout.
          </p>
        </div>

        {/* Quick presets */}
        <div>
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Quick Demo — Known Offenders</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {KNOWN_OFFENDERS.map((o) => (
              <button
                key={o.domain}
                onClick={() => handleQuick(o)}
                disabled={isPending}
                className="p-3 text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all"
              >
                <div className="font-semibold text-sm">{o.domain}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{o.description}</div>
                <div className="text-sm font-mono text-primary mt-1">${o.listed} listed</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Estimate</CardTitle>
              <CardDescription>Enter a domain and listed price to see what you'll actually pay</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Domain</label>
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="booking.com" />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Merchant Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {MERCHANT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setMerchantType(t.id)}
                      className={`p-2 rounded-lg border text-sm text-left transition-all ${
                        merchantType === t.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <span className="mr-1">{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Listed Price (USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={listedPrice}
                    onChange={(e) => setListedPrice(e.target.value)}
                    className="pl-8 font-mono"
                    placeholder="165.00"
                    type="number"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Description (optional)</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="3-night stay, downtown hotel"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleEstimate}
                disabled={isPending || !listedPrice || !domain}
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estimating true cost...</>
                ) : (
                  <><Calculator className="mr-2 h-4 w-4" /> Reveal True Price</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          <div className="space-y-4">
            {!isPending && aiCopilot && (
              <AiCopilotCard
                title="Guardian Thinking"
                description="Guardian reads your merchant, price, and category first, then produces the fee estimate beneath it."
                payload={aiCopilot}
              />
            )}
            {isPending && (
              <Card className="border-primary/20">
                <CardContent className="py-8 flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground text-center">
                    Claude AI is analyzing known fee patterns for {domain}...
                  </p>
                </CardContent>
              </Card>
            )}

            {!isPending && !result && (
              <Card className="border-dashed">
                <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    Your true price estimate will appear here
                  </p>
                </CardContent>
              </Card>
            )}

            {!isPending && result && (
              <div className="space-y-4">
                <Card className={`border-2 ${warningColor.split(" ")[0]} ${warningColor.split(" ")[1]}`}>
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Listed Price</div>
                        <div className="text-2xl font-bold font-mono">${result.listedPrice.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">True Total</div>
                        <div className={`text-3xl font-bold font-mono ${warningColor.split(" ")[2]}`}>
                          ${result.estimatedTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className={`mt-3 flex items-center gap-2 text-sm ${warningColor.split(" ")[2]}`}>
                      {result.warningLevel === "green" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <span>
                        +${result.savingsOpportunity.toFixed(2)} extra ({percentageExtra}% more than listed)
                      </span>
                      <Badge variant="outline" className={`ml-auto text-xs ${warningColor.split(" ")[2]}`}>
                        {result.confidence} confidence
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fee Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Listed base price</span>
                      <span className="font-mono">${result.listedPrice.toFixed(2)}</span>
                    </div>
                    {result.feeBreakdown?.map((fee: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{fee.label}</span>
                        <span className="font-mono text-destructive">+${fee.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                      <span>Estimated Total</span>
                      <span className="font-mono">${result.estimatedTotal.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{result.explanation}</p>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Why Guardian Estimated This Total
                    </CardTitle>
                    <CardDescription>
                      This box explains the reasoning behind the fee uplift instead of only showing the final number.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {feeReasoning.map((reason) => (
                      <div key={reason.title} className="rounded-lg border border-primary/10 bg-background/70 p-3">
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
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
