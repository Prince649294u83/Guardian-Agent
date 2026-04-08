import { Link } from "wouter";
import {
  Shield,
  ShieldCheck,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  Zap,
  CheckCircle2,
  Clock,
  Package,
  MessageSquareWarning,
  DollarSign,
  CheckSquare,
  BarChart3,
  Chrome,
  Bot,
  Star,
  Users,
  TrendingUp,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATS = [
  { value: "2.3M+", label: "Patterns blocked globally", icon: Shield },
  { value: "$4.1M", label: "In hidden fees revealed", icon: DollarSign },
  { value: "18,400+", label: "Sites analyzed", icon: BarChart3 },
  { value: "98.2%", label: "Detection accuracy", icon: CheckCircle2 },
];

const PATTERNS = [
  {
    icon: Clock,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    label: "False Urgency",
    description: "Fake countdown timers and \"deal expires\" messages designed to rush your decision.",
    example: '"Only 2 minutes left at this price!"',
  },
  {
    icon: Package,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    label: "False Scarcity",
    description: "Fake \"only X left\" warnings that reset every visit to create artificial demand.",
    example: '"12 people are looking at this right now"',
  },
  {
    icon: MessageSquareWarning,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Confirm Shaming",
    description: "Decline buttons written to make you feel guilty for saying no.",
    example: '"No thanks, I hate saving money"',
  },
  {
    icon: DollarSign,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Hidden Fees",
    description: "Resort fees, service charges, and taxes that appear only at the final step.",
    example: '"+ $42 resort fee (added at checkout)"',
  },
  {
    icon: CheckSquare,
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Pre-Checked Add-Ons",
    description: "Insurance, newsletters, and upsells added to your cart without your consent.",
    example: '"✓ Travel Protection $24.99 [pre-selected]"',
  },
  {
    icon: EyeOff,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    label: "Misdirection",
    description: "\"No thanks\" links hidden in tiny gray text while upsell buttons are massive and blue.",
    example: '"I accept the risk of losing my booking"',
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Install in 30 seconds",
    description: "Add Guardian to Chrome. No account required. It immediately starts watching every checkout page you visit.",
    icon: Chrome,
  },
  {
    step: "02",
    title: "Guardian scans in real time",
    description: "As you shop, Guardian profiles the site, reveals the true payable total, and compares safer alternatives before you commit.",
    icon: Zap,
  },
  {
    step: "03",
    title: "See the truth — and act on it",
    description: "An overlay and mission panel strip upsells, score credibility, suggest alternatives, and stop for approval before risky actions.",
    icon: ShieldCheck,
  },
];

const TESTIMONIALS = [
  {
    quote: "Guardian caught a $47 resort fee that booking.com hid until step 4 of 4. I switched to a hotel that showed its full price upfront.",
    author: "Sarah M.",
    context: "Saved $47 on a weekend getaway",
  },
  {
    quote: "The pre-checked insurance on United flights costs me $40+ every time. Guardian unchecks it automatically now.",
    author: "Marcus T.",
    context: "Saved $40+ per United booking",
  },
  {
    quote: "I can't believe how manipulative these checkout timers are. Guardian labeled every single one as unverified.",
    author: "Priya K.",
    context: "Guardian user since launch",
  },
];

const OFFENDERS = [
  { domain: "booking.com", score: 28, tier: "High Manipulation", color: "text-destructive", patterns: 5 },
  { domain: "united.com", score: 41, tier: "Suspicious", color: "text-orange-400", patterns: 4 },
  { domain: "airbnb.com", score: 38, tier: "Suspicious", color: "text-orange-400", patterns: 3 },
  { domain: "etsy.com", score: 88, tier: "Clean", color: "text-green-400", patterns: 0 },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Shield className="h-7 w-7 text-primary" />
            <span className="font-bold text-lg tracking-tight">Guardian Agent</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/agent" className="hover:text-foreground transition-colors">Mission Control</Link>
            <Link href="/patterns" className="hover:text-foreground transition-colors">Dark Patterns</Link>
            <Link href="/trust" className="hover:text-foreground transition-colors">Trust Ratings</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Live Demo</Link>
          </nav>
          <div className="flex gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Open HUD</Button>
            </Link>
            <Button size="sm" className="gap-2">
              <Chrome className="h-4 w-4" />
              Add to Chrome
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Zap className="h-3.5 w-3.5" />
            Hackathon Demo — Live AI Analysis Running
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter max-w-4xl mx-auto leading-none">
            Let Guardian Shop Like a <span className="text-destructive">Manipulation Blocker</span>.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Guardian Agent is a Chrome extension powered by Claude AI that detects dark patterns — fake timers, hidden fees, pre-checked add-ons — and blocks them before they cost you money.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button size="lg" className="text-base px-8 h-13 gap-2">
              <Chrome className="h-5 w-5" />
              Add to Chrome — Free
            </Button>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="text-base px-8 h-13 gap-2">
                <Zap className="h-5 w-5" />
                Watch Live Demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-2">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              No account required
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              Completely free
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              Open source
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="text-center space-y-1">
                <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Browser demo mockup */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <Badge variant="outline" className="text-primary border-primary/30">Guardian in Action</Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">See It Catch a Dark Pattern</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            This is what Guardian's overlay looks like on a real hotel booking checkout page.
          </p>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden shadow-2xl max-w-3xl mx-auto">
          <div className="bg-zinc-900 px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 bg-zinc-800 rounded px-3 py-1 text-xs text-zinc-400 font-mono">
              https://booking.com/hotel/paradise-resort/checkout
            </div>
            <div className="flex items-center gap-1.5 bg-primary/20 rounded px-2 py-1">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-primary font-medium">Guardian Active</span>
            </div>
          </div>

          {/* Guardian bar */}
          <div className="bg-yellow-900/70 border-b border-yellow-600/20 px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-white" />
                <span className="text-white text-xs font-bold uppercase tracking-wider">GUARDIAN AGENT</span>
                <Badge className="bg-destructive text-white text-[10px] h-4">5 PATTERNS DETECTED</Badge>
              </div>
              <div className="text-xs font-mono font-bold text-white">
                True Total: <span className="text-destructive">$212.40</span> (listed $165)
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-yellow-100/70">
              <span>Base: <strong className="text-white">$165.00</strong></span>
              <span>+ Tax: <strong className="text-destructive">$22.40</strong></span>
              <span>+ Resort Fee: <strong className="text-destructive">$15.00</strong></span>
              <span>+ Sustainability: <strong className="text-destructive">$10.00</strong></span>
            </div>
          </div>

          {/* Mocked page content */}
          <div className="bg-white p-6 space-y-4">
            <div className="border-2 border-orange-400 rounded-lg p-3 bg-orange-50 text-center relative">
              <div className="text-orange-700 font-bold text-sm">⏰ DEAL EXPIRES IN: 00:04:59</div>
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                ⚠ Guardian: Timer resets on page refresh
              </div>
            </div>

            <div className="border border-yellow-300 bg-yellow-50 rounded p-2.5 relative">
              <div className="text-yellow-800 text-xs">⚡ ONLY 1 ROOM LEFT AT THIS PRICE! 14 people viewing.</div>
              <div className="absolute -top-2 right-2 bg-yellow-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                Unverified
              </div>
            </div>

            <div className="border border-red-200 bg-red-50 rounded p-3 relative">
              <div className="absolute -top-2 left-3 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-bold">
                Guardian: Auto-unchecked
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded border border-gray-400 bg-white" />
                <span className="text-gray-500 line-through">Travel Protection — $24.99</span>
              </div>
            </div>

            <div className="space-y-2">
              <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-sm">Reserve Now</button>
              <div className="text-center">
                <span className="text-gray-400 text-xs line-through">No, I hate saving money</span>
                <div className="text-gray-600 text-xs underline cursor-pointer mt-0.5">No thanks ← Guardian rewrote this</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <Link href="/extension">
            <Button variant="outline" className="gap-2">
              See more extension states
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card/20 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="outline" className="text-primary border-primary/30">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Three steps to protected checkout</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative text-center space-y-4">
                  <div className="font-mono text-5xl font-bold text-primary/10">{step.step}</div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto -mt-8">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dark patterns catalog */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center space-y-3 mb-14">
          <Badge variant="outline" className="text-primary border-primary/30">What Guardian Catches</Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">6 classes of manipulation</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Dark patterns are deceptive UI tricks. Guardian detects all of them in real time using Claude AI.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PATTERNS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className={`p-5 rounded-xl border border-border ${p.bg} space-y-3`}>
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${p.color}`} />
                  <span className={`font-semibold ${p.color}`}>{p.label}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                <div className="text-xs font-mono text-muted-foreground/70 bg-background/40 rounded px-2 py-1">
                  {p.example}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center mt-8">
          <Link href="/patterns">
            <Button variant="outline" className="gap-2">
              Full dark patterns encyclopedia <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Trust leaderboard */}
      <section className="bg-card/20 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center space-y-3 mb-12">
            <Badge variant="outline" className="text-primary border-primary/30">Trust Intelligence</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Know before you click "Buy"</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Guardian maintains a crowd-sourced trust score for thousands of domains based on real scan data.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {OFFENDERS.map((o) => (
              <Link key={o.domain} href={`/trust/${o.domain}`}>
                <div className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer space-y-2">
                  <div className="font-semibold text-sm">{o.domain}</div>
                  <div className={`text-2xl font-bold font-mono ${o.color}`}>{o.score}</div>
                  <div className={`text-xs ${o.color}`}>{o.tier}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.patterns === 0 ? "No patterns found" : `${o.patterns} active patterns`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <Link href="/trust">
              <Button variant="outline" className="gap-2">
                Browse all trust ratings <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center space-y-3 mb-12">
          <Badge variant="outline" className="text-primary border-primary/30">User Stories</Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Real money saved, real patterns blocked</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="p-6 rounded-xl border border-border bg-card/50 space-y-4">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">"{t.quote}"</p>
              <div>
                <div className="font-semibold text-sm">{t.author}</div>
                <div className="text-xs text-primary">{t.context}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live demo CTA */}
      <section className="bg-primary/5 border-y border-primary/10">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Try the live AI scanner right now
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Paste any checkout page text and watch Guardian's Claude AI detect dark patterns in seconds. No install needed for the demo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/demo">
              <Button size="lg" className="gap-2">
                <Zap className="h-5 w-5" />
                Open Live Scanner
              </Button>
            </Link>
            <Link href="/fee-calculator">
              <Button size="lg" variant="outline" className="gap-2">
                <DollarSign className="h-5 w-5" />
                Fee Calculator
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold">Guardian Agent</span>
            <span className="text-xs text-muted-foreground ml-2">Hackathon Project — Built with Claude AI</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Live Demo</Link>
            <Link href="/patterns" className="hover:text-foreground transition-colors">Patterns</Link>
            <Link href="/stats" className="hover:text-foreground transition-colors">Analytics</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
