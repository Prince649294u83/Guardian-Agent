import { Brain, MessageSquareText, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CopilotPayload = {
  headline?: string;
  confidence?: string;
  inputSummary?: string;
  reasoning?: string[];
  recommendation?: string;
  trustScore?: number | null;
  followUps?: string[];
};

export function AiCopilotCard({
  title = "Guardian Thinking",
  description = "How Guardian interpreted your input before showing the structured result.",
  payload,
}: {
  title?: string;
  description?: string;
  payload?: CopilotPayload | null;
}) {
  if (!payload) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {payload.confidence ? <Badge variant="outline">{payload.confidence} confidence</Badge> : null}
            {typeof payload.trustScore === "number" ? <Badge>Trust {payload.trustScore}</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {payload.headline ? (
          <div className="rounded-xl border border-primary/20 bg-background/60 p-4">
            <div className="font-medium">{payload.headline}</div>
            {payload.inputSummary ? <div className="mt-1 text-sm text-muted-foreground">{payload.inputSummary}</div> : null}
          </div>
        ) : null}

        {payload.reasoning?.length ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Reasoning</div>
            {payload.reasoning.map((line) => (
              <div key={line} className="flex gap-2 rounded-xl border border-border bg-background/50 p-3 text-sm">
                <MessageSquareText className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        ) : null}

        {payload.recommendation ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-green-400" />
              Guardian recommendation
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{payload.recommendation}</div>
          </div>
        ) : null}

        {payload.followUps?.length ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Next checks</div>
            {payload.followUps.map((line) => (
              <div key={line} className="text-sm text-muted-foreground">
                {line}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
