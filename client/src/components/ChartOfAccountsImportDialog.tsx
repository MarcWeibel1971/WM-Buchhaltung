import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { readSpreadsheetRecords } from "@/lib/spreadsheet";

export type ChartOfAccountsImportAccount = {
  number: string;
  name: string;
  accountType: "asset" | "liability" | "expense" | "revenue" | "equity";
  category?: string;
  subCategory?: string;
};

type ChartOfAccountsImportInput = {
  accounts: ChartOfAccountsImportAccount[];
  mode: "merge" | "replace";
};

type ChartOfAccountsImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bulkImportMut: {
    mutate: (input: ChartOfAccountsImportInput, options?: { onSuccess?: () => void }) => void;
    isPending: boolean;
  };
  onImportSuccess: () => void;
};

const ACCOUNT_TYPE_LABELS: Record<ChartOfAccountsImportAccount["accountType"], string> = {
  asset: "Aktiven",
  liability: "Passiven",
  expense: "Aufwand",
  revenue: "Ertrag",
  equity: "Eigenkapital",
};

export function getAccountType(value: string, number: number): ChartOfAccountsImportAccount["accountType"] {
  const normalized = value.toLowerCase();
  if (normalized === "aktiv" || normalized === "aktiva" || normalized === "asset") return "asset";
  if (normalized === "passiv" || normalized === "passiva" || normalized === "liability") return "liability";
  if (normalized === "aufwand" || normalized === "expense") return "expense";
  if (normalized === "ertrag" || normalized === "revenue" || normalized === "income") return "revenue";
  if (normalized === "komplett" || normalized === "equity" || normalized === "eigenkapital") return "equity";
  if (number >= 1000 && number < 2000) return "asset";
  if (number >= 2000 && number < 2800) return "liability";
  if (number >= 2800 && number < 3000) return "equity";
  if (number >= 3000 && number < 4000) return "revenue";
  if (number >= 4000 && number < 9000) return "expense";
  if (number >= 9000) return "equity";
  return "expense";
}

export function getSwissKmuCategory(number: number): Pick<ChartOfAccountsImportAccount, "category" | "subCategory"> {
  const ranges: Array<[number, number, string, string]> = [
    [1000, 1100, "Umlaufvermögen", "Flüssige Mittel"],
    [1100, 1200, "Umlaufvermögen", "Kurzfristige Forderungen"],
    [1200, 1300, "Umlaufvermögen", "Vorräte"],
    [1300, 1400, "Umlaufvermögen", "Aktive Rechnungsabgrenzung"],
    [1400, 1500, "Anlagevermögen", "Finanzanlagen"],
    [1500, 1600, "Anlagevermögen", "Mobile Sachanlagen"],
    [1600, 1700, "Anlagevermögen", "Immobile Sachanlagen"],
    [1700, 2000, "Anlagevermögen", "Immaterielle Anlagen"],
    [2000, 2100, "Kurzfristiges Fremdkapital", "Kurzfristige Verbindlichkeiten"],
    [2100, 2200, "Kurzfristiges Fremdkapital", "Kurzfristige Finanzverbindlichkeiten"],
    [2200, 2300, "Kurzfristiges Fremdkapital", "Passive Rechnungsabgrenzung"],
    [2300, 2400, "Kurzfristiges Fremdkapital", "Kurzfristige Rückstellungen"],
    [2400, 2500, "Langfristiges Fremdkapital", "Langfristige Finanzverbindlichkeiten"],
    [2500, 2600, "Langfristiges Fremdkapital", "Langfristige Rückstellungen"],
    [2600, 2800, "Langfristiges Fremdkapital", "Übrige langfristige Verbindlichkeiten"],
    [2800, 2900, "Eigenkapital", "Grund-/Stammkapital"],
    [2900, 3000, "Eigenkapital", "Reserven / Gewinnvortrag"],
    [3000, 3200, "Betriebsertrag", "Produktionsertrag"],
    [3200, 3400, "Betriebsertrag", "Handelsertrag"],
    [3400, 3600, "Betriebsertrag", "Dienstleistungsertrag"],
    [3600, 3800, "Betriebsertrag", "Übriger Ertrag"],
    [3800, 4000, "Betriebsertrag", "Erlösminderungen"],
    [4000, 4500, "Aufwand für Material/Waren", "Materialaufwand"],
    [4500, 5000, "Aufwand für Material/Waren", "Drittleistungen"],
    [5000, 5800, "Personalaufwand", "Löhne und Gehälter"],
    [5800, 6000, "Personalaufwand", "Sozialversicherungsaufwand"],
    [6000, 6100, "Übriger Betriebsaufwand", "Raumaufwand"],
    [6100, 6200, "Übriger Betriebsaufwand", "Unterhalt und Reparaturen"],
    [6200, 6300, "Übriger Betriebsaufwand", "Fahrzeugaufwand"],
    [6300, 6400, "Übriger Betriebsaufwand", "Versicherungen"],
    [6400, 6500, "Übriger Betriebsaufwand", "Energie und Entsorgung"],
    [6500, 6600, "Übriger Betriebsaufwand", "Verwaltungsaufwand"],
    [6600, 6700, "Übriger Betriebsaufwand", "Informatikaufwand"],
    [6700, 6800, "Übriger Betriebsaufwand", "Übriger Betriebsaufwand"],
    [6800, 6900, "Übriger Betriebsaufwand", "Abschreibungen"],
    [6900, 7000, "Übriger Betriebsaufwand", "Finanzaufwand"],
    [7000, 7500, "Betriebsfremder Aufwand/Ertrag", "Betriebsfremder Ertrag"],
    [7500, 8000, "Betriebsfremder Aufwand/Ertrag", "Betriebsfremder Aufwand"],
    [8000, 8500, "Ausserordentlicher Aufwand/Ertrag", "Ausserordentlicher Ertrag"],
    [8500, 9000, "Ausserordentlicher Aufwand/Ertrag", "Ausserordentlicher Aufwand"],
    [9000, Number.POSITIVE_INFINITY, "Abschluss", "Abschlusskonten"],
  ];
  const match = ranges.find(([from, to]) => number >= from && number < to);
  return match ? { category: match[2], subCategory: match[3] } : {};
}

