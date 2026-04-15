import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

function formatCHF(val: number | string) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

interface BookingDetailDialogProps {
  entryId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Buchungsliste – Pop-Up showing full Einzel- or Sammelbuchung
 * with Beleg, Datum, Konto, Text, Gegen-Konto, Soll, Haben columns.
 * Matches the style of the user's Abacus "Buchungsliste" screenshot.
 */
export default function BookingDetailDialog({ entryId, open, onOpenChange }: BookingDetailDialogProps) {
  const { data, isLoading } = trpc.journal.getWithLines.useQuery(
    { entryId: entryId! },
    { enabled: entryId !== null && open }
  );

  const entry = data?.entry;
  const lines = data?.lines ?? [];

  // Compute contra account for each line
  // For Einzelbuchung (2 lines): contra is the other account
  // For Sammelbuchung (>2 lines): the "main" line (e.g. 1082 Durchlaufkonto) has contra "div" (diverse)
  //   and each detail line has the main account as contra
  const computeContraAccount = (lineIndex: number) => {
    if (lines.length === 0) return "";
    if (lines.length === 2) {
      // Einzelbuchung: contra is the other line's account
      const otherIdx = lineIndex === 0 ? 1 : 0;
      return `${lines[otherIdx].account.number}`;
    }
    // Sammelbuchung: find the "summary" line (usually the one on the opposite side of the majority)
    const debitLines = lines.filter(l => l.line.side === "debit");
    const creditLines = lines.filter(l => l.line.side === "credit");
    const currentLine = lines[lineIndex];

    if (debitLines.length === 1 && creditLines.length > 1) {
      // One debit (summary), many credits
      if (currentLine.line.side === "debit") return "div";
      return `${debitLines[0].account.number}`;
    }
    if (creditLines.length === 1 && debitLines.length > 1) {
      // One credit (summary), many debits
      if (currentLine.line.side === "credit") return "div";
      return `${creditLines[0].account.number}`;
    }
    // Fallback: show "div" for multi-line
    return "div";
  };

  const totalDebit = lines
    .filter(l => l.line.side === "debit")
    .reduce((sum, l) => sum + parseFloat(l.line.amount as string), 0);
  const totalCredit = lines
    .filter(l => l.line.side === "credit")
    .reduce((sum, l) => sum + parseFloat(l.line.amount as string), 0);

  const bookingDate = entry?.bookingDate
    ? new Date(entry.bookingDate + "T00:00:00").toLocaleDateString("de-CH")
    : "–";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(95vw,56rem)] max-w-none max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Buchungsliste</DialogTitle>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{/* Firmenname kommt aus dem Layout-Header – hier bewusst leer */}</span>
            <span>{new Date().toLocaleDateString("de-CH")}</span>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !entry ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Buchung nicht gefunden.</p>
        ) : (
          <div className="mt-2">
            {/* Entry header info */}
            <div className="mb-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{entry.description}</span>
              {entry.source && entry.source !== "manual" && (
                <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {entry.source === "bank_import" ? "Bank" : entry.source === "credit_card" ? "Kreditkarte" : entry.source}
                </span>
              )}
            </div>

            {/* Buchungsliste table – matches Abacus style */}
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[36rem]">
                <thead>
                  <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground">
                    <th className="text-left px-3 py-2 w-16">Beleg</th>
                    <th className="text-left px-3 py-2 w-24">Datum</th>
                    <th className="text-left px-3 py-2 w-16">Konto</th>
                    <th className="text-left px-3 py-2">Text</th>
                    <th className="text-left px-3 py-2 w-24">Gegen-Konto</th>
                    <th className="text-right px-3 py-2 w-28">Soll</th>
                    <th className="text-right px-3 py-2 w-28">Haben</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {entry.entryNumber ?? entry.id}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">
                        {bookingDate}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs font-medium">
                        {l.account.number}
                      </td>
                      <td className="px-3 py-1.5 text-sm">
                        {l.line.description || entry.description}
                        {l.line.description && l.line.description !== entry.description
                          ? ""
                          : ""}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {computeContraAccount(i)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm">
                        {l.line.side === "debit" ? formatCHF(l.line.amount as string) : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm">
                        {l.line.side === "credit" ? formatCHF(l.line.amount as string) : ""}
                      </td>
                    </tr>
                  ))}

                  {/* Total Soll */}
                  <tr className="border-t-2 border-border font-bold bg-muted/30">
                    <td colSpan={5} className="px-3 py-2 text-sm">Total Soll</td>
                    <td className="px-3 py-2 text-right font-mono text-sm">{formatCHF(totalDebit)}</td>
                    <td></td>
                  </tr>
                  {/* Total Haben */}
                  <tr className="font-bold bg-muted/30">
                    <td colSpan={5} className="px-3 py-2 text-sm">Total Haben</td>
                    <td></td>
                    <td className="px-3 py-2 text-right font-mono text-sm">{formatCHF(totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* AI reasoning if present */}
            {entry.aiReasoning && (
              <p className="text-xs text-muted-foreground mt-3 italic">
                KI-Begründung: {entry.aiReasoning}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
