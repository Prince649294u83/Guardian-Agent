import { useListTrustRatings } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ShieldCheck, AlertTriangle, ShieldAlert, EyeOff, MinusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function TrustRatings() {
  const { data: ratings, isLoading } = useListTrustRatings({ query: { queryKey: ["trust-ratings"] } });
  const [search, setSearch] = useState("");

  const filteredRatings = ratings?.filter(r => r.domain.toLowerCase().includes(search.toLowerCase()));

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "gold": return <ShieldCheck className="h-4 w-4 text-yellow-500" />;
      case "clean": return <ShieldCheck className="h-4 w-4 text-green-500" />;
      case "neutral": return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
      case "suspicious": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "high_manipulation": return <ShieldAlert className="h-4 w-4 text-destructive" />;
      default: return <MinusCircle className="h-4 w-4" />;
    }
  };

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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trust Ratings</h1>
          <p className="text-muted-foreground">Domain intelligence and manipulation scores.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Monitored Domains</CardTitle>
                <CardDescription>All sites tracked by Guardian Agent.</CardDescription>
              </div>
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Search domains..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
              </div>
            ) : filteredRatings?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No domains found matching "{search}".
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Trust Score</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Patterns Detected</TableHead>
                    <TableHead className="text-right">Scans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRatings?.map((rating) => (
                    <TableRow key={rating.id}>
                      <TableCell className="font-medium">
                        <Link href={`/trust/${rating.domain}`} className="text-primary hover:underline">
                          {rating.domain}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`text-sm font-bold ${rating.score >= 80 ? "text-green-500" : rating.score >= 50 ? "text-orange-500" : "text-destructive"}`}>
                            {rating.score}/100
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTierIcon(rating.tier)}
                          {getTierBadge(rating.tier)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {rating.patternsDetectedCount > 0 ? (
                          <span className="text-destructive font-medium">{rating.patternsDetectedCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {rating.totalScans}
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
