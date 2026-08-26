import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCHF } from "@/lib/formatters";

export function BankImportTransactionBasics({ transactionDate, amount, description, onDescriptionChange }: { transactionDate: string | number | Date | null | undefined; amount: string | number; description: string; onDescriptionChange: (value: string) => void }) {
  const formattedDate = transactionDate ? new Date(transactionDate).toLocaleDateString("de-CH") : "–";
  return <><div className="grid grid-cols-2 gap-4"><div><Label className="text-xs">Datum</Label><Input value={formattedDate} disabled className="bg-muted" /></div><div><Label className="text-xs">Betrag CHF</Label><Input value={formatCHF(amount)} disabled className="bg-muted" /></div></div><div><Label className="text-xs">Buchungstext</Label><Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="z.B. Sunrise 1. Quartal 2026" /></div></>;
}
