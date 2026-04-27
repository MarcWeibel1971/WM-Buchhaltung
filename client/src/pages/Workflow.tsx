import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import {
  FileText, Building2, Sparkles, Link2, RefreshCw, Upload,
  CheckCircle, AlertCircle, X, ChevronRight,
} from "lucide-react";
import { Pill } from "@/components/klax/Pill";
import { AICallout } from "@/components/klax/AICallout";
import { DocumentUpload } from "@/components/DocumentUpload";
import { toast } from "sonner";

function formatCHF(val: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(val);
}

function parseAmount(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

type DocItem = {
  id: number;
  filename: string;
  matchStatus: string | null;
  bankTransactionId: number | null;
  aiMetadata: string | null;
  createdAt?: string | Date;
};

type TxItem = {
  id: number;
  transactionDate: string;
  amount: string;
  counterparty: string | null;
  description: string | null;
  matchedDocumentId: number | null;
  status: string;
};

export default function Workflow() {
  const [location, setLocation] = useLocation();
  const { fiscalYear } = useFiscalYear();

  // URL-Parameter parsen (?action=upload|bank-import|ai-match)
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const initialAction = params.get("action");
  const initialFilter = params.get("filter");

  const [showUpload, setShowUpload] = useState(initialAction === "upload");
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [docFilter, setDocFilter] = useState<"all" | "new" | "matched">(initialFilter === "new" ? "new" : "all");
  const [txFilter, setTxFilter] = useState<"all" | "unmatched">(initialFilter === "unmatched" ? "unmatched" : "all");

  const docsQuery = trpc.documents.list.useQuery({ fiscalYear });
  const txQuery = trpc.bankImport.getPendingTransactions.useQuery({});

  const utils = trpc.useUtils();
  const autoMatchMut = trpc.documents.autoMatch.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.matched} von ${res.total} Belegen automatisch gematcht.`);
      utils.documents.list.invalidate();
      utils.bankImport.getPendingTransactions.invalidate();
    },
    onError: (e) => toast.error(`Auto-Match fehlgeschlagen: ${e.message}`),
  });

  const manualMatchMut = trpc.documents.manualMatch.useMutation({
    onSuccess: () => {
      toast.success("Beleg mit Banktransaktion verknüpft.");
      utils.documents.list.invalidate();
      utils.bankImport.getPendingTransactions.invalidate();
      setSelectedDocId(null);
      setSelectedTxId(null);
    },
    onError: (e) => toast.error(`Verknüpfung fehlgeschlagen: ${e.message}`),
  });

  // ?action=ai-match → Auto-Match direkt anstossen
  useEffect(() => {
    if (initialAction === "ai-match" && !autoMatchMut.isPending) {
      autoMatchMut.mutate({ threshold: 40 });
      // Action aus URL entfernen, damit es nicht beim Re-Render erneut feuert
      setLocation("/workflow", { replace: true } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  // ?action=upload → Upload-Dialog öffnen
  useEffect(() => {
    if (initialAction === "upload") setShowUpload(true);
  }, [initialAction]);

  const docs: DocItem[] = (docsQuery.data ?? []) as any;
  const txns: TxItem[] = (txQuery.data ?? []) as any;

  const filteredDocs = useMemo(() => {
    let list = docs;
    if (docFilter === "new") list = list.filter(d => !d.matchStatus || d.matchStatus === "unmatched");
    else if (docFilter === "matched") list = list.filter(d => d.matchStatus === "matched" || d.matchStatus === "manual");
    return list;
  }, [docs, docFilter]);

  const filteredTxns = useMemo(() => {
    let list = txns;
    if (txFilter === "unmatched") list = list.filter(t => !t.matchedDocumentId);
    return list;
  }, [txns, txFilter]);

  const newDocsCount = docs.filter(d => !d.matchStatus || d.matchStatus === "unmatched").length;
  const unmatchedTxCount = txns.filter(t => !t.matchedDocumentId).length;
  const matchedDocsCount = docs.filter(d => d.matchStatus === "matched" || d.matchStatus === "manual").length;

  // Match-Linien zwischen Belegen und Transaktionen (matched docs ↔ tx)
  const matchPairs = useMemo(() => {
    const pairs: { docId: number; txId: number }[] = [];
    for (const d of docs) {
      if (d.bankTransactionId) pairs.push({ docId: d.id, txId: d.bankTransactionId });
    }
    return pairs;
  }, [docs]);

  const handleManualMatch = () => {
    if (!selectedDocId || !selectedTxId) {
      toast.error("Bitte einen Beleg und eine Banktransaktion auswählen.");
      return;
    }
    manualMatchMut.mutate({ documentId: selectedDocId, transactionId: selectedTxId });
  };

  return (
    <div className="px-4 lg:px-6 py-5 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="display text-[22px] font-medium" style={{ color: "var(--ink)" }}>
            Belege & Bank
          </h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Belege und Banktransaktionen abgleichen, prüfen, freigeben.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => autoMatchMut.mutate({ threshold: 40 })}
            disabled={autoMatchMut.isPending}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, var(--ai) 0%, #6B5AA8 100%)",
              color: "#fff",
              boxShadow: "var(--shadow-1)",
            }}
          >
            {autoMatchMut.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Auto-Match
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium"
            style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)", boxShadow: "var(--shadow-1)" }}
          >
            <Upload className="h-3.5 w-3.5" /> Beleg hochladen
          </button>
          <button
            onClick={() => setLocation("/bank-import")}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium"
            style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)" }}
          >
            <Building2 className="h-3.5 w-3.5" /> Bank importieren
          </button>
          {selectedDocId && selectedTxId && (
            <button
              onClick={handleManualMatch}
              disabled={manualMatchMut.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium disabled:opacity-50"
              style={{ background: "var(--pos)", color: "#fff", boxShadow: "var(--shadow-1)" }}
            >
              <Link2 className="h-3.5 w-3.5" /> Manuell verknüpfen
            </button>
          )}
        </div>
      </div>

      {/* Status-Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Neue Belege" value={newDocsCount} icon={<FileText className="h-3.5 w-3.5" />} />
        <StatCard label="Ungematchte Bank-Tx" value={unmatchedTxCount} icon={<Building2 className="h-3.5 w-3.5" />} />
        <StatCard label="Gematcht" value={matchedDocsCount} icon={<Link2 className="h-3.5 w-3.5" />} tone="pos" />
        <StatCard label="Match-Paare" value={matchPairs.length} icon={<Sparkles className="h-3.5 w-3.5" />} tone="ai" />
      </div>

      {autoMatchMut.data && (
        <AICallout title="Auto-Match abgeschlossen">
          {autoMatchMut.data.matched} von {autoMatchMut.data.total} Vorschlägen wurden angewendet.
          {autoMatchMut.data.debug && (
            <> ({autoMatchMut.data.debug.unmatchedDocs} offene Belege, {autoMatchMut.data.debug.pendingTxns} offene Transaktionen geprüft.)</>
          )}
        </AICallout>
      )}

      {/* Split-View: Belege links, Banktransaktionen rechts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
        {/* Linke Spalte: Belege */}
        <section className="klax-card p-4 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
              <h3 className="display text-[15px] font-medium" style={{ color: "var(--ink)" }}>
                Belege
              </h3>
              <Pill variant="info">{filteredDocs.length}</Pill>
            </div>
            <div className="flex gap-1">
              {(["all", "new", "matched"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setDocFilter(f)}
                  className="text-[11.5px] px-2 py-1 rounded"
                  style={{
                    background: docFilter === f ? "var(--klax-accent)" : "transparent",
                    color: docFilter === f ? "var(--klax-accent-ink)" : "var(--ink-3)",
                    border: "1px solid var(--hair)",
                  }}
                >
                  {f === "all" ? "Alle" : f === "new" ? "Neu" : "Gematcht"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: "70vh" }}>
            {docsQuery.isLoading && (
              <div className="text-center py-8 text-[12px]" style={{ color: "var(--ink-4)" }}>Lade Belege…</div>
            )}
            {!docsQuery.isLoading && filteredDocs.length === 0 && (
              <EmptyState message="Keine Belege im aktuellen Filter." />
            )}
            {filteredDocs.map(d => {
              const meta = parseMeta(d.aiMetadata);
              const isSelected = selectedDocId === d.id;
              const isMatched = d.matchStatus === "matched" || d.matchStatus === "manual";
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDocId(isSelected ? null : d.id)}
                  className="w-full text-left rounded-md p-3 transition-all"
                  style={{
                    background: isSelected ? "var(--klax-accent-soft, #FFF6E6)" : "var(--surface)",
                    border: `1px solid ${isSelected ? "var(--klax-accent)" : "var(--hair)"}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: isMatched ? "var(--pos-soft)" : "var(--surface-2)",
                        color: isMatched ? "var(--pos)" : "var(--ink-3)",
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                          {meta?.counterparty ?? d.filename}
                        </span>
                        {isMatched && <Pill variant="pos" icon={<Link2 className="h-2.5 w-2.5" />}>verknüpft</Pill>}
                        {!isMatched && d.aiMetadata && <Pill variant="ai" icon={<Sparkles className="h-2.5 w-2.5" />}>KI</Pill>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                        {meta?.amount != null && (
                          <span className="mono font-medium">{formatCHF(parseAmount(meta.amount))}</span>
                        )}
                        {meta?.date && <span>{meta.date}</span>}
                        <span className="truncate flex-1">{d.filename}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 mt-1" style={{ color: "var(--ink-4)" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Rechte Spalte: Banktransaktionen */}
        <section className="klax-card p-4 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
              <h3 className="display text-[15px] font-medium" style={{ color: "var(--ink)" }}>
                Banktransaktionen
              </h3>
              <Pill variant="info">{filteredTxns.length}</Pill>
            </div>
            <div className="flex gap-1">
              {(["all", "unmatched"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className="text-[11.5px] px-2 py-1 rounded"
                  style={{
                    background: txFilter === f ? "var(--klax-accent)" : "transparent",
                    color: txFilter === f ? "var(--klax-accent-ink)" : "var(--ink-3)",
                    border: "1px solid var(--hair)",
                  }}
                >
                  {f === "all" ? "Alle" : "Ungematcht"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: "70vh" }}>
            {txQuery.isLoading && (
              <div className="text-center py-8 text-[12px]" style={{ color: "var(--ink-4)" }}>Lade Transaktionen…</div>
            )}
            {!txQuery.isLoading && filteredTxns.length === 0 && (
              <EmptyState message="Keine Banktransaktionen im aktuellen Filter." />
            )}
            {filteredTxns.map(t => {
              const isSelected = selectedTxId === t.id;
              const amount = parseAmount(t.amount);
              const isMatched = !!t.matchedDocumentId;
              const isInbound = amount > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTxId(isSelected ? null : t.id)}
                  className="w-full text-left rounded-md p-3 transition-all"
                  style={{
                    background: isSelected ? "var(--klax-accent-soft, #FFF6E6)" : "var(--surface)",
                    border: `1px solid ${isSelected ? "var(--klax-accent)" : "var(--hair)"}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: isMatched ? "var(--pos-soft)" : "var(--surface-2)",
                        color: isMatched ? "var(--pos)" : "var(--ink-3)",
                      }}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                          {t.counterparty ?? t.description ?? "Unbekannt"}
                        </span>
                        {isMatched && <Pill variant="pos" icon={<Link2 className="h-2.5 w-2.5" />}>verknüpft</Pill>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                        <span>{new Date(t.transactionDate).toLocaleDateString("de-CH")}</span>
                        {t.description && <span className="truncate flex-1">{t.description}</span>}
                      </div>
                    </div>
                    <div
                      className="mono text-[13px] font-medium flex-shrink-0"
                      style={{ color: isInbound ? "var(--pos)" : "var(--neg)" }}
                    >
                      {isInbound ? "+" : ""}{formatCHF(amount)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Match-Indikator unten */}
      {(selectedDocId || selectedTxId) && (
        <div
          className="klax-card p-3 flex items-center gap-3 sticky bottom-3"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-2)" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: "var(--ai)" }} />
          <div className="flex-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            {selectedDocId && selectedTxId
              ? "Beleg und Banktransaktion ausgewählt — bereit zum Verknüpfen."
              : selectedDocId
                ? "Beleg ausgewählt. Wähle nun eine passende Banktransaktion rechts."
                : "Banktransaktion ausgewählt. Wähle nun einen passenden Beleg links."}
          </div>
          <button
            onClick={() => { setSelectedDocId(null); setSelectedTxId(null); }}
            className="p-1 rounded"
            style={{ color: "var(--ink-3)" }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Upload-Modal */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowUpload(false)}
        >
          <div
            className="klax-card max-w-lg w-full p-6"
            style={{ background: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="display text-[18px] font-medium" style={{ color: "var(--ink)" }}>
                Beleg hochladen
              </h3>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 rounded"
                style={{ color: "var(--ink-3)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DocumentUpload
              fiscalYear={fiscalYear}
              onUploaded={() => {
                utils.documents.list.invalidate();
                toast.success("Beleg hochgeladen.");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function parseMeta(s: string | null | undefined): { counterparty?: string; amount?: number | string; date?: string } | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "pos" | "neg" | "ai" }) {
  const color = tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : tone === "ai" ? "var(--ai)" : "var(--ink-2)";
  return (
    <div className="klax-card p-3 flex items-center gap-3">
      <span
        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--surface-2)", color }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="display text-[18px] mono font-medium" style={{ color: "var(--ink)" }}>{value}</div>
        <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8">
      <CheckCircle className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--ink-4)" }} />
      <div className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>{message}</div>
    </div>
  );
}
