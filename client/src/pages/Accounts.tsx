import { trpc } from "@/lib/trpc";
import { useState, useRef, useMemo } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Search, BookOpen, Printer, ArrowLeft, ChevronRight, ChevronDown, ChevronUp, Edit2, Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import BookingDetailDialog from "@/components/BookingDetailDialog";

function formatCHF(val: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Aktiven",
  liability: "Passiven",
  equity: "Eigenkapital",
  revenue: "Ertrag",
  expense: "Aufwand",
};

const FISCAL_YEARS = [2026, 2025, 2024, 2023];

// ─── Edit Entry Dialog (reusable) ────────────────────────────────────────────
function EditEntryDialog({ entry, onClose, onSaved }: {
  entry: any; onClose: () => void; onSaved: () => void;
}) {
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: detail } = trpc.journal.getWithLines.useQuery({ entryId: entry.id });
  const [lines, setLines] = useState<Array<{ accountId: number; side: "debit" | "credit"; amount: string }>>([]);
  const [initialized, setInitialized] = useState(false);

  if (detail && !initialized) {
    setLines(detail.lines.map((l: any) => ({ accountId: l.line.accountId, side: l.line.side, amount: l.line.amount as string })));
    setInitialized(true);
  }

  const approveMutation = trpc.journal.approve.useMutation({
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e.message),
  });

  const debitTotal = lines.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const creditTotal = lines.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.01;
  const isSimple = lines.length === 2;

  const handleAmountChange = (i: number, val: string) => {
    if (isSimple) {
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
          <DialogTitle>Buchung bearbeiten – {entry.entryNumber || `#${entry.id}`}</DialogTitle>
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
                    {(accounts ?? []).map((a: any) => (
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

// ─── Account Detail View ──────────────────────────────────────────────────────
function AccountDetail({ accountId, fiscalYear, onBack }: { accountId: number; fiscalYear: number; onBack: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [detailEntryId, setDetailEntryId] = useState<number | null>(null);
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<any>(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = trpc.accounts.getLedger.useQuery({ accountId, fiscalYear });
  const utils = trpc.useUtils();

  const account = data?.account;
  const lines = data?.lines ?? [];
  const openingBalance = data?.openingBalance ?? 0;

  // Calculate running balance
  const linesWithBalance = useMemo(() => {
    let running = openingBalance;
    return lines.map((l: any) => {
      const amount = parseFloat(l.line.amount);
      if (l.line.side === "debit") {
        running += amount;
      } else {
        running -= amount;
      }
      return { ...l, runningBalance: running };
    });
  }, [lines, openingBalance]);

  // Apply filters
  const filteredLines = useMemo(() => {
    return linesWithBalance.filter((item: any) => {
      // Text search
      if (searchText) {
        const desc = (item.entry.description || "").toLowerCase();
        const entryNum = String(item.entry.entryNumber || item.entry.id);
        if (!desc.includes(searchText.toLowerCase()) && !entryNum.includes(searchText)) {
          return false;
        }
      }
      // Date range filter
      if (dateFrom || dateTo) {
        const bookingDate = item.entry.bookingDate;
        if (!bookingDate) return false;
        if (dateFrom && bookingDate < dateFrom) return false;
        if (dateTo && bookingDate > dateTo) return false;
      }
      return true;
    });
  }, [linesWithBalance, searchText, dateFrom, dateTo]);

  const hasFilters = searchText || dateFrom || dateTo;

  const closingBalance = linesWithBalance.length > 0
    ? linesWithBalance[linesWithBalance.length - 1].runningBalance
    : openingBalance;

  const totalDebit = lines.reduce((sum: number, l: any) => l.line.side === "debit" ? sum + parseFloat(l.line.amount) : sum, 0);
  const totalCredit = lines.reduce((sum: number, l: any) => l.line.side === "credit" ? sum + parseFloat(l.line.amount) : sum, 0);

  // Filtered totals
  const filteredDebit = filteredLines.reduce((sum: number, l: any) => l.line.side === "debit" ? sum + parseFloat(l.line.amount) : sum, 0);
  const filteredCredit = filteredLines.reduce((sum: number, l: any) => l.line.side === "credit" ? sum + parseFloat(l.line.amount) : sum, 0);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Konto ${account?.number} – ${account?.name}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; padding: 20px; color: #1a1a1a; }
        h1 { font-size: 16px; margin-bottom: 2px; }
        h2 { font-size: 12px; color: #666; margin-top: 0; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #f5f5f5; text-align: left; padding: 6px 8px; border-bottom: 2px solid #ddd; font-weight: 600; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        .right { text-align: right; }
        .mono { font-family: 'SF Mono', 'Consolas', monospace; }
        .total-row { font-weight: 700; border-top: 2px solid #333; background: #f9f9f9; }
        .footer { margin-top: 20px; font-size: 9px; color: #999; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Konto ${account?.number} – ${account?.name}</h1>
      <h2>WM Weibel Mueller AG | Geschäftsjahr ${fiscalYear}</h2>
      ${content.querySelector('table')?.outerHTML ?? ''}
      <div class="footer">Gedruckt am ${new Date().toLocaleDateString('de-CH')} | WM Weibel Mueller AG Buchhaltung</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
        </Button>
        <p className="text-muted-foreground">Konto nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          <div>
            <h2 className="text-xl font-bold">{account.number} – {account.name}</h2>
            <p className="text-sm text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType} | GJ {fiscalYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Drucken
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground mb-1">Eröffnungssaldo</div>
          <div className="text-sm font-mono font-semibold">{formatCHF(openingBalance)}</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground mb-1">Total Soll</div>
          <div className="text-sm font-mono font-semibold text-green-700">{formatCHF(totalDebit)}</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground mb-1">Total Haben</div>
          <div className="text-sm font-mono font-semibold text-red-600">{formatCHF(totalCredit)}</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground mb-1">Schlusssaldo</div>
          <div className={`text-sm font-mono font-bold ${closingBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
            {formatCHF(closingBalance)}
          </div>
        </div>
      </div>

      {/* Search & Date Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buchungstext suchen..."
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setExpandedRowIdx(null); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setExpandedRowIdx(null); }}
              className="w-36 text-sm"
              placeholder="Von"
            />
          </div>
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setExpandedRowIdx(null); }}
            className="w-36 text-sm"
            placeholder="Bis"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchText(""); setDateFrom(""); setDateTo(""); setExpandedRowIdx(null); }}>
            <X className="h-4 w-4 mr-1" /> Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Filter info */}
      {hasFilters && (
        <div className="text-xs text-muted-foreground">
          {filteredLines.length} von {linesWithBalance.length} Buchungen
          {(filteredDebit > 0 || filteredCredit > 0) && (
            <span className="ml-3">
              | Soll: <span className="font-mono font-semibold text-green-700">{formatCHF(filteredDebit)}</span>
              {" "}| Haben: <span className="font-mono font-semibold text-red-600">{formatCHF(filteredCredit)}</span>
            </span>
          )}
        </div>
      )}

      {/* Transaction table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" ref={printRef}>
        <div className="overflow-x-auto">
          <table className="accounting-table" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: "7.5rem" }} />{/* Datum */}
              <col style={{ width: "auto" }} />{/* Buchungstext – flexibel */}
              <col style={{ width: "5.5rem" }} />{/* Beleg-Nr. */}
              <col style={{ width: "8.5rem" }} />{/* Soll CHF */}
              <col style={{ width: "8.5rem" }} />{/* Haben CHF */}
              <col style={{ width: "8.5rem" }} />{/* Saldo CHF */}
              <col style={{ width: "3rem" }} />{/* Aktionen */}
            </colgroup>
            <thead>
              <tr>
                <th className="text-center">Datum</th>
                <th>Buchungstext</th>
                <th className="text-center">Beleg-Nr.</th>
                <th className="text-right">Soll CHF</th>
                <th className="text-right">Haben CHF</th>
                <th className="text-right">Saldo CHF</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr className="bg-muted/30">
                <td className="font-mono text-xs text-center">01.01.{fiscalYear}</td>
                <td className="text-sm font-medium italic">Eröffnungssaldo</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="text-right font-mono text-sm font-semibold">{formatCHF(openingBalance)}</td>
                <td></td>
              </tr>

              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    {hasFilters ? "Keine Buchungen für diesen Filter" : "Keine Buchungen in diesem Geschäftsjahr"}
                  </td>
                </tr>
              ) : filteredLines.map((item: any, idx: number) => {
                const isExpanded = expandedRowIdx === idx;
                const description = item.entry.description || "–";
                const isLongText = description.length > 60;

                return (
                  <>
                    <tr
                      key={idx}
                      className={`cursor-pointer hover:bg-muted/20 ${isExpanded ? 'bg-muted/30' : ''}`}
                      onClick={() => setExpandedRowIdx(isExpanded ? null : idx)}
                    >
                      <td className="font-mono text-xs text-center">
                        {item.entry.bookingDate ? new Date(item.entry.bookingDate + 'T00:00:00').toLocaleDateString('de-CH') : '–'}
                      </td>
                      <td className="text-sm">
                        <div className="flex items-start gap-1">
                          {isLongText && (
                            isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <span className={isExpanded ? "" : "truncate block"}>{description}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground text-center">{item.entry.id}</td>
                      <td className="text-right font-mono text-sm">
                        {item.line.side === "debit" ? formatCHF(parseFloat(item.line.amount)) : ""}
                      </td>
                      <td className="text-right font-mono text-sm">
                        {item.line.side === "credit" ? formatCHF(parseFloat(item.line.amount)) : ""}
                      </td>
                      <td className={`text-right font-mono text-sm font-medium ${item.runningBalance >= 0 ? "" : "text-red-600"}`}>
                        {formatCHF(item.runningBalance)}
                      </td>
                      <td className="text-center" onClick={e => e.stopPropagation()}>
                        {item.entry.status === "pending" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Buchung bearbeiten"
                            onClick={() => setEditEntry(item.entry)}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Buchungsdetail anzeigen"
                            onClick={() => setDetailEntryId(item.entry.id)}
                          >
                            <Search className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`detail-${idx}`}>
                        <td colSpan={7} className="bg-muted/10 px-6 py-3 border-t-0">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Buchungstext</div>
                              <p className="text-sm leading-relaxed">{description}</p>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Beleg-Nr.: </span>
                                <span className="font-mono text-xs">{item.entry.entryNumber || `#${item.entry.id}`}</span>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status: </span>
                                <span className="text-xs">
                                  {item.entry.status === "pending" ? <span className="badge-pending">Ausstehend</span>
                                    : item.entry.status === "approved" ? <span className="badge-approved">Genehmigt</span>
                                    : <span className="badge-rejected">Abgelehnt</span>}
                                </span>
                              </div>
                              {item.entry.aiReasoning && (
                                <div>
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KI-Begründung: </span>
                                  <span className="text-xs italic text-muted-foreground">{item.entry.aiReasoning}</span>
                                </div>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setDetailEntryId(item.entry.id)}
                                >
                                  <Search className="h-3 w-3" /> Buchungsdetail
                                </Button>
                                {item.entry.status === "pending" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => setEditEntry(item.entry)}
                                  >
                                    <Edit2 className="h-3 w-3" /> Bearbeiten
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {/* Closing balance row */}
              {filteredLines.length > 0 && !hasFilters && (
                <tr className="total-row" style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td></td>
                  <td className="text-sm font-bold">Schlusssaldo</td>
                  <td></td>
                  <td className="text-right font-mono text-sm font-bold">{formatCHF(totalDebit)}</td>
                  <td className="text-right font-mono text-sm font-bold">{formatCHF(totalCredit)}</td>
                  <td className={`text-right font-mono text-sm font-bold ${closingBalance >= 0 ? "" : "text-red-600"}`}>
                    {formatCHF(closingBalance)}
                  </td>
                  <td></td>
                </tr>
              )}
              {/* Filtered totals row */}
              {hasFilters && filteredLines.length > 0 && (
                <tr className="total-row" style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td></td>
                  <td className="text-sm font-bold">Filter-Total ({filteredLines.length} Buchungen)</td>
                  <td></td>
                  <td className="text-right font-mono text-sm font-bold">{formatCHF(filteredDebit)}</td>
                  <td className="text-right font-mono text-sm font-bold">{formatCHF(filteredCredit)}</td>
                  <td></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buchungsdetail-Popup */}
      <BookingDetailDialog
        entryId={detailEntryId}
        open={detailEntryId !== null}
        onOpenChange={(open) => { if (!open) setDetailEntryId(null); }}
      />

      {/* Edit Entry Dialog */}
      {editEntry && (
        <EditEntryDialog
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={() => {
            setEditEntry(null);
            utils.accounts.getLedger.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Account List View ────────────────────────────────────────────────────────
export default function Accounts() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const { fiscalYear } = useFiscalYear();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const { data: accounts } = trpc.accounts.list.useQuery();

  const filtered = (accounts ?? []).filter((a: any) => {
    const matchSearch = !search || a.number.includes(search) || a.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || a.accountType === typeFilter;
    return matchSearch && matchType;
  });

  // Group accounts by type
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    const order = ["asset", "liability", "equity", "revenue", "expense"];
    for (const type of order) {
      const items = filtered.filter((a: any) => a.accountType === type);
      if (items.length > 0) groups[type] = items;
    }
    return groups;
  }, [filtered]);

  if (selectedAccountId !== null) {
    return (
      <AccountDetail
        accountId={selectedAccountId}
        fiscalYear={fiscalYear}
        onBack={() => setSelectedAccountId(null)}
      />
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Konten</h2>
          <p className="text-sm text-muted-foreground">
            {accounts?.length ?? 0} Konten | Klicken Sie auf ein Konto für die Detailansicht
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Konto suchen (Nr. oder Name)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      {/* Grouped account list */}
      {Object.entries(grouped).map(([type, accs]) => (
        <div key={type} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {ACCOUNT_TYPE_LABELS[type] ?? type}
              <span className="text-xs font-normal text-muted-foreground ml-2">({accs.length} Konten)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="accounting-table">
              <thead>
                <tr>
                  <th className="w-24">Nr.</th>
                  <th>Bezeichnung</th>
                  <th className="text-right w-36">Saldo CHF</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {accs.map((account: any) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    fiscalYear={fiscalYear}
                    onClick={() => setSelectedAccountId(account.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Konten gefunden</p>
        </div>
      )}
    </div>
  );
}

function AccountRow({ account, fiscalYear, onClick }: { account: any; fiscalYear: number; onClick: () => void }) {
  const { data: balance } = trpc.accounts.getBalance.useQuery(
    { accountId: account.id, fiscalYear },
    { staleTime: 30000 }
  );

  const bal = balance ?? 0;

  return (
    <tr
      className="hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="font-mono text-sm font-medium">{account.number}</td>
      <td className="text-sm">{account.name}</td>
      <td className={`text-right font-mono text-sm ${bal > 0 ? "amount-positive" : bal < 0 ? "amount-negative" : "text-muted-foreground"}`}>
        {bal !== 0 ? formatCHF(Math.abs(bal)) : "–"}
      </td>
      <td className="text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
      </td>
    </tr>
  );
}
