import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Link } from "wouter";
import {
  FileText, Building2, CheckSquare, Receipt, Clock,
  ArrowRight, Upload, Sparkles, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle, Link2, Eye, Wallet,
  CreditCard, BarChart3, CalendarClock
} from "lucide-react";
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
  const { data: allDocs } = trpc.documents.list.useQuery({ fiscalYear: year });
  const { data: company } = trpc.settings.getCompanySettings.useQuery();

  const totalRevenue = useMemo(() => {
    if (!incomeStatement?.revenues) return 0;
    return incomeStatement.revenues.reduce((s, r) => s + r.balance, 0);
  }, [incomeStatement]);

  const totalExpenses = useMemo(() => {
    if (!incomeStatement?.expenses) return 0;
    return incomeStatement.expenses.reduce((s, e) => s + e.balance, 0);
  }, [incomeStatement]);

  const profit = totalRevenue - totalExpenses;

  // Compute task counts
  const pendingEntries = pendingJournal?.entries?.length ?? 0;
  const pendingBankTx = pendingBank?.length ?? 0;
  const unmatchedBankTx = pendingBank?.filter(tx => !tx.matchedDocumentId)?.length ?? 0;
  const newDocs = allDocs?.filter(d => !d.matchStatus || d.matchStatus === "unmatched")?.length ?? 0;
  const aiProcessedDocs = allDocs?.filter(d => d.aiMetadata)?.length ?? 0;
  const matchedDocs = allDocs?.filter(d => d.matchStatus === "matched")?.length ?? 0;
  const totalDocs = allDocs?.length ?? 0;
  const autoRate = totalDocs > 0 ? Math.round((aiProcessedDocs / totalDocs) * 100) : 0;
  const matchRate = totalDocs > 0 ? Math.round((matchedDocs / totalDocs) * 100) : 0;

  const todoItems = [
    { icon: FileText, label: "Neue Belege", count: newDocs, href: "/belege?filter=new", color: "oklch(0.65 0.20 250)" },
    { icon: CheckSquare, label: "Zur Freigabe", count: pendingEntries, href: "/freigaben", color: "oklch(0.65 0.18 145)" },
    { icon: Building2, label: "Ungematchte Banktx", count: unmatchedBankTx, href: "/bank?tab=unmatched", color: "oklch(0.70 0.15 60)" },
  ].filter(t => t.count > 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header with primary CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{company?.companyName ?? "Meine Firma"} · GJ {year}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/belege">
            <Button size="sm" className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Beleg hochladen
            </Button>
          </Link>
          <Link href="/bank?tab=import">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              Bank importieren
            </Button>
          </Link>
          <Link href="/rechnungen">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Receipt className="h-3.5 w-3.5" />
              Rechnung erstellen
            </Button>
          </Link>
        </div>
      </div>

      {/* Block 1: HEUTE ZU ERLEDIGEN */}
      {todoItems.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heute zu erledigen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {todoItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="border-border hover:border-primary/30 transition-all cursor-pointer group shadow-sm h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${item.color} / 0.12)`.replace(")", "") }}>
                        <item.icon className="h-4 w-4" style={{ color: item.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xl font-bold text-foreground">{item.count}</div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-border shadow-sm bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="py-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Alles erledigt!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Keine offenen Aufgaben. Neue Belege oder Banktransaktionen erscheinen hier automatisch.</p>
          </CardContent>
        </Card>
      )}

      {/* Block 2: KI HAT FÜR DICH VORBEREITET */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          KI hat für dich vorbereitet
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{aiProcessedDocs}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Automatisch erkannt</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{matchedDocs}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Gematcht</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{autoRate}%</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Automatisierungsquote</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{matchRate}%</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Match-Quote</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block 3: BELEGE + BANK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Belege Status */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Belege
              </CardTitle>
              <Link href="/belege">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  Alle <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {totalDocs === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Lade Rechnungen, Spesen oder Kreditkartenabrechnungen hoch, damit die KI sie automatisch vorbereitet.</p>
                <Link href="/belege">
                  <Button size="sm" className="mt-3 gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    Beleg hochladen
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Neu / Unverarbeitet</span>
                  <span className="text-sm font-semibold">{newDocs}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Von KI verarbeitet</span>
                  <span className="text-sm font-semibold">{aiProcessedDocs}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Gematcht</span>
                  <span className="text-sm font-semibold">{matchedDocs}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Total Belege</span>
                  <span className="text-sm font-bold">{totalDocs}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bank Status */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-500" />
                Bank
              </CardTitle>
              <Link href="/bank">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  Alle <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingBankTx === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">Alle Bankbewegungen zugeordnet. Importiere neue Transaktionen, um sie automatisch matchen zu lassen.</p>
                <Link href="/bank?tab=import">
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs">
                    <Building2 className="h-3.5 w-3.5" />
                    Bank importieren
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingBank?.slice(0, 4).map((tx) => {
                  const amount = parseFloat(tx.amount as string);
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{tx.description || tx.counterparty || "Transaktion"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(tx.transactionDate as any).toLocaleDateString("de-CH")}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold ml-2 ${amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {formatCHF(amount)}
                      </span>
                    </div>
                  );
                })}
                {pendingBankTx > 4 && (
                  <Link href="/bank">
                    <p className="text-xs text-primary text-center pt-1 cursor-pointer hover:underline">
                      +{pendingBankTx - 4} weitere Transaktionen
                    </p>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Block 4: FREIGABEN + RECHNUNGEN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buchungen */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-amber-500" />
                Buchungen
              </CardTitle>
              <Link href="/freigaben">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  Alle <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingEntries === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">Alle Vorschläge wurden verbucht. Neue Belege oder Banktransaktionen erscheinen hier automatisch.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingJournal?.entries?.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{entry.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(entry.bookingDate as any).toLocaleDateString("de-CH")} · {entry.entryNumber}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium ml-2 flex-shrink-0">
                      {entry.source}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rechnungen / Debitoren */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-violet-500" />
                Rechnungen
              </CardTitle>
              <Link href="/rechnungen">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  Alle <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col items-center py-6 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Erstelle Ausgangsrechnungen und verfolge Zahlungseingänge.</p>
              <Link href="/rechnungen">
                <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs">
                  <Receipt className="h-3.5 w-3.5" />
                  Rechnung erstellen
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Block 5: FINANZSTATUS */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Finanzstatus {year}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <Wallet className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <div className="text-sm font-bold text-foreground">{formatCHF(totalRevenue - totalExpenses)}</div>
              <p className="text-[10px] text-muted-foreground">Liquidität</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <div className="text-sm font-bold text-green-600">{formatCHF(totalRevenue)}</div>
              <p className="text-[10px] text-muted-foreground">Ertrag</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <TrendingDown className="h-4 w-4 text-red-500 mx-auto mb-1" />
              <div className="text-sm font-bold text-red-500">{formatCHF(totalExpenses)}</div>
              <p className="text-[10px] text-muted-foreground">Aufwand</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              {profit >= 0
                ? <TrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
                : <TrendingDown className="h-4 w-4 text-red-500 mx-auto mb-1" />}
              <div className={`text-sm font-bold ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCHF(profit)}</div>
              <p className="text-[10px] text-muted-foreground">Ergebnis</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <AlertCircle className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <div className="text-sm font-bold text-foreground">{formatCHF(0)}</div>
              <p className="text-[10px] text-muted-foreground">Off. Forderungen</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <CreditCard className="h-4 w-4 text-orange-500 mx-auto mb-1" />
              <div className="text-sm font-bold text-foreground">{formatCHF(0)}</div>
              <p className="text-[10px] text-muted-foreground">Off. Verbindlichk.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block 6: FRISTEN & HINWEISE */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fristen & Hinweise</h3>
        <Card className="border-border shadow-sm">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 flex-shrink-0" />
              <span>Keine anstehenden Fristen. MWST-Abrechnung und Periodenabschluss werden hier angezeigt, sobald sie fällig sind.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
