import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  FileText, Building2, CheckSquare, Receipt,
  ArrowRight, Upload, Sparkles, CheckCircle,
  Link2, Eye, Inbox as InboxIcon, AlertCircle,
} from "lucide-react";
import { Pill } from "@/components/klax/Pill";
import { AICallout } from "@/components/klax/AICallout";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

function formatCHF(val: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(val);
}

type TaskKey = "all" | "newDocs" | "pendingEntries" | "unmatchedBankTx" | "openInvoices";

export default function Dashboard() {
  const { fiscalYear: year } = useFiscalYear();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TaskKey>("all");

  const { data: incomeStatement } = trpc.reports.incomeStatement.useQuery({ fiscalYear: year });
  const { data: pendingJournal } = trpc.journal.list.useQuery({ status: "pending", limit: 50 });
  // AP2.1: dieselbe Quelle wie die gemeinsame Transaktionsliste (/workflow)
  const { data: pendingBank } = trpc.bankImport.getTransactionsByStatus.useQuery({ status: "all", fiscalYear: year });
  const { data: allDocs } = trpc.documents.list.useQuery({ fiscalYear: year });
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
  const { data: monthlyData } = trpc.reports.monthlyAggregates.useQuery({ months: 6 });
  const { data: bankBalanceData } = trpc.accounts.getBankBalance.useQuery({ fiscalYear: year });

  const totalRevenue = useMemo(() =>
    incomeStatement?.revenues?.reduce((s, r) => s + r.balance, 0) ?? 0,
    [incomeStatement]);
  const totalExpenses = useMemo(() =>
    incomeStatement?.expenses?.reduce((s, e) => s + e.balance, 0) ?? 0,
    [incomeStatement]);
  const profit = totalRevenue - totalExpenses;

  const pendingEntries = pendingJournal?.entries?.length ?? 0;
  const pendingBankTx = pendingBank?.filter(tx => tx.status === "pending")?.length ?? 0;
  const unmatchedBankTx = pendingBank?.filter(tx => tx.status === "pending" && !tx.matchedDocumentId && !(tx as any).matchedInvoiceId)?.length ?? 0;
  const newDocs = allDocs?.filter(d => !d.matchStatus || d.matchStatus === "unmatched")?.length ?? 0;
  const aiProcessedDocs = allDocs?.filter(d => d.aiMetadata)?.length ?? 0;
  const matchedDocs = allDocs?.filter(d => d.matchStatus === "matched" || d.matchStatus === "manual")?.length ?? 0;
  // AP2.1: SCOR/QR-Matches aus derselben Quelle wie die Workflow-Seite mitzählen
  const scorMatchedTx = pendingBank?.filter(tx => (tx as any).matchedInvoiceId)?.length ?? 0;
  const totalDocs = allDocs?.length ?? 0;
  const autoRate = totalDocs > 0 ? Math.round((aiProcessedDocs / totalDocs) * 100) : 0;
  const matchRate = totalDocs > 0 ? Math.round((matchedDocs / totalDocs) * 100) : 0;
  const openInvoices = 0;

  const firstName = (user?.name ?? "").split(" ")[0] || "dir";
  const companyName = company?.companyName ?? "Meine Firma";
  const kw = getKW(new Date());

  // Aufgaben-Hub: konsolidierte Tabs (ehemalige Tiles + Filter-Rail)
  const tasks: { key: TaskKey; icon: any; label: string; count: number; href: string; description: string }[] = [
    { key: "newDocs", icon: FileText, label: "Neue Belege", count: newDocs, href: "/belege-bank?tab=docs&filter=new", description: "Warten auf KI-Analyse" },
    { key: "pendingEntries", icon: CheckSquare, label: "Zur Freigabe", count: pendingEntries, href: "/journal", description: "Buchungsvorschläge bereit" },
    { key: "unmatchedBankTx", icon: Building2, label: "Ungematchte Bank-Tx", count: unmatchedBankTx, href: "/belege-bank?tab=bank&filter=unmatched", description: "Ohne zugeordneten Beleg" },
    { key: "openInvoices", icon: Receipt, label: "Offene Rechnungen", count: openInvoices, href: "/rechnungen?tab=open", description: "Fällige Zahlungen" },
  ];

  const totalActive = tasks.reduce((s, t) => s + t.count, 0);
  const visibleTasks = activeTab === "all"
    ? tasks
    : tasks.filter(t => t.key === activeTab);

  const sparkData = useMemo(() => {
    if (!monthlyData?.length) return [];
    return monthlyData.map(m => ({
      name: m.month.slice(5),
      revenue: m.revenue,
      expenses: m.expenses,
      profit: m.profit,
    }));
  }, [monthlyData]);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1280px] mx-auto">
      {/* Greeting + Quick-Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="display text-[26px] font-medium" style={{ color: "var(--ink)" }}>
            Guten Tag, {firstName}.
          </h2>
          <p className="text-[13px] mt-1" style={{ color: "var(--ink-3)" }}>
            {companyName} · GJ {year} · KW {kw}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/belege-bank?action=upload">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium"
              style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)", boxShadow: "var(--shadow-1)" }}>
              <Upload className="h-3.5 w-3.5" /> Beleg hochladen
            </button>
          </Link>
          <Link href="/rechnungen/neu">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium"
              style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)", boxShadow: "var(--shadow-1)" }}>
              <Receipt className="h-3.5 w-3.5" /> Rechnung erstellen
            </button>
          </Link>
        </div>
      </div>

      {/* Kompakte KI-Hero Card */}
      <div
        className="rounded-[14px] p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--paper) 0%, #F6F2EB 100%)",
          border: "1px solid var(--hair)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--ai) 0%, #6B5AA8 100%)", color: "#fff" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="k-label" style={{ color: "var(--ai)" }}>
                KLAX hat für Sie vorbereitet
              </span>
            </div>
            <p className="text-[15px] leading-snug" style={{ color: "var(--ink)" }}>
              {totalActive > 0 ? (
                <>
                  <strong className="font-semibold">{totalActive}</strong> offene Aufgaben warten auf Sie.
                  {aiProcessedDocs > 0 && <> Davon wurden <strong className="font-semibold">{aiProcessedDocs}</strong> automatisch erkannt.</>}
                </>
              ) : (
                <>Alles erledigt. Keine offenen Aufgaben.</>
              )}
            </p>
          </div>

          {/* Kompakter KPI-Block */}
          <div className="grid grid-cols-3 gap-4 w-full lg:w-auto lg:flex-shrink-0">
            <div className="min-w-[78px]">
              <div className="display text-[22px] mono font-medium" style={{ color: "var(--ink)" }}>
                {autoRate}<span className="text-[14px]" style={{ color: "var(--ink-3)" }}>%</span>
              </div>
              <div className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>Automatisierung</div>
            </div>
            <div className="min-w-[78px]">
              <div className="display text-[22px] mono font-medium" style={{ color: "var(--ink)" }}>
                {matchRate}<span className="text-[14px]" style={{ color: "var(--ink-3)" }}>%</span>
              </div>
              <div className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>Match-Quote</div>
            </div>
            <div className="min-w-[78px]">
              <div className="display text-[22px] mono font-medium" style={{ color: "var(--ink)" }}>
                {aiProcessedDocs}
              </div>
              <div className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>Verarbeitet</div>
            </div>
          </div>
        </div>
      </div>

      {/* Aufgaben-Hub: Filter-Rail + Task-Liste */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Filter-Rail (links) */}
        <aside className="space-y-4">
          <div className="klax-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <InboxIcon className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
              <h3 className="k-label">Heute zu erledigen</h3>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("all")}
                className={`sb-item w-full text-left ${activeTab === "all" ? "sb-item--active" : ""}`}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="flex-1 text-[13px]">Alle</span>
                {totalActive > 0 && (
                  <span
                    className="text-[10.5px] px-1.5 py-0.5 rounded-full font-medium mono"
                    style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
                  >
                    {totalActive}
                  </span>
                )}
              </button>
              {tasks.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`sb-item w-full text-left ${activeTab === t.key ? "sb-item--active" : ""}`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  <span className="flex-1 text-[13px]">{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className="text-[10.5px] px-1.5 py-0.5 rounded-full font-medium mono"
                      style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="klax-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4" style={{ color: "var(--ai)" }} />
              <h3 className="k-label">KI-Pipeline</h3>
            </div>
            <div className="space-y-3">
              <PipelineRow label="Automatisch erkannt" value={aiProcessedDocs} icon={<Sparkles className="h-3 w-3" />} tone="ai" />
              <PipelineRow label="Gematcht" value={matchedDocs + scorMatchedTx} icon={<Link2 className="h-3 w-3" />} tone="pos" />
              <PipelineRow label="Zur Prüfung" value={pendingEntries} icon={<Eye className="h-3 w-3" />} tone="warn" />
            </div>
          </div>
        </aside>

        {/* Task-Liste (rechts) */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="display text-[18px] font-medium" style={{ color: "var(--ink)" }}>
              {activeTab === "all" ? "Alle Aufgaben" : tasks.find(t => t.key === activeTab)?.label}
            </h3>
            <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
              {totalActive > 0 ? `${totalActive} offen` : "alles erledigt"}
            </span>
          </div>

          {visibleTasks.some(t => t.count > 0) ? (
            <div className="space-y-2">
              {visibleTasks.filter(t => t.count > 0).map(task => (
                <Link key={task.key} href={task.href}>
                  <div className="klax-card p-4 cursor-pointer group transition-shadow hover:shadow-[var(--shadow-2)]">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                      >
                        <task.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
                            {task.label}
                          </span>
                          <Pill variant="accent">{task.count}</Pill>
                        </div>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                          {task.description}
                        </p>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--ink-3)" }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="klax-card p-10 text-center">
              <CheckCircle className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--pos)" }} />
              <h3 className="display text-[18px] font-medium mb-1" style={{ color: "var(--ink)" }}>
                Alles erledigt.
              </h3>
              <p className="text-[13px] max-w-md mx-auto" style={{ color: "var(--ink-3)" }}>
                Alle Vorschläge sind verbucht und alle Transaktionen zugeordnet.
              </p>
              <div className="flex gap-2 justify-center mt-5">
                <Link href="/belege-bank?action=upload">
                  <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px]"
                    style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)" }}>
                    <Upload className="h-3.5 w-3.5" /> Beleg hochladen
                  </button>
                </Link>
                <Link href="/belege-bank?action=bank-import">
                  <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px]"
                    style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)" }}>
                    <Building2 className="h-3.5 w-3.5" /> Bank importieren
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Finanzstatus */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="k-label">Finanzstatus {year}</h3>
          <Link href="/berichte">
            <span className="text-[12px] cursor-pointer hover:underline" style={{ color: "var(--klax-accent)" }}>
              Berichte öffnen →
            </span>
          </Link>
        </div>
        <div className="klax-card p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <KpiStat label="Bankbestand" value={formatCHF(bankBalanceData?.balance ?? 0)} tone={(bankBalanceData?.balance ?? 0) >= 0 ? "pos" : "neg"} />
            <KpiStat label="Ertrag YTD" value={formatCHF(totalRevenue)} tone="pos" />
            <KpiStat label="Aufwand YTD" value={formatCHF(totalExpenses)} tone="neg" />
          </div>

          <div style={{ borderTop: "1px solid var(--hair)", paddingTop: 12 }}>
            {sparkData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <Tooltip
                      contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--hair)', background: 'var(--surface)' }}
                      formatter={(val: number, name: string) => [
                        new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0 }).format(val),
                        name === 'revenue' ? 'Ertrag' : name === 'expenses' ? 'Aufwand' : 'Gewinn'
                      ]}
                      labelFormatter={(label) => `Monat ${label}`}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="var(--pos)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expenses" stroke="var(--neg)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-5 h-0.5 rounded" style={{ background: 'var(--pos)' }} /> Ertrag
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-5 h-0.5 rounded" style={{ background: 'var(--neg)' }} /> Aufwand
                  </span>
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--ink-4)' }}>Letzte 6 Monate</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-20 text-[12px]" style={{ color: 'var(--ink-4)' }}>
                Noch keine Buchungsdaten für Sparklines verfügbar.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aktivität + Fristen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="klax-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="k-label">Aktivität</h3>
            <Link href="/journal">
              <span className="text-[12px] cursor-pointer" style={{ color: "var(--klax-accent)" }}>
                Alle anzeigen →
              </span>
            </Link>
          </div>
          {pendingJournal?.entries?.length ? (
            <ul className="space-y-2.5">
              {pendingJournal.entries.slice(0, 5).map(entry => (
                <li key={entry.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: "1px solid var(--hair)" }}>
                  <span className="text-[11px] mono" style={{ color: "var(--ink-4)" }}>
                    {new Date(entry.bookingDate as any).toLocaleDateString("de-CH")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate" style={{ color: "var(--ink)" }}>{entry.description}</div>
                    <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>#{entry.entryNumber}</div>
                  </div>
                  <Pill variant="ai" icon={<Sparkles className="h-2.5 w-2.5" />}>{entry.source}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              Keine Aktivität. Neue Belege und Banktransaktionen erscheinen hier.
            </p>
          )}
        </div>

        <div className="klax-card p-5">
          <h3 className="k-label mb-3">Fristen & Hinweise</h3>
          <AICallout title="Empfehlung">
            MWST-Abrechnung Q{Math.floor(new Date().getMonth() / 3) + 1} prüfen.
            Klax schlägt vor, die Belege zu konsolidieren.
          </AICallout>
          <div className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Keine überfälligen Fristen.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiStat({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" | "neutral" }) {
  const color = tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--ink)";
  return (
    <div>
      <div className="text-[11px] mb-1" style={{ color: "var(--ink-3)" }}>{label}</div>
      <div className="display text-[22px] mono font-medium" style={{ color }}>{value}</div>
    </div>
  );
}

function PipelineRow({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "ai" | "pos" | "warn" }) {
  const color = tone === "ai" ? "var(--ai)" : tone === "pos" ? "var(--pos)" : "var(--warn)";
  const bg = tone === "ai" ? "var(--ai-soft)" : tone === "pos" ? "var(--pos-soft)" : "var(--warn-soft)";
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: bg, color }}
      >
        {icon}
      </span>
      <span className="flex-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
        {label}
      </span>
      <span className="mono text-[13px] font-medium" style={{ color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

function getKW(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
