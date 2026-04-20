import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { DocumentUpload, type UploadedDocument } from "@/components/DocumentUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Image, Eye, Trash2, Search, Filter,
  Receipt, ArrowDownToLine, ArrowUpFromLine, StickyNote, Building2,
  Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle, Loader2, Calendar,
  Paperclip, ChevronRight, CreditCard, LayoutList, AlignJustify
} from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useLocation } from "wouter";

const DOC_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string; border: string }> = {
  // Rechnungen (Eingang + Ausgang) → Blau
  invoice_in:  { label: "Eingangsrechnung",  icon: <ArrowDownToLine className="w-3.5 h-3.5" />, color: "text-blue-700 bg-blue-50",   border: "border-l-4 border-l-blue-400" },
  invoice_out: { label: "Ausgangsrechnung",  icon: <ArrowUpFromLine className="w-3.5 h-3.5" />, color: "text-blue-600 bg-blue-50",   border: "border-l-4 border-l-blue-300" },
  // Kreditkartenabrechnungen → Lila
  credit_card_statement: { label: "KK-Abrechnung", icon: <CreditCard className="w-3.5 h-3.5" />, color: "text-purple-700 bg-purple-50", border: "border-l-4 border-l-purple-500" },
  // Barbelege / Quittungen → Grün
  receipt:     { label: "Barbelegung",       icon: <Receipt className="w-3.5 h-3.5" />,         color: "text-emerald-700 bg-emerald-50", border: "border-l-4 border-l-emerald-500" },
  // Kontoauszüge → Grau-Blau
  bank_statement: { label: "Kontoauszug",    icon: <Building2 className="w-3.5 h-3.5" />,        color: "text-slate-600 bg-slate-50",  border: "border-l-4 border-l-slate-400" },
  other:       { label: "Sonstiges",          icon: <StickyNote className="w-3.5 h-3.5" />,      color: "text-gray-600 bg-gray-50",   border: "border-l-4 border-l-gray-300" },
};

