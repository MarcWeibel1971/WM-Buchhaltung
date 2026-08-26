import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type OpeningBalanceImportItem = {
  number: string;
  name: string;
  balance: number;
  accountType: string;
};

type OpeningBalanceAccount = {
  accountNumber: string;
};

type OpeningBalancesImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows?: OpeningBalanceAccount[];
  onApply: (items: OpeningBalanceImportItem[]) => void;
};

export function inferOpeningBalanceAccountType(number: string) {
  const accountNumber = Number.parseInt(number, 10);
  if (accountNumber >= 2000 && accountNumber <= 2799) return "liability";
  return accountNumber >= 2800 ? "equity" : "asset";
}

export function OpeningBalancesImportDialog({ open, onOpenChange, rows, onApply }: OpeningBalancesImportDialogProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [preview, setPreview] = useState<OpeningBalanceImportItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);

  const resetPreview = () => {
    setPreview([]);
    setSelectedIds(new Set());
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetPreview();
  };

  const setParsedPreview = (items: OpeningBalanceImportItem[], successMessage: string) => {
    setPreview(items);
    setSelectedIds(new Set(items.map((_, index) => index)));
    if (items.length === 0) toast.warning("Keine Salden gefunden");
    else toast.success(`${items.length} Konten ${successMessage}`);
  };

  const handleFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    setIsParsing(true);

    try {
      if (["pdf", "jpg", "jpeg", "png", "webp"].includes(extension)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload/opening-balance-pdf", { method: "POST", body: formData, credentials: "include" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Upload fehlgeschlagen");
        setParsedPreview(result.balances ?? [], "extrahiert");
        return;
      }

      if (!["csv", "xlsx", "xls"].includes(extension)) {
        toast.error("Bitte PDF, Bild oder CSV/Excel hochladen");
        return;
      }

      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      const separator = lines[0]?.includes(";") ? ";" : ",";
      const headers = lines[0]?.split(separator).map((header) => header.trim().toLowerCase().replace(/"/g, "")) ?? [];
      const numberIndex = headers.findIndex((header) => ["nummer", "konto", "kontonummer", "number"].includes(header));
      const nameIndex = headers.findIndex((header) => ["bezeichnung", "name", "kontoname"].includes(header));
      const balanceIndex = headers.findIndex((header) => ["saldo", "betrag", "balance", "amount", "soll"].includes(header));
      if (numberIndex === -1 || balanceIndex === -1) {
        toast.error("Spalten 'Nummer' und 'Saldo' nicht gefunden. Bitte Spaltenüberschriften prüfen.");
        return;
      }

      const items: OpeningBalanceImportItem[] = [];
      for (let index = 1; index < lines.length; index += 1) {
        const columns = lines[index].split(separator).map((column) => column.trim().replace(/"/g, ""));
        const number = columns[numberIndex]?.trim();
        const balance = Number.parseFloat(columns[balanceIndex]?.replace(/[^0-9.\-]/g, "") ?? "0");
        if (!number || Number.isNaN(balance) || balance === 0) continue;
        items.push({
          number,
          name: nameIndex >= 0 ? columns[nameIndex] : number,
          balance: Math.abs(balance),
          accountType: inferOpeningBalanceAccountType(number),
        });
      }
      setParsedPreview(items, "gelesen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Die Importdatei konnte nicht verarbeitet werden.");
    } finally {
      setIsParsing(false);
    }
  };

  const selectAll = () => setSelectedIds(new Set(preview.map((_, index) => index)));
  const selectedItems = preview.filter((_, index) => selectedIds.has(index));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Eröffnungssalden importieren</DialogTitle>
          <p className="text-sm text-muted-foreground">Laden Sie eine Bilanz als PDF/Bild (KI-Extraktion) oder als CSV/Excel-Datei hoch. CSV/Excel muss Spalten „Nummer“ und „Saldo“ enthalten.</p>
        </DialogHeader>

        {preview.length === 0 && (
          <div className="space-y-3 py-2">
            {isParsing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">KI analysiert die Bilanz...</p>
                <p className="text-xs text-muted-foreground">Dies kann 15–30 Sekunden dauern</p>
              </div>
            ) : (
              <>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void handleFile(file); }}>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">PDF, Bild oder CSV/Excel hier ablegen</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF/JPG/PNG → KI-Extraktion | CSV/XLSX → direkt einlesen</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-4 w-4 mr-2" /> CSV / Excel hochladen</Button>
                  <Button variant="outline" className="flex-1" onClick={() => pdfFileRef.current?.click()}><FileText className="h-4 w-4 mr-2" /> PDF / Bild hochladen (KI)</Button>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.target.value = ""; }} />
                <input ref={pdfFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.target.value = ""; }} />
              </>
            )}
          </div>
        )}

        {preview.length > 0 && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{preview.length} Konten gefunden – {selectedIds.size} ausgewählt</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Alle auswählen</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>Alle abwählen</Button>
                <Button variant="outline" size="sm" onClick={resetPreview}>Neue Datei</Button>
              </div>
            </div>
            <div className="overflow-auto flex-1 border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr><th className="w-8 px-3 py-2"><input type="checkbox" checked={selectedIds.size === preview.length} onChange={(event) => event.target.checked ? selectAll() : setSelectedIds(new Set())} className="rounded" /></th><th className="text-left px-3 py-2 font-medium">Nr.</th><th className="text-left px-3 py-2 font-medium">Bezeichnung</th><th className="text-left px-3 py-2 font-medium">Typ</th><th className="text-right px-3 py-2 font-medium">Saldo CHF</th><th className="text-left px-3 py-2 font-medium">Im Kontenplan</th></tr></thead>
                <tbody>{preview.map((item, index) => {
                  const inPlan = rows?.some((row) => row.accountNumber === item.number);
                  return <tr key={`${item.number}-${index}`} className={`border-t border-border ${selectedIds.has(index) ? "bg-primary/5" : ""}`}><td className="px-3 py-1.5"><input type="checkbox" checked={selectedIds.has(index)} onChange={(event) => setSelectedIds((previous) => { const next = new Set(previous); event.target.checked ? next.add(index) : next.delete(index); return next; })} className="rounded" /></td><td className="px-3 py-1.5 font-mono text-xs">{item.number}</td><td className="px-3 py-1.5">{item.name}</td><td className="px-3 py-1.5"><Badge variant="outline" className="text-xs">{item.accountType === "asset" ? "Aktiven" : item.accountType === "liability" ? "Fremdkapital" : "Eigenkapital"}</Badge></td><td className="px-3 py-1.5 text-right font-mono">{new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2 }).format(item.balance)}</td><td className="px-3 py-1.5">{inPlan ? <span className="text-green-600 text-xs">✓ Vorhanden</span> : <span className="text-amber-600 text-xs">⚠ Nicht gefunden</span>}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
          {preview.length > 0 && <Button onClick={() => onApply(selectedItems)} disabled={selectedItems.length === 0}><Upload className="h-4 w-4 mr-2" />{selectedItems.length} Salden übernehmen</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
