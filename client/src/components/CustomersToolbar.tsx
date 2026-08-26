import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload } from "lucide-react";

export function CustomersToolbar({ search, onSearchChange, onImport, onCreate }: { search: string; onSearchChange: (value: string) => void; onImport: () => void; onCreate: () => void }) {
  return <><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Kunden-Stammdaten</h1><p className="text-muted-foreground text-sm mt-1">Kunden mit Dienstleistungen und Ertragskonten-Zuordnung</p></div><div className="flex gap-2"><Button variant="outline" onClick={onImport}><Upload className="h-4 w-4 mr-2" />CSV/Excel Import</Button><Button onClick={onCreate}><Plus className="h-4 w-4 mr-2" />Neuer Kunde</Button></div></div><Input placeholder="Suche nach Name, Firma oder Ort..." value={search} onChange={event => onSearchChange(event.target.value)} className="max-w-sm" /></>;
}
