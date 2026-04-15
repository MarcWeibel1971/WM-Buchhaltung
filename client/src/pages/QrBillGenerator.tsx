import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QrCode, Download, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function QrBillGenerator() {
  const { data: qrSettings } = trpc.qrBill.getQrSettings.useQuery();

  const [debtorName, setDebtorName] = useState("");
  const [debtorAddress, setDebtorAddress] = useState("");
  const [debtorZip, setDebtorZip] = useState("");
  const [debtorCity, setDebtorCity] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"CHF" | "EUR">("CHF");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const generateMut = trpc.qrBill.generateQrBill.useMutation({
    onSuccess: (result) => {
      const byteChars = atob(result.base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("QR-Rechnung erstellt");
    },
    onError: (e: any) => toast.error(`Fehler: ${e.message}`),
  });

  const handleGenerate = () => {
    if (!debtorName.trim()) { toast.error("Empfängername ist erforderlich"); return; }
    if (!debtorAddress.trim()) { toast.error("Adresse ist erforderlich"); return; }
    if (!debtorZip.trim()) { toast.error("PLZ ist erforderlich"); return; }
    if (!debtorCity.trim()) { toast.error("Ort ist erforderlich"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Betrag muss grösser als 0 sein"); return; }

    generateMut.mutate({
      debtorName: debtorName.trim(),
      debtorAddress: debtorAddress.trim(),
      debtorZip: debtorZip.trim(),
      debtorCity: debtorCity.trim(),
      amount: parseFloat(amount),
      currency,
      additionalInfo: additionalInfo || undefined,
    });
  };

  if (!qrSettings) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">QR-Rechnung nicht konfiguriert</h2>
            <p className="text-muted-foreground mb-4">
              Bitte konfigurieren Sie zuerst die IBAN und Referenzart unter Einstellungen &gt; QR-Rechnung.
            </p>
            <Button variant="outline" onClick={() => window.location.href = "/settings"}>
              Zu den Einstellungen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <QrCode className="h-7 w-7 text-primary" />
          QR-Rechnung erstellen
        </h1>
        <p className="text-muted-foreground mt-1">
          Generieren Sie eine Swiss QR-Rechnung mit QR-Zahlungsteil (ISO 20022).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Creditor info (from settings) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zahlungsempfänger (Creditor)</CardTitle>
            <CardDescription>Aus den QR-Rechnungs-Einstellungen</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1 text-muted-foreground">
            <p className="font-mono">{qrSettings.iban}</p>
            <p>Referenztyp: {qrSettings.referenceType}</p>
            <p>Währung: {qrSettings.currency}</p>
          </CardContent>
        </Card>

        {/* Debtor form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zahlungspflichtiger (Debtor)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name / Firma *</Label>
              <Input value={debtorName} onChange={e => setDebtorName(e.target.value)} placeholder="Max Muster AG" />
            </div>
            <div>
              <Label>Strasse *</Label>
              <Input value={debtorAddress} onChange={e => setDebtorAddress(e.target.value)} placeholder="Musterstrasse 1" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>PLZ *</Label>
                <Input value={debtorZip} onChange={e => setDebtorZip(e.target.value)} placeholder="8000" />
              </div>
              <div className="col-span-2">
                <Label>Ort *</Label>
                <Input value={debtorCity} onChange={e => setDebtorCity(e.target.value)} placeholder="Zürich" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zahlungsdetails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Betrag *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="1'500.00"
              />
            </div>
            <div>
              <Label>Währung</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Zusätzliche Informationen (optional)</Label>
            <Textarea
              value={additionalInfo}
              onChange={e => setAdditionalInfo(e.target.value)}
              placeholder="Rechnungsnummer, Mitteilung..."
              maxLength={140}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={generateMut.isPending}
          className="gap-2"
        >
          {generateMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          QR-Rechnung als PDF generieren
        </Button>
      </div>
    </div>
  );
}
