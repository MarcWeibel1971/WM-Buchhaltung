import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type RevenueAccount = { id: number; number: string; name: string };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; isEditing: boolean; description: string; onDescriptionChange: (value: string) => void; accountId: string; onAccountIdChange: (value: string) => void; hourlyRate: string; onHourlyRateChange: (value: string) => void; isDefault: boolean; onDefaultChange: (value: boolean) => void; accounts: RevenueAccount[]; onSave: () => void; isPending: boolean; onCancel: () => void };

export function CustomerServiceDialog({ open, onOpenChange, isEditing, description, onDescriptionChange, accountId, onAccountIdChange, hourlyRate, onHourlyRateChange, isDefault, onDefaultChange, accounts, onSave, isPending, onCancel }: Props) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{isEditing ? "Dienstleistung bearbeiten" : "Neue Dienstleistung"}</DialogTitle></DialogHeader><div className="grid gap-4 py-4"><div><Label>Beschreibung *</Label><Input value={description} onChange={event => onDescriptionChange(event.target.value)} placeholder="z.B. Finanzberatung, Steuererklärung" /></div><div><Label>Ertragskonto *</Label><Select value={accountId} onValueChange={onAccountIdChange}><SelectTrigger><SelectValue placeholder="Ertragskonto wählen" /></SelectTrigger><SelectContent>{accounts.map(account => <SelectItem key={account.id} value={String(account.id)}>{account.number} {account.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Stundenansatz (CHF)</Label><Input value={hourlyRate} onChange={event => onHourlyRateChange(event.target.value)} type="number" step="0.50" placeholder="250.00" /></div><div className="flex items-center gap-2"><Switch checked={isDefault} onCheckedChange={onDefaultChange} /><Label>Primäre Dienstleistung (häufigste)</Label></div></div><DialogFooter><Button variant="outline" onClick={onCancel}>Abbrechen</Button><Button onClick={onSave} disabled={isPending}>{isEditing ? "Speichern" : "Hinzufügen"}</Button></DialogFooter></DialogContent></Dialog>;
}
