import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { DocumentUpload, type UploadedDocument } from "@/components/DocumentUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileText, Image, Eye, Trash2, Search, Filter, Check,
  Receipt, ArrowDownToLine, ArrowUpFromLine, StickyNote, Building2,
  Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle, Loader2, Calendar,
  Paperclip, ChevronRight, CreditCard, LayoutList, AlignJustify
} from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Pill } from "@/components/klax/Pill";
import { AICallout } from "@/components/klax/AICallout";

type PillKind = "default" | "info" | "ai" | "pos" | "warn" | "neg";

const DOC_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; pill: PillKind; stripe: string }> = {
  invoice_in:  { label: "Eingangsrechnung",  icon: <ArrowDownToLine className="w-3 h-3" />, pill: "info",    stripe: "var(--info)" },
  invoice_out: { label: "Ausgangsrechnung",  icon: <ArrowUpFromLine className="w-3 h-3" />, pill: "info",    stripe: "var(--info)" },
  credit_card_statement: { label: "KK-Abrechnung", icon: <CreditCard className="w-3 h-3" />, pill: "ai",    stripe: "var(--ai)" },
  receipt:     { label: "Barbelegung",       icon: <Receipt className="w-3 h-3" />,         pill: "pos",     stripe: "var(--pos)" },
  bank_statement: { label: "Kontoauszug",    icon: <Building2 className="w-3 h-3" />,        pill: "default", stripe: "var(--hair-strong)" },
  other:       { label: "Sonstiges",          icon: <StickyNote className="w-3 h-3" />,      pill: "default", stripe: "var(--hair-strong)" },
};

