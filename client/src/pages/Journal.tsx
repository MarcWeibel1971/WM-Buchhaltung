import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useSearch } from "wouter";
import { Check, X, Edit2, Search, Filter, Plus, ChevronDown, ChevronUp, Layers, Trash2, RotateCcw } from "lucide-react";
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

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Journal</h2>
          <p className="text-sm text-muted-foreground">{total} Buchungen</p>
        </div>
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

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Datum</th>
                <th>Typ</th>
                <th>Beschreibung</th>
                <th>Konto (Soll)</th>
                <th>Gegenkonto (Haben)</th>
                <th className="text-right">Betrag CHF</th>
                <th>Quelle</th>
                <th>Status</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground">
                    Keine Buchungen gefunden
                  </td>
                </tr>
              ) : entries.map((entry: any) => (
                <>
                  <tr
                    key={entry.id}
                    className={cn("cursor-pointer hover:bg-muted/20", expandedId === entry.id && "bg-muted/30")}
                    onClick={() => setDetailEntryId(entry.id)}
                  >
                    <td className="font-mono text-xs text-muted-foreground">{entry.entryNumber}</td>
                    <td className="text-sm whitespace-nowrap">
                      {new Date(entry.bookingDate as any).toLocaleDateString("de-CH")}
                    </td>
                    <td className="text-xs">
                      {entry.isCollective ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Sammel</span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Einzel</span>
                      )}
                    </td>
                    <td className="text-sm max-w-xs truncate">{entry.description}</td>
                    <td className="text-xs font-mono truncate max-w-[180px]" title={entry.debitAccountLabel}>
                      {entry.debitAccountLabel ?? '\u2013'}
                    </td>
                    <td className="text-xs font-mono truncate max-w-[180px]" title={entry.creditAccountLabel}>
                      {entry.creditAccountLabel ?? '\u2013'}
                    </td>
                    <td className="text-right font-mono text-sm whitespace-nowrap">
                      {entry.totalAmount != null && entry.totalAmount > 0 ? (
                        <span>{formatCHF(entry.totalAmount)}</span>
                      ) : '\u2013'}
                    </td>
                    <td><SourceBadge source={entry.source ?? "manual"} /></td>
                    <td><StatusBadge status={entry.status} /></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {entry.status === "pending" && (<>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Genehmigen"
                            onClick={() => approveMutation.mutate({ entryId: entry.id })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                            title="Ablehnen"
                            onClick={() => rejectMutation.mutate({ entryId: entry.id })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            title="Bearbeiten"
                            onClick={() => setEditEntry(entry)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </>)}
                        {entry.status === "approved" && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                            title="Zurück auf Ausstehend setzen"
                            onClick={() => setConfirmDialog({
                              open: true,
                              title: "Buchung rücksetzen",
                              message: `Buchung "${entry.description}" zurück auf Ausstehend setzen?`,
                              onConfirm: () => revertMutation.mutate({ entryId: entry.id }),
                            })}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Buchung löschen"
                          onClick={() => setConfirmDialog({
                            open: true,
                            title: "Buchung löschen",
                            message: `Buchung "${entry.description}" wirklich löschen? Verknüpfte Bankimport-Transaktionen werden auf Ausstehend zurückgesetzt.`,
                            onConfirm: () => deleteMutation.mutate({ entryId: entry.id }),
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {expandedId === entry.id && entryDetail && (
                    <tr key={`detail-${entry.id}`}>
                      <td colSpan={10} className="bg-muted/20 px-6 py-3">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Buchungszeilen</div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left pb-1 font-medium">Konto</th>
                              <th className="text-right pb-1 font-medium">Soll</th>
                              <th className="text-right pb-1 font-medium">Haben</th>
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
          onSaved={() => { setShowCreateDialog(false); utils.journal.list.invalidate(); }}
        />
      )}

      {/* Buchungsdetail-Popup */}
      <BookingDetailDialog
        entryId={detailEntryId}
        open={detailEntryId !== null}
        onOpenChange={(open) => { if (!open) setDetailEntryId(null); }}
      />

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

  // Collective mode: multiple lines
  const [lines, setLines] = useState([
    { accountId: 0, side: "debit" as const, amount: "" },
    { accountId: 0, side: "credit" as const, amount: "" },
    { accountId: 0, side: "debit" as const, amount: "" },
  ]);

  const createMutation = trpc.journal.create.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });

  // Validation for single mode
  const singleAmountNum = parseFloat(singleAmount || "0");
  const singleValid = isSingle && description.trim() && singleDebitAccountId && singleCreditAccountId && singleAmountNum > 0;

  // Validation for collective mode
  const debitTotal = lines.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const creditTotal = lines.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.01 && debitTotal > 0;
  const collectiveValid = !isSingle && balanced && description.trim() && lines.filter(l => l.accountId > 0).length >= 2 && lines.every(l => l.accountId > 0 || !l.amount);

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
      createMutation.mutate({
        bookingDate,
        description,
        lines: lines.filter(l => l.accountId > 0),
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={isSingle ? "w-[min(95vw,38rem)] max-w-none" : "w-[min(95vw,52rem)] max-w-none"}>
        <DialogHeader>
          <DialogTitle>
            {isSingle ? "Einzelbuchung erstellen" : "Sammelbuchung erstellen"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isSingle
              ? "Einfache Buchung mit einem Soll- und einem Haben-Konto"
              : "Buchung mit mehreren Soll- und/oder Haben-Positionen"}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Datum</label>
              <Input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Buchungstext..." />
            </div>
          </div>

          {isSingle ? (
            /* ── Single booking: Soll-Konto, Haben-Konto, Betrag ── */
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
          ) : (
            /* ── Collective booking: multiple lines ── */
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_100px_120px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Konto</span><span>Seite</span><span className="text-right">Betrag CHF</span><span></span>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_120px_32px] gap-2 items-center">
                  <Select value={String(line.accountId || "")} onValueChange={v => {
                    const nl = [...lines]; nl[i] = { ...line, accountId: parseInt(v) }; setLines(nl);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Konto..." /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.number} – {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={line.side} onValueChange={v => {
                    const nl = [...lines]; nl[i] = { ...line, side: v as any }; setLines(nl);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Soll</SelectItem>
                      <SelectItem value="credit">Haben</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="font-mono text-right"
                    value={line.amount}
                    onChange={e => { const nl = [...lines]; nl[i] = { ...line, amount: e.target.value }; setLines(nl); }}
                    placeholder="0.00"
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground"
                    disabled={lines.length <= 2}
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-full text-xs"
                onClick={() => setLines([...lines, { accountId: 0, side: "debit", amount: "" }])}>
                + Zeile hinzufügen
              </Button>
              {lines.length >= 2 && (
                <div className="flex justify-between text-xs px-1">
                  <span className={balanced ? "text-green-600" : "text-red-500"}>
                    Soll: {debitTotal.toFixed(2)} | Haben: {creditTotal.toFixed(2)}
                    {balanced ? " ✓" : " ✗"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={isSingle ? (!singleValid || createMutation.isPending) : (!collectiveValid || createMutation.isPending)}
            onClick={handleCreate}
          >
            {createMutation.isPending ? "Wird erstellt..." : (isSingle ? "Einzelbuchung erstellen" : "Sammelbuchung erstellen")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
