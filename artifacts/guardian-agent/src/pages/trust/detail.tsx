import { useGetTrustRating, useListReports } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useParams, Link } from "wouter";
import { ShieldCheck, ShieldAlert, AlertTriangle, MinusCircle, ArrowLeft, ExternalLink, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DomainDetail() {
  const { domain } = useParams();
  
  const { data: rating, isLoading: ratingLoading, error: ratingError } = useGetTrustRating(domain || "", { 
    query: { enabled: !!domain, queryKey: ["trust-rating", domain] } 
  });
  
  const { data: reports, isLoading: reportsLoading } = useListReports({ domain: domain || undefined, limit: 10 }, {
    query: { enabled: !!domain, queryKey: ["reports", { domain, limit: 10 }] }
  });

  if (ratingError) {
    return (
      <Layout>
        <div className="text-center py-24 space-y-4">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Domain not found</h2>
          <p className="text-muted-foreground">We have no data for {domain}.</p>
          <Link href="/trust">
            <Button variant="outline">Back to Trust Ratings</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "gold": return <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 bg-yellow-500/10">Gold Standard</Badge>;
      case "clean": return <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10">Clean</Badge>;
      case "neutral": return <Badge variant="outline" className="text-muted-foreground border-border bg-muted/50">Neutral</Badge>;
      case "suspicious": return <Badge variant="outline" className="text-orange-500 border-orange-500/20 bg-orange-500/10">Suspicious</Badge>;
      case "high_manipulation": return <Badge variant="destructive">High Manipulation</Badge>;
      default: return <Badge variant="outline">{tier}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-orange-500";
    return "text-destructive";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/trust">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{domain}</h1>
            <p className="text-muted-foreground">Domain intelligence profile.</p>
          </div>
        </div>

        {ratingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            <div className="h-64 bg-muted rounded-xl col-span-1" />
            <div className="h-64 bg-muted rounded-xl col-span-1 md:col-span-2" />
          </div>
        ) : rating ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Trust Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-xl">
                  <div className={`text-6xl font-bold tracking-tighter ${getScoreColor(rating.score)}`}>
                    {rating.score}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 mb-4">Trust Score (0-100)</div>
                  {getTierBadge(rating.tier)}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Total Scans</span>
                    <span className="font-medium">{rating.totalScans}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Patterns Detected</span>
                    <span className={`font-medium ${rating.patternsDetectedCount > 0 ? "text-destructive" : "text-green-500"}`}>
                      {rating.patternsDetectedCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Hidden Fees</span>
                    <span className={`font-medium ${rating.hiddenFeesCount > 0 ? "text-orange-500" : "text-green-500"}`}>
                      {rating.hiddenFeesCount} events
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1 md:col-span-2">
              <CardHeader>
                <CardTitle>Scan History</CardTitle>
                <CardDescription>Recent checkout analyses for {domain}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportsLoading ? (
                    <div className="space-y-2 animate-pulse">
                      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
                    </div>
                  ) : reports?.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                      No scan reports found for this domain.
                    </div>
                  ) : reports?.map(report => (
                    <Link key={report.id} href={`/reports/${report.id}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-card/50 hover:bg-muted/50 transition-colors cursor-pointer gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Scan Report #{report.id}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                            {report.url}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {report.totalPatternsDetected > 0 ? (
                            <Badge variant="destructive" className="whitespace-nowrap">
                              {report.totalPatternsDetected} patterns
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10 whitespace-nowrap">
                              Clean
                            </Badge>
                          )}
                          <span className="text-muted-foreground whitespace-nowrap">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
