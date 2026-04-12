import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Link } from "wouter";
import { BookOpen, Building2, Clock, CheckCircle, TrendingUp, TrendingDown, AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatCHF(val: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(val);
}

export default function Dashboard() {
  const { fiscalYear: year } = useFiscalYear();

  const { data: stats } = trpc.reports.dashboard.useQuery({ fiscalYear: year });
  const { data: incomeStatement } = trpc.reports.incomeStatement.useQuery({ fiscalYear: year });
  const { data: pendingJournal } = trpc.journal.list.useQuery({ status: "pending", limit: 5 });
  const { data: pendingBank } = trpc.bankImport.getPendingTransactions.useQuery({});

  const totalRevenue = useMemo(() => {
    if (!incomeStatement?.revenues) return 0;
    return incomeStatement.revenues.reduce((s, r) => s + r.balance, 0);
  }, [incomeStatement]);

  const totalExpenses = useMemo(() => {
    if (!incomeStatement?.expenses) return 0;
    return incomeStatement.expenses.reduce((s, e) => s + e.balance, 0);
  }, [incomeStatement]);

  const profit = totalRevenue - totalExpenses;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Übersicht {year}</h2>
        <p className="text-muted-foreground text-sm mt-1">WM Weibel Mueller AG – Buchhaltung</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ertrag {year}</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold amount-positive">{formatCHF(totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aufwand {year}</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold amount-negative">{formatCHF(totalExpenses)}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ergebnis {year}</span>
              {profit >= 0
                ? <TrendingUp className="h-4 w-4 text-green-600" />
                : <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            <div className={`text-2xl font-bold ${profit >= 0 ? "amount-positive" : "amount-negative"}`}>
              {formatCHF(profit)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ausstehend</span>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {(stats?.pendingEntries ?? 0) + (stats?.pendingBankTransactions ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Buchungen zu genehmigen</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Journal Entries */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Ausstehende Buchungen
              </CardTitle>
              <Link href="/journal?status=pending">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Alle <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {!pendingJournal?.entries?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">Keine ausstehenden Buchungen</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingJournal.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.bookingDate as any).toLocaleDateString("de-CH")} · {entry.entryNumber}
                      </p>
                    </div>
                    <span className="badge-pending ml-3 flex-shrink-0">{entry.source}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Bank Transactions */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Offene Banktransaktionen
              </CardTitle>
              <Link href="/bank-import">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Verarbeiten <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {!pendingBank?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">Alle Transaktionen verarbeitet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingBank.slice(0, 5).map((tx) => {
                  const amount = parseFloat(tx.amount as string);
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.transactionDate as any).toLocaleDateString("de-CH")}
                          {tx.counterparty ? ` · ${tx.counterparty}` : ""}
                        </p>
                      </div>
                      <span className={`amount-neutral ml-3 flex-shrink-0 text-sm ${amount >= 0 ? "amount-positive" : "amount-negative"}`}>
                        {formatCHF(amount)}
                      </span>
                    </div>
                  );
                })}
                {pendingBank.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{pendingBank.length - 5} weitere Transaktionen
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Schnellzugriff</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/journal", icon: BookOpen, label: "Journal", desc: "Buchungen anzeigen" },
              { href: "/bank-import", icon: Building2, label: "Bankimport", desc: "Auszüge importieren" },
              { href: "/payroll", icon: "users", label: "Lohn", desc: "Lohnabrechnung" },
              { href: "/reports", icon: "chart", label: "Berichte", desc: "Bilanz & ER" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer text-center">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {item.icon === BookOpen ? <BookOpen className="h-5 w-5 text-primary" /> :
                     item.icon === Building2 ? <Building2 className="h-5 w-5 text-primary" /> :
                     item.icon === "users" ? <span className="text-primary font-bold text-sm">L</span> :
                     <span className="text-primary font-bold text-sm">B</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
