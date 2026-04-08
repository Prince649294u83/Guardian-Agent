import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Download,
} from "lucide-react";

const DEMO_STATES = [
  {
    id: "scanning",
    label: "Booking.com — Scanning",
    domain: "booking.com",
    trustScore: 28,
    tier: "high_manipulation" as const,
    headerColor: "bg-yellow-900/80",
    trueTotal: "$212.40",
    baseFare: "$165.00",
    fees: [
      { label: "Tax", amount: "$22.40" },
      { label: "Resort Fee", amount: "$15.00" },
      { label: "Sustainability Levy", amount: "$10.00" },
    ],
    patterns: [
      { type: "falseUrgency", label: "False Urgency", detail: "⚠ Unverified: Timer resets on refresh", color: "text-orange-400", bg: "bg-orange-500/10" },
      { type: "falseScarcity", label: "False Scarcity", detail: "\"Only 1 left\" — same message shown across 5 sessions", color: "text-yellow-400", bg: "bg-yellow-500/10" },
      { type: "confirmShaming", label: "Confirm Shaming", detail: "Rewritten: \"No thanks\" → was \"No, I hate saving money\"", color: "text-purple-400", bg: "bg-purple-500/10" },
      { type: "hiddenFees", label: "Hidden Fees", detail: "+$47.40 in resort & sustainability fees", color: "text-destructive", bg: "bg-destructive/10" },
      { type: "preCheckedAddOns", label: "Pre-Checked Add-Ons", detail: "Auto-unchecked: Travel Insurance ($24.99)", color: "text-red-400", bg: "bg-red-500/10" },
    ],
    actions: [
      { label: "Auto-unchecked Travel Insurance", saved: "$24.99", color: "text-green-400" },
      { label: "Auto-clicked 'No thanks' on upsell", saved: null, color: "text-green-400" },
    ],
  },
  {
    id: "clean",
    label: "Etsy — Guardian Seal",
    domain: "etsy.com",
    trustScore: 88,
    tier: "gold" as const,
    headerColor: "bg-green-900/80",
    trueTotal: "$34.88",
    baseFare: "$28.00",
    fees: [
      { label: "Shipping", amount: "$4.50" },
      { label: "Tax", amount: "$2.38" },
    ],
    patterns: [],
    actions: [],
  },
  {
    id: "airline",
    label: "United Airlines — Upsell Gauntlet",
    domain: "united.com",
    trustScore: 41,
    tier: "suspicious" as const,
    headerColor: "bg-orange-900/80",
    trueTotal: "$341.98",
    baseFare: "$189.00",
    fees: [
      { label: "Taxes & Airport Fees", amount: "$42.98" },
      { label: "Carry-on Baggage", amount: "$45.00" },
      { label: "Seat Selection", amount: "$45.00" },
      { label: "Travel Insurance (pre-checked)", amount: "$20.00" },
    ],
    patterns: [
      { type: "falseUrgency", label: "False Urgency", detail: "Fare countdown timer — could not be verified", color: "text-orange-400", bg: "bg-orange-500/10" },
      { type: "preCheckedAddOns", label: "Pre-Checked Add-Ons", detail: "Auto-unchecked: TravelGuard + Airport Fast Track", color: "text-red-400", bg: "bg-red-500/10" },
      { type: "misdirection", label: "Misdirection", detail: "Free seat hidden behind premium options visually", color: "text-pink-400", bg: "bg-pink-500/10" },
    ],
    actions: [
      { label: "Skipped seat upgrade page", saved: "$45", color: "text-green-400" },
      { label: "Skipped TravelGuard page", saved: "$42.99", color: "text-green-400" },
      { label: "Auto-unchecked Airport Fast Track", saved: "$19.99", color: "text-green-400" },
    ],
  },
];

const TIER_COLORS = {
  gold: "text-yellow-400",
  clean: "text-green-400",
  neutral: "text-muted-foreground",
  suspicious: "text-orange-400",
  high_manipulation: "text-destructive",
};

