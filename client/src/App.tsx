import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { FiscalYearProvider } from "./contexts/FiscalYearContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { Loader2 } from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import BankImport from "./pages/BankImport";
import CreditCard from "./pages/CreditCard";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
// Accounts is now embedded in Reports
import VatPage from "./pages/Vat";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import YearEnd from "./pages/YearEnd";
import QrBillGenerator from "./pages/QrBillGenerator";
import Kreditoren from "./pages/Kreditoren";
import TimeTracking from "./pages/TimeTracking";
import Layout from "./components/Layout";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">WM-Buchhaltung</h1>
            <p className="text-lg font-semibold text-primary mb-1">Schweizer KMU-Buchhaltung</p>
            <p className="text-muted-foreground text-sm">Bitte melden Sie sich an, um fortzufahren.</p>
          </div>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            Anmelden
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/journal" component={Journal} />
      <Route path="/bank-import" component={BankImport} />
      <Route path="/credit-card" component={CreditCard} />
      <Route path="/payroll" component={Payroll} />
      <Route path="/reports" component={Reports} />
      <Route path="/accounts">{() => { window.location.replace("/reports"); return null; }}</Route>
      <Route path="/vat" component={VatPage} />
      <Route path="/documents" component={Documents} />
      <Route path="/settings" component={Settings} />
      <Route path="/year-end" component={YearEnd} />
      <Route path="/zahlungen/debitoren" component={QrBillGenerator} />
      <Route path="/zahlungen/kreditoren" component={Kreditoren} />
      <Route path="/time-tracking" component={TimeTracking} />
      <Route path="/zahlungen">{() => { window.location.replace("/zahlungen/debitoren"); return null; }}</Route>
      <Route path="/qr-rechnung">{() => { window.location.replace("/zahlungen/debitoren"); return null; }}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <AuthGuard>
            <FiscalYearProvider>
              <Layout>
                <Router />
              </Layout>
            </FiscalYearProvider>
          </AuthGuard>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
