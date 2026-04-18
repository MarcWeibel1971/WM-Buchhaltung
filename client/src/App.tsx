import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
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
import Inbox from "./pages/Inbox";
import Belege from "./pages/Belege";
import Bank from "./pages/Bank";
import Freigaben from "./pages/Freigaben";
import Berichte from "./pages/Berichte";
import Journal from "./pages/Journal";
import BankImport from "./pages/BankImport";
import CreditCard from "./pages/CreditCard";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import VatPage from "./pages/Vat";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import Settings from "./pages/Settings";
import YearEnd from "./pages/YearEnd";
import QrBillGenerator from "./pages/QrBillGenerator";
import Kreditoren from "./pages/Kreditoren";
import TimeTracking from "./pages/TimeTracking";
import Onboarding from "./pages/Onboarding";
import Invoices from "./pages/Invoices";
import OpenPositions from "./pages/OpenPositions";
import GlobalRules from "./pages/GlobalRules";
import Layout from "./components/Layout";
import AvatarChatWidget from "./components/AvatarChatWidget";
import Accounts from "./pages/Accounts";

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
    return <Redirect to="/landing" />;
  }

  return <>{children}</>;
}

/**
 * OrgGuard: Stellt sicher, dass der eingeloggte User eine aktive
 * Organisation hat. Falls nicht, wird die Onboarding-Seite angezeigt.
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
 * 
 * Neue Informationsarchitektur:
 * - /inbox → Zentrale Aufgabenübersicht
 * - /belege → Belege (= Documents)
 * - /bank → Banktransaktionen (= BankImport + CreditCard)
 * - /freigaben → Freigaben (= Journal mit pending-Filter)
 * - /berichte → Berichte (= Reports)
 * - /rechnungen → Ausgangsrechnungen
 * - /mahnwesen → Mahnwesen
 * - /vat → MWST
 * - /year-end → Jahresabschluss
 * - /settings → Einstellungen
 * - /admin/* → Admin-Bereich
 * 
 * Alte Pfade werden per Redirect auf neue Pfade umgeleitet.
 */
function AppRouter() {
  return (
    <Switch>
      {/* Neue Hauptrouten */}
      <Route path="/" component={Dashboard} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/belege" component={Belege} />
      <Route path="/bank" component={Bank} />
      <Route path="/freigaben" component={Freigaben} />
      <Route path="/berichte" component={Berichte} />
      <Route path="/rechnungen" component={Invoices} />
      <Route path="/mahnwesen" component={OpenPositions} />
      <Route path="/vat" component={VatPage} />
      <Route path="/year-end" component={YearEnd} />
      <Route path="/settings" component={Settings} />
      <Route path="/einstellungen" component={Settings} />
      <Route path="/einstellungen/:tab" component={Settings} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/admin/global-rules" component={GlobalRules} />

      {/* Bestehende Detail-Routen */}
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/zahlungen/debitoren" component={QrBillGenerator} />
      <Route path="/zahlungen/kreditoren" component={Kreditoren} />
      <Route path="/time-tracking" component={TimeTracking} />
      <Route path="/payroll" component={Payroll} />

      {/* Redirects: Alte Pfade → Neue Pfade */}
      <Route path="/journal">{() => { window.location.replace("/freigaben"); return null; }}</Route>
      <Route path="/bank-import">{() => { window.location.replace("/bank"); return null; }}</Route>
      <Route path="/credit-card">{() => { window.location.replace("/bank"); return null; }}</Route>
      <Route path="/documents">{() => { window.location.replace("/belege"); return null; }}</Route>
      <Route path="/reports">{() => { window.location.replace("/berichte"); return null; }}</Route>
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
          <AvatarChatWidget />
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
            <Route component={ProtectedApp} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
