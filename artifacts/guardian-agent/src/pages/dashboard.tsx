import { useGetStatsSummary, useListReports } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Activity, DollarSign, Globe } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStatsSummary({ query: { queryKey: ["stats-summary"] } });
  const { data: reports, isLoading: reportsLoading } = useListReports({ limit: 5 }, { query: { queryKey: ["reports", { limit: 5 }] } });

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">System overview and recent activity.</p>
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patterns Blocked</CardTitle>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPatternsDetected.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Across all tracking sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Money Saved</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalHiddenFeesBlocked.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From hidden fees & add-ons</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Domains Tracked</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDomainsTracked.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{stats.highManipulationDomains} high risk domains</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalScans.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">System-wide checkouts analyzed</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Recent Detections</CardTitle>
              <CardDescription>Latest identified manipulation tactics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportsLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
                  </div>
                ) : reports?.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card/50">
                    <div className="space-y-1">
                      <div className="font-medium">{report.domain}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        {report.totalPatternsDetected > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                            {report.totalPatternsDetected} patterns
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Link href={`/reports/${report.id}`} className="text-sm text-primary hover:underline">
                      View details
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
