import { trpc } from "@/lib/trpc";
import { useState, useRef, useMemo } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Search, BookOpen, Printer, ArrowLeft, ChevronRight, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// ─── Account Detail View ──────────────────────────────────────────────────────
function AccountDetail({ accountId, fiscalYear, onBack }: { accountId: number; fiscalYear: number; onBack: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [detailEntryId, setDetailEntryId] = useState<number | null>(null);

  const { data, isLoading } = trpc.accounts.getLedger.useQuery({ accountId, fiscalYear });

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

  const closingBalance = linesWithBalance.length > 0
    ? linesWithBalance[linesWithBalance.length - 1].runningBalance
    : openingBalance;

  const totalDebit = lines.reduce((sum: number, l: any) => l.line.side === "debit" ? sum + parseFloat(l.line.amount) : sum, 0);
  const totalCredit = lines.reduce((sum: number, l: any) => l.line.side === "credit" ? sum + parseFloat(l.line.amount) : sum, 0);

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

      {/* Transaction table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" ref={printRef}>
        <div className="overflow-x-auto">
          <table className="accounting-table" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: "8rem" }} />{/* Datum */}
              <col style={{ width: "auto" }} />{/* Buchungstext – flexibel */}
              <col style={{ width: "7rem" }} />{/* Beleg-Nr. */}
              <col style={{ width: "9rem" }} />{/* Soll CHF */}
              <col style={{ width: "9rem" }} />{/* Haben CHF */}
              <col style={{ width: "9rem" }} />{/* Saldo CHF */}
            </colgroup>
            <thead>
              <tr>
                <th className="text-center">Datum</th>
                <th>Buchungstext</th>
                <th className="text-center">Beleg-Nr.</th>
                <th className="text-right">Soll CHF</th>
                <th className="text-right">Haben CHF</th>
                <th className="text-right">Saldo CHF</th>
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
              </tr>

              {linesWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    Keine Buchungen in diesem Geschäftsjahr
                  </td>
                </tr>
              ) : linesWithBalance.map((item: any, idx: number) => (
                <tr key={idx} className="cursor-pointer hover:bg-muted/20" onClick={() => setDetailEntryId(item.entry.id)}>
                  <td className="font-mono text-xs text-center">{item.entry.bookingDate ? new Date(item.entry.bookingDate + 'T00:00:00').toLocaleDateString('de-CH') : '–'}</td>
                  <td className="text-sm truncate" title={item.entry.description}>{item.entry.description}</td>
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
                </tr>
              ))}

              {/* Closing balance row */}
              {linesWithBalance.length > 0 && (
                <tr className="total-row" style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td></td>
                  <td className="text-sm font-bold">Schlusssaldo</td>
                  <td></td>
                  <td className="text-right font-mono text-sm font-bold">{formatCHF(totalDebit)}</td>
                  <td className="text-right font-mono text-sm font-bold">{formatCHF(totalCredit)}</td>
                  <td className={`text-right font-mono text-sm font-bold ${closingBalance >= 0 ? "" : "text-red-600"}`}>
                    {formatCHF(closingBalance)}
                  </td>
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
