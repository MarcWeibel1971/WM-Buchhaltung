import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard, Inbox, FileText, Building2, CheckSquare,
  Receipt, BarChart3, LogOut, ChevronRight, ChevronDown,
  Menu, X, Bell, Settings, CalendarCheck, Clock,
  Brain, ShieldCheck, Upload, Sparkles, Search, Eye,
  Link2, Archive, CreditCard, ArrowLeftRight, Wallet,
  AlertTriangle, Users, BookOpen, PieChart, List,
  FileCheck, AlertCircle, CheckCircle, Banknote
} from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NavItem = {
  href: string;
  icon: any;
  label: string;
  badge?: number | string;
  children?: NavItem[];
  adminOnly?: boolean;
  separator?: boolean;
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { fiscalYear, setFiscalYear, fiscalYears, fiscalYearInfos } = useFiscalYear();

  // Queries for badge counts
  const { data: stats } = trpc.reports.dashboard.useQuery({ fiscalYear });
  const { data: companyData } = trpc.settings.getCompanySettings.useQuery();
  const { data: myOrgs } = trpc.organizations.listMine.useQuery();
  const { data: pendingBank } = trpc.bankImport.getPendingTransactions.useQuery({});
  const { data: pendingJournal } = trpc.journal.list.useQuery({ status: "pending", limit: 1 });
  const { data: allDocs } = trpc.documents.list.useQuery({ fiscalYear });

  const utils = trpc.useUtils();
  const switchOrg = trpc.organizations.setCurrent.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.href = "/";
    },
  });

  // Compute badge counts
  const pendingEntries = stats?.pendingEntries ?? 0;
  const pendingBankTx = pendingBank?.length ?? 0;
  const unmatchedBankTx = pendingBank?.filter(tx => !tx.matchedDocumentId)?.length ?? 0;
  const newDocs = allDocs?.filter(d => d.matchStatus === "unmatched" || !d.matchStatus)?.length ?? 0;
  const totalInbox = pendingEntries + pendingBankTx + newDocs;

  const currentOrgName = myOrgs?.find(o => o.isCurrent)?.name ?? companyData?.companyName ?? 'Meine Firma';
  const hasMultipleOrgs = (myOrgs?.length ?? 0) > 1;

  // Auto-expand sections based on current route
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Auto-expand the section containing the current route
    const sectionPrefixes: Record<string, string[]> = {
      "/belege": ["/belege", "/documents"],
      "/bank": ["/bank", "/bank-import", "/credit-card"],
      "/freigaben": ["/freigaben", "/journal"],
      "/rechnungen": ["/rechnungen", "/mahnwesen", "/zahlungen"],
      "/berichte": ["/berichte", "/reports"],
      "/abschluss": ["/abschluss", "/vat", "/year-end"],
      "/einstellungen": ["/einstellungen", "/settings"],
      "/admin": ["/admin"],
    };
    for (const [section, prefixes] of Object.entries(sectionPrefixes)) {
      if (prefixes.some(p => location.startsWith(p))) {
        initial.add(section);
      }
    }
    return initial;
  });

  // Update expanded sections when location changes
  useEffect(() => {
    const sectionPrefixes: Record<string, string[]> = {
      "/belege": ["/belege", "/documents"],
      "/bank": ["/bank", "/bank-import", "/credit-card"],
      "/freigaben": ["/freigaben", "/journal"],
      "/rechnungen": ["/rechnungen", "/mahnwesen", "/zahlungen"],
      "/berichte": ["/berichte", "/reports"],
      "/abschluss": ["/abschluss", "/vat", "/year-end"],
      "/einstellungen": ["/einstellungen", "/settings"],
      "/admin": ["/admin"],
    };
    setExpandedSections(prev => {
      const next = new Set(prev);
      for (const [section, prefixes] of Object.entries(sectionPrefixes)) {
        if (prefixes.some(p => location.startsWith(p))) {
          next.add(section);
        }
      }
      return next;
    });
  }, [location]);

  const NAV_ITEMS: NavItem[] = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/inbox", icon: Inbox, label: "Inbox", badge: totalInbox > 0 ? totalInbox : undefined },
    { href: "/belege", icon: FileText, label: "Belege", separator: true, badge: newDocs > 0 ? newDocs : undefined },
    { href: "/bank", icon: Building2, label: "Bank", badge: pendingBankTx > 0 ? pendingBankTx : undefined },
    { href: "/freigaben", icon: CheckSquare, label: "Freigaben", badge: pendingEntries > 0 ? pendingEntries : undefined },
    { href: "/rechnungen", icon: Receipt, label: "Rechnungen", separator: true, children: [
      { href: "/rechnungen", icon: FileText, label: "Ausgangsrechnungen" },
      { href: "/rechnungen?tab=open", icon: Clock, label: "Offene Forderungen" },
      { href: "/rechnungen?tab=payments", icon: Banknote, label: "Zahlungseingänge" },
      { href: "/mahnwesen", icon: AlertTriangle, label: "Mahnwesen" },
      { href: "/rechnungen?tab=customers", icon: Users, label: "Kunden" },
    ]},
    { href: "/berichte", icon: BarChart3, label: "Berichte", children: [
      { href: "/berichte?view=income", icon: PieChart, label: "Erfolgsrechnung" },
      { href: "/berichte?view=balance", icon: BarChart3, label: "Bilanz" },
      { href: "/berichte?view=accounts", icon: BookOpen, label: "Kontoblätter" },
      { href: "/berichte?view=journal", icon: List, label: "Journal" },
    ]},
    { href: "/abschluss", icon: CalendarCheck, label: "Abschluss & MWST", separator: true, children: [
      { href: "/vat", icon: Receipt, label: "MWST" },
      { href: "/year-end", icon: CalendarCheck, label: "Jahresabschluss" },
    ]},
    { href: "/einstellungen", icon: Settings, label: "Einstellungen", children: [
      { href: "/settings", icon: Settings, label: "Firma & Konten" },
      { href: "/settings?tab=users", icon: Users, label: "Benutzer" },
    ]},
    { href: "/admin", icon: Brain, label: "Admin", adminOnly: true, children: [
      { href: "/admin/global-rules", icon: Brain, label: "KI-Regeln" },
    ]},
  ];

  const toggleSection = (href: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      return next;
    });
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.children) {
      return item.children.some(child => {
        const baseHref = child.href.split("?")[0];
        return location === baseHref || location.startsWith(baseHref + "/") ||
          (child.href.includes("?") && location + window.location.search === child.href);
      });
    }
    return location === item.href || (item.href !== "/" && location.startsWith(item.href));
  };

  const isChildActive = (child: NavItem): boolean => {
    const baseHref = child.href.split("?")[0];
    // Exact match for base routes
    if (!child.href.includes("?")) {
      return location === baseHref;
    }
    // For query-filtered routes, check if current URL matches
    return location === baseHref && window.location.search === "?" + child.href.split("?")[1];
  };

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isActive = isItemActive(item);
    const isExpanded = expandedSections.has(item.href);

    if (hasChildren) {
      return (
        <div key={item.href}>
          {item.separator && <div className="my-2 mx-3 border-t" style={{ borderColor: "oklch(0.25 0.03 240)" }} />}
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
            )}
            style={{
              backgroundColor: isActive && !isExpanded ? "oklch(0.25 0.08 240)" : "transparent",
              color: isActive ? "oklch(0.88 0.01 240)" : "oklch(0.60 0.03 240)",
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.24 0.04 240)";
            }}
            onMouseLeave={e => {
              if (!isActive || isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
            onClick={() => toggleSection(item.href)}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-[13px]">{item.label}</span>
            {item.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: "oklch(0.55 0.22 25)", color: "white", minWidth: "18px", textAlign: "center" }}>
                {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 opacity-50" />
            ) : (
              <ChevronRight className="h-3 w-3 opacity-50" />
            )}
          </div>
          {isExpanded && (
            <div className="ml-4 mt-0.5 space-y-0.5">
              {item.children!.map(child => {
                const childActive = isChildActive(child);
                return (
                  <Link key={child.href} href={child.href}>
                    <div
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] transition-all cursor-pointer"
                      )}
                      style={{
                        backgroundColor: childActive ? "oklch(0.30 0.10 240)" : "transparent",
                        color: childActive ? "white" : "oklch(0.52 0.03 240)",
                        fontWeight: childActive ? 600 : 400,
                      }}
                      onMouseEnter={e => {
                        if (!childActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.22 0.04 240)";
                          (e.currentTarget as HTMLElement).style.color = "oklch(0.75 0.03 240)";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!childActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "oklch(0.52 0.03 240)";
                        }
                      }}
                      onClick={() => setMobileOpen(false)}
                    >
                      <child.icon className="h-3 w-3 flex-shrink-0 opacity-70" />
                      <span>{child.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Top-level items without children (Dashboard, Inbox)
    return (
      <Link key={item.href} href={item.href}>
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
          )}
          style={{
            backgroundColor: isActive ? "oklch(0.30 0.10 240)" : "transparent",
            color: isActive ? "white" : "oklch(0.60 0.03 240)",
          }}
          onMouseEnter={e => {
            if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.24 0.04 240)";
          }}
          onMouseLeave={e => {
            if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }}
          onClick={() => setMobileOpen(false)}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 text-[13px]">{item.label}</span>
          {item.badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ backgroundColor: "oklch(0.55 0.22 25)", color: "white", minWidth: "18px", textAlign: "center" }}>
              {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
          {isActive && <ChevronRight className="h-3 w-3 opacity-50" />}
        </div>
      </Link>
    );
  };

  // Find current page label for header
  const findLabel = (items: NavItem[]): string => {
    for (const item of items) {
      if (item.children) {
        for (const child of item.children) {
          const baseHref = child.href.split("?")[0];
          if (location === baseHref || location.startsWith(baseHref + "/")) return child.label;
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
        "fixed inset-y-0 left-0 z-30 w-60 flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ backgroundColor: "oklch(0.16 0.02 240)", borderRight: "1px solid oklch(0.24 0.03 240)" }}>

        {/* Logo + Org-Switcher */}
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: "oklch(0.24 0.03 240)" }}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {companyData?.logoUrl && (
              <img src={companyData.logoUrl} alt="Logo" className="h-7 w-auto object-contain flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              {hasMultipleOrgs ? (
                <Select
                  value={String(myOrgs?.find(o => o.isCurrent)?.id ?? "")}
                  onValueChange={(v) => switchOrg.mutate({ organizationId: parseInt(v) })}
                >
                  <SelectTrigger
                    className="h-auto min-h-0 px-0 py-0 border-0 bg-transparent hover:opacity-80 shadow-none focus:ring-0"
                    style={{ color: "oklch(0.92 0.01 240)" }}
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
                <div className="text-sm font-bold truncate" style={{ color: "oklch(0.92 0.01 240)" }}>
                  {currentOrgName}
                </div>
              )}
              <div className="text-[10px] font-medium mt-0.5 tracking-wider" style={{ color: "oklch(0.45 0.02 240)" }}>KLAX</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded flex-shrink-0"
            style={{ color: "oklch(0.50 0.02 240)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS
            .filter(item => !item.adminOnly || user?.role === "admin")
            .map(item => renderNavItem(item))}
        </nav>

        {/* User section */}
        <div className="px-2 py-3 border-t" style={{ borderColor: "oklch(0.24 0.03 240)" }}>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1"
            style={{ backgroundColor: "oklch(0.20 0.03 240)" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: "oklch(0.35 0.12 240)", color: "white" }}>
              {user?.name?.charAt(0) ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium truncate" style={{ color: "oklch(0.85 0.01 240)" }}>
                {user?.name ?? "Benutzer"}
              </div>
              <div className="text-[10px] truncate" style={{ color: "oklch(0.48 0.02 240)" }}>
                {user?.email ?? ""}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-[12px] transition-colors"
            style={{ color: "oklch(0.48 0.02 240)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "oklch(0.85 0.01 240)"; (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.22 0.03 240)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "oklch(0.48 0.02 240)"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-4 lg:px-6 py-2.5 border-b border-border bg-card flex-shrink-0">
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
              <Link href="/inbox">
                <div className="relative cursor-pointer p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
                    style={{ backgroundColor: "oklch(0.55 0.22 25)", color: "white" }}>
                    {totalInbox > 9 ? "9+" : totalInbox}
                  </span>
                </div>
              </Link>
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