const MATCH_STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; pill: PillKind }> = {
  matched:   { label: "Mit Bank abgeglichen", icon: <CheckCircle2 className="w-3 h-3" />, pill: "pos" },
  unmatched: { label: "Nicht abgeglichen",    icon: <AlertCircle className="w-3 h-3" />,  pill: "warn" },
  manual:    { label: "Manuell abgeglichen",  icon: <Link2 className="w-3 h-3" />,        pill: "info" },
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
  const { fiscalYear, fiscalYears, fiscalYearInfos } = useFiscalYear();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Admin bulk-delete state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // GJ-Eröffnungs-Dialog State
  const [gjDialogOpen, setGjDialogOpen] = useState(false);
  const [gjDialogYear, setGjDialogYear] = useState<number | null>(null);
  const [gjDialogDocIds, setGjDialogDocIds] = useState<number[]>([]);
  const [gjCreating, setGjCreating] = useState(false);
  
  // Read filter from URL query params (sidebar sub-items use ?filter=... or ?type=...)
  const urlFilter = new URLSearchParams(window.location.search).get("filter");
  const urlType = new URLSearchParams(window.location.search).get("type");
  
  // Map sidebar filter values to internal filter states
  const getInitialMatchFilter = () => {
    if (urlFilter === "matched") return "matched";
    if (urlFilter === "new" || urlFilter === "review") return "unmatched";
    return "all";
  };

  // Map ?type=incoming to filterType "incoming" (Eingangsrechnungen)
  const getInitialTypeFilter = () => {
    if (urlType === "incoming") return "incoming";
    return "all";
  };
  
  const [filterType, setFilterType] = useState<string>(getInitialTypeFilter);
  const [filterMatch, setFilterMatch] = useState<string>(getInitialMatchFilter);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarFilter, setSidebarFilter] = useState<string | null>(urlFilter);
  const [viewMode, setViewMode] = useState<"compact" | "detail">("detail");
  
  // Update filters when URL changes (sidebar navigation)
  useEffect(() => {
    const newFilter = new URLSearchParams(window.location.search).get("filter");
    const newType = new URLSearchParams(window.location.search).get("type");
    setSidebarFilter(newFilter);
    if (newFilter === "matched") setFilterMatch("matched");
    else if (newFilter === "new" || newFilter === "review") setFilterMatch("unmatched");
    else if (!newFilter) { setFilterMatch("all"); }
    if (newType === "incoming") setFilterType("incoming");
    else if (!newType && !newFilter) setFilterType("all");
  }, [urlFilter, urlType]);

  // Manual match dialog state
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchDocId, setMatchDocId] = useState<number | null>(null);
  const [matchDocName, setMatchDocName] = useState("");
  const [txnSearch, setTxnSearch] = useState("");

  // "incoming" = Eingangsrechnungen (invoice_in + receipt + bank_statement, NICHT invoice_out/credit_card_statement)
  const incomingTypes = ["invoice_in", "receipt", "bank_statement"];
  const resolvedDocumentType = filterType === "incoming" ? undefined : (filterType !== "all" ? filterType : undefined);

  const { data: docs, refetch } = trpc.documents.list.useQuery({
    documentType: resolvedDocumentType,
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

  // Admin delete mutations
  const utils = trpc.useUtils();
  const adminDeleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Beleg gelöscht");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const adminBulkDeleteMutation = trpc.documents.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} Beleg(e) gelöscht`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)));
    }
  };

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

  const createFiscalYearMutation = trpc.yearEnd.createFiscalYear.useMutation({
    onSuccess: async (_, variables) => {
      toast.success(`Geschäftsjahr ${variables.year} wurde eröffnet`);
      // Update fiscalYear in documents that were uploaded with wrong GJ
      for (const docId of gjDialogDocIds) {
        await updateFiscalYearMutation.mutateAsync({ documentId: docId, fiscalYear: variables.year });
      }
      setGjDialogOpen(false);
      setGjDialogDocIds([]);
      setGjCreating(false);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setGjCreating(false);
    },
  });

  const handleUploaded = useCallback((doc: UploadedDocument) => {
    setRefreshKey(k => k + 1);
    refetch();
    // Check if document date is from a different year than current fiscalYear
    // and that year is not yet opened
    if (doc.aiMetadata) {
      try {
        const meta = JSON.parse(doc.aiMetadata);
        if (meta.documentDate) {
          const docYear = new Date(meta.documentDate).getFullYear();
          if (docYear !== fiscalYear && !isNaN(docYear) && docYear > 2000) {
            const isOpened = fiscalYearInfos.some(fy => fy.year === docYear);
            if (!isOpened) {
              // Ask user to open new fiscal year
              setGjDialogYear(docYear);
              setGjDialogDocIds(prev => [...prev, doc.id]);
              setGjDialogOpen(true);
            } else if (!fiscalYears.includes(docYear)) {
              // Year exists but not in list – just update the document's GJ
              updateFiscalYearMutation.mutate({ documentId: doc.id, fiscalYear: docYear });
            }
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }, [refetch, fiscalYear, fiscalYears, fiscalYearInfos]);

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
    // "incoming" type filter: nur Eingangsrechnungen (invoice_in, receipt, bank_statement)
    if (filterType === "incoming" && !incomingTypes.includes(doc.documentType ?? "")) return false;
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
    <div className="px-6 lg:px-8 py-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="display text-[22px] font-medium" style={{ color: "var(--ink)" }}>Belege</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Rechnungen, Kreditkartenabrechnungen und Barbelege zentral verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (confirm(`Alle Belege neu analysieren? Dies kann einige Minuten dauern.`)) batchReanalyzeMutation.mutate(); }}
            disabled={batchReanalyzeMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px]"
            style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair)" }}
          >
            {batchReanalyzeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Neu analysieren
          </button>
        </div>
      </div>

      {/* AI-Callout wenn ungematchte Belege vorhanden */}
      {unmatchedCount > 0 && (
        <AICallout
          title="Abgleich bereit"
          icon={<Link2 className="h-3.5 w-3.5" />}
          action={
            <button
              onClick={() => autoMatchMutation.mutate({ threshold: 40 })}
              disabled={autoMatchMutation.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] font-medium whitespace-nowrap"
              style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
            >
              {autoMatchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {autoMatchMutation.isPending ? "Abgleiche…" : "Jetzt abgleichen"}
            </button>
          }
        >
          {unmatchedCount} Beleg{unmatchedCount !== 1 ? "e" : ""} noch nicht mit Banktransaktionen
          abgeglichen. KLAX sucht automatisch nach Betrag, Gegenpartei und Datum.
        </AICallout>
      )}

      {/* Progress info */}
      {(autoMatchMutation.isPending || batchReanalyzeMutation.isPending) && (
        <div
          className="flex items-center gap-3 p-3 rounded-md"
          style={{ background: "var(--ai-soft)", border: "1px solid var(--ai-line)", color: "var(--ai)" }}
        >
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <div>
            <p className="text-[13px] font-medium">
              {autoMatchMutation.isPending && "KLAX sucht passende Belege und Transaktionen…"}
              {batchReanalyzeMutation.isPending && "KLAX analysiert alle Dokumente neu…"}
            </p>
            <p className="text-[11.5px] opacity-80">Bitte warten, dies kann einige Sekunden dauern.</p>
          </div>
        </div>
      )}

      {/* Filter-Kacheln (KLAX) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: null,           label: "Alle Belege",        count: stats.total,       icon: <FileText className="w-4 h-4" /> },
          { key: "new",          label: "Neu hochgeladen",    count: stats.newDocs,     icon: <ArrowDownToLine className="w-4 h-4" /> },
          { key: "ai-processed", label: "KI verarbeitet",     count: stats.aiProcessed, icon: <RefreshCw className="w-4 h-4" /> },
          { key: "review",       label: "Zu prüfen",          count: stats.review,      icon: <Eye className="w-4 h-4" /> },
          { key: "matched",      label: "Mit Bank abgeglichen", count: stats.matched,   icon: <CheckCircle2 className="w-4 h-4" /> },
          { key: "archived",     label: "Archiv",             count: stats.archived,    icon: <StickyNote className="w-4 h-4" /> },
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
              className="text-left p-4 rounded-[14px] transition-all"
              style={{
                background: isActive ? "var(--klax-accent)" : "var(--surface)",
                color: isActive ? "var(--klax-accent-ink)" : "var(--ink)",
                border: `1px solid ${isActive ? "var(--klax-accent)" : "var(--hair)"}`,
                boxShadow: isActive ? "var(--shadow-2)" : "var(--shadow-1)",
              }}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: isActive ? "var(--klax-accent-ink)" : "var(--ink-3)" }}>
                {tile.icon}
                <span className="text-[10.5px] uppercase tracking-wider font-medium">{tile.label}</span>
              </div>
              <div className="display mono text-[26px] font-medium leading-none">{tile.count}</div>
            </button>
          );
        })}
      </div>

      {/* Upload Zone */}
      <div className="klax-card p-5">
        <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--ink)" }}>Neuen Beleg hochladen</h3>
        <DocumentUpload onUploaded={handleUploaded} fiscalYear={fiscalYear} />
        <p className="text-[11.5px] mt-2" style={{ color: "var(--ink-3)" }}>
          KLAX analysiert den Beleg automatisch und extrahiert Betrag, Gegenpartei und Datum.
          Belege werden automatisch dem Geschäftsjahr <strong>GJ {fiscalYear}</strong> zugewiesen.
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
            <SelectItem value="incoming">Eingangsrechnungen (alle)</SelectItem>
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
            <SelectItem value="matched">Mit Bank abgeglichen</SelectItem>
            <SelectItem value="unmatched">Nicht abgeglichen</SelectItem>
            <SelectItem value="manual">Manuell abgeglichen</SelectItem>
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

      {/* Admin Bulk-Delete Toolbar */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">{selectedIds.size} Beleg{selectedIds.size !== 1 ? "e" : ""} ausgewählt</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} className="text-xs">
              Auswahl aufheben
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={adminBulkDeleteMutation.isPending}
              className="gap-1.5 text-xs"
            >
              {adminBulkDeleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {selectedIds.size} Beleg{selectedIds.size !== 1 ? "e" : ""} löschen
            </Button>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="klax-card overflow-hidden">
        {/* Admin: Select-All Header */}
        {isAdmin && filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid var(--hair)", background: "var(--surface-2)" }}>
            <Checkbox
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onCheckedChange={toggleAll}
              aria-label="Alle auswählen"
            />
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>
              {selectedIds.size > 0 ? `${selectedIds.size} von ${filtered.length} ausgewählt` : `Alle ${filtered.length} auswählen`}
            </span>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: "var(--ink-3)" }}>
            <FileText className="w-10 h-10 mb-3 opacity-40" />
            <p className="font-medium text-[14px]" style={{ color: "var(--ink)" }}>Keine Dokumente gefunden</p>
            <p className="text-[12.5px] mt-1">Laden Sie oben Ihren ersten Beleg hoch</p>
          </div>
        ) : (
          <div>
            {filtered.map(doc => {
              const typeInfo = DOC_TYPE_LABELS[doc.documentType] ?? DOC_TYPE_LABELS.other;
              const matchStatus = (doc as any).matchStatus ?? "unmatched";
              const matchInfo = MATCH_STATUS_LABELS[matchStatus] ?? MATCH_STATUS_LABELS.unmatched;
              const matchScoreVal = (doc as any).matchScore as number | null;
              let meta: any = null;
              try { if (doc.aiMetadata) meta = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }
              const docFiscalYear = doc.fiscalYear;
              const isUnmatched = matchStatus === "unmatched" || !matchStatus;

              const isSelected = selectedIds.has(doc.id);
              return (
                <div
                  key={doc.id}
                  className="group flex items-start gap-3 p-4 transition-colors cursor-pointer"
                  style={{ borderBottom: "1px solid var(--hair)", borderLeft: `3px solid ${typeInfo.stripe}`, background: isSelected ? "color-mix(in oklab, var(--neg) 5%, transparent)" : "transparent" }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  {/* Admin Checkbox */}
                  {isAdmin && (
                    <div className="flex-shrink-0 self-center" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(doc.id)}
                        aria-label={`Beleg ${doc.filename} auswählen`}
                      />
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div
                    className="mt-0.5 flex-shrink-0 w-10 h-12 rounded overflow-hidden flex items-center justify-center"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--hair)" }}
                  >
                    {doc.mimeType.startsWith("image/")
                      ? <img src={doc.s3Url} alt="" className="w-full h-full object-cover" />
                      : <span style={{ color: typeInfo.stripe }}>{typeInfo.icon}</span>
                    }
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[13.5px] truncate" style={{ color: "var(--ink)" }}>{doc.filename}</span>
                      <Pill variant={typeInfo.pill} icon={typeInfo.icon}>{typeInfo.label}</Pill>
                      <Pill variant={matchInfo.pill} icon={matchInfo.icon}>
                        {matchInfo.label}
                        {matchScoreVal != null && matchStatus === "matched" && (
                          <span className="ml-0.5 mono opacity-80">{matchScoreVal}%</span>
                        )}
                      </Pill>
                      {doc.bankTransactionId && (
                        <Pill icon={<Link2 className="w-3 h-3" />}>Txn #{doc.bankTransactionId}</Pill>
                      )}
                      {doc.journalEntryId && (
                        <Pill icon={<FileText className="w-3 h-3" />}>Buchung #{doc.journalEntryId}</Pill>
                      )}
                    </div>

                    {/* AI-extracted info – only in detail mode */}
                    {viewMode === "detail" && meta && (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                        {meta.counterparty && <span>Gegenpartei: <span className="font-medium" style={{ color: "var(--ink)" }}>{meta.counterparty}</span></span>}
                        {meta.totalAmount != null && <span>Betrag: <span className="mono font-medium" style={{ color: "var(--ink)" }}>CHF {formatCHF(Number(meta.totalAmount))}</span></span>}
                        {meta.documentDate && <span>Datum: <span className="mono font-medium" style={{ color: "var(--ink)" }}>{meta.documentDate}</span></span>}
                        {meta.vatRate != null && <span>MWST: <span className="mono font-medium" style={{ color: "var(--ink)" }}>{meta.vatRate}%</span></span>}
                        {meta.description && <span className="truncate max-w-xs">{meta.description}</span>}
                      </div>
                    )}

                    {viewMode === "detail" && (
                      <div className="mt-1 text-[11px]" style={{ color: "var(--ink-4)" }}>
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
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-2.5 text-xs bg-green-600 hover:bg-green-700 gap-1.5"
                      title="Verbuchen / Detailansicht"
                      onClick={(e) => { e.stopPropagation(); navigate(`/documents/${doc.id}?tab=verbuchen`); }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Verbuchen
                    </Button>
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
                    {isAdmin ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Admin: Löschen"
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Beleg "${doc.filename}" wirklich löschen?`)) adminDeleteMutation.mutate({ documentId: doc.id }); }}
                        disabled={adminDeleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Löschen"
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.filename); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
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

      {/* Admin Bulk-Delete Bestätigungsdialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              {selectedIds.size} Beleg{selectedIds.size !== 1 ? "e" : ""} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Belege werden dauerhaft aus der Datenbank und dem Speicher gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => adminBulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })}
              disabled={adminBulkDeleteMutation.isPending}
            >
              {adminBulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Ja, {selectedIds.size} Beleg{selectedIds.size !== 1 ? "e" : ""} löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GJ-Eröffnungs-Dialog */}
      <Dialog open={gjDialogOpen} onOpenChange={(open) => { if (!open) { setGjDialogOpen(false); setGjDialogDocIds([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Neues Geschäftsjahr eröffnen?
            </DialogTitle>
            <DialogDescription className="mt-2">
              Der hochgeladene Beleg hat das Datum <strong>{gjDialogYear}</strong>, aber das Geschäftsjahr{" "}
              <strong>GJ {gjDialogYear}</strong> wurde noch nicht eröffnet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Soll das Geschäftsjahr <strong>GJ {gjDialogYear}</strong> jetzt automatisch eröffnet werden?
            Der Beleg wird dann automatisch dem richtigen Geschäftsjahr zugewiesen.
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setGjDialogOpen(false); setGjDialogDocIds([]); }}
            >
              Nein, bei GJ {fiscalYear} belassen
            </Button>
            <Button
              onClick={() => {
                if (gjDialogYear) {
                  setGjCreating(true);
                  createFiscalYearMutation.mutate({ year: gjDialogYear });
                }
              }}
              disabled={gjCreating || createFiscalYearMutation.isPending}
            >
              {(gjCreating || createFiscalYearMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ja, GJ {gjDialogYear} eröffnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
