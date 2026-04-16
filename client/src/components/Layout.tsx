import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard, BookOpen, Building2, CreditCard,
  Users, BarChart3, Receipt, LogOut, ChevronRight, ChevronDown,
  Menu, X, Bell, Paperclip, Settings, CalendarCheck, QrCode, Banknote, Wallet, Clock, FileText
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NavItem = {
  href: string;
  icon: any;
  label: string;
  children?: NavItem[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/journal", icon: BookOpen, label: "Journal" },
  {
    href: "/zahlungen", icon: Wallet, label: "Zahlungen",
    children: [
      { href: "/rechnungen", icon: FileText, label: "Rechnungen" },
      { href: "/zahlungen/debitoren", icon: QrCode, label: "QR-Einzahlung" },
      { href: "/zahlungen/kreditoren", icon: Banknote, label: "Kreditoren" },
    ],
  },
  { href: "/bank-import", icon: Building2, label: "Bankimport" },
  { href: "/credit-card", icon: CreditCard, label: "Kreditkarte" },
  { href: "/payroll", icon: Users, label: "Lohnbuchhaltung" },
  { href: "/vat", icon: Receipt, label: "MWST" },
  { href: "/reports", icon: BarChart3, label: "Berichte" },
  { href: "/documents", icon: Paperclip, label: "Dokumente" },
  { href: "/year-end", icon: CalendarCheck, label: "Jahresabschluss" },
  { href: "/time-tracking", icon: Clock, label: "Zeiterfassung" },
  { href: "/settings", icon: Settings, label: "Einstellungen" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { fiscalYear, setFiscalYear, fiscalYears } = useFiscalYear();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Auto-expand Zahlungen if we're on a Zahlungen sub-page
    const initial = new Set<string>();
    if (location.startsWith("/zahlungen")) initial.add("/zahlungen");
    return initial;
  });

  const { data: stats } = trpc.reports.dashboard.useQuery({ fiscalYear });
  const { data: companyData } = trpc.settings.getCompanySettings.useQuery();
  const { data: myOrgs } = trpc.organizations.listMine.useQuery();
  const utils = trpc.useUtils();
  const switchOrg = trpc.organizations.setCurrent.useMutation({
    onSuccess: async () => {
      // Nach Org-Wechsel komplette App neu laden, damit alle Queries frisch sind.
      await utils.invalidate();
      window.location.href = "/";
    },
  });

  const pendingCount = (stats?.pendingEntries ?? 0) + (stats?.pendingBankTransactions ?? 0);
  const currentOrgName = myOrgs?.find(o => o.isCurrent)?.name ?? companyData?.companyName ?? 'Meine Firma';
  const hasMultipleOrgs = (myOrgs?.length ?? 0) > 1;

  const toggleSection = (href: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      return next;
    });
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.children) {
      return item.children.some(child => location === child.href || location.startsWith(child.href + "/"));
    }
    return location === item.href || (item.href !== "/" && location.startsWith(item.href));
  };

  // Ensure Zahlungen is expanded when navigating to a sub-page
  if (location.startsWith("/zahlungen") && !expandedSections.has("/zahlungen")) {
    setExpandedSections(prev => { const next = new Set(prev); next.add("/zahlungen"); return next; });
  }

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isActive = isItemActive(item);
    const isExpanded = expandedSections.has(item.href);

    if (hasChildren) {
      return (
        <div key={item.href}>
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
              isActive ? "text-white" : ""
            )}
            style={{
              backgroundColor: isActive && !isExpanded ? "oklch(0.35 0.12 240)" : "transparent",
              color: isActive ? "oklch(0.88 0.01 240)" : "oklch(0.65 0.03 240)",
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.28 0.04 240)";
            }}
            onMouseLeave={e => {
              if (!isActive || isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
            onClick={() => toggleSection(item.href)}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 opacity-60" />
            ) : (
              <ChevronRight className="h-3 w-3 opacity-60" />
            )}
          </div>
          {isExpanded && (
            <div className="ml-4 mt-0.5 space-y-0.5">
              {item.children!.map(child => {
                const childActive = location === child.href || location.startsWith(child.href + "/");
                return (
                  <Link key={child.href} href={child.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
                        childActive ? "text-white font-medium" : ""
                      )}
                      style={{
                        backgroundColor: childActive ? "oklch(0.35 0.12 240)" : "transparent",
                        color: childActive ? "white" : "oklch(0.55 0.03 240)",
                      }}
                      onMouseEnter={e => {
                        if (!childActive) (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.25 0.04 240)";
                      }}
                      onMouseLeave={e => {
                        if (!childActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                      }}
                      onClick={() => setMobileOpen(false)}
                    >
                      <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{child.label}</span>
                      {childActive && <ChevronRight className="h-3 w-3 opacity-60 ml-auto" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link key={item.href} href={item.href}>
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group",
            isActive ? "text-white" : "hover:text-white"
          )}
          style={{
            backgroundColor: isActive ? "oklch(0.35 0.12 240)" : "transparent",
            color: isActive ? "white" : "oklch(0.65 0.03 240)",
          }}
          onMouseEnter={e => {
            if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.28 0.04 240)";
          }}
          onMouseLeave={e => {
            if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }}
          onClick={() => setMobileOpen(false)}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{item.label}</span>
          {item.href === "/journal" && pendingCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: "oklch(0.75 0.18 75)", color: "oklch(0.15 0.02 240)" }}>
              {pendingCount}
            </span>
          )}
          {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
        </div>
      </Link>
    );
  };

  // Find current page label for header
  const findLabel = (items: NavItem[]): string => {
    for (const item of items) {
      if (item.children) {
        for (const child of item.children) {
          if (location === child.href || location.startsWith(child.href + "/")) return child.label;
        }
      }
      if (location === item.href || (item.href !== "/" && location.startsWith(item.href))) return item.label;
    }
    return "Dashboard";
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ backgroundColor: "oklch(0.18 0.03 240)", borderRight: "1px solid oklch(0.28 0.04 240)" }}>

        {/* Logo + Org-Switcher */}
        <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: "oklch(0.28 0.04 240)" }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {companyData?.logoUrl && (
              <img src={companyData.logoUrl} alt="Logo" className="h-8 w-auto object-contain flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              {hasMultipleOrgs ? (
                <Select
                  value={String(myOrgs?.find(o => o.isCurrent)?.id ?? "")}
                  onValueChange={(v) => switchOrg.mutate({ organizationId: parseInt(v) })}
                >
                  <SelectTrigger
                    className="h-auto min-h-0 px-0 py-0 border-0 bg-transparent hover:opacity-80 shadow-none focus:ring-0"
                    style={{ color: "oklch(0.95 0.01 240)" }}
                  >
                    <SelectValue>
                      <span className="text-sm font-bold truncate block">{currentOrgName}</span>
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
                <div className="text-sm font-bold truncate" style={{ color: "oklch(0.95 0.01 240)" }}>
                  {currentOrgName}
                </div>
              )}
              <div className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.02 240)" }}>Buchhaltung</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded flex-shrink-0"
            style={{ color: "oklch(0.55 0.02 240)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => renderNavItem(item))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "oklch(0.28 0.04 240)" }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1"
            style={{ backgroundColor: "oklch(0.23 0.04 240)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: "oklch(0.35 0.12 240)", color: "white" }}>
              {user?.name?.charAt(0) ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: "oklch(0.88 0.01 240)" }}>
                {user?.name ?? "Benutzer"}
              </div>
              <div className="text-xs truncate" style={{ color: "oklch(0.55 0.02 240)" }}>
                {user?.email ?? ""}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "oklch(0.55 0.02 240)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "oklch(0.88 0.01 240)"; (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.28 0.04 240)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "oklch(0.55 0.02 240)"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <LogOut className="h-4 w-4" />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-4 lg:px-6 py-3 border-b border-border bg-card flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground">
              {findLabel(NAV_ITEMS)}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Select value={String(fiscalYear)} onValueChange={v => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map(y => (
                  <SelectItem key={y} value={String(y)}>GJ {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pendingCount > 0 && (
              <div className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ backgroundColor: "oklch(0.55 0.22 25)", color: "white" }}>
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
