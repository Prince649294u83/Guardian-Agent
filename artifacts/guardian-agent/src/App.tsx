import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import TrustRatings from "@/pages/trust/index";
import DomainDetail from "@/pages/trust/detail";
import Reports from "@/pages/reports/index";
import ReportDetail from "@/pages/reports/detail";
import Patterns from "@/pages/patterns";
import Stats from "@/pages/stats";
import Demo from "@/pages/demo";
import FeeCalc from "@/pages/feecalc";
import Extension from "@/pages/extension";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/demo" component={Demo} />
      <Route path="/extension" component={Extension} />
      <Route path="/fee-calculator" component={FeeCalc} />
      <Route path="/trust" component={TrustRatings} />
      <Route path="/trust/:domain" component={DomainDetail} />
      <Route path="/reports" component={Reports} />
      <Route path="/reports/:id" component={ReportDetail} />
      <Route path="/patterns" component={Patterns} />
      <Route path="/stats" component={Stats} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
