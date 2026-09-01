import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { FiscalYearProvider } from "./contexts/FiscalYearContext";
import { useAuth } from "./_core/hooks/useAuth";
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
import Workflow from "./pages/Workflow";
import Berichte from "./pages/Berichte";
import Payroll from "./pages/Payroll";
import VatPage from "./pages/Vat";
import DocumentDetail from "./pages/DocumentDetail";
import Settings from "./pages/Settings";
import YearEnd from "./pages/YearEnd";
import QrBillGenerator from "./pages/QrBillGenerator";
import Kreditoren from "./pages/Kreditoren";
import TimeTracking from "./pages/TimeTracking";
import Onboarding from "./pages/Onboarding";
import Invoices from "./pages/Invoices";
import OpenPositions from "./pages/OpenPositions";
import Layout from "./components/Layout";
import AvatarChatWidget from "./components/AvatarChatWidget";
import AcceptInvitation from "./pages/AcceptInvitation";
import Admin from "./pages/Admin";
import Journal from "./pages/Journal";
import BankImport from "./pages/BankImport";

/**
 * AuthGuard: Prüft ob der User eingeloggt ist.
 * Falls nicht → Redirect zur Login-Seite.
 */
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

  if (orgs.length === 0) {
    return <Onboarding />;
  }

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

// Wouter-kompatible In-App-Weiterleitung (behält Query-String, falls erwünscht)
function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    // AP3.2: Query-Parameter der Alt-Route an die Ziel-Route durchreichen
    const search = typeof window !== "undefined" ? window.location.search : "";
    setLocation(to + (search && !to.includes("?") ? search : ""), { replace: true } as any);
  }, [to, setLocation]);
  return null;
}

/**
 * Protected app routes – nach Refactoring 5-Bereiche-Navigation:
 * - /            → Dashboard (mit Aufgaben-Hub aus Ex-Inbox)
 * - /workflow    → Belege & Bank Split-View (Workflow)
 * - /rechnungen  → Ausgangsrechnungen
 * - /berichte    → Berichte
 * - /abschluss   → Abschluss (MWST + Jahresabschluss)
 *
 * Alte Pfade werden auf neue Pfade weitergeleitet.
 */
function AppRouter() {
  return (
    <Switch>
      {/* Hauptrouten */}
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/belege-bank" component={Workflow} />
      <Route path="/workflow">{() => <RedirectTo to="/belege-bank" />}</Route>
      <Route path="/rechnungen" component={Invoices} />
      <Route path="/mahnwesen" component={OpenPositions} />
      <Route path="/berichte" component={Berichte} />
      <Route path="/mwst" component={VatPage} />
      <Route path="/abschluss">{() => <RedirectTo to="/mwst" />}</Route>
      <Route path="/vat">{() => <RedirectTo to="/mwst" />}</Route>
      <Route path="/jahresabschluss" component={YearEnd} />
      <Route path="/year-end">{() => <RedirectTo to="/jahresabschluss" />}</Route>
      {/* Einstellungen (persönlich/Workspace) – Tabs via ?tab=… */}
      <Route path="/einstellungen">{() => <Settings />}</Route>
      <Route path="/settings">{() => <Settings />}</Route>

      {/* Admin (organisationsweit) – Tabs via ?tab=… */}
      <Route path="/admin" component={Admin} />

      {/* Detail-Routen */}
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/rechnungen/neu" component={QrBillGenerator} />
      <Route path="/zahlungen/debitoren">{() => <RedirectTo to="/rechnungen/neu" />}</Route>
      <Route path="/zahlungen/kreditoren" component={Kreditoren} />
      <Route path="/zeiterfassung" component={TimeTracking} />
      <Route path="/time-tracking">{() => <RedirectTo to="/zeiterfassung" />}</Route>
      <Route path="/payroll" component={Payroll} />

      {/* Redirects: Alte Pfade → Neue Pfade */}
      <Route path="/inbox">{() => <RedirectTo to="/" />}</Route>
      <Route path="/belege">{() => <RedirectTo to="/belege-bank" />}</Route>
      <Route path="/bank">{() => <RedirectTo to="/belege-bank" />}</Route>
      <Route path="/freigaben">{() => <RedirectTo to="/journal" />}</Route>
      <Route path="/documents">{() => <RedirectTo to="/belege-bank" />}</Route>
      <Route path="/journal" component={Journal} />
      <Route path="/bank-import" component={BankImport} />
      <Route path="/credit-card">{() => <RedirectTo to="/bank-import" />}</Route>
      <Route path="/reports">{() => <RedirectTo to="/berichte" />}</Route>
      <Route path="/zahlungen">{() => <RedirectTo to="/rechnungen/neu" />}</Route>
      <Route path="/qr-rechnung">{() => <RedirectTo to="/rechnungen/neu" />}</Route>

      {/* Redirects: alte Admin/Settings-Pfade → neue Tab-URLs */}
      <Route path="/admin/global-rules">{() => <RedirectTo to="/admin?tab=globalRules" />}</Route>
      <Route path="/admin/users">{() => <RedirectTo to="/admin?tab=users" />}</Route>
      <Route path="/admin/benutzer">{() => <RedirectTo to="/admin?tab=users" />}</Route>
      <Route path="/admin/kontenplan">{() => <RedirectTo to="/admin?tab=chartOfAccounts" />}</Route>
      <Route path="/admin/buchungsregeln">{() => <RedirectTo to="/admin?tab=rules" />}</Route>
      <Route path="/admin/audit">{() => <RedirectTo to="/admin?tab=dsg" />}</Route>
      <Route path="/admin/abonnement">{() => <RedirectTo to="/admin?tab=subscription" />}</Route>
      <Route path="/accounts">{() => <RedirectTo to="/admin?tab=chartOfAccounts" />}</Route>
      <Route path="/einstellungen/:tab">
        {(params: { tab: string }) => <RedirectTo to={`/einstellungen?tab=${params.tab}`} />}
      </Route>
      <Route path="/settings/:tab">
        {(params: { tab: string }) => <RedirectTo to={`/einstellungen?tab=${params.tab}`} />}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

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
            {/* Public routes */}
            <Route path="/landing" component={LandingPage} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/verify-email" component={VerifyEmail} />
            <Route path="/einladung/:token" component={AcceptInvitation} />

            {/* Protected routes */}
            <Route component={ProtectedApp} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
