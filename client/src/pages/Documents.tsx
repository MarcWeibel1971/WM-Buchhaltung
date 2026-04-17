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
  Paperclip, ChevronRight, CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useLocation } from "wouter";

const DOC_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  invoice_in:  { label: "Eingangsrechnung",  icon: <ArrowDownToLine className="w-3.5 h-3.5" />, color: "text-red-600 bg-red-50" },
  invoice_out: { label: "Ausgangsrechnung",  icon: <ArrowUpFromLine className="w-3.5 h-3.5" />, color: "text-green-600 bg-green-50" },
  receipt:     { label: "Quittung",           icon: <Receipt className="w-3.5 h-3.5" />,         color: "text-blue-600 bg-blue-50" },
  bank_statement: { label: "Kontoauszug",    icon: <Building2 className="w-3.5 h-3.5" />,        color: "text-purple-600 bg-purple-50" },
  credit_card_statement: { label: "KK-Abrechnung", icon: <CreditCard className="w-3.5 h-3.5" />, color: "text-orange-600 bg-orange-50" },
  other:       { label: "Sonstiges",          icon: <StickyNote className="w-3.5 h-3.5" />,      color: "text-gray-600 bg-gray-50" },
};

const MATCH_STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  matched:   { label: "Matched",   icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-700 bg-green-100 border-green-200" },
  unmatched: { label: "Offen",     icon: <AlertCircle className="w-3.5 h-3.5" />,  color: "text-amber-700 bg-amber-50 border-amber-200" },
  manual:    { label: "Manuell",   icon: <Link2 className="w-3.5 h-3.5" />,        color: "text-blue-700 bg-blue-50 border-blue-200" },
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
      if (result.matched > 0) {
        toast.success(`${result.matched} Dokument(e) automatisch mit Transaktionen gematched`);
      } else {
        toast.info("Keine neuen Matches gefunden");
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
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dokumente</h2>
          <p className="text-sm text-muted-foreground">Belege, Rechnungen und Quittungen zentral verwalten</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => autoMatchMutation.mutate({ threshold: 50 })}
          disabled={autoMatchMutation.isPending}
          className="gap-2"
        >
          {autoMatchMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Auto-Match
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm(`Alle Dokumente neu analysieren? Dies kann einige Minuten dauern.`)) {
              batchReanalyzeMutation.mutate();
            }
          }}
          disabled={batchReanalyzeMutation.isPending}
          className="gap-2"
        >
          {batchReanalyzeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Alle neu analysieren
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Gesamt", value: stats.total, color: "text-foreground" },
          { label: "Matched", value: stats.matched, color: "text-green-600" },
          { label: "Offen", value: stats.unmatched, color: "text-amber-600" },
          { label: "Eingangsrechnungen", value: stats.invoice_in, color: "text-red-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3">Neues Dokument hochladen</h3>
        <DocumentUpload onUploaded={handleUploaded} fiscalYear={fiscalYear} />
        <p className="text-xs text-muted-foreground mt-2">
          Die KI analysiert den Beleg automatisch und extrahiert Betrag, Gegenpartei und Datum.
          Dokumente werden automatisch dem Geschäftsjahr <strong>GJ {fiscalYear}</strong> zugewiesen.
          Klicken Sie «Auto-Match» um Dokumente automatisch mit Banktransaktionen zu verknüpfen.
        </p>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          <SelectTrigger className="w-full sm:w-40">
            <Link2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Match-Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="unmatched">Offen</SelectItem>
            <SelectItem value="manual">Manuell</SelectItem>
          </SelectContent>
        </Select>
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
                  className="group flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-primary"
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

                    {/* AI-extracted info */}
                    {meta && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {meta.counterparty && <span>Gegenpartei: <span className="text-foreground font-medium">{meta.counterparty}</span></span>}
                        {meta.totalAmount != null && <span>Betrag: <span className="text-foreground font-medium">CHF {formatCHF(Number(meta.totalAmount))}</span></span>}
                        {meta.documentDate && <span>Datum: <span className="text-foreground font-medium">{meta.documentDate}</span></span>}
                        {meta.vatRate != null && <span>MWST: <span className="text-foreground font-medium">{meta.vatRate}%</span></span>}
                        {meta.description && <span className="truncate max-w-xs">{meta.description}</span>}
                      </div>
                    )}

                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
                    </div>
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
