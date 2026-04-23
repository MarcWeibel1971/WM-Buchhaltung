import { trpc } from "@/lib/trpc";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Link } from "wouter";
import {
  FileText, Building2, CheckSquare, Receipt,
  ArrowRight, Upload, Sparkles, CheckCircle,
  Link2, Eye, Inbox as InboxIcon,
} from "lucide-react";
import { Pill } from "@/components/klax/Pill";
import { AICallout } from "@/components/klax/AICallout";

export default function Inbox() {
  const { fiscalYear } = useFiscalYear();

  const { data: pendingJournal } = trpc.journal.list.useQuery({ status: "pending", limit: 50 });
  const { data: pendingBank } = trpc.bankImport.getPendingTransactions.useQuery({});
  const { data: allDocs } = trpc.documents.list.useQuery({ fiscalYear });

  const pendingEntries = pendingJournal?.entries?.length ?? 0;
  const pendingBankTx = pendingBank?.length ?? 0;
  const unmatchedBankTx = pendingBank?.filter(tx => !tx.matchedDocumentId)?.length ?? 0;
  const newDocs = allDocs?.filter(d => !d.matchStatus || d.matchStatus === "unmatched")?.length ?? 0;
  const aiProcessedDocs = allDocs?.filter(d => d.aiMetadata)?.length ?? 0;
  const matchedDocs = allDocs?.filter(d => d.matchStatus === "matched")?.length ?? 0;

  const tasks = [
    {
      icon: FileText,
      label: "Neue Belege",
      count: newDocs,
      href: "/belege?filter=new",
      description: "Warten auf KI-Analyse",
    },
    {
      icon: CheckSquare,
      label: "Zur Freigabe",
      count: pendingEntries,
      href: "/freigaben",
      description: "Buchungsvorschläge bereit",
    },
    {
      icon: Building2,
      label: "Ungematchte Banktransaktionen",
      count: unmatchedBankTx,
      href: "/bank?tab=unmatched",
      description: "Ohne zugeordneten Beleg",
    },
    {
      icon: Receipt,
      label: "Offene Rechnungen",
      count: 0,
      href: "/rechnungen?tab=open",
      description: "Fällige Zahlungen",
    },
  ];

  const activeTasks = tasks.filter(t => t.count > 0);
  const totalActive = activeTasks.reduce((s, t) => s + t.count, 0);

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filter-Rail */}
        <aside
          className="w-full lg:w-[280px] flex-shrink-0 space-y-4"
        >
          <div className="klax-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <InboxIcon className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
              <h3 className="k-label">Stapel</h3>
            </div>
            <div className="space-y-1.5">
              {tasks.map(t => (
                <Link key={t.href} href={t.href}>
                  <div className="sb-item">
                    <t.icon className="h-3.5 w-3.5" />
                    <span className="flex-1 text-[13px]">{t.label}</span>
                    {t.count > 0 && (
                      <span
                        className="text-[10.5px] px-1.5 py-0.5 rounded-full font-medium mono"
                        style={{
                          background: "var(--klax-accent)",
                          color: "var(--klax-accent-ink)",
                        }}
                      >
                        {t.count}
                      </span>
                    )}
                  </div>
                </Link>
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
              <PipelineRow label="Gematcht" value={matchedDocs} icon={<Link2 className="h-3 w-3" />} tone="pos" />
              <PipelineRow label="Zur Prüfung" value={pendingEntries} icon={<Eye className="h-3 w-3" />} tone="warn" />
            </div>
          </div>

          <div className="klax-card p-4">
            <h3 className="k-label mb-3">Quellen</h3>
            <div className="space-y-1.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
              <div className="flex items-center justify-between">
                <span>Upload</span>
                <span className="mono">{newDocs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Bank-Import</span>
                <span className="mono">{pendingBankTx}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>E-Mail-Inbox</span>
                <span className="mono" style={{ color: "var(--ink-4)" }}>0</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main: Freigabe-Liste */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="display text-[22px] font-medium" style={{ color: "var(--ink)" }}>
                Inbox
              </h2>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                {totalActive > 0
                  ? `${totalActive} offene Aufgaben`
                  : "Alles erledigt – keine offenen Aufgaben"}
              </p>
            </div>
            <Link href="/belege">
              <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] font-medium"
                style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}>
                <Upload className="h-3.5 w-3.5" /> Beleg hochladen
              </button>
            </Link>
          </div>

          {aiProcessedDocs > 0 && (
            <AICallout title="Klax hat vorbereitet">
              {aiProcessedDocs} Belege wurden automatisch erkannt und vorgebucht.
              Prüfe sie unter "Zur Freigabe".
            </AICallout>
          )}

          {activeTasks.length > 0 ? (
            <div className="space-y-2">
              {activeTasks.map(task => (
                <Link key={task.href} href={task.href}>
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
            <div className="klax-card p-12 text-center">
              <CheckCircle className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--pos)" }} />
              <h3 className="display text-[18px] font-medium mb-1" style={{ color: "var(--ink)" }}>
                Alles erledigt.
              </h3>
              <p className="text-[13px] max-w-md mx-auto" style={{ color: "var(--ink-3)" }}>
                Alle Vorschläge sind verbucht und alle Transaktionen zugeordnet.
                Neue Belege oder Banktransaktionen erscheinen hier automatisch.
              </p>
              <div className="flex gap-2 justify-center mt-5">
                <Link href="/belege">
                  <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px]"
                    style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)" }}>
                    <Upload className="h-3.5 w-3.5" /> Beleg hochladen
                  </button>
                </Link>
                <Link href="/bank?tab=import">
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
