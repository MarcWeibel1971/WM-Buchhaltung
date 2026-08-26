import { FileText, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SuppliersToolbar({ search, onSearchChange, showInactive, onShowInactiveChange, onImportFromDocuments, isImportingFromDocuments, onImport, onCreate }: { search: string; onSearchChange: (value: string) => void; showInactive: boolean; onShowInactiveChange: (value: boolean) => void; onImportFromDocuments: () => void; isImportingFromDocuments: boolean; onImport: () => void; onCreate: () => void }) {
  return <><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Lieferanten-Stammdaten</h1><p className="text-muted-foreground text-sm mt-1">Lieferanten mit IBAN, Zahlungsfristen und Kontaktdaten für ISO 20022 Zahlungen</p></div><div className="flex gap-2"><Button variant="outline" onClick={onImportFromDocuments} disabled={isImportingFromDocuments}>{isImportingFromDocuments ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}Aus Rechnungen</Button><Button variant="outline" onClick={onImport}><Upload className="h-4 w-4 mr-2" />CSV/Excel Import</Button><Button onClick={onCreate}><Plus className="h-4 w-4 mr-2" />Neuer Lieferant</Button></div></div><div className="flex items-center gap-4"><Input placeholder="Suche nach Name, Ort oder IBAN..." value={search} onChange={event => onSearchChange(event.target.value)} className="max-w-sm" /><div className="flex items-center gap-2"><Switch checked={showInactive} onCheckedChange={onShowInactiveChange} /><Label className="text-sm text-muted-foreground">Inaktive anzeigen</Label></div></div></>;
}
