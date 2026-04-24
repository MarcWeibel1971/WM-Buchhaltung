import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard, Inbox, FileText, Building2, CheckSquare,
  Receipt, BarChart3, LogOut, ChevronRight, ChevronDown,
  Menu, X, Bell, Settings, CalendarCheck,
  Brain, Users, BookOpen,
  AlertTriangle, Bot, Bolt, Wallet, Clock, Banknote,
  Sparkles, PieChart, List,
} from "lucide-react";
import { useState, useEffect } from "react";
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
  children?: NavItem[];
  adminOnly?: boolean;
};

type NavSection = {
  group?: string;
  items: NavItem[];
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const unmatchedBankTx = pendingBank?.filter(tx => !tx.matchedDocumentId)?.length ?? 0;
  const newDocs = allDocs?.filter(d => d.matchStatus === "unmatched" || !d.matchStatus)?.length ?? 0;
  const totalInbox = pendingEntries + pendingBankTx + newDocs;

  const currentOrgName = myOrgs?.find(o => o.isCurrent)?.name ?? companyData?.companyName ?? 'Meine Firma';
  const hasMultipleOrgs = (myOrgs?.length ?? 0) > 1;
  const userInitials = (user?.name ?? "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  const sectionPrefixes: Record<string, string[]> = {
    "/belege": ["/belege", "/documents"],
    "/bank": ["/bank", "/bank-import", "/credit-card"],
    "/freigaben": ["/freigaben", "/journal"],
    "/rechnungen": ["/rechnungen", "/mahnwesen", "/zahlungen"],
    "/berichte": ["/berichte", "/reports"],
    "/abschluss": ["/abschluss", "/vat", "/year-end"],
    "/einstellungen": ["/einstellungen", "/settings"],
    "/admin": ["/admin"],
    "/accounts": ["/accounts"],
  };

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const [section, prefixes] of Object.entries(sectionPrefixes)) {
      if (prefixes.some(p => location.startsWith(p))) initial.add(section);
    }
    return initial;
  });

  useEffect(() => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      for (const [section, prefixes] of Object.entries(sectionPrefixes)) {
        if (prefixes.some(p => location.startsWith(p))) next.add(section);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const SECTIONS: NavSection[] = [
    {
      items: [
        { href: "/", icon: LayoutDashboard, label: "Dashboard" },
        { href: "/inbox", icon: Inbox, label: "Inbox", badge: totalInbox > 0 ? totalInbox : undefined },
      ],
    },
    {
      group: "Belege",
      items: [
        {
          href: "/belege", icon: FileText, label: "Alle Belege",
          badge: newDocs > 0 ? newDocs : undefined,
          children: [
            { href: "/belege?filter=new", icon: FileText, label: "Neu hochgeladen" },
            { href: "/belege?filter=ai", icon: Sparkles, label: "KI-verarbeitet" },
            { href: "/belege?filter=review", icon: CheckSquare, label: "Zu prüfen" },
          ],
        },
      ],
    },
    {
      group: "Bank & Zahlungen",
      items: [
        {
          href: "/bank", icon: Building2, label: "Banktransaktionen",
          badge: pendingBankTx > 0 ? pendingBankTx : undefined,
          children: [
            { href: "/bank?tab=unmatched", icon: AlertTriangle, label: "Ungematcht" },
            { href: "/bank-import", icon: Wallet, label: "Konten & Karten" },
          ],
        },
        {
          href: "/kreditoren", icon: Banknote, label: "Kreditoren",
          children: [
            { href: "/kreditoren", icon: Clock, label: "Offene Posten" },
          ],
        },
      ],
    },
    {
      group: "Freigaben",
      items: [
        {
          href: "/freigaben", icon: CheckSquare, label: "Bereit zur Freigabe",
          badge: pendingEntries > 0 ? pendingEntries : undefined,
          children: [
            { href: "/freigaben?tab=warnings", icon: AlertTriangle, label: "Mit Warnungen" },
            { href: "/journal", icon: List, label: "Verbucht" },
          ],
        },
      ],
    },
    {
      group: "Rechnungen",
      items: [
        {
          href: "/rechnungen", icon: Receipt, label: "Ausgangsrechnungen",
          children: [
            { href: "/rechnungen?tab=open", icon: Clock, label: "Offene Forderungen" },
            { href: "/mahnwesen", icon: AlertTriangle, label: "Mahnwesen" },
          ],
        },
      ],
    },
    {
      group: "Buchhaltung",
      items: [
        {
          href: "/accounts", icon: BookOpen, label: "Kontenplan",
          children: [
            { href: "/accounts", icon: BookOpen, label: "Kontendetail" },
          ],
        },
      ],
    },
    {
      group: "Berichte",
      items: [
        {
          href: "/berichte", icon: BarChart3, label: "Erfolgsrechnung",
          children: [
            { href: "/berichte?view=balance", icon: BarChart3, label: "Bilanz" },
            { href: "/berichte?view=cashflow", icon: PieChart, label: "Cashflow" },
          ],
        },
      ],
    },
    {
      group: "Abschluss",
      items: [
        {
          href: "/abschluss", icon: CalendarCheck, label: "MWST",
          children: [
            { href: "/vat", icon: Receipt, label: "MWST" },
            { href: "/year-end", icon: CalendarCheck, label: "Jahresabschluss" },
          ],
        },
      ],
    },
    {
      group: "Admin",
      items: [
        {
          href: "/admin", icon: Brain, label: "KI-Regeln", adminOnly: true,
          children: [
            { href: "/admin/global-rules", icon: Brain, label: "Regeln" },
            { href: "/settings?tab=avatar", icon: Bot, label: "Avatar-Chatbot" },
            { href: "/settings?tab=importAutomation", icon: Bolt, label: "Import-Automatisierung" },
          ],
        },
      ],
    },
  ];

  const toggleSection = (href: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      return next;
    });
  };

  const baseHrefOf = (href: string) => href.split("?")[0];

  const isChildActive = (child: NavItem): boolean => {
    const baseHref = baseHrefOf(child.href);
    if (!child.href.includes("?")) return location === baseHref;
    return location === baseHref && window.location.search === "?" + child.href.split("?")[1];
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.children) {
      return item.children.some(child => isChildActive(child)) ||
        (location === item.href);
    }
    return location === item.href || (item.href !== "/" && location.startsWith(item.href));
  };

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isActive = isItemActive(item);
    const isExpanded = expandedSections.has(item.href);

    if (hasChildren) {
      return (
        <div key={item.href}>
          <div
            className={cn(
              "sb-item group",
              isActive && !isExpanded && "sb-item--active"
            )}
            onClick={() => toggleSection(item.href)}
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
            {isExpanded
              ? <ChevronDown className="h-3 w-3 opacity-50" />
              : <ChevronRight className="h-3 w-3 opacity-50" />}
          </div>
          {isExpanded && (
            <div className="mt-0.5">
              {item.children!.map(child => {
                const active = isChildActive(child);
                return (
                  <Link key={child.href} href={child.href}>
                    <div
                      className={cn("sb-item sb-sub", active && "sb-item--active")}
                      onClick={() => setMobileOpen(false)}
                    >
                      <child.icon className="h-3 w-3 flex-shrink-0 opacity-70" />
                      <span className="truncate">{child.label}</span>
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
          className={cn("sb-item", isActive && "sb-item--active")}
          onClick={() => setMobileOpen(false)}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--neg)", color: "#fff", minWidth: 18, textAlign: "center" }}
            >
              {typeof item.badge === "number" && item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  const findLabel = (sections: NavSection[]): string => {
    for (const sec of sections) {
      for (const item of sec.items) {
        if (item.children) {
          for (const child of item.children) {
            const base = baseHrefOf(child.href);
            if (location === base || location.startsWith(base + "/")) return child.label;
          }
        }
        if (location === item.href || (item.href !== "/" && location.startsWith(item.href))) return item.label;
      }
    }
    return "Dashboard";
  };

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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {SECTIONS.map((section, idx) => {
            const visibleItems = section.items.filter(i => !i.adminOnly || user?.role === "admin");
            if (visibleItems.length === 0) return null;
            return (
              <div key={idx}>
                {section.group && <div className="sb-group">{section.group}</div>}
                {visibleItems.map(renderNavItem)}
              </div>
            );
          })}
        </nav>

        {/* Settings link */}
        <div className="px-3 pt-2" style={{ borderTop: "1px solid var(--hair)" }}>
          <Link href="/settings">
            <div className={cn("sb-item", location.startsWith("/settings") && "sb-item--active")}>
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
              {findLabel(SECTIONS)}
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