const MATCH_STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  matched:   { label: "Verknüpft",             icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-700 bg-green-100 border-green-200" },
  unmatched: { label: "Nicht verknüpft",       icon: <AlertCircle className="w-3.5 h-3.5" />,  color: "text-amber-700 bg-amber-50 border-amber-200" },
  manual:    { label: "Manuell verknüpft",     icon: <Link2 className="w-3.5 h-3.5" />,        color: "text-blue-700 bg-blue-50 border-blue-200" },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCHF(n: number) {
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Documents() {
  const { fiscalYear, fiscalYears } = useFiscalYear();
  const [, navigate] = useLocation();
  
  // Read filter from URL query params (sidebar sub-items use ?filter=...)
  const urlFilter = new URLSearchParams(window.location.search).get("filter");
  
  // Map sidebar filter values to internal filter states
  const getInitialMatchFilter = () => {
    if (urlFilter === "matched") return "matched";
    if (urlFilter === "new" || urlFilter === "review") return "unmatched";
    return "all";
  };
  
  const [filterType, setFilterType] = useState<string>("all");
  const [filterMatch, setFilterMatch] = useState<string>(getInitialMatchFilter);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarFilter, setSidebarFilter] = useState<string | null>(urlFilter);
  const [viewMode, setViewMode] = useState<"compact" | "detail">("detail");
  
  // Update filters when URL changes (sidebar navigation)
  useEffect(() => {
    const newFilter = new URLSearchParams(window.location.search).get("filter");
    setSidebarFilter(newFilter);
    if (newFilter === "matched") setFilterMatch("matched");
    else if (newFilter === "new" || newFilter === "review") setFilterMatch("unmatched");
    else if (!newFilter) { setFilterMatch("all"); setFilterType("all"); }
  }, [urlFilter]);

  // Manual match dialog state
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchDocId, setMatchDocId] = useState<number | null>(null);
  const [matchDocName, setMatchDocName] = useState("");
  const [txnSearch, setTxnSearch] = useState("");

  const { data: docs, refetch } = trpc.documents.list.useQuery({
    documentType: filterType !== "all" ? filterType : undefined,
    fiscalYear: fiscalYear,
    limit: 200,
  });

  // Unmatched transactions for manual matching dialog
  const { data: unmatchedTxns } = trpc.bankImport.listUnmatchedTransactions.useQuery(
    { search: txnSearch || undefined, limit: 50 },
    { enabled: matchDialogOpen }
  );

  const autoMatchMutation = trpc.documents.autoMatch.useMutation({
    onSuccess: (result) => {
      const dbg = (result as any).debug;
      if (result.matched > 0) {
        toast.success(`${result.matched} Dokument(e) automatisch mit Transaktionen gematched`);
      } else {
        const info = dbg ? ` (${dbg.unmatchedDocs} Belege ohne Match, ${dbg.pendingTxns} ausstehende Transaktionen)` : '';
        toast.info(`Keine neuen Matches gefunden${info}`);
      }
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const batchReanalyzeMutation = trpc.documents.batchReanalyze.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.success} von ${result.total} Dokument(en) neu analysiert`);
      if (result.failed > 0) toast.warning(`${result.failed} Dokument(e) konnten nicht analysiert werden`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const unmatchMutation = trpc.documents.unmatch.useMutation({
    onSuccess: () => {
      toast.success("Match aufgehoben");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const manualMatchMutation = trpc.documents.manualMatch.useMutation({
    onSuccess: () => {
      toast.success("Dokument erfolgreich mit Transaktion verknüpft");
      setMatchDialogOpen(false);
      setMatchDocId(null);
      setTxnSearch("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateFiscalYearMutation = trpc.documents.updateFiscalYear.useMutation({
    onSuccess: () => {
      toast.success("Geschäftsjahr aktualisiert");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUploaded = useCallback((_doc: UploadedDocument) => {
    setRefreshKey(k => k + 1);
    refetch();
  }, [refetch]);

  const handleDelete = useCallback(async (id: number, filename: string) => {
    if (!confirm(`Dokument "${filename}" wirklich löschen?`)) return;
    try {
      const resp = await fetch(`/api/upload/document/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Löschen fehlgeschlagen");
      toast.success(`"${filename}" gelöscht`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [refetch]);

  const openMatchDialog = (docId: number, docName: string) => {
    setMatchDocId(docId);
    setMatchDocName(docName);
    setTxnSearch("");
    setMatchDialogOpen(true);
  };

  const filtered = (docs ?? []).filter(doc => {
    // Sidebar filter from URL params
    if (sidebarFilter) {
      const ms = (doc as any).matchStatus ?? "unmatched";
      const hasAi = !!(doc as any).aiMetadata;
      switch (sidebarFilter) {
        case "new": if (hasAi || ms === "matched" || ms === "manual") return false; break;
        case "ai-processed": if (!hasAi || ms === "matched" || ms === "manual") return false; break;
        case "review": if (ms !== "unmatched" || !hasAi) return false; break;
        case "matched": if (ms !== "matched" && ms !== "manual") return false; break;
        case "archived": if (doc.documentType !== "other") return false; break;
      }
    }
    // Match status filter (from dropdown)
    if (!sidebarFilter && filterMatch !== "all") {
      const ms = (doc as any).matchStatus ?? "unmatched";
      if (ms !== filterMatch) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      doc.filename.toLowerCase().includes(q) ||
      (doc.notes ?? "").toLowerCase().includes(q) ||
      (doc.aiMetadata ? (() => {
        try {
          const m = JSON.parse(doc.aiMetadata!);
          return (m.counterparty ?? "").toLowerCase().includes(q) ||
                 (m.description ?? "").toLowerCase().includes(q);
        } catch { return false; }
      })() : false)
    );
  });

  // Stats
  const allDocs = docs ?? [];
  const stats = {
    total: allDocs.length,
    matched: allDocs.filter(d => (d as any).matchStatus === "matched" || (d as any).matchStatus === "manual").length,
    unmatched: allDocs.filter(d => (d as any).matchStatus === "unmatched" || !(d as any).matchStatus).length,
    invoice_in: allDocs.filter(d => d.documentType === "invoice_in").length,
    newDocs: allDocs.filter(d => { const ms = (d as any).matchStatus ?? "unmatched"; const hasAi = !!(d as any).aiMetadata; return !hasAi && ms !== "matched" && ms !== "manual"; }).length,
    aiProcessed: allDocs.filter(d => { const ms = (d as any).matchStatus ?? "unmatched"; const hasAi = !!(d as any).aiMetadata; return hasAi && ms !== "matched" && ms !== "manual"; }).length,
    review: allDocs.filter(d => { const ms = (d as any).matchStatus ?? "unmatched"; const hasAi = !!(d as any).aiMetadata; return ms === "unmatched" && hasAi; }).length,
    archived: allDocs.filter(d => d.documentType === "other").length,
  };

  // Count unmatched docs that could be matched
  const unmatchedCount = stats.unmatched;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Belege</h2>
          <p className="text-sm text-muted-foreground">Rechnungen, Kreditkartenabrechnungen und Barbelege zentral verwalten</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Alle Belege neu analysieren? Dies kann einige Minuten dauern.`)) {
                batchReanalyzeMutation.mutate();
              }
            }}
            disabled={batchReanalyzeMutation.isPending}
            className="gap-2 text-xs"
          >
            {batchReanalyzeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Neu analysieren
          </Button>
        </div>
      </div>

      {/* Prominenter Abgleichen-Banner wenn ungematchte Belege vorhanden */}
      {unmatchedCount > 0 && (
        <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/15 rounded-lg">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{unmatchedCount} Beleg{unmatchedCount !== 1 ? "e" : ""} noch nicht mit Banktransaktionen abgeglichen</p>
              <p className="text-xs text-muted-foreground">KI sucht automatisch passende Transaktionen nach Betrag, Gegenpartei und Datum</p>
            </div>
          </div>
          <Button
            onClick={() => autoMatchMutation.mutate({ threshold: 40 })}
            disabled={autoMatchMutation.isPending}
            className="gap-2 shrink-0"
            size="default"
          >
            {autoMatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {autoMatchMutation.isPending ? "Abgleiche..." : "Jetzt abgleichen"}
          </Button>
        </div>
      )}

      {/* KI-Fortschrittsanzeige */}
      {(autoMatchMutation.isPending || batchReanalyzeMutation.isPending) && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">
              {autoMatchMutation.isPending && "KI sucht passende Belege und Transaktionen..."}
              {batchReanalyzeMutation.isPending && "KI analysiert alle Dokumente neu..."}
            </p>
            <p className="text-xs text-muted-foreground">Bitte warten, dies kann einige Sekunden dauern.</p>
          </div>
        </div>
      )}

      {/* Filter-Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: null,           label: "Alle Belege",        count: stats.total,       accent: "from-slate-500 to-slate-600",   light: "bg-slate-50 border-slate-200 text-slate-700",   icon: <FileText className="w-5 h-5" /> },
          { key: "new",          label: "Neu hochgeladen",    count: stats.newDocs,     accent: "from-blue-500 to-blue-600",     light: "bg-blue-50 border-blue-200 text-blue-700",      icon: <ArrowDownToLine className="w-5 h-5" /> },
          { key: "ai-processed", label: "KI verarbeitet",     count: stats.aiProcessed, accent: "from-purple-500 to-purple-600", light: "bg-purple-50 border-purple-200 text-purple-700", icon: <RefreshCw className="w-5 h-5" /> },
          { key: "review",       label: "Zu prüfen",          count: stats.review,      accent: "from-amber-500 to-orange-500",  light: "bg-amber-50 border-amber-200 text-amber-700",   icon: <Eye className="w-5 h-5" /> },
          { key: "matched",      label: "Verknüpft",          count: stats.matched,     accent: "from-green-500 to-emerald-600", light: "bg-green-50 border-green-200 text-green-700",   icon: <CheckCircle2 className="w-5 h-5" /> },
          { key: "archived",     label: "Archiv",             count: stats.archived,    accent: "from-gray-400 to-gray-500",     light: "bg-gray-50 border-gray-200 text-gray-600",      icon: <StickyNote className="w-5 h-5" /> },
        ].map(tile => {
          const isActive = sidebarFilter === tile.key;
          return (
            <button
              key={String(tile.key)}
              onClick={() => {
                setSidebarFilter(tile.key);
                if (!tile.key) { setFilterMatch("all"); setFilterType("all"); }
                else if (tile.key === "matched") setFilterMatch("matched");
                else if (tile.key === "new" || tile.key === "review") setFilterMatch("unmatched");
              }}
              className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                isActive
                  ? `bg-gradient-to-br ${tile.accent} text-white border-transparent shadow-lg scale-[1.02]`
                  : `${tile.light} border-transparent hover:border-current hover:shadow-md`
              }`}
            >
              <div className={`mb-2 p-2 rounded-lg ${ isActive ? "bg-white/20" : "bg-white shadow-sm" }`}>
                <span className={isActive ? "text-white" : ""}>{tile.icon}</span>
              </div>
              <div className={`text-2xl font-bold leading-none mb-1 ${ isActive ? "text-white" : "" }`}>{tile.count}</div>
              <div className={`text-xs font-medium leading-tight ${ isActive ? "text-white/90" : "" }`}>{tile.label}</div>
            </button>
          );
        })}
      </div>

      {/* Upload Zone */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3">Neuen Beleg hochladen</h3>
        <DocumentUpload onUploaded={handleUploaded} fiscalYear={fiscalYear} />
        <p className="text-xs text-muted-foreground mt-2">
          Die KI analysiert den Beleg automatisch und extrahiert Betrag, Gegenpartei und Datum.
          Belege werden automatisch dem Geschäftsjahr <strong>GJ {fiscalYear}</strong> zugewiesen.
          Nutzen Sie den «Jetzt abgleichen»-Button oben um Belege automatisch mit Banktransaktionen zu verknüpfen.
        </p>
      </div>

      {/* Filter & Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Dateiname, Gegenpartei, Beschreibung…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="invoice_in">Eingangsrechnungen</SelectItem>
            <SelectItem value="invoice_out">Ausgangsrechnungen</SelectItem>
            <SelectItem value="receipt">Quittungen</SelectItem>
            <SelectItem value="bank_statement">Kontoauszüge</SelectItem>
            <SelectItem value="credit_card_statement">KK-Abrechnungen</SelectItem>
            <SelectItem value="other">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMatch} onValueChange={setFilterMatch}>
          <SelectTrigger className="w-full sm:w-44">
            <Link2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Buchungsstatus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="matched">Verknüpft</SelectItem>
            <SelectItem value="unmatched">Nicht verknüpft</SelectItem>
            <SelectItem value="manual">Manuell verknüpft</SelectItem>
          </SelectContent>
        </Select>
        {/* View Mode Toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden flex-shrink-0">
          <button
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              viewMode === "compact" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setViewMode("compact")}
            title="Übersicht: nur erste Zeile"
          >
            <LayoutList className="w-3.5 h-3.5" />
            Übersicht
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-border ${
              viewMode === "detail" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setViewMode("detail")}
            title="Details: alle Zeilen"
          >
            <AlignJustify className="w-3.5 h-3.5" />
            Details
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Keine Dokumente gefunden</p>
            <p className="text-sm mt-1">Laden Sie oben Ihren ersten Beleg hoch</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(doc => {
              const typeInfo = DOC_TYPE_LABELS[doc.documentType] ?? DOC_TYPE_LABELS.other;
              const matchStatus = (doc as any).matchStatus ?? "unmatched";
              const matchInfo = MATCH_STATUS_LABELS[matchStatus] ?? MATCH_STATUS_LABELS.unmatched;
              const matchScoreVal = (doc as any).matchScore as number | null;
              let meta: any = null;
              try { if (doc.aiMetadata) meta = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }
              const docFiscalYear = doc.fiscalYear;
              const isUnmatched = matchStatus === "unmatched" || !matchStatus;

              return (
                <div
                  key={doc.id}
                  className={`group flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer ${typeInfo.border}`}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="mt-0.5 flex-shrink-0 w-10 h-12 rounded border border-border overflow-hidden bg-muted/50 flex items-center justify-center">
                    {doc.mimeType.startsWith("image/")
                      ? <img src={doc.s3Url} alt="" className="w-full h-full object-cover" />
                      : <FileText className="w-5 h-5 text-red-400" />
                    }
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{doc.filename}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                        {typeInfo.icon}
                        {typeInfo.label}
                      </span>
 
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border font-medium ${matchInfo.color}`}>
                        {matchInfo.icon}
                        {matchInfo.label}
                        {matchScoreVal != null && matchStatus === "matched" && (
                          <span className="ml-0.5 opacity-70">{matchScoreVal}%</span>
                        )}
                      </span>
                      {doc.bankTransactionId && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Link2 className="w-3 h-3" />
                          Txn #{doc.bankTransactionId}
                        </Badge>
                      )}
                      {doc.journalEntryId && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileText className="w-3 h-3" />
                          Buchung #{doc.journalEntryId}
                        </Badge>
                      )}
                    </div>

                    {/* AI-extracted info – only in detail mode */}
                    {viewMode === "detail" && meta && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {meta.counterparty && <span>Gegenpartei: <span className="text-foreground font-medium">{meta.counterparty}</span></span>}
                        {meta.totalAmount != null && <span>Betrag: <span className="text-foreground font-medium">CHF {formatCHF(Number(meta.totalAmount))}</span></span>}
                        {meta.documentDate && <span>Datum: <span className="text-foreground font-medium">{meta.documentDate}</span></span>}
                        {meta.vatRate != null && <span>MWST: <span className="text-foreground font-medium">{meta.vatRate}%</span></span>}
                        {meta.description && <span className="truncate max-w-xs">{meta.description}</span>}
                      </div>
                    )}

                    {viewMode === "detail" && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
                      </div>
                    )}
                  </div>

                  {/* Fiscal Year Select */}
                  <div className="flex-shrink-0">
                    <Select
                      value={docFiscalYear != null ? String(docFiscalYear) : "none"}
                      onValueChange={(val) => {
                        if (val === "none") return;
                        const newYear = parseInt(val);
                        updateFiscalYearMutation.mutate({ documentId: doc.id, fiscalYear: newYear });
                      }}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <Calendar className="w-3 h-3 mr-1 text-muted-foreground" />
                        {docFiscalYear != null ? `GJ ${docFiscalYear}` : "GJ"}
                      </SelectTrigger>
                      <SelectContent>
                        {fiscalYears.map(y => (
                          <SelectItem key={y} value={String(y)}>GJ {y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.s3Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Öffnen"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </a>
                    {isUnmatched && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700"
                        title="Manuell mit Banktransaktion verknüpfen"
                        onClick={(e) => { e.stopPropagation(); openMatchDialog(doc.id, doc.filename); }}
                      >
                        <Paperclip className="w-4 h-4" />
                      </Button>
                    )}
                    {(matchStatus === "matched" || matchStatus === "manual") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-600 hover:text-amber-700"
                        title="Match aufheben"
                        onClick={(e) => { e.stopPropagation(); unmatchMutation.mutate({ documentId: doc.id }); }}
                      >
                        <Unlink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Löschen"
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.filename); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Click indicator */}
                  <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              Transaktion manuell verknüpfen
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Dokument: <span className="font-medium text-foreground">{matchDocName}</span>
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Transaktion suchen (Buchungstext, Lieferant...)"
                className="pl-9"
                value={txnSearch}
                onChange={e => setTxnSearch(e.target.value)}
              />
            </div>

            {/* Transaction List */}
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              {!unmatchedTxns || unmatchedTxns.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  Keine unverknüpften Transaktionen gefunden
                </div>
              ) : (
                unmatchedTxns.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{tx.transactionDate}</span>
                        <span className="font-medium text-sm truncate">{tx.bookingText || tx.description || '–'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {tx.counterpartyName && <span>{tx.counterpartyName}</span>}
                        {tx.bankAccountName && <span className="opacity-70">{tx.bankAccountName}</span>}
                      </div>
                    </div>
                    <div className={`text-sm font-mono font-medium whitespace-nowrap ${Number(tx.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      CHF {formatCHF(Number(tx.amount))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                      disabled={manualMatchMutation.isPending}
                      onClick={() => {
                        if (matchDocId) {
                          manualMatchMutation.mutate({
                            documentId: matchDocId,
                            transactionId: tx.id,
                          });
                        }
                      }}
                    >
                      <Paperclip className="w-3.5 h-3.5 mr-1" />
                      Verknüpfen
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
