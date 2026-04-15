import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useSearch } from "wouter";
import { Check, X, Edit2, Search, Filter, Plus, ChevronDown, ChevronUp, Layers, Trash2, RotateCcw, ArrowLeftRight, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocumentUpload, DocumentList } from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BookingDetailDialog from "@/components/BookingDetailDialog";

function formatCHF(val: number | string) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return <span className="badge-pending">Ausstehend</span>;
  if (status === "approved") return <span className="badge-approved">Genehmigt</span>;
  return <span className="badge-rejected">Abgelehnt</span>;
}

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    manual: "Manuell", bank_import: "Bank", credit_card: "Kreditkarte",
    payroll: "Lohn", vat: "MWST", system: "System",
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
      {labels[source] ?? source}
    </span>
  );
}

export default function Journal() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<false | "single" | "collective">(false);
  const [detailEntryId, setDetailEntryId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [crossPageAll, setCrossPageAll] = useState(false); // true = alle Seiten selektiert
  const lastClickedIndexRef = useRef<number | null>(null);
  const limit = 20;

  const { fiscalYear } = useFiscalYear();

  const filters = useMemo(() => ({
    status: status === "all" ? undefined : status as any,
    search: search || undefined,
    fiscalYear,
    limit,
    offset,
  }), [status, search, offset, fiscalYear]);

  const { data, refetch } = trpc.journal.list.useQuery(filters);
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: entryDetail } = trpc.journal.getWithLines.useQuery(
    { entryId: expandedId! },
    { enabled: expandedId !== null }
  );

  const utils = trpc.useUtils();
  const approveMutation = trpc.journal.approve.useMutation({
    onSuccess: () => { toast.success("Buchung genehmigt"); utils.journal.list.invalidate(); utils.reports.dashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = trpc.journal.reject.useMutation({
    onSuccess: () => { toast.success("Buchung abgelehnt"); utils.journal.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.journal.delete.useMutation({
    onSuccess: () => { toast.success("Buchung gelöscht"); utils.journal.list.invalidate(); utils.reports.dashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const revertMutation = trpc.journal.revert.useMutation({
    onSuccess: () => { toast.success("Buchung zurück auf Ausstehend gesetzt"); utils.journal.list.invalidate(); utils.reports.dashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  // Sort state for journal table
  const [jSortCol, setJSortCol] = useState<string>("nr");
  const [jSortDir, setJSortDir] = useState<"asc" | "desc">("desc");
  const toggleJSort = (col: string) => {
    if (jSortCol === col) { setJSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setJSortCol(col); setJSortDir(col === "amount" || col === "nr" ? "desc" : "asc"); }
  };
  const JSortIcon = ({ col }: { col: string }) => {
    if (jSortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return jSortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedEntries = useMemo(() => {
    if (!entries.length) return entries;
    const arr = [...entries];
    const dir = jSortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      switch (jSortCol) {
        case "nr":
          return ((a.entryNumber ?? 0) - (b.entryNumber ?? 0)) * dir;
        case "date": {
          const da = a.bookingDate ? new Date(a.bookingDate).getTime() : 0;
          const db = b.bookingDate ? new Date(b.bookingDate).getTime() : 0;
          return (da - db) * dir;
        }
        case "type":
          return ((a.isCollective ? 1 : 0) - (b.isCollective ? 1 : 0)) * dir;
        case "description":
          return ((a.description ?? "").localeCompare(b.description ?? "", "de")) * dir;
        case "debit":
          return ((a.debitAccountLabel ?? "").localeCompare(b.debitAccountLabel ?? "", "de")) * dir;
        case "credit":
          return ((a.creditAccountLabel ?? "").localeCompare(b.creditAccountLabel ?? "", "de")) * dir;
        case "amount":
          return ((a.totalAmount ?? 0) - (b.totalAmount ?? 0)) * dir;
        case "source":
          return ((a.source ?? "").localeCompare(b.source ?? "", "de")) * dir;
        case "status": {
          const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
          return ((order[a.status ?? ""] ?? 3) - (order[b.status ?? ""] ?? 3)) * dir;
        }
        default: return 0;
      }
    });
    return arr;
  }, [entries, jSortCol, jSortDir]);

  // Cross-page: load all IDs for current filter
  const allIdsFilter = useMemo(() => ({
    status: status === "all" ? undefined : status as any,
    search: search || undefined,
    fiscalYear,
  }), [status, search, fiscalYear]);
  const { data: allIdsData } = trpc.journal.getAllIds.useQuery(allIdsFilter, { enabled: crossPageAll });

  // Selection helpers
  const toggleSelect = (id: number, event?: React.MouseEvent, rowIndex?: number) => {
    if (event?.shiftKey && lastClickedIndexRef.current !== null && rowIndex !== undefined) {
      // Shift-click: select range
      const start = Math.min(lastClickedIndexRef.current, rowIndex);
      const end = Math.max(lastClickedIndexRef.current, rowIndex);
      const rangeIds = entries.slice(start, end + 1).map((e: any) => e.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach((rid: number) => next.add(rid));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      lastClickedIndexRef.current = rowIndex ?? null;
    }
    setCrossPageAll(false);
  };
  const toggleSelectAll = () => {
    if (entries.length > 0 && selectedIds.size === entries.length) {
      setSelectedIds(new Set());
      setCrossPageAll(false);
      lastClickedIndexRef.current = null;
    } else {
      setSelectedIds(new Set(entries.map((e: any) => e.id)));
      setCrossPageAll(false);
      lastClickedIndexRef.current = null;
    }
  };
  const selectAllPages = () => {
    if (allIdsData) {
      setSelectedIds(new Set(allIdsData.ids));
    } else {
      setCrossPageAll(true); // trigger query, apply when loaded
    }
  };

  // Apply cross-page IDs when loaded
  useMemo(() => {
    if (crossPageAll && allIdsData) {
      setSelectedIds(new Set(allIdsData.ids));
      setCrossPageAll(false);
    }
  }, [crossPageAll, allIdsData]);

  // Derived selection info
  const selectedEntries = entries.filter((e: any) => selectedIds.has(e.id));
  const selectedPending = selectedEntries.filter((e: any) => e.status === "pending");
  const selectedApproved = selectedEntries.filter((e: any) => e.status === "approved");

  // Bulk mutations
  const bulkApproveMut = trpc.journal.bulkApprove.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.approved} Buchung(en) genehmigt` + (res.skipped ? `, ${res.skipped} übersprungen` : ""));
      setSelectedIds(new Set());
      utils.journal.list.invalidate();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const bulkDeleteMut = trpc.journal.bulkDelete.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.deleted} Buchung(en) gelöscht` + (res.skipped ? `, ${res.skipped} übersprungen` : ""));
      setSelectedIds(new Set());
      utils.journal.list.invalidate();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const bulkRevertMut = trpc.journal.bulkRevert.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.reverted} Buchung(en) zurückgesetzt` + (res.skipped ? `, ${res.skipped} übersprungen` : ""));
      setSelectedIds(new Set());
      utils.journal.list.invalidate();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Journal</h2>
          <p className="text-sm text-muted-foreground">{total} Buchungen</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowExportDialog(true)}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Neue Buchung <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowCreateDialog("single")}>
                <Edit2 className="h-4 w-4 mr-2" /> Einzelbuchung
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCreateDialog("collective")}>
                <Layers className="h-4 w-4 mr-2" /> Sammelbuchung
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0); }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={v => { setStatus(v); setOffset(0); }}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="approved">Genehmigt</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} ausgewählt</span>
          <div className="flex-1" />
          {selectedPending.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
              disabled={bulkApproveMut.isPending}
              onClick={() => bulkApproveMut.mutate({ entryIds: selectedPending.map(e => e.id) })}>
              <Check className="h-3 w-3" />
              {bulkApproveMut.isPending ? "Genehmige..." : `${selectedPending.length} genehmigen`}
            </Button>
          )}
          {selectedApproved.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              disabled={bulkRevertMut.isPending}
              onClick={() => bulkRevertMut.mutate({ entryIds: selectedApproved.map(e => e.id) })}>
              <RotateCcw className="h-3 w-3" />
              {bulkRevertMut.isPending ? "Setze zurück..." : `${selectedApproved.length} zurücksetzen`}
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
            disabled={bulkDeleteMut.isPending}
            onClick={() => setConfirmDialog({
              open: true,
              title: "Buchungen löschen",
              message: `${selectedIds.size} Buchung(en) wirklich löschen? Verknüpfte Bankimport-Transaktionen werden auf Ausstehend zurückgesetzt.`,
              onConfirm: () => bulkDeleteMut.mutate({ entryIds: Array.from(selectedIds) }),
            })}>
            <Trash2 className="h-3 w-3" />
            {bulkDeleteMut.isPending ? "Lösche..." : `${selectedIds.size} löschen`}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSelectedIds(new Set()); setCrossPageAll(false); lastClickedIndexRef.current = null; }}>
            <X className="h-3 w-3 mr-1" /> Auswahl aufheben
          </Button>
        </div>
      )}

      {/* Cross-page selection banner */}
      {selectedIds.size === entries.length && entries.length > 0 && selectedIds.size > 0 && total > limit && selectedIds.size < total && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
          <span>Alle {entries.length} Einträge dieser Seite sind ausgewählt.</span>
          <button
            className="font-semibold underline hover:no-underline ml-1"
            onClick={selectAllPages}
          >
            Alle {total} Buchungen auswählen
          </button>
        </div>
      )}
      {selectedIds.size === total && total > limit && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
          <span>Alle <strong>{total}</strong> Buchungen sind ausgewählt.</span>
          <button
            className="font-semibold underline hover:no-underline ml-1"
            onClick={() => { setSelectedIds(new Set(entries.map((e: any) => e.id))); setCrossPageAll(false); }}
          >
            Nur diese Seite behalten
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th className="w-10 px-2">
                  <Checkbox
                    checked={entries.length > 0 && selectedIds.size === entries.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("nr")}>
                  <span className="inline-flex items-center">Nr.<JSortIcon col="nr" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("date")}>
                  <span className="inline-flex items-center">Datum<JSortIcon col="date" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("type")}>
                  <span className="inline-flex items-center">Typ<JSortIcon col="type" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("description")}>
                  <span className="inline-flex items-center">Beschreibung<JSortIcon col="description" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("debit")}>
                  <span className="inline-flex items-center">Konto (Soll)<JSortIcon col="debit" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("credit")}>
                  <span className="inline-flex items-center">Gegenkonto (Haben)<JSortIcon col="credit" /></span>
                </th>
                <th className="text-right cursor-pointer select-none" onClick={() => toggleJSort("amount")}>
                  <span className="inline-flex items-center justify-end">Betrag CHF<JSortIcon col="amount" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("source")}>
                  <span className="inline-flex items-center">Quelle<JSortIcon col="source" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleJSort("status")}>
                  <span className="inline-flex items-center">Status<JSortIcon col="status" /></span>
                </th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground">
                    Keine Buchungen gefunden
                  </td>
                </tr>
              ) : sortedEntries.map((entry: any) => (
                <>
                  <tr
                    key={entry.id}
                    className={cn("cursor-pointer hover:bg-muted/20", expandedId === entry.id && "bg-muted/30", selectedIds.has(entry.id) && "bg-primary/5")}
                    onClick={() => setDetailEntryId(entry.id)}
                  >
                    <td className="px-2" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = sortedEntries.findIndex((se: any) => se.id === entry.id);
                          toggleSelect(entry.id, e as any, idx);
                        }}
                      />
                    </td>
                    <td className="font-mono text-xs">{entry.entryNumber}</td>
                    <td className="text-xs">
                      {entry.bookingDate ? new Date(entry.bookingDate).toLocaleDateString("de-CH") : "–"}
                    </td>
                    <td>
                      {entry.isCollective ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          <Layers className="h-3 w-3" /> Sammel
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                          Einzel
                        </span>
                      )}
                    </td>
                    <td className="max-w-48 truncate text-sm">{entry.description}</td>
                    <td className="text-xs font-mono">{entry.debitAccountLabel ?? "–"}</td>
                    <td className="text-xs font-mono">{entry.creditAccountLabel ?? "–"}</td>
                    <td className="text-right font-mono">
                      {entry.totalAmount != null ? formatCHF(entry.totalAmount) : "–"}
                    </td>
                    <td><SourceBadge source={entry.source} /></td>
                    <td><StatusBadge status={entry.status} /></td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {entry.status === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                              onClick={() => approveMutation.mutate({ entryId: entry.id })}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                              onClick={() => rejectMutation.mutate({ entryId: entry.id })}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {entry.status === "approved" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600"
                            onClick={() => revertMutation.mutate({ entryId: entry.id })}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => setEditEntry(entry)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                          onClick={() => setConfirmDialog({
                            open: true,
                            title: "Buchung löschen",
                            message: `Buchung ${entry.entryNumber} wirklich löschen?`,
                            onConfirm: () => deleteMutation.mutate({ entryId: entry.id }),
                          })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === entry.id && entryDetail && (
                    <tr key={`detail-${entry.id}`}>
                      <td colSpan={11} className="bg-muted/10 px-6 py-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left py-1">Konto</th>
                              <th className="text-right py-1">Soll</th>
                              <th className="text-right py-1">Haben</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entryDetail.lines.map((l, i) => (
                              <tr key={i} className="border-t border-border/30">
                                <td className="py-1 font-mono text-xs">
                                  {l.account.number} – {l.account.name}
                                </td>
                                <td className="text-right py-1 font-mono">
                                  {l.line.side === "debit" ? <span className="amount-neutral">CHF {formatCHF(l.line.amount as string)}</span> : ""}
                                </td>
                                <td className="text-right py-1 font-mono">
                                  {l.line.side === "credit" ? <span className="amount-neutral">CHF {formatCHF(l.line.amount as string)}</span> : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {entry.aiReasoning && (
                          <p className="text-xs text-muted-foreground mt-2 italic">KI-Begründung: {entry.aiReasoning}</p>
                        )}
                        {/* Belege */}
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Belege</div>
                          <DocumentList journalEntryId={entry.id} />
                          <div className="mt-1">
                            <DocumentUpload journalEntryId={entry.id} compact />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + limit, total)} von {total}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                Zurück
              </Button>
              <Button size="sm" variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                Weiter
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editEntry && (
        <EditEntryDialog
          entry={editEntry}
          accounts={accounts ?? []}
          onClose={() => setEditEntry(null)}
          onSaved={() => { setEditEntry(null); utils.journal.list.invalidate(); }}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateEntryDialog
          mode={showCreateDialog}
          accounts={accounts ?? []}
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => { setShowCreateDialog(false); utils.journal.list.invalidate(); utils.reports.dashboard.invalidate(); }}
        />
      )}

      {/* Buchungsdetail-Popup */}
      <BookingDetailDialog
        entryId={detailEntryId}
        open={detailEntryId !== null}
        onOpenChange={(open) => { if (!open) setDetailEntryId(null); }}
      />

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          fiscalYear={fiscalYear}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Bestätigungs-Dialog */}
      {confirmDialog && (
        <Dialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
          <DialogContent className="w-[min(95vw,28rem)] max-w-none">
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{confirmDialog.message}</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>Abbrechen</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                Bestätigen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Edit Entry Dialog ────────────────────────────────────────────────────────
function EditEntryDialog({ entry, accounts, onClose, onSaved }: {
  entry: any; accounts: any[]; onClose: () => void; onSaved: () => void;
}) {
  const { data: detail } = trpc.journal.getWithLines.useQuery({ entryId: entry.id });
  const [lines, setLines] = useState<Array<{ accountId: number; side: "debit" | "credit"; amount: string }>>([]);
  const [initialized, setInitialized] = useState(false);

  if (detail && !initialized) {
    setLines(detail.lines.map(l => ({ accountId: l.line.accountId, side: l.line.side, amount: l.line.amount as string })));
    setInitialized(true);
  }

  const approveMutation = trpc.journal.approve.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });

  const debitTotal = lines.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const creditTotal = lines.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.01;

  // For simple 2-line bookings: sync amount between debit and credit
  const isSimple = lines.length === 2;

  const handleAmountChange = (i: number, val: string) => {
    if (isSimple) {
      // Sync the other line's amount
      const otherIdx = i === 0 ? 1 : 0;
      const newLines = [...lines];
      newLines[i] = { ...lines[i], amount: val };
      newLines[otherIdx] = { ...lines[otherIdx], amount: val };
      setLines(newLines);
    } else {
      const newLines = [...lines];
      newLines[i] = { ...lines[i], amount: val };
      setLines(newLines);
    }
  };

  const handleSwapAccounts = () => {
    if (lines.length < 2) return;
    const newLines = lines.map(l => ({
      ...l,
      side: l.side === "debit" ? "credit" as const : "debit" as const,
    }));
    setLines(newLines);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[min(95vw,48rem)] max-w-none">
        <DialogHeader>
          <DialogTitle>Buchung bearbeiten – {entry.entryNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{entry.description}</p>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={String(line.accountId)} onValueChange={v => {
                  const newLines = [...lines]; newLines[i] = { ...line, accountId: parseInt(v) }; setLines(newLines);
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Konto wählen" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.number} – {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={line.side} onValueChange={v => {
                  const newLines = [...lines]; newLines[i] = { ...line, side: v as any }; setLines(newLines);
                }}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Soll</SelectItem>
                    <SelectItem value="credit">Haben</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="w-32 font-mono text-right"
                  value={line.amount}
                  onChange={e => handleAmountChange(i, e.target.value)}
                />
              </div>
            ))}
          </div>
          {/* Konten tauschen + Balance-Anzeige */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSwapAccounts}
              className="gap-2 text-xs"
            >
              ⇄ Konten tauschen
            </Button>
            {!balanced && (
              <p className="text-xs text-red-500">
                Soll ({debitTotal.toFixed(2)}) ≠ Haben ({creditTotal.toFixed(2)})
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={!balanced || approveMutation.isPending}
            onClick={() => approveMutation.mutate({ entryId: entry.id, lines })}
          >
            Genehmigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Entry Dialog ──────────────────────────────────────────────────────
function CreateEntryDialog({ mode, accounts, onClose, onSaved }: {
  mode: "single" | "collective"; accounts: any[]; onClose: () => void; onSaved: () => void;
}) {
  const isSingle = mode === "single";
  const [description, setDescription] = useState("");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);

  // Single mode: simple debit/credit with one amount
  const [singleDebitAccountId, setSingleDebitAccountId] = useState<string>("");
  const [singleCreditAccountId, setSingleCreditAccountId] = useState<string>("");
  const [singleAmount, setSingleAmount] = useState("");

  // Collective mode (Sammelbuchung): one credit (Haben) line + multiple debit (Soll) lines
  const [habenAccountId, setHabenAccountId] = useState<string>("");
  const [habenAmount, setHabenAmount] = useState("");
  const [sollLines, setSollLines] = useState<Array<{ accountId: string; text: string; amount: string; vatRate: string }>>([
    { accountId: "", text: "", amount: "", vatRate: "" },
    { accountId: "", text: "", amount: "", vatRate: "" },
  ]);

  // Load bank accounts for the Haben dropdown
  const { data: bankAccountsData } = trpc.bankImport.getBankAccounts.useQuery(undefined, { enabled: !isSingle });

  // Build bank account options (from bankAccounts joined with accounts)
  const bankAccountOptions = useMemo(() => {
    if (!bankAccountsData) return [];
    return bankAccountsData.map((ba: any) => ({
      accountId: ba.account.id,
      number: ba.account.number,
      name: ba.bankAccount.name || ba.account.name,
      label: `${ba.account.number} – ${ba.bankAccount.name || ba.account.name}`,
    }));
  }, [bankAccountsData]);

  const createMutation = trpc.journal.create.useMutation({
    onSuccess: () => {
      toast.success(isSingle ? "Einzelbuchung erstellt" : "Sammelbuchung erstellt");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  // Validation for single mode
  const singleAmountNum = parseFloat(singleAmount || "0");
  const singleValid = isSingle && description.trim() && singleDebitAccountId && singleCreditAccountId && singleAmountNum > 0;

  // Validation for collective mode
  const habenAmountNum = parseFloat(habenAmount || "0");
  const sollTotal = sollLines.reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const differenz = habenAmountNum - sollTotal;
  const isBalanced = Math.abs(differenz) < 0.01 && habenAmountNum > 0;
  const validSollLines = sollLines.filter(l => l.accountId && parseFloat(l.amount || "0") > 0);
  const collectiveValid = !isSingle && isBalanced && description.trim() && habenAccountId && validSollLines.length >= 1;

  // Build preview lines for the table
  const previewLines = useMemo(() => {
    if (isSingle) return [];
    const lines: Array<{ konto: string; text: string; soll: number; haben: number; steuer: string }> = [];
    // Haben line (bank account)
    if (habenAccountId) {
      const acct = accounts.find(a => String(a.id) === habenAccountId);
      const bankAcct = bankAccountOptions.find((ba: any) => String(ba.accountId) === habenAccountId);
      lines.push({
        konto: acct ? `${acct.number}` : "",
        text: bankAcct ? bankAcct.name : (acct?.name ?? ""),
        soll: 0,
        haben: habenAmountNum,
        steuer: "",
      });
    }
    // Soll lines
    for (const sl of sollLines) {
      if (!sl.accountId) continue;
      const amt = parseFloat(sl.amount || "0");
      if (amt <= 0) continue;
      const acct = accounts.find(a => String(a.id) === sl.accountId);
      lines.push({
        konto: acct ? `${acct.number}` : "",
        text: sl.text || (acct?.name ?? ""),
        soll: amt,
        haben: 0,
        steuer: sl.vatRate ? `${sl.vatRate}%` : "",
      });
    }
    return lines;
  }, [isSingle, habenAccountId, habenAmountNum, sollLines, accounts, bankAccountOptions]);

  const handleCreate = () => {
    if (isSingle) {
      createMutation.mutate({
        bookingDate,
        description,
        lines: [
          { accountId: parseInt(singleDebitAccountId), side: "debit", amount: singleAmount },
          { accountId: parseInt(singleCreditAccountId), side: "credit", amount: singleAmount },
        ],
      });
    } else {
      // Build lines: one credit (Haben) + multiple debits (Soll)
      const lines: Array<{ accountId: number; side: "debit" | "credit"; amount: string; description?: string; vatRate?: string }> = [];
      // Credit line (bank account)
      lines.push({
        accountId: parseInt(habenAccountId),
        side: "credit",
        amount: habenAmount,
      });
      // Debit lines (expenses)
      for (const sl of sollLines) {
        const amt = parseFloat(sl.amount || "0");
        if (!sl.accountId || amt <= 0) continue;
        lines.push({
          accountId: parseInt(sl.accountId),
          side: "debit",
          amount: sl.amount,
          description: sl.text || undefined,
          vatRate: sl.vatRate || undefined,
        });
      }
      createMutation.mutate({
        bookingDate,
        description,
        lines,
      });
    }
  };

  const addSollLine = () => {
    setSollLines([...sollLines, { accountId: "", text: "", amount: "", vatRate: "" }]);
  };

  const removeSollLine = (index: number) => {
    if (sollLines.length <= 1) return;
    setSollLines(sollLines.filter((_, i) => i !== index));
  };

  const updateSollLine = (index: number, field: string, value: string) => {
    const updated = [...sollLines];
    updated[index] = { ...updated[index], [field]: value };
    setSollLines(updated);
  };

  // Account search filter for Soll lines
  const [sollSearches, setSollSearches] = useState<Record<number, string>>({});

  const getFilteredAccounts = (searchTerm: string) => {
    if (!searchTerm) return accounts;
    const lower = searchTerm.toLowerCase();
    return accounts.filter(a =>
      a.number.toLowerCase().includes(lower) ||
      a.name.toLowerCase().includes(lower)
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={isSingle ? "w-[min(95vw,38rem)] max-w-none" : "w-[min(95vw,64rem)] max-w-none max-h-[90vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle>
            {isSingle ? "Einzelbuchung erstellen" : "Sammelbuchung erstellen"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isSingle
              ? "Einfache Buchung mit einem Soll- und einem Haben-Konto"
              : "Sammelbeleg: Ein Konto im Haben (z.B. Bank), mehrere Aufwandspositionen im Soll"}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          {isSingle ? (
            /* ── Single booking ── */
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Datum</label>
                  <Input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Buchungstext</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Buchungstext..." />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Soll-Konto</label>
                  <Select value={singleDebitAccountId} onValueChange={setSingleDebitAccountId}>
                    <SelectTrigger><SelectValue placeholder="Soll-Konto wählen..." /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.number} – {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Haben-Konto</label>
                  <Select value={singleCreditAccountId} onValueChange={setSingleCreditAccountId}>
                    <SelectTrigger><SelectValue placeholder="Haben-Konto wählen..." /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.number} – {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Betrag CHF</label>
                  <Input
                    className="font-mono text-right"
                    value={singleAmount}
                    onChange={e => setSingleAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          ) : (
            /* ── Collective booking (Sammelbuchung) ── */
            <>
              {/* Row 1: Date, Description, Diff */}
              <div className="grid grid-cols-[1fr_2fr_auto] gap-3 items-end">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Datum</label>
                  <Input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Buchungstext</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="z.B. F5, Sammelbeleg Februar..." />
                </div>
                <div className="text-right">
                  <label className="text-xs font-medium text-muted-foreground">Diff.</label>
                  <div className={cn(
                    "px-3 py-2 rounded-md border font-mono text-right text-sm font-bold min-w-24",
                    Math.abs(differenz) < 0.01 && habenAmountNum > 0
                      ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400"
                      : "bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400"
                  )}>
                    {differenz >= 0 ? "" : "-"}{formatCHF(Math.abs(differenz))}
                  </div>
                </div>
              </div>

              {/* HABEN Section (Bank Account) */}
              <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Haben (Belastung)</span>
                  <span className="text-xs text-muted-foreground">– Bankkonto / Gegenkonto</span>
                </div>
                <div className="grid grid-cols-[1fr_160px] gap-3">
                  <div>
                    <Select value={habenAccountId} onValueChange={setHabenAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Bankkonto wählen..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {/* Bank accounts first */}
                        {bankAccountOptions.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Bankkonten</div>
                            {bankAccountOptions.map((ba: any) => (
                              <SelectItem key={`bank-${ba.accountId}`} value={String(ba.accountId)}>
                                {ba.label}
                              </SelectItem>
                            ))}
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1">Alle Konten</div>
                          </>
                        )}
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.number} – {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input
                      className="font-mono text-right font-bold"
                      value={habenAmount}
                      onChange={e => setHabenAmount(e.target.value)}
                      placeholder="Betrag CHF"
                    />
                  </div>
                </div>
              </div>

              {/* SOLL Section (Expense Lines) */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Soll (Aufwand)</span>
                    <span className="text-xs text-muted-foreground">– Aufwandspositionen</span>
                  </div>
                  <span className="text-xs font-mono font-semibold">
                    Total: {formatCHF(sollTotal)}
                  </span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[40px_1fr_1fr_120px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>#</span>
                  <span>Konto</span>
                  <span>Text</span>
                  <span className="text-right">Betrag CHF</span>
                  <span className="text-right">MWST %</span>
                  <span></span>
                </div>

                {/* Soll lines */}
                {sollLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[40px_1fr_1fr_120px_80px_32px] gap-2 items-center">
                    <span className="text-xs text-muted-foreground font-mono">{i + 1}:</span>
                    <Select value={line.accountId} onValueChange={v => updateSollLine(i, "accountId", v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Konto..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.number} – {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-9"
                      value={line.text}
                      onChange={e => updateSollLine(i, "text", e.target.value)}
                      placeholder="Buchungstext..."
                    />
                    <Input
                      className="h-9 font-mono text-right"
                      value={line.amount}
                      onChange={e => updateSollLine(i, "amount", e.target.value)}
                      placeholder="0.00"
                    />
                    <Input
                      className="h-9 font-mono text-right"
                      value={line.vatRate}
                      onChange={e => updateSollLine(i, "vatRate", e.target.value)}
                      placeholder="0.0"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                      disabled={sollLines.length <= 1}
                      onClick={() => removeSollLine(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                <Button size="sm" variant="outline" className="w-full text-xs gap-1" onClick={addSollLine}>
                  <Plus className="h-3 w-3" /> Zeile hinzufügen
                </Button>
              </div>

              {/* Preview Table */}
              {previewLines.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Vorschau Buchungssatz
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-3 py-1.5 text-xs font-semibold w-20">Konto</th>
                        <th className="text-left px-3 py-1.5 text-xs font-semibold">Text</th>
                        <th className="text-right px-3 py-1.5 text-xs font-semibold w-28">Soll</th>
                        <th className="text-right px-3 py-1.5 text-xs font-semibold w-28">Haben</th>
                        <th className="text-right px-3 py-1.5 text-xs font-semibold w-20">Steuer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewLines.map((pl, i) => (
                        <tr key={i} className={cn("border-b border-border/50", pl.haben > 0 ? "bg-blue-50/30 dark:bg-blue-950/10" : "")}>
                          <td className="px-3 py-1.5 font-mono text-xs">{pl.konto}</td>
                          <td className="px-3 py-1.5 text-xs">{pl.text}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-right">
                            {pl.soll > 0 ? formatCHF(pl.soll) : ""}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs text-right">
                            {pl.haben > 0 ? formatCHF(pl.haben) : ""}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs text-right">{pl.steuer}</td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="border-t-2 border-border font-bold bg-muted/20">
                        <td className="px-3 py-1.5 text-xs" colSpan={2}>Total</td>
                        <td className="px-3 py-1.5 font-mono text-xs text-right">{formatCHF(sollTotal)}</td>
                        <td className="px-3 py-1.5 font-mono text-xs text-right">{formatCHF(habenAmountNum)}</td>
                        <td className="px-3 py-1.5"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={isSingle ? (!singleValid || createMutation.isPending) : (!collectiveValid || createMutation.isPending)}
            onClick={handleCreate}
          >
            {createMutation.isPending
              ? "Wird erstellt..."
              : isSingle
                ? "Einzelbuchung erstellen"
                : `Sammelbuchung erstellen${validSollLines.length > 0 ? ` (${validSollLines.length} Pos.)` : ""}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Export Dialog ──────────────────────────────────────────────────────────
function ExportDialog({ fiscalYear, onClose }: { fiscalYear: number; onClose: () => void }) {
  const [format, setFormat] = useState("infoniqa");
  const [statusFilter, setStatusFilter] = useState<"approved" | "all">("approved");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const exportInfoniqaMut = trpc.journal.exportInfoniqa.useMutation({
    onSuccess: (data) => {
      // Infoniqa uses Latin-1 encoding
      const encoder = new TextEncoder();
      const utf8Bytes = encoder.encode(data.csv);
      // Convert to Latin-1 manually for Infoniqa compatibility
      const latin1Bytes = new Uint8Array(data.csv.length);
      for (let i = 0; i < data.csv.length; i++) {
        latin1Bytes[i] = data.csv.charCodeAt(i) & 0xFF;
      }
      const blob = new Blob([latin1Bytes], { type: "text/csv;charset=iso-8859-1" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${data.entryCount} Buchungen exportiert (Infoniqa-Format)`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const exportCsvMut = trpc.journal.exportCsv.useMutation({
    onSuccess: (data) => {
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${data.entryCount} Buchungen exportiert (CSV)`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleExport = () => {
    const params = {
      fiscalYear,
      statusFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    if (format === "infoniqa") {
      exportInfoniqaMut.mutate(params);
    } else {
      exportCsvMut.mutate(params);
    }
  };

  const isExporting = exportInfoniqaMut.isPending || exportCsvMut.isPending;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(95vw,32rem)] max-w-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Journal exportieren
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Export-Format</label>
            <div className="space-y-2">
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  format === "infoniqa" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
                onClick={() => setFormat("infoniqa")}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="infoniqa"
                  checked={format === "infoniqa"}
                  onChange={() => setFormat("infoniqa")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm">Infoniqa (sfbbuch.csv)</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Kompatibel mit Infoniqa ONE / Sage / Topal. Felder: BlgNr, Date, AccId, MType, Type, CAcc, TaxId, ValNt etc. Latin-1 Encoding.
                  </div>
                </div>
              </label>
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  format === "csv" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
                onClick={() => setFormat("csv")}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="csv"
                  checked={format === "csv"}
                  onChange={() => setFormat("csv")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm">Standard CSV</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Allgemeines CSV-Format mit Semikolon-Trennung. Felder: Belegnummer, Datum, Konto, Soll, Haben, Beschreibung, MWST. UTF-8 mit BOM.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "approved" | "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Nur genehmigte Buchungen</SelectItem>
                <SelectItem value="all">Alle Buchungen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Von (optional)</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Startdatum"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bis (optional)</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Enddatum"
              />
            </div>
          </div>

          {/* Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p>Geschäftsjahr: <strong>{fiscalYear}</strong></p>
            <p className="mt-1">
              {format === "infoniqa"
                ? "Die Buchungen werden im Infoniqa-kompatiblen Format (sfbbuch.csv) exportiert. Einzelbuchungen als MType=1, Sammelbuchungen als MType=2. MWST-Codes werden automatisch gemappt (z.B. USt81 für 8.1%)."
                : "Die Buchungen werden als Standard-CSV mit Semikolon-Trennung exportiert. UTF-8 mit BOM für Excel-Kompatibilität."
              }
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Abbrechen
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            <Download className="h-4 w-4" />
            {isExporting ? "Exportiere..." : "Exportieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
