import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Clock, EyeOff, MessageSquare, MousePointerClick, CornerUpRight } from "lucide-react";

export default function Patterns() {
  const patterns = [
    {
      id: "false-urgency",
      name: "False Urgency",
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      description: "Artificial time limits created to rush your decision making.",
      example: "A countdown timer that resets when you refresh the page.",
      howWeFight: "Guardian analyzes the timer logic and intercepts it, showing you whether it's tied to real inventory or just a visual trick."
    },
    {
      id: "false-scarcity",
      name: "False Scarcity",
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      description: "Fake claims about low inventory or high demand.",
      example: "\"Only 1 left in stock!\" or \"34 people are looking at this right now.\"",
      howWeFight: "We cross-reference stock claims across sessions and flag repetitive, hard-coded scarcity alerts that aren't tied to real data."
    },
    {
      id: "hidden-fees",
      name: "Hidden Fees",
      icon: EyeOff,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20",
      description: "Unannounced costs added at the very end of the checkout process.",
      example: "\"Service fees\", \"Convenience fees\", or mandated tips that appear on the final screen.",
      howWeFight: "Guardian scans the checkout flow invisibly and calculates the true final price before you even add an item to your cart."
    },
    {
      id: "confirm-shaming",
      name: "Confirm Shaming",
      icon: MessageSquare,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      description: "Manipulative language designed to guilt you into opting in.",
      example: "A popup to join a newsletter where the decline button says \"No thanks, I prefer to pay full price.\"",
      howWeFight: "Our AI detects emotionally manipulative language and visually rewrites the decline button to neutral text."
    },
    {
      id: "pre-checked-addons",
      name: "Pre-Checked Add-Ons",
      icon: MousePointerClick,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20",
      description: "Checkboxes for extra items or subscriptions that are opted-in by default.",
      example: "A $2.99 \"shipping protection\" fee that is automatically checked in your cart.",
      howWeFight: "Guardian automatically unchecks sneakily pre-selected add-ons and alerts you that they were present."
    },
    {
      id: "misdirection",
      name: "Misdirection",
      icon: CornerUpRight,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      description: "Visual design that draws attention to the more expensive option while hiding the free/cheaper alternative.",
      example: "A massive, glowing \"Upgrade\" button next to a tiny, grayed-out \"Skip\" text link.",
      howWeFight: "We inject CSS to normalize button hierarchy, ensuring the decline option is just as visible as the accept option."
    }
  ];

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dark Patterns Encyclopedia</h1>
          <p className="text-muted-foreground">The psychological tricks used to manipulate shoppers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {patterns.map((pattern) => (
            <Card key={pattern.id} className={`border ${pattern.borderColor} overflow-hidden`}>
              <div className={`h-2 w-full ${pattern.bgColor}`} />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${pattern.bgColor} ${pattern.color}`}>
                    <pattern.icon className="h-5 w-5" />
                  </div>
                  {pattern.name}
                </CardTitle>
                <CardDescription className="text-base text-foreground font-medium pt-2">
                  {pattern.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Example</h4>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm border border-border border-dashed italic">
                    "{pattern.example}"
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">How Guardian Fights It</h4>
                  <p className="text-sm">{pattern.howWeFight}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
