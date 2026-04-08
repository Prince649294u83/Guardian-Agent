import { useListReports } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Activity, ShieldAlert, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Reports() {
  const [domainFilter, setDomainFilter] = useState("");
  const { data: reports, isLoading } = useListReports(
    { domain: domainFilter || undefined }, 
    { query: { queryKey: ["reports", { domain: domainFilter || undefined }] } }
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Detection Reports</h1>
            <p className="text-muted-foreground">Timeline of all checkout analyses.</p>
          </div>
          <div className="w-full sm:w-72">
            <Input
              placeholder="Filter by domain..."
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Latest scans across the network.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
                </div>
              ) : reports?.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  No reports found matching your criteria.
                </div>
              ) : reports?.map(report => (
                <Link key={report.id} href={`/reports/${report.id}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-border rounded-xl bg-card hover:bg-muted/50 transition-colors cursor-pointer gap-4 group">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${report.totalPatternsDetected > 0 ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-500"}`}>
                        {report.totalPatternsDetected > 0 ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg group-hover:text-primary transition-colors">{report.domain}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50 border border-border">
                            {new Date(report.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{report.url}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {report.falseUrgencyDetected && <Badge variant="outline" className="text-orange-500 border-orange-500/20 bg-orange-500/10">False Urgency</Badge>}
                          {report.falseScarcityDetected && <Badge variant="outline" className="text-orange-500 border-orange-500/20 bg-orange-500/10">False Scarcity</Badge>}
                          {report.hiddenFeesDetected && <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/10">Hidden Fees</Badge>}
                          {report.confirmShamingDetected && <Badge variant="outline" className="text-orange-500 border-orange-500/20 bg-orange-500/10">Confirm Shaming</Badge>}
                          {report.preCheckedAddOnsDetected && <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/10">Pre-Checked Add-ons</Badge>}
                          {report.misdirectionDetected && <Badge variant="outline" className="text-orange-500 border-orange-500/20 bg-orange-500/10">Misdirection</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      {report.totalPatternsDetected === 0 && (
                        <span className="text-sm font-medium text-green-500">Clean</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
