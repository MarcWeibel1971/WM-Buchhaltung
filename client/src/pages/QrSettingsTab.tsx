import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, QrCode, Upload, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

export default function QrSettingsTab() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.qrBill.getQrSettings.useQuery();

  const [iban, setIban] = useState("");
  const [referenceType, setReferenceType] = useState<"QRR" | "SCOR" | "NON">("QRR");
  const [currency, setCurrency] = useState<"CHF" | "EUR">("CHF");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Felder mit gespeicherten Werten befüllen (einmalig)
  if (settings && !initialized) {
    setIban(settings.iban ?? "");
    setReferenceType(settings.referenceType ?? "QRR");
    setCurrency(settings.currency ?? "CHF");
    setAdditionalInfo(settings.additionalInfo ?? "");
    setInitialized(true);
  }

  const saveMut = trpc.qrBill.saveQrSettings.useMutation({
    onSuccess: () => {
      toast.success("QR-Einstellungen gespeichert");
      utils.qrBill.getQrSettings.invalidate();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  // QR-Code Bild Upload (für eigenes QR-Bild, falls gewünscht)
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadLogoMut = trpc.settings.uploadCompanyLogo.useMutation({
    onSuccess: () => {
      toast.success("QR-Code Bild hochgeladen");
    },
    onError: (e) => toast.error(`Upload fehlgeschlagen: ${e.message}`),
  });

  const handleSave = () => {
    if (!iban.trim()) {
      toast.error("Bitte IBAN eingeben");
      return;
    }
    saveMut.mutate({ iban: iban.trim(), referenceType, currency, additionalInfo: additionalInfo || undefined });
  };

  // IBAN-Format-Hinweis: QR-IBAN beginnt mit CH3 oder CH4 und IID 30000-31999
  const cleanIban = iban.replace(/\s/g, "");
  const iid = cleanIban.length >= 9 ? parseInt(cleanIban.substring(4, 9)) : 0;
  const isQrIban = iid >= 30000 && iid <= 31999;
  const ibanValid = cleanIban.length >= 15;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">QR-Rechnung Einstellungen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Konfigurieren Sie IBAN und Referenztyp für den automatischen QR-Einzahlungsschein auf Ausgangsrechnungen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Zahlungsverbindung
          </CardTitle>
          <CardDescription>
            Diese Angaben erscheinen auf dem QR-Einzahlungsschein jeder Ausgangsrechnung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="iban">IBAN / QR-IBAN *</Label>
            <Input
              id="iban"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="CH56 0483 5012 3456 7800 9"
              className={ibanValid && isQrIban ? "border-green-500" : ibanValid ? "border-blue-400" : ""}
            />
            {ibanValid && (
              <p className={`text-xs ${isQrIban ? "text-green-600" : "text-blue-600"}`}>
                {isQrIban
                  ? "✓ QR-IBAN erkannt – QR-Referenz (QRR) wird verwendet"
                  : "✓ Normale IBAN – Creditor Reference (SCOR) wird verwendet"}
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              QR-IBAN erhalten Sie bei Ihrer Bank (IID 30000–31999). Normale IBAN ist ebenfalls möglich.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Referenztyp</Label>
              <Select value={referenceType} onValueChange={(v) => setReferenceType(v as "QRR" | "SCOR" | "NON")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QRR">QR-Referenz (QRR) – nur mit QR-IBAN</SelectItem>
                  <SelectItem value="SCOR">Creditor Reference (SCOR)</SelectItem>
                  <SelectItem value="NON">Ohne Referenz (NON)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Währung</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "CHF" | "EUR")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHF">CHF – Schweizer Franken</SelectItem>
                  <SelectItem value="EUR">EUR – Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalInfo">Zusatzinformation (optional)</Label>
            <Input
              id="additionalInfo"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="z.B. Rechnungsnummer oder Verwendungszweck"
              maxLength={140}
            />
            <p className="text-xs text-muted-foreground">{additionalInfo.length}/140 Zeichen</p>
          </div>

          <Button onClick={handleSave} disabled={saveMut.isPending || !ibanValid}>
            {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Speichern…</> : "Einstellungen speichern"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>So funktioniert es</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
            <p>Tragen Sie Ihre IBAN oder QR-IBAN ein und speichern Sie die Einstellungen.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
            <p>Bei jeder Ausgangsrechnung erscheint der Button <strong>"Verbuchen &amp; QR-Rechnung PDF"</strong>.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
            <p>Das generierte PDF enthält Briefkopf mit Logo, Positionen und den normierten QR-Einzahlungsschein (Swiss QR Bill Standard).</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</div>
            <p>Das Logo wird automatisch aus den <strong>Unternehmenseinstellungen</strong> übernommen.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
