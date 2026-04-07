import { Link } from "wouter";
import { Shield, ShieldCheck, EyeOff, Lock, AlertTriangle, ArrowRight, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <header className="w-full max-w-6xl mx-auto p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl tracking-tight">Guardian Agent</span>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard">
            <Button variant="ghost">Launch HUD</Button>
          </Link>
          <Button>Add to Chrome</Button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col items-center pt-24 px-6 text-center space-y-32">
        <section className="space-y-8 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Zap className="h-4 w-4" />
            <span>Vigilant Protection Active</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter">
            The Ad Blocker for <span className="text-destructive">Manipulation</span>.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            E-commerce sites use psychological manipulation to extract more money from you. Guardian Agent intercepts and exposes dark patterns before they influence your checkout.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 h-14">
              Add to Chrome — It's Free
            </Button>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 h-14 border-primary/20 hover:bg-primary/5">
                Open Command Center
              </Button>
            </Link>
          </div>
        </section>

        <section className="w-full border border-border bg-card/50 rounded-xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <img src="/hero-hud.png" alt="Guardian HUD" className="w-full rounded-lg shadow-2xl border border-border" />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-left">
          <div className="space-y-4 p-6 bg-card rounded-xl border border-border">
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Expose False Scarcity</h3>
            <p className="text-muted-foreground">"Only 1 left in stock!" — We verify inventory claims and block fake urgency timers meant to rush your purchase.</p>
          </div>
          <div className="space-y-4 p-6 bg-card rounded-xl border border-border">
            <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
              <EyeOff className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Uncover Hidden Fees</h3>
            <p className="text-muted-foreground">Service fees, handling costs, and pre-checked add-ons are intercepted and calculated before you reach checkout.</p>
          </div>
          <div className="space-y-4 p-6 bg-card rounded-xl border border-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Domain Trust Ratings</h3>
            <p className="text-muted-foreground">Know instantly if a store is safe. Our crowd-sourced trust index scores domains based on their manipulative tactics.</p>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-border mt-32 py-12">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span>Guardian Agent</span>
          </div>
          <p>Protecting shoppers worldwide.</p>
        </div>
      </footer>
    </div>
  );
}
