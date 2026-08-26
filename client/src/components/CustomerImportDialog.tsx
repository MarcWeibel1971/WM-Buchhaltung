import type { ChangeEvent, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload } from "lucide-react";

export type CustomerImportPreview = { name: string; company?: string; street?: string; zipCode?: string; city?: string; email?: string; phone?: string };

export function CustomerImportDialog({ open, onOpenChange, fileRef, onFileChange, onImport, preview, isPending }: { open: boolean; onOpenChange: (value: boolean) => void; fileRef: RefObject<HTMLInputElement | null>; onFileChange: (event: ChangeEvent<HTMLInputElement>) => void; onImport: () => void; preview: CustomerImportPreview[]; isPending: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Kunden importieren (CSV/Excel)</DialogTitle></DialogHeader><div className="space-y-4 py-4"><p className="text-sm text-muted-foreground">CSV- oder Excel-Datei auswählen. Nach dem Einlesen wird der Import der erkannten Kunden bestätigt.</p><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} /><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Datei wählen</Button>{preview.length > 0 && <p className="text-sm font-medium">{preview.length} Kunden zum Import bereit</p>}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button><Button disabled={preview.length === 0 || isPending} onClick={onImport}><Upload className="h-4 w-4 mr-2" />{preview.length} Kunden importieren</Button></DialogFooter></DialogContent></Dialog>;
}
