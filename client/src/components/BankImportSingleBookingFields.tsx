import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BookingForm = { counterparty: string; counterpartyIban: string; reference: string; debitAccountId: string; creditAccountId: string };
type Account = { id: number; number: string; name: string };

export function BankImportSingleBookingFields({ form, accounts, onChange }: { form: BookingForm; accounts: Account[] | undefined; onChange: (field: keyof BookingForm, value: string) => void }) {
  return <>
    <div><Label className="text-xs">Lieferant (Kreditor) / Kunde (Debitor)</Label><Input value={form.counterparty} onChange={(event) => onChange("counterparty", event.target.value)} /></div>
    <div><Label className="text-xs">IBAN Gegenpartei</Label><Input value={form.counterpartyIban} onChange={(event) => onChange("counterpartyIban", event.target.value)} /></div>
    <div><Label className="text-xs">Referenz</Label><Input value={form.reference} onChange={(event) => onChange("reference", event.target.value)} /></div>
    <div className="grid grid-cols-2 gap-4">
      <div><Label className="text-xs">Soll-Konto</Label><Select value={form.debitAccountId} onValueChange={(value) => onChange("debitAccountId", value)}><SelectTrigger><SelectValue placeholder="Konto wählen..." /></SelectTrigger><SelectContent>{accounts?.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.number} {account.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Haben-Konto</Label><Select value={form.creditAccountId} onValueChange={(value) => onChange("creditAccountId", value)}><SelectTrigger><SelectValue placeholder="Konto wählen..." /></SelectTrigger><SelectContent>{accounts?.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.number} {account.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
  </>;
}
