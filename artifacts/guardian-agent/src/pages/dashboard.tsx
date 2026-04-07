import { useGetStatsSummary, useListReports, useGetTopOffenders, useGetPatternBreakdown } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Activity, DollarSign, Globe, TrendingUp, ArrowRight, Zap, Clock, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const PATTERN_COLORS: Record<string, string> = {
  falseUrgency: "hsl(var(--chart-1))",
  falseScarcity: "hsl(var(--chart-2))",
  hiddenFees: "hsl(var(--destructive))",
  confirmShaming: "hsl(var(--chart-4))",
  preCheckedAddOns: "hsl(var(--chart-3))",
  misdirection: "hsl(var(--chart-5))",
};

const TIER_COLORS: Record<string, string> = {
  gold: "text-yellow-400",
  clean: "text-green-400",
  neutral: "text-muted-foreground",
  suspicious: "text-orange-400",
  high_manipulation: "text-destructive",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStatsSummary({
    query: { queryKey: ["stats-summary"], refetchInterval: 30000 },
  });
  const { data: reports, isLoading: reportsLoading } = useListReports(
    { limit: 8 },
    { query: { queryKey: ["reports", { limit: 8 }], refetchInterval: 30000 } }
  );
  const { data: topOffenders } = useGetTopOffenders(
    { limit: 5 },
    { query: { queryKey: ["top-offenders", 5] } }
  );
  const { data: breakdown } = useGetPatternBreakdown({
    query: { queryKey: ["pattern-breakdown"] },
  });

  const pieData = breakdown
    ? [
        { name: "False Urgency", value: breakdown.falseUrgency, color: PATTERN_COLORS.falseUrgency },
        { name: "False Scarcity", value: breakdown.falseScarcity, color: PATTERN_COLORS.falseScarcity },
        { name: "Hidden Fees", value: breakdown.hiddenFees, color: PATTERN_COLORS.hiddenFees },
        { name: "Confirm Shaming", value: breakdown.confirmShaming, color: PATTERN_COLORS.confirmShaming },
        { name: "Pre-Checked", value: breakdown.preCheckedAddOns, color: PATTERN_COLORS.preCheckedAddOns },
        { name: "Misdirection", value: breakdown.misdirection, color: PATTERN_COLORS.misdirection },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
            <p className="text-muted-foreground mt-0.5">Real-time dark pattern intelligence dashboard.</p>
          </div>
          <Link href="/demo">
            <Button className="gap-2">
              <Zap className="h-4 w-4" />
              Run Live Scan
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-destructive/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patterns Blocked</CardTitle>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPatternsDetected.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Across all scan sessions</p>
              </CardContent>
            </Card>

            <Card className="border-green-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fees Exposed</CardTitle>
                <DollarSign className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalHiddenFeesBlocked.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">In hidden fees revealed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Domains Tracked</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDomainsTracked.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-destructive">{stats.highManipulationDomains}</span> high-risk sites
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalScans.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Checkout pages analyzed</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Live Detection Feed</CardTitle>
                <CardDescription>Latest scans — auto-refreshes every 30s</CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportsLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-muted rounded-lg" />)}
                  </div>
                ) : reports?.map((report) => (
                  <Link key={report.id} href={`/reports/${report.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-card/80 transition-all group">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        report.totalPatternsDetected > 3
                          ? "bg-destructive/10"
                          : report.totalPatternsDetected > 0
                          ? "bg-orange-500/10"
                          : "bg-green-500/10"
                      }`}>
                        {report.totalPatternsDetected === 0 ? (
                          <ShieldCheck className="h-4 w-4 text-green-400" />
                        ) : (
                          <ShieldAlert className={`h-4 w-4 ${report.totalPatternsDetected > 3 ? "text-destructive" : "text-orange-400"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{report.domain}</span>
                          {report.totalPatternsDetected > 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 h-4 shrink-0">
                              {report.totalPatternsDetected} patterns
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(report.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {report.hiddenFeesTotal && report.hiddenFeesTotal > 0 && (
                            <span className="text-destructive ml-2 font-mono">+${report.hiddenFeesTotal.toFixed(2)} hidden</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <Link href="/reports">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1">
                    View all reports <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button size="sm" className="gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    New Scan
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-6">
            {/* Pattern distribution pie */}
            {pieData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pattern Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {pieData.slice(0, 4).map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-muted-foreground truncate">{d.name}</span>
                        </div>
                        <span className="font-mono font-medium">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Offenders */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  Top Offenders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topOffenders?.slice(0, 5).map((o, i) => (
                    <Link key={o.domain} href={`/trust/${o.domain}`}>
                      <div className="flex items-center gap-2 py-1.5 hover:text-foreground transition-colors group">
                        <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                        <span className="flex-1 text-xs font-medium truncate group-hover:text-primary">
                          {o.domain}
                        </span>
                        <span className="text-xs font-mono text-destructive">{o.trustScore}/100</span>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/trust">
                  <Button variant="ghost" size="sm" className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground gap-1">
                    All trust ratings <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4 space-y-2">
                <div className="text-xs font-semibold text-primary mb-3">Quick Actions</div>
                <Link href="/demo">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 mb-2">
                    <Zap className="h-3.5 w-3.5" /> Run AI Scanner
                  </Button>
                </Link>
                <Link href="/fee-calculator">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 mb-2">
                    <DollarSign className="h-3.5 w-3.5" /> Fee Calculator
                  </Button>
                </Link>
                <Link href="/extension">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" /> Extension Preview
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
