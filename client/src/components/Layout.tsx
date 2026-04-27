import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard, FileText, BarChart3, LogOut,
  Menu, X, Bell, Settings, CalendarCheck,
  Brain, Receipt, Plus, ChevronDown, Upload, Building2,
  Sparkles, Wallet,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CopilotDock from "@/components/CopilotDock";

type NavItem = {
  href: string;
  icon: any;
  label: string;
  badge?: number | string;
  adminOnly?: boolean;
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement | null>(null);
  const { fiscalYear, setFiscalYear, fiscalYears, fiscalYearInfos } = useFiscalYear();

  const { data: stats } = trpc.reports.dashboard.useQuery({ fiscalYear });
  const { data: companyData } = trpc.settings.getCompanySettings.useQuery();
  const { data: myOrgs } = trpc.organizations.listMine.useQuery();
  const { data: pendingBank } = trpc.bankImport.getPendingTransactions.useQuery({});
  const { data: allDocs } = trpc.documents.list.useQuery({ fiscalYear });

  const utils = trpc.useUtils();
  const switchOrg = trpc.organizations.setCurrent.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.href = "/";
    },
  });

  const pendingEntries = stats?.pendingEntries ?? 0;
  const pendingBankTx = pendingBank?.length ?? 0;
  const newDocs = allDocs?.filter(d => d.matchStatus === "unmatched" || !d.matchStatus)?.length ?? 0;
  const totalInbox = pendingEntries + pendingBankTx + newDocs;
  const workflowBadge = newDocs + pendingBankTx;

  const currentOrgName = myOrgs?.find(o => o.isCurrent)?.name ?? companyData?.companyName ?? 'Meine Firma';
  const hasMultipleOrgs = (myOrgs?.length ?? 0) > 1;
  const userInitials = (user?.name ?? "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  // Schliesse Dropdown beim Klick ausserhalb
  useEffect(() => {
    if (!newOpen) return;
    const onClick = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) {
        setNewOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [newOpen]);

  // 5-Bereiche-Navigation: Dashboard / Belege & Bank (Workflow) / Rechnungen / Berichte / Abschluss
  const NAV_ITEMS: NavItem[] = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard", badge: totalInbox > 0 ? totalInbox : undefined },
    { href: "/workflow", icon: Wallet, label: "Belege & Bank", badge: workflowBadge > 0 ? workflowBadge : undefined },
    { href: "/rechnungen", icon: Receipt, label: "Rechnungen" },
    { href: "/berichte", icon: BarChart3, label: "Berichte" },
    { href: "/abschluss", icon: CalendarCheck, label: "Abschluss" },
  ];

  const ADMIN_ITEMS: NavItem[] = [
    { href: "/admin/global-rules", icon: Brain, label: "KI-Regeln", adminOnly: true },
  ];

  const isItemActive = (item: NavItem): boolean => {
    if (item.href === "/") return location === "/";
    if (item.href === "/workflow") {
      return location.startsWith("/workflow") ||
        location.startsWith("/belege") ||
        location.startsWith("/bank") ||
        location.startsWith("/freigaben") ||
        location.startsWith("/documents") ||
        location.startsWith("/journal") ||
        location.startsWith("/bank-import") ||
        location.startsWith("/credit-card");
    }
    if (item.href === "/rechnungen") {
      return location.startsWith("/rechnungen") ||
        location.startsWith("/mahnwesen") ||
        location.startsWith("/zahlungen");
    }
    if (item.href === "/berichte") {
      return location.startsWith("/berichte") || location.startsWith("/reports");
    }
    if (item.href === "/abschluss") {
      return location.startsWith("/abschluss") ||
        location.startsWith("/vat") ||
        location.startsWith("/year-end");
    }
    return location === item.href || location.startsWith(item.href + "/");
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = isItemActive(item);
    return (
      <Link key={item.href} href={item.href}>
        <div
          className={cn("sb-item", isActive && "sb-item--active")}
          onClick={() => setMobileOpen(false)}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--klax-accent)", color: "var(--klax-accent-ink)", minWidth: 18, textAlign: "center" }}
            >
              {typeof item.badge === "number" && item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  const findLabel = (): string => {
    if (location === "/") return "Dashboard";
    if (location.startsWith("/workflow") ||
      location.startsWith("/belege") ||
      location.startsWith("/bank") ||
      location.startsWith("/freigaben") ||
      location.startsWith("/journal") ||
      location.startsWith("/bank-import") ||
      location.startsWith("/credit-card") ||
      location.startsWith("/documents")) return "Belege & Bank";
    if (location.startsWith("/rechnungen") || location.startsWith("/mahnwesen") || location.startsWith("/zahlungen")) return "Rechnungen";
    if (location.startsWith("/berichte") || location.startsWith("/reports")) return "Berichte";
    if (location.startsWith("/abschluss") || location.startsWith("/vat") || location.startsWith("/year-end")) return "Abschluss";
    if (location.startsWith("/settings") || location.startsWith("/einstellungen")) return "Einstellungen";
    if (location.startsWith("/admin")) return "Admin";
    if (location.startsWith("/accounts")) return "Kontenplan";
    return "KLAX";
  };

  // "+ Neu"-Dropdown Aktionen
  const newActions: { label: string; icon: any; onClick: () => void }[] = [
    {
      label: "Beleg hochladen",
      icon: Upload,
      onClick: () => { setNewOpen(false); setLocation("/workflow?action=upload"); },
    },
    {
      label: "Bank importieren",
      icon: Building2,
      onClick: () => { setNewOpen(false); setLocation("/workflow?action=bank-import"); },
    },
    {
      label: "KI-Auto-Match",
      icon: Sparkles,
      onClick: () => { setNewOpen(false); setLocation("/workflow?action=ai-match"); },
    },
    {
      label: "Rechnung erstellen",
      icon: Receipt,
      onClick: () => { setNewOpen(false); setLocation("/rechnungen/neu"); },
    },
  ];

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{
          width: 232,
          background: "var(--paper)",
          borderRight: "1px solid var(--hair)",
        }}
      >
        {/* Brand / Org */}
        <div
          className="flex items-center gap-2.5 px-4 py-4"
          style={{ borderBottom: "1px solid var(--hair)" }}
        >
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
          >
            <span className="font-semibold text-[13px] tracking-wide">K</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
              KLAX
            </div>
            <div className="text-[10.5px] tracking-wider uppercase" style={{ color: "var(--ink-4)" }}>
              Buchhaltung
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded"
            style={{ color: "var(--ink-3)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav: 5 Hauptbereiche */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map(renderNavItem)}

          {user?.role === "admin" && (
            <div className="pt-4">
              <div className="sb-group">Admin</div>
              {ADMIN_ITEMS.filter(i => !i.adminOnly || user?.role === "admin").map(renderNavItem)}
              <Link href="/accounts">
                <div className={cn("sb-item", location.startsWith("/accounts") && "sb-item--active")}>
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">Kontenplan</span>
                </div>
              </Link>
            </div>
          )}
        </nav>

        {/* Settings link */}
        <div className="px-3 pt-2" style={{ borderTop: "1px solid var(--hair)" }}>
          <Link href="/settings">
            <div className={cn("sb-item", (location.startsWith("/settings") || location.startsWith("/einstellungen")) && "sb-item--active")}>
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">Einstellungen</span>
            </div>
          </Link>
        </div>

        {/* User + Org section */}
        <div className="px-3 py-3">
          <div
            className="flex items-center gap-2.5 rounded-md px-2 py-2 mb-1"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
              style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              {hasMultipleOrgs ? (
                <Select
                  value={String(myOrgs?.find(o => o.isCurrent)?.id ?? "")}
                  onValueChange={(v) => switchOrg.mutate({ organizationId: parseInt(v) })}
                >
                  <SelectTrigger
                    className="h-auto min-h-0 px-0 py-0 border-0 bg-transparent hover:opacity-80 shadow-none focus:ring-0"
                    style={{ color: "var(--ink)" }}
                  >
                    <SelectValue>
                      <span className="text-[12px] font-medium truncate block">{currentOrgName}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {myOrgs?.map(org => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name} {org.role !== "viewer" ? `(${org.role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-[12px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {currentOrgName}
                </div>
              )}
              <div className="text-[10.5px] truncate" style={{ color: "var(--ink-3)" }}>
                GJ {fiscalYear} · {user?.name ?? ""}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[12px]"
            style={{ color: "var(--ink-3)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center gap-3 px-4 lg:px-6 py-2.5 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--hair)", background: "var(--surface)" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-md"
            style={{ color: "var(--ink-3)" }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-[14px] font-semibold truncate" style={{ color: "var(--ink)" }}>
              {findLabel()}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* "+ Neu"-Dropdown */}
            <div className="relative" ref={newDropdownRef}>
              <button
                onClick={() => setNewOpen(o => !o)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium"
                style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)", boxShadow: "var(--shadow-1)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Neu</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
              {newOpen && (
                <div
                  className="absolute right-0 mt-1.5 w-56 rounded-md py-1 z-40"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--hair)",
                    boxShadow: "var(--shadow-2)",
                  }}
                >
                  {newActions.map(a => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12.5px] text-left"
                      style={{ color: "var(--ink)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <a.icon className="h-3.5 w-3.5" style={{ color: "var(--ink-3)" }} />
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Select value={String(fiscalYear)} onValueChange={v => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map(y => {
                  const info = fiscalYearInfos?.find(fi => fi.year === y);
                  const closed = info?.isClosed ?? false;
                  return (
                    <SelectItem key={y} value={String(y)}>
                      GJ {y}{closed ? " 🔒" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {totalInbox > 0 && (
              <Link href="/">
                <div
                  className="relative cursor-pointer p-1.5 rounded-md"
                  style={{ color: "var(--ink-3)" }}
                >
                  <Bell className="h-4 w-4" />
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-semibold"
                    style={{ backgroundColor: "var(--neg)", color: "white" }}
                  >
                    {totalInbox > 9 ? "9+" : totalInbox}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: "var(--paper)" }}>
          {children}
        </main>

        <CopilotDock />
      </div>
    </div>
  );
}
