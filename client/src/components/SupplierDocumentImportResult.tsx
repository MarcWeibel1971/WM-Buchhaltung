import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ImportResult = { created: number; linked: number; skipped: number; total: number; details: Array<{ supplierName: string; action: string }> };

export function SupplierDocumentImportResult({ result }: { result?: ImportResult }) {
  if (!result) return null;
  return <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"><CardContent className="py-3 px-4"><div className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-600" /><span className="font-medium">Rechnungs-Import abgeschlossen:</span><span>{result.created} neu erstellt, {result.linked} verknüpft, {result.skipped} übersprungen</span><span className="text-muted-foreground">({result.total} Rechnungen geprüft)</span></div>{result.details.length > 0 && <div className="mt-2 max-h-32 overflow-y-auto">{result.details.map((detail, index) => <div key={index} className="text-xs text-muted-foreground">{detail.supplierName} – {detail.action}</div>)}</div>}</CardContent></Card>;
}
