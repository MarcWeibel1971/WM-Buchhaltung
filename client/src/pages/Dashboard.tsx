import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  FileText, Building2, CheckSquare, Receipt,
  ArrowRight, Upload, Sparkles,
  AlertCircle,
} from "lucide-react";
import { Pill } from "@/components/klax/Pill";
import { AICallout } from "@/components/klax/AICallout";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

function formatCHF(val: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(val);
}

function formatNumberShort(val: number) {
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M";
  if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + "k";
  return val.toFixed(0);
}

export default function Dashboard() {
  const { fiscalYear: year } = useFiscalYear();
  const { user } = useAuth();

  const { data: incomeStatement } = trpc.reports.incomeStatement.useQuery({ fiscalYear: year });
  const { data: pendingJournal } = trpc.journal.list.useQuery({ status: "pending", limit: 5 });
  const { data: pendingBank } = trpc.bankImport.getPendingTransactions.useQuery({});
  const { data: allDocs } = trpc.documents.list.useQuery({ fiscalYear: year });
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
  const { data: monthlyData } = trpc.reports.monthlyAggregates.useQuery({ months: 6 });

  const totalRevenue = useMemo(() =>
    incomeStatement?.revenues?.reduce((s, r) => s + r.balance, 0) ?? 0,
    [incomeStatement]);
  const totalExpenses = useMemo(() =>
    incomeStatement?.expenses?.reduce((s, e) => s + e.balance, 0) ?? 0,
    [incomeStatement]);
  const profit = totalRevenue - totalExpenses;

  const pendingEntries = pendingJournal?.entries?.length ?? 0;
  const pendingBankTx = pendingBank?.length ?? 0;
  const unmatchedBankTx = pendingBank?.filter(tx => !tx.matchedDocumentId)?.length ?? 0;
  const newDocs = allDocs?.filter(d => !d.matchStatus || d.matchStatus === "unmatched")?.length ?? 0;
  const aiProcessedDocs = allDocs?.filter(d => d.aiMetadata)?.length ?? 0;
  const matchedDocs = allDocs?.filter(d => d.matchStatus === "matched")?.length ?? 0;
  const totalDocs = allDocs?.length ?? 0;
  const autoRate = totalDocs > 0 ? Math.round((aiProcessedDocs / totalDocs) * 100) : 0;
  const matchRate = totalDocs > 0 ? Math.round((matchedDocs / totalDocs) * 100) : 0;

  const firstName = (user?.name ?? "").split(" ")[0] || "dir";
  const companyName = company?.companyName ?? "Meine Firma";
  const kw = getKW(new Date());

  const todoItems = [
    { icon: FileText, label: "Neue Belege", count: newDocs, href: "/belege?filter=new" },
    { icon: CheckSquare, label: "Zur Freigabe", count: pendingEntries, href: "/freigaben" },
    { icon: Building2, label: "Ungematchte Bank-Tx", count: unmatchedBankTx, href: "/bank?tab=unmatched" },
    { icon: Receipt, label: "Offene Rechnungen", count: 0, href: "/rechnungen?tab=open" },
  ];

  // Sparkline data aus echten Monatsdaten
  const sparkData = useMemo(() => {
    if (!monthlyData?.length) return [];
    return monthlyData.map(m => ({
      name: m.month.slice(5), // MM
      revenue: m.revenue,
      expenses: m.expenses,
      profit: m.profit,
    }));
  }, [monthlyData]);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Topbar greeting */}
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
          <Link href="/belege">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium"
              style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)", boxShadow: "var(--shadow-1)" }}>
              <Upload className="h-3.5 w-3.5" /> Beleg hochladen
            </button>
          </Link>
          <Link href="/rechnungen">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium"
              style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)", boxShadow: "var(--shadow-1)" }}>
              <Receipt className="h-3.5 w-3.5" /> Rechnung erstellen
            </button>
          </Link>
        </div>
      </div>

      {/* KI Hero Card */}
      <div
        className="rounded-[14px] p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--paper) 0%, #F6F2EB 100%)",
          border: "1px solid var(--hair)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--ai) 0%, #6B5AA8 100%)", color: "#fff" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="k-label" style={{ color: "var(--ai)" }}>
                KLAX hat für dich vorbereitet
              </span>
            </div>
            <p className="text-[17px] leading-relaxed" style={{ color: "var(--ink)" }}>
              Heute warten{" "}
              <Link href="/belege?filter=new">
                <span className="underline decoration-dotted underline-offset-4 cursor-pointer" style={{ textDecorationColor: "var(--klax-accent)" }}>
                  <strong className="font-semibold">{newDocs}</strong> neue Belege
                </span>
              </Link>{" "}
              auf die KI-Analyse, und{" "}
              <Link href="/freigaben">
                <span className="underline decoration-dotted underline-offset-4 cursor-pointer" style={{ textDecorationColor: "var(--klax-accent)" }}>
                  <strong className="font-semibold">{pendingEntries} Buchungen</strong>
                </span>
              </Link>{" "}
              sind bereit zur Freigabe.
              {unmatchedBankTx > 0 && <> Zusätzlich gibt es{" "}
                <Link href="/bank?tab=unmatched">
                  <span className="underline decoration-dotted underline-offset-4 cursor-pointer" style={{ textDecorationColor: "var(--klax-accent)" }}>
                    <strong className="font-semibold">{unmatchedBankTx}</strong> ungematchte Banktransaktionen
                  </span>
                </Link>.
              </>}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/inbox">
                <button
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] font-medium"
                  style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
                >
                  Zur Inbox <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
              <Link href="/freigaben">
                <button
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px]"
                  style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)" }}
                >
                  Buchungen freigeben
                </button>
              </Link>
            </div>
          </div>

          {/* KPI-Block rechts */}
          <div className="grid grid-cols-3 gap-4 w-full lg:w-auto lg:flex-shrink-0">
            <div className="min-w-[92px]">
              <div className="display text-[28px] mono font-medium" style={{ color: "var(--ink)" }}>
                {autoRate}<span className="text-[18px]" style={{ color: "var(--ink-3)" }}>%</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>Automatisierung</div>
            </div>
            <div className="min-w-[92px]">
              <div className="display text-[28px] mono font-medium" style={{ color: "var(--ink)" }}>
                {matchRate}<span className="text-[18px]" style={{ color: "var(--ink-3)" }}>%</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>Match-Quote</div>
            </div>
            <div className="min-w-[92px]">
              <div className="display text-[28px] mono font-medium" style={{ color: "var(--ink)" }}>
                {aiProcessedDocs}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>Verarbeitet</div>
            </div>
          </div>
        </div>
      </div>

      {/* Heute zu erledigen — 4 Kacheln */}
      <div className="space-y-3">
        <h3 className="k-label">Heute zu erledigen</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {todoItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="klax-card p-4 cursor-pointer group transition-shadow hover:shadow-[var(--shadow-2)]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                  >
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="display text-[22px] mono font-medium leading-none" style={{ color: "var(--ink)" }}>
                      {item.count}
                    </div>
                    <div className="text-[11.5px] mt-1" style={{ color: "var(--ink-3)" }}>{item.label}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--ink-3)" }} />
                </div>
              </div>
            </Link>
          ))}
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
            <KpiStat label="Liquidität" value={formatCHF(profit)} tone={profit >= 0 ? "pos" : "neg"} />
            <KpiStat label="Ertrag YTD" value={formatCHF(totalRevenue)} tone="pos" />
            <KpiStat label="Aufwand YTD" value={formatCHF(totalExpenses)} tone="neg" />
          </div>

          {/* Sparkline Chart (echte Monatsdaten) */}
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
                    <span className="inline-block w-5 h-0.5 rounded" style={{ background: 'var(--neg)', borderTop: '1px dashed var(--neg)' }} /> Aufwand
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

function getKW(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
