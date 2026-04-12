import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard, BookOpen, Building2, CreditCard,
  Users, FileText, BarChart3, Receipt, LogOut, ChevronRight,
  Menu, X, Bell
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/journal", icon: BookOpen, label: "Journal" },
  { href: "/bank-import", icon: Building2, label: "Bankimport" },
  { href: "/credit-card", icon: CreditCard, label: "Kreditkarte" },
  { href: "/payroll", icon: Users, label: "Lohnbuchhaltung" },
  { href: "/vat", icon: Receipt, label: "MWST" },
  { href: "/reports", icon: BarChart3, label: "Berichte" },
  { href: "/accounts", icon: FileText, label: "Kontenplan" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: stats } = trpc.reports.dashboard.useQuery({ fiscalYear: new Date().getFullYear() });

  const pendingCount = (stats?.pendingEntries ?? 0) + (stats?.pendingBankTransactions ?? 0);

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

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: "oklch(0.28 0.04 240)" }}>
          <div>
            <div className="text-sm font-bold" style={{ color: "oklch(0.95 0.01 240)" }}>WM Weibel Mueller AG</div>
            <div className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.02 240)" }}>Buchhaltung</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded"
            style={{ color: "oklch(0.55 0.02 240)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group",
                    isActive
                      ? "text-white"
                      : "hover:text-white"
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
          })}
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
              {NAV_ITEMS.find(n => n.href === location || (n.href !== "/" && location.startsWith(n.href)))?.label ?? "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              GJ {new Date().getFullYear()}
            </span>
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
