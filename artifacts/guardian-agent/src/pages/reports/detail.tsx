import { useGetReport } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useParams } from "wouter";
import { ArrowLeft, ShieldAlert, CheckCircle2, Clock, AlertTriangle, EyeOff, XCircle, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReportDetail() {
  const { id } = useParams();
  const reportId = id ? parseInt(id, 10) : 0;
  
  const { data: report, isLoading, error } = useGetReport(reportId, { 
    query: { enabled: !!reportId, queryKey: ["report", reportId] } 
  });

  if (error) {
    return (
      <Layout>
        <div className="text-center py-24 space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Report not found</h2>
          <p className="text-muted-foreground">The requested analysis report does not exist.</p>
          <Link href="/reports">
            <Button variant="outline">Back to Reports</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analysis Report #{reportId}</h1>
            <p className="text-muted-foreground">Detailed breakdown of detected manipulation.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-48 bg-muted rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-muted rounded-xl" />
              <div className="h-64 bg-muted rounded-xl" />
            </div>
          </div>
        ) : report ? (
          <div className="space-y-6">
            <Card className="border-border">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold text-primary">
                      <Link href={`/trust/${report.domain}`} className="hover:underline">
                        {report.domain}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-1 break-all max-w-3xl">
                      {report.url}
                    </CardDescription>
                  </div>
                  <Badge variant={report.totalPatternsDetected > 0 ? "destructive" : "outline"} className="text-sm px-3 py-1">
                    {report.totalPatternsDetected > 0 
                      ? `${report.totalPatternsDetected} Patterns Found` 
                      : "Clean (0 Patterns)"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Guardian AI Summary</h4>
                  <p className="text-foreground leading-relaxed">{report.summary}</p>
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(report.createdAt).toLocaleString()}
                  </div>
                  {report.hiddenFeesTotal && report.hiddenFeesTotal > 0 && (
                    <div className="flex items-center gap-1 text-destructive font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Blocked ${report.hiddenFeesTotal} in hidden fees
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <h3 className="text-xl font-bold pt-4">Pattern Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              <Card className={`border ${report.falseUrgencyDetected ? "border-orange-500/50 bg-orange-500/5" : "border-border/50 bg-card/30 opacity-70"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {report.falseUrgencyDetected ? <AlertTriangle className="h-5 w-5 text-orange-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    False Urgency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.falseUrgencyDetected 
                      ? "Detected artificial timers or countdowns designed to rush decision making." 
                      : "No fake countdown timers detected."}
                  </p>
                </CardContent>
              </Card>

              <Card className={`border ${report.falseScarcityDetected ? "border-orange-500/50 bg-orange-500/5" : "border-border/50 bg-card/30 opacity-70"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {report.falseScarcityDetected ? <AlertTriangle className="h-5 w-5 text-orange-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    False Scarcity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.falseScarcityDetected 
                      ? "Detected deceptive low-stock warnings or 'X people viewing this' alerts." 
                      : "No artificial scarcity claims detected."}
                  </p>
                </CardContent>
              </Card>

              <Card className={`border ${report.hiddenFeesDetected ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-card/30 opacity-70"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {report.hiddenFeesDetected ? <EyeOff className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    Hidden Fees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.hiddenFeesDetected 
                      ? `Detected unannounced fees added at the end of the checkout process.` 
                      : "No surprise fees detected during checkout."}
                  </p>
                </CardContent>
              </Card>

              <Card className={`border ${report.confirmShamingDetected ? "border-orange-500/50 bg-orange-500/5" : "border-border/50 bg-card/30 opacity-70"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {report.confirmShamingDetected ? <AlertTriangle className="h-5 w-5 text-orange-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    Confirm Shaming
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.confirmShamingDetected 
                      ? "Detected manipulative language used to guilt the user into accepting an offer." 
                      : "No guilt-tripping language detected."}
                  </p>
                </CardContent>
              </Card>

              <Card className={`border ${report.preCheckedAddOnsDetected ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-card/30 opacity-70"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {report.preCheckedAddOnsDetected ? <MousePointerClick className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    Pre-Checked Add-Ons
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.preCheckedAddOnsDetected 
                      ? "Detected checkboxes for extra products/services that were opted-in by default." 
                      : "No sneaky default opt-ins detected."}
                  </p>
                </CardContent>
              </Card>

              <Card className={`border ${report.misdirectionDetected ? "border-orange-500/50 bg-orange-500/5" : "border-border/50 bg-card/30 opacity-70"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {report.misdirectionDetected ? <AlertTriangle className="h-5 w-5 text-orange-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    Misdirection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.misdirectionDetected 
                      ? "Detected visual tricks used to hide decline buttons or emphasize accept buttons." 
                      : "No intentional visual misdirection detected."}
                  </p>
                </CardContent>
              </Card>

            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