function getColumn(record: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = record[name] ?? record[`${name}*`];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return "";
}

export function ChartOfAccountsImportDialog({
  open,
  onOpenChange,
  bulkImportMut,
  onImportSuccess,
}: ChartOfAccountsImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importPreview, setImportPreview] = useState<ChartOfAccountsImportAccount[]>([]);
  const [isPdfParsing, setIsPdfParsing] = useState(false);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<number>>(new Set());
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);

  const resetDialog = () => {
    setImportPreview([]);
    setSelectedImportIds(new Set());
    setPdfProgress(null);
    setImportMode("merge");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDialog();
    onOpenChange(nextOpen);
  };

  const selectAll = () => setSelectedImportIds(new Set(importPreview.map((_, index) => index)));

  const handleSpreadsheetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readSpreadsheetRecords(file);
      const parsed = rows.reduce<ChartOfAccountsImportAccount[]>((accounts, row: Record<string, unknown>) => {
        const number = getColumn(row, "Nummer", "Konto", "Nr", "number", "Account", "Kontonummer");
        const name = getColumn(row, "Name", "Bezeichnung", "Kontoname", "name", "Description");
        const accountTypeValue = getColumn(row, "Kontoart", "Typ", "Type", "accountType", "Art");
        const parsedNumber = Number.parseInt(number, 10);
        if (Number.isNaN(parsedNumber) || parsedNumber < 1000 || accountTypeValue.toLowerCase() === "gruppe" || accountTypeValue.toLowerCase() === "group") return accounts;
        const automaticCategory = getSwissKmuCategory(parsedNumber);
        accounts.push({
          number,
          name,
          accountType: getAccountType(accountTypeValue, parsedNumber),
          category: getColumn(row, "Kategorie", "category") || automaticCategory.category,
          subCategory: getColumn(row, "Unterkategorie", "subCategory") || automaticCategory.subCategory,
        });
        return accounts;
      }, []).filter((account) => Boolean(account.number) && Boolean(account.name));
      setImportPreview(parsed);
      setSelectedImportIds(new Set(parsed.map((_, index) => index)));
      toast.success(`${parsed.length} Konten aus Datei gelesen`);
    } catch {
      toast.error("Fehler beim Lesen der Datei");
    } finally {
      event.target.value = "";
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsPdfParsing(true);
    setPdfProgress("Kontenplan wird extrahiert, bitte warten...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/chart-of-accounts-pdf", { method: "POST", body: formData });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Upload fehlgeschlagen");
      }
      const result = await response.json() as { accounts?: Array<{ number?: string; name?: string; accountType?: string }> };
      const parsed = (result.accounts ?? []).map((account) => {
        const number = account.number?.trim() ?? "";
        const parsedNumber = Number.parseInt(number, 10);
        return {
          number,
          name: account.name?.trim() ?? "",
          accountType: getAccountType(account.accountType ?? "", Number.isNaN(parsedNumber) ? 0 : parsedNumber),
          ...getSwissKmuCategory(Number.isNaN(parsedNumber) ? 0 : parsedNumber),
        } satisfies ChartOfAccountsImportAccount;
      }).filter((account) => Boolean(account.number) && Boolean(account.name));
      if (parsed.length === 0) {
        toast.error("Keine Konten im PDF gefunden");
        return;
      }
      setImportPreview(parsed);
      setSelectedImportIds(new Set(parsed.map((_, index) => index)));
      toast.success(`${parsed.length} Konten per KI aus PDF extrahiert`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF-Analyse fehlgeschlagen");
    } finally {
      setIsPdfParsing(false);
      setPdfProgress(null);
      event.target.value = "";
    }
  };

  const toggleAccount = (index: number) => {
    setSelectedImportIds((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const handleImport = () => {
    const accounts = importPreview.filter((_, index) => selectedImportIds.has(index));
    bulkImportMut.mutate({ accounts, mode: importMode }, {
      onSuccess: () => {
        resetDialog();
        onOpenChange(false);
        onImportSuccess();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Kontenplan importieren</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Laden Sie eine Excel-/CSV-Datei oder ein PDF mit dem Kontenplan hoch. Bei Excel/CSV werden die Spalten "Nummer" und "Name" automatisch erkannt. Bei PDF wird der Kontenplan per KI extrahiert.
          </p>
          {isPdfParsing && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">KI analysiert PDF...</p>
                <p className="text-xs text-muted-foreground">{pdfProgress || "Kontenplan wird extrahiert, bitte warten..."}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isPdfParsing}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel/CSV
            </Button>
            <Button variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={isPdfParsing}>
              {isPdfParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {isPdfParsing ? "KI analysiert..." : "PDF/Bild"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleSpreadsheetUpload} />
            <input ref={pdfInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handlePdfUpload} />
            <Select value={importMode} onValueChange={(value: "merge" | "replace") => setImportMode(value)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">Zusammenführen (Merge)</SelectItem>
                <SelectItem value="replace">Ersetzen (Replace)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {importMode === "replace" && <p className="text-sm text-destructive">Achtung: Im Ersetzen-Modus werden alle Konten ohne Buchungen gelöscht und durch die importierten ersetzt.</p>}
          {importPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border cursor-pointer"
                    checked={selectedImportIds.size === importPreview.length}
                    ref={(element) => { if (element) element.indeterminate = selectedImportIds.size > 0 && selectedImportIds.size < importPreview.length; }}
                    onChange={(event) => event.target.checked ? selectAll() : setSelectedImportIds(new Set())}
                  />
                  <span className="text-sm text-muted-foreground">{selectedImportIds.size === importPreview.length ? `Alle ${importPreview.length} Konten ausgewählt` : `${selectedImportIds.size} von ${importPreview.length} ausgewählt`}</span>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs text-primary underline hover:no-underline" onClick={selectAll}>Alle</button>
                  <button className="text-xs text-muted-foreground underline hover:no-underline" onClick={() => setSelectedImportIds(new Set())}>Keine</button>
                </div>
              </div>
              <div className="border rounded-lg overflow-y-auto" style={{ maxHeight: "55vh" }}>
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow><TableHead className="w-8" /><TableHead className="w-16">Nr.</TableHead><TableHead>Name</TableHead><TableHead className="w-24">Typ</TableHead><TableHead>Kategorie</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((account, index) => (
                      <TableRow key={`${account.number}-${index}`} className={`cursor-pointer transition-colors ${selectedImportIds.has(index) ? "bg-primary/5" : "opacity-50"}`} onClick={() => toggleAccount(index)}>
                        <TableCell className="py-1.5" onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" className="h-4 w-4 rounded border-border cursor-pointer" checked={selectedImportIds.has(index)} onChange={() => toggleAccount(index)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs py-1.5">{account.number}</TableCell>
                        <TableCell className="text-sm py-1.5">{account.name}</TableCell>
                        <TableCell className="py-1.5"><Badge variant="outline" className="text-xs">{ACCOUNT_TYPE_LABELS[account.accountType]}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground py-1.5">{account.category || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleImport} disabled={selectedImportIds.size === 0 || bulkImportMut.isPending}>
            {bulkImportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {selectedImportIds.size} von {importPreview.length} Konten importieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