export default function Extension() {
  const [selectedDemo, setSelectedDemo] = useState(0);
  const [detailOpen, setDetailOpen] = useState(true);
  const demo = DEMO_STATES[selectedDemo];
  const isClean = demo.patterns.length === 0;

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-xs font-mono text-primary uppercase tracking-widest">Extension Preview</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Guardian in Your Browser</h1>
            <p className="text-muted-foreground mt-1">
              See exactly what the extension looks like as you shop. Switch scenarios to see different protection states.
            </p>
          </div>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Add to Chrome
          </Button>
        </div>

        {/* Scenario selector */}
        <div className="flex gap-3">
          {DEMO_STATES.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setSelectedDemo(i)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedDemo === i
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Browser mock */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Browser View</p>
            <div className="rounded-xl border border-border overflow-hidden shadow-2xl">
              {/* Browser chrome */}
              <div className="bg-zinc-900 px-4 py-2 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 bg-zinc-800 rounded px-3 py-1 text-xs text-zinc-400 font-mono truncate">
                  https://{demo.domain}/checkout
                </div>
                <div className="flex items-center gap-1 bg-zinc-700 rounded px-2 py-1">
                  <Shield className="h-3 w-3 text-primary" />
                  <span className="text-xs text-zinc-300">GA</span>
                </div>
              </div>

              {/* Guardian Header Bar */}
              <div className={`${demo.headerColor} border-b border-white/10 px-4 py-2.5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-white" />
                    <span className="text-white text-xs font-bold">GUARDIAN AGENT</span>
                    {isClean ? (
                      <Badge className="bg-green-500 text-white text-[10px] h-4">VERIFIED SAFE</Badge>
                    ) : (
                      <Badge className="bg-destructive text-white text-[10px] h-4">{demo.patterns.length} PATTERNS DETECTED</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/80">
                    <span className="font-mono font-bold text-white">
                      True Total: {demo.trueTotal}
                    </span>
                    <button onClick={() => setDetailOpen(!detailOpen)} className="text-white/60 hover:text-white">
                      {detailOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {detailOpen && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <div className="text-xs text-white/60">
                      Base: <span className="text-white">{demo.baseFare}</span>
                    </div>
                    {demo.fees.map((fee, i) => (
                      <div key={i} className="text-xs text-white/60">
                        + {fee.label}: <span className="text-destructive font-mono">{fee.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Page content mock */}
              <div className="bg-white p-6 space-y-4 min-h-[300px]">
                {demo.patterns.some((p) => p.type === "falseUrgency") && (
                  <div className="relative border-2 border-orange-400 rounded p-3 text-center bg-orange-50">
                    <div className="text-orange-700 font-bold text-sm">DEAL EXPIRES IN: 04:59</div>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                      ⚠ Guardian: UNVERIFIED TIMER
                    </div>
                  </div>
                )}

                {demo.patterns.some((p) => p.type === "falseScarcity") && (
                  <div className="relative border border-yellow-400 bg-yellow-50 rounded p-2">
                    <div className="text-yellow-700 text-xs">⚡ Only 1 room left at this price! 14 people viewing</div>
                    <div className="absolute -top-2 right-2 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                      ⚠ Unverified
                    </div>
                  </div>
                )}

                <div className="bg-gray-100 rounded p-3 text-sm text-gray-700 space-y-2">
                  <div className="font-bold text-gray-800">{demo.domain === "etsy.com" ? "Handmade Ceramic Mug" : demo.domain === "booking.com" ? "Paradise Resort — Standard Room" : "NYC → LAX Flight"}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Base price</span>
                    <span>{demo.baseFare}</span>
                  </div>
                </div>

                {demo.patterns.some((p) => p.type === "preCheckedAddOns") && (
                  <div className="relative border border-red-300 bg-red-50 rounded p-3 space-y-2">
                    <div className="absolute -top-2 left-3 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded">
                      Guardian auto-unchecked
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 rounded border-2 border-gray-400 bg-white" />
                      <span className="text-gray-600 line-through">Travel Insurance — $24.99</span>
                    </div>
                  </div>
                )}

                {demo.patterns.some((p) => p.type === "confirmShaming") && (
                  <div className="relative">
                    <button className="w-full bg-blue-600 text-white py-3 rounded font-bold text-sm">
                      Reserve Now
                    </button>
                    <div className="relative mt-2 text-center">
                      <span className="text-gray-400 text-xs" style={{ textDecoration: "line-through" }}>
                        No, I hate saving money
                      </span>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-max bg-purple-500 text-white text-[9px] px-2 rounded">
                        Guardian: rewritten below
                      </div>
                    </div>
                    <button className="w-full mt-1 text-xs text-gray-500 underline text-center py-1">
                      No thanks
                    </button>
                  </div>
                )}

                {isClean && (
                  <div className="border-2 border-green-400 bg-green-50 rounded p-4 text-center">
                    <ShieldCheck className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <div className="text-green-700 font-bold text-sm">Guardian Seal: Safe to Proceed</div>
                    <div className="text-green-600 text-xs mt-1">Price verified. No hidden fees. No manipulation.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="space-y-4">
            {/* Trust score */}
            <Card className={`border ${isClean ? "border-green-500/30" : "border-destructive/30"}`}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isClean ? "bg-green-500/10" : "bg-destructive/10"}`}>
                  {isClean ? (
                    <ShieldCheck className="h-6 w-6 text-green-400" />
                  ) : (
                    <ShieldAlert className="h-6 w-6 text-destructive" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{demo.domain}</div>
                  <div className={`text-sm capitalize ${TIER_COLORS[demo.tier]}`}>
                    {demo.tier.replace("_", " ")} — {demo.tier === "high_manipulation" ? "Guardian warns on every visit" : demo.tier === "gold" ? "Gold Trust: consistently honest pricing" : "Monitor this site"}
                  </div>
                </div>
                <div className={`text-3xl font-bold font-mono ${TIER_COLORS[demo.tier]}`}>{demo.trustScore}</div>
              </CardContent>
            </Card>

            {/* Patterns detected */}
            {demo.patterns.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                    Patterns Detected
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {demo.patterns.map((p) => (
                    <div key={p.type} className={`p-3 rounded-lg ${p.bg} border border-transparent`}>
                      <div className={`text-sm font-medium ${p.color}`}>{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.detail}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Guardian Actions Taken */}
            {demo.actions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Guardian Actions Taken
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {demo.actions.map((action, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2 text-green-400">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{action.label}</span>
                      </div>
                      {action.saved && (
                        <Badge variant="secondary" className="text-green-400 text-[10px]">
                          saved {action.saved}
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* How to install */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4 space-y-3">
                <div className="text-sm font-semibold">Get the Extension</div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {["Install from Chrome Web Store — free", "Fill in your preferences once (refundable rates, skip insurance)", "Guardian runs silently on every checkout, automatically"].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center shrink-0 font-bold">{i + 1}</div>
                      {step}
                    </div>
                  ))}
                </div>
                <Button size="sm" className="w-full gap-2">
                  <Download className="h-3.5 w-3.5" />
                  Add Guardian to Chrome
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
