import { useGetStatsSummary, useGetPatternBreakdown, useGetTopOffenders } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Stats() {
  const { data: summary, isLoading: summaryLoading } = useGetStatsSummary({ query: { queryKey: ["stats-summary"] } });
  const { data: breakdown, isLoading: breakdownLoading } = useGetPatternBreakdown({ query: { queryKey: ["pattern-breakdown"] } });
  const { data: topOffenders, isLoading: offendersLoading } = useGetTopOffenders({ limit: 5 }, { query: { queryKey: ["top-offenders", { limit: 5 }] } });

  const breakdownData = breakdown ? [
    { name: "False Urgency", value: breakdown.falseUrgency, color: "hsl(var(--chart-1))" },
    { name: "False Scarcity", value: breakdown.falseScarcity, color: "hsl(var(--chart-2))" },
    { name: "Hidden Fees", value: breakdown.hiddenFees, color: "hsl(var(--chart-3))" },
    { name: "Confirm Shaming", value: breakdown.confirmShaming, color: "hsl(var(--chart-4))" },
    { name: "Pre-Checked", value: breakdown.preCheckedAddOns, color: "hsl(var(--chart-5))" },
    { name: "Misdirection", value: breakdown.misdirection, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0) : [];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Analytics</h1>
          <p className="text-muted-foreground">Global detection statistics and trends.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pattern Breakdown</CardTitle>
              <CardDescription>Distribution of detected manipulation types.</CardDescription>
            </CardHeader>
            <CardContent>
              {breakdownLoading ? (
                <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-xl animate-pulse" />
              ) : breakdownData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdownData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {breakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl">
                  No pattern data available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global Impact</CardTitle>
              <CardDescription>Total metrics across the Guardian network.</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
                </div>
              ) : summary ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="text-3xl font-bold text-primary">{summary.totalPatternsDetected.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total Patterns Blocked</div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="text-3xl font-bold text-destructive">${summary.totalHiddenFeesBlocked.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground mt-1">Hidden Fees Exposed</div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="text-3xl font-bold">{summary.totalDomainsTracked.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground mt-1">Domains Indexed</div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="text-3xl font-bold">{summary.highManipulationDomains.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground mt-1">High Risk Sites</div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Offenders</CardTitle>
            <CardDescription>Domains with the highest rate of dark pattern usage.</CardDescription>
          </CardHeader>
          <CardContent>
            {offendersLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
              </div>
            ) : topOffenders?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                No offender data available yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead className="text-right">Patterns</TableHead>
                    <TableHead className="text-right">Trust Score</TableHead>
                    <TableHead className="text-right">Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOffenders?.map((offender) => (
                    <TableRow key={offender.domain}>
                      <TableCell className="font-medium">
                        <Link href={`/trust/${offender.domain}`} className="text-primary hover:underline">
                          {offender.domain}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {offender.totalPatternsDetected}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-destructive font-bold">{offender.trustScore}/100</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">High Manipulation</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
