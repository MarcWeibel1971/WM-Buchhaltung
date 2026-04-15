import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { FiscalYearProvider } from "./contexts/FiscalYearContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

// Pages – Auth (public)
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import LandingPage from "./pages/LandingPage";

// Pages – App (protected)
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import BankImport from "./pages/BankImport";
import CreditCard from "./pages/CreditCard";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import VatPage from "./pages/Vat";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import YearEnd from "./pages/YearEnd";
import QrBillGenerator from "./pages/QrBillGenerator";
import Kreditoren from "./pages/Kreditoren";
import TimeTracking from "./pages/TimeTracking";
import Onboarding from "./pages/Onboarding";
import Layout from "./components/Layout";

/**
 * AuthGuard: Prüft ob der User eingeloggt ist.
 * Falls nicht → Redirect zur Login-Seite (statt Manus OAuth).
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

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
    // Redirect to login page
    window.location.href = "/login";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Weiterleitung zur Anmeldung...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Phase 1c OrgGuard: Stellt sicher, dass der eingeloggte User eine aktive
 * Organisation hat. Falls nicht, wird die Onboarding-Seite angezeigt, auf der
 * der User eine neue Firma anlegen kann.
 */
function OrgGuard({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const orgsQuery = trpc.organizations.listMine.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const setCurrent = trpc.organizations.setCurrent.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  if (orgsQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Organisation wird geladen...</p>
        </div>
      </div>
    );
  }

  const orgs = orgsQuery.data ?? [];

  // Kein Mitglied in einer Org → Onboarding
  if (orgs.length === 0) {
    return <Onboarding />;
  }

  // Mitglied, aber keine aktuelle Org → erste verfügbare aktivieren
  const hasCurrent = orgs.some((o) => o.isCurrent);
  if (!hasCurrent) {
    if (!setCurrent.isPending && !setCurrent.isSuccess) {
      setCurrent.mutate({ organizationId: orgs[0].id });
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Organisation wird aktiviert...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Protected app routes – only accessible after login + org selection
 */
function AppRouter() {
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

/**
 * ProtectedApp: Wraps the app routes with AuthGuard + OrgGuard + Layout
 */
function ProtectedApp() {
  return (
    <AuthGuard>
      <OrgGuard>
        <FiscalYearProvider>
          <Layout>
            <AppRouter />
          </Layout>
        </FiscalYearProvider>
      </OrgGuard>
    </AuthGuard>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Switch>
            {/* Public routes – no auth required */}
            <Route path="/landing" component={LandingPage} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/verify-email" component={VerifyEmail} />

            {/* Protected routes – auth + org required */}
            <Route path="/:rest*" component={ProtectedApp} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
