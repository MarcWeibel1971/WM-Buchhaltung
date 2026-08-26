import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CollectiveLine = { accountId: string; amount: string; description: string; vatRate: string };
type Account = { id: number; number: string; name: string };

export function BankImportCollectiveBookingLines({ lines, accounts, isIncoming, onChange, onAdd, onRemove }: { lines: CollectiveLine[]; accounts: Account[] | undefined; isIncoming: boolean; onChange: (index: number, patch: Partial<CollectiveLine>) => void; onAdd: () => void; onRemove: (index: number) => void }) {
  const tone = isIncoming ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" : "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700";
  const heading = isIncoming ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400";
  return <div className={`rounded-lg border-2 p-3 ${tone}`}>
    <div className="flex items-center gap-2 mb-2"><span className={`text-xs font-bold uppercase ${heading}`}>{isIncoming ? "HABEN (Ertrag)" : "SOLL (Aufwand)"}</span><span className="text-xs text-muted-foreground">– Gegenpositionen</span></div>
    <div className="space-y-2">{lines.map((line, index) => <div key={index} className="flex items-center gap-2"><span className="text-xs text-muted-foreground w-5 shrink-0">{index + 1}.</span><Select value={line.accountId} onValueChange={(accountId) => onChange(index, { accountId })}><SelectTrigger className="h-8 text-xs flex-1 min-w-[180px]"><SelectValue placeholder="Konto wählen..." /></SelectTrigger><SelectContent>{accounts?.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.number} {account.name}</SelectItem>)}</SelectContent></Select><Input className="h-8 text-xs w-[120px]" placeholder="Text" value={line.description} onChange={(event) => onChange(index, { description: event.target.value })} /><Input className="h-8 text-xs w-[100px] font-mono text-right" placeholder="Betrag" value={line.amount} onChange={(event) => onChange(index, { amount: event.target.value })} /><Select value={line.vatRate} onValueChange={(vatRate) => onChange(index, { vatRate: vatRate === "none" ? "" : vatRate })}><SelectTrigger className="h-8 text-xs w-[80px]"><SelectValue placeholder="MWST" /></SelectTrigger><SelectContent><SelectItem value="none">–</SelectItem><SelectItem value="8.1">8.1%</SelectItem><SelectItem value="2.6">2.6%</SelectItem><SelectItem value="3.8">3.8%</SelectItem></SelectContent></Select><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 shrink-0" disabled={lines.length <= 1} onClick={() => onRemove(index)}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>
    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={onAdd}><Plus className="h-3 w-3" /> Zeile hinzufügen</Button>
  </div>;
}
