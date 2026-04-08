import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Shield,
  LayoutDashboard,
  ShieldCheck,
  Activity,
  BookOpen,
  BarChart3,
  Radio,
  Zap,
  Calculator,
  Monitor,
  Bot,
  Menu,
} from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "main" },
  { name: "Mission Control", href: "/agent", icon: Bot, group: "main", highlight: true },
  { name: "Live Scanner", href: "/demo", icon: Zap, group: "demo", highlight: true },
  { name: "Extension Preview", href: "/extension", icon: Monitor, group: "demo" },
  { name: "Fee Calculator", href: "/fee-calculator", icon: Calculator, group: "demo" },
  { name: "Trust Ratings", href: "/trust", icon: ShieldCheck, group: "data" },
  { name: "Reports", href: "/reports", icon: Activity, group: "data" },
  { name: "Analytics", href: "/stats", icon: BarChart3, group: "data" },
  { name: "Dark Patterns", href: "/patterns", icon: BookOpen, group: "learn" },
];

const groups = [
  { id: "main", label: null },
  { id: "demo", label: "Live Demo" },
  { id: "data", label: "Intelligence" },
  { id: "learn", label: "Learn" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: health } = useHealthCheck({
    query: { queryKey: ["health-check"], refetchInterval: 30000 },
  });

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <Shield className="h-7 w-7 text-primary shrink-0" />
        <div>
          <span className="font-bold text-lg tracking-tight leading-none">Guardian</span>
          <div className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5 uppercase tracking-widest">Agent v1.0</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {groups.map((group) => {
          const items = navigation.filter((n) => n.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id}>
              {group.label && (
                <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-primary/15 text-primary font-medium"
                          : item.highlight
                          ? "text-primary/80 hover:bg-primary/10 hover:text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      {item.name}
                      {item.highlight && !isActive && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Live
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio
            className={`h-3.5 w-3.5 ${health?.status === "ok" ? "text-green-500 animate-pulse" : "text-orange-500"}`}
          />
          <span>API: {health?.status === "ok" ? "Online" : "Checking..."}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <div className="w-56 border-r border-border bg-card/30 hidden md:flex flex-col shrink-0">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 bg-card border-r border-border">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold">Guardian Agent</span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
