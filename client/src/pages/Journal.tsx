import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useSearch } from "wouter";
import { Check, X, Edit2, Search, Filter, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { DocumentUpload, DocumentList } from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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
        <Button size="sm" className="gap-2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" /> Neue Buchung
        </Button>
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
                <th className="w-8"></th>
                <th>Nr.</th>
                <th>Datum</th>
                <th>Beschreibung</th>
                <th>Quelle</th>
                <th>Status</th>
                <th className="text-right">Betrag</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Keine Buchungen gefunden
                  </td>
                </tr>
              ) : entries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className={cn("cursor-pointer", expandedId === entry.id && "bg-muted/30")}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="text-center">
                      {expandedId === entry.id
                        ? <ChevronUp className="h-3 w-3 text-muted-foreground mx-auto" />
                        : <ChevronDown className="h-3 w-3 text-muted-foreground mx-auto" />}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{entry.entryNumber}</td>
                    <td className="text-sm whitespace-nowrap">
                      {new Date(entry.bookingDate as any).toLocaleDateString("de-CH")}
                    </td>
                    <td className="text-sm max-w-xs truncate">{entry.description}</td>
                    <td><SourceBadge source={entry.source ?? "manual"} /></td>
                    <td><StatusBadge status={entry.status} /></td>
                    <td className="text-right">
                      {entry.aiConfidence != null && (
                        <span className="text-xs text-muted-foreground mr-2">KI {entry.aiConfidence}%</span>
                      )}
                    </td>
                    <td className="text-right">
                      {entry.status === "pending" && (
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => approveMutation.mutate({ entryId: entry.id })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => rejectMutation.mutate({ entryId: entry.id })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            onClick={() => setEditEntry(entry)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {expandedId === entry.id && entryDetail && (
                    <tr key={`detail-${entry.id}`}>
                      <td colSpan={8} className="bg-muted/20 px-6 py-3">
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
          accounts={accounts ?? []}
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => { setShowCreateDialog(false); utils.journal.list.invalidate(); }}
        />
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
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
                  onChange={e => {
                    const newLines = [...lines]; newLines[i] = { ...line, amount: e.target.value }; setLines(newLines);
                  }}
                />
              </div>
            ))}
          </div>
          {!balanced && (
            <p className="text-xs text-red-500">
              Soll ({debitTotal.toFixed(2)}) ≠ Haben ({creditTotal.toFixed(2)})
            </p>
          )}
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
function CreateEntryDialog({ accounts, onClose, onSaved }: {
  accounts: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState([
    { accountId: 0, side: "debit" as const, amount: "" },
    { accountId: 0, side: "credit" as const, amount: "" },
  ]);

  const createMutation = trpc.journal.create.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });

  const debitTotal = lines.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const creditTotal = lines.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.01 && debitTotal > 0;
  const valid = balanced && description.trim() && lines.every(l => l.accountId > 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manuelle Buchung erstellen</DialogTitle>
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
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full text-xs"
              onClick={() => setLines([...lines, { accountId: 0, side: "debit", amount: "" }])}>
              + Zeile hinzufügen
            </Button>
          </div>
          {lines.length >= 2 && (
            <div className="flex justify-between text-xs px-1">
              <span className={balanced ? "text-green-600" : "text-red-500"}>
                Soll: {debitTotal.toFixed(2)} | Haben: {creditTotal.toFixed(2)}
                {balanced ? " ✓" : " ✗"}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={!valid || createMutation.isPending}
            onClick={() => createMutation.mutate({ bookingDate, description, lines: lines.filter(l => l.accountId > 0) })}
          >
            Buchung erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
