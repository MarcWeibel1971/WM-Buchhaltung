import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Account = { id: number; number: string; name: string };
type Props = { paymentDays: string; onPaymentDaysChange: (value: string) => void; accountId: string; onAccountIdChange: (value: string) => void; accounts: Account[]; matchPattern: string; onMatchPatternChange: (value: string) => void; notes: string; onNotesChange: (value: string) => void };

export function SupplierPaymentFields({ paymentDays, onPaymentDaysChange, accountId, onAccountIdChange, accounts, matchPattern, onMatchPatternChange, notes, onNotesChange }: Props) {
  return <><div className="grid grid-cols-2 gap-4"><div><Label>Zahlungsfrist (Tage)</Label><Input value={paymentDays} onChange={event => onPaymentDaysChange(event.target.value)} type="number" /></div><div><Label>Standard-Aufwandkonto</Label><Select value={accountId} onValueChange={onAccountIdChange}><SelectTrigger><SelectValue placeholder="Konto wählen" /></SelectTrigger><SelectContent>{accounts.map(account => <SelectItem key={account.id} value={String(account.id)}>{account.number} {account.name}</SelectItem>)}</SelectContent></Select></div></div><div><Label>Match-Pattern (für Bankimport)</Label><Input value={matchPattern} onChange={event => onMatchPatternChange(event.target.value)} placeholder="z.B. AXA, Mobility, Swisscom" /><p className="text-xs text-muted-foreground mt-1">Komma-getrennte Begriffe, die in Bankimport-Transaktionen automatisch diesem Lieferanten zugeordnet werden.</p></div><div><Label>Notizen</Label><Textarea value={notes} onChange={event => onNotesChange(event.target.value)} rows={3} placeholder="Interne Notizen..." /></div></>;
}
