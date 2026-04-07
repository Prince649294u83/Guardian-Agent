import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Shield, LayoutDashboard, ShieldCheck, Activity, BookOpen, BarChart3, Radio } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { queryKey: ["health-check"], refetchInterval: 30000 } });

  const navigation = [
    { name: "Home", href: "/", icon: Shield },
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Trust Ratings", href: "/trust", icon: ShieldCheck },
    { name: "Reports", href: "/reports", icon: Activity },
    { name: "Dark Patterns", href: "/patterns", icon: BookOpen },
    { name: "Stats", href: "/stats", icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div className="w-64 border-r border-border bg-card/50 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl tracking-tight">Guardian</span>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className={`h-4 w-4 ${health?.status === 'ok' ? 'text-green-500 animate-pulse' : 'text-orange-500'}`} />
            <span>API Status: {health?.status === 'ok' ? 'Online' : 'Checking...'}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
