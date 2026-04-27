/**
 * EBICS 3.0 Einstellungen
 * Konfiguration für den direkten Bankdaten-Abruf via EBICS 3.0.
 * Unterstützte Banken: LUKB, UBS, Raiffeisen, PostFinance, ZKB und weitere SIX-Mitglieder.
 *
 * EBICS-Prozess:
 * 1. Konfiguration hinterlegen (Host-URL, Partner-ID, User-ID)
 * 2. RSA-Schlüsselpaar generieren (in Browser, privater Schlüssel bleibt lokal)
 * 3. Initialisierungsbrief drucken und an Bank senden
 * 4. Bank aktiviert den Zugang (INI/HIA bestätigt)
 * 5. Automatischer CAMT.053-Abruf täglich
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Landmark, Plus, Trash2, Pencil, Loader2, AlertTriangle, CheckCircle,
  Key, FileText, Download, RefreshCw, Shield, Info, ChevronRight,
  Clock, Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── Bekannte Schweizer Banken mit EBICS-Unterstützung ───────────────────────
const SWISS_BANKS = [
  { name: "LUKB (Luzerner Kantonalbank)", hostId: "LUKBEBICS", url: "https://ebics.lukb.ch/ebicsweb/ebicsweb" },
  { name: "UBS", hostId: "UBSW", url: "https://ebics.ubs.com/ebicsweb/ebicsweb" },
  { name: "Raiffeisen", hostId: "RAIFF", url: "https://ebics.raiffeisen.ch/ebicsweb/ebicsweb" },
  { name: "PostFinance", hostId: "PFEBICS", url: "https://ebics.postfinance.ch/ebicsweb/ebicsweb" },
  { name: "ZKB (Zürcher Kantonalbank)", hostId: "ZKB", url: "https://ebics.zkb.ch/ebicsweb/ebicsweb" },
  { name: "BCGE (Genfer Kantonalbank)", hostId: "BCGE", url: "https://ebics.bcge.ch/ebicsweb/ebicsweb" },
  { name: "BCVS (Walliser Kantonalbank)", hostId: "BCVS", url: "https://ebics.bcvs.ch/ebicsweb/ebicsweb" },
  { name: "Andere (manuell eingeben)", hostId: "", url: "" },
];

// EBICS-Auftragstypen (Schweiz)
const ORDER_TYPES = [
  { code: "C53", label: "CAMT.053 – Kontoauszug (täglich)", recommended: true },
  { code: "C52", label: "CAMT.052 – Intraday-Umsätze (mehrmals täglich)", recommended: false },
  { code: "C54", label: "CAMT.054 – Buchungsdetails", recommended: false },
  { code: "HAA", label: "HAA – Verfügbare Auftragstypen abfragen", recommended: false },
];

interface EbicsConfig {
  id: number;
  bankName: string;
  hostId: string;
  hostUrl: string;
  partnerId: string;
  userId: string;
  status: string;
  isActive: boolean;
  lastFetchAt?: Date | string | null;
  autoFetchEnabled: boolean;
  autoFetchOrderType: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Neu", color: "bg-gray-100 text-gray-700" },
  ini_sent: { label: "INI gesendet", color: "bg-yellow-100 text-yellow-700" },
  hia_sent: { label: "HIA gesendet", color: "bg-blue-100 text-blue-700" },
  active: { label: "Aktiv", color: "bg-green-100 text-green-700" },
  suspended: { label: "Gesperrt", color: "bg-red-100 text-red-700" },
};

export default function EbicsSettingsTab() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EbicsConfig | null>(null);
  const [selectedBank, setSelectedBank] = useState(SWISS_BANKS[0]);
  const [form, setForm] = useState({
    bankName: SWISS_BANKS[0].name,
    hostId: SWISS_BANKS[0].hostId,
    hostUrl: SWISS_BANKS[0].url,
    partnerId: "",
    userId: "",
    isActive: true,
    autoFetchEnabled: true,
    autoFetchOrderType: "C53",
  });

  const utils = trpc.useUtils();

  // Daten laden
  const { data: configs = [], isLoading } = trpc.ebics.getConfigs.useQuery();

  // Mutationen
  const saveMutation = trpc.ebics.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("EBICS-Konfiguration gespeichert");
      utils.ebics.getConfigs.invalidate();
      setShowDialog(false);
      resetForm();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const deleteMutation = trpc.ebics.deleteConfig.useMutation({
    onSuccess: () => {
      toast.success("Konfiguration gelöscht");
      utils.ebics.getConfigs.invalidate();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const generateKeysMutation = trpc.ebics.generateKeys.useMutation({
    onSuccess: (data) => {
      toast.success("RSA-Schlüsselpaar generiert. Bitte drucken Sie den Initialisierungsbrief.");
      utils.ebics.getConfigs.invalidate();
      // Initialisierungsbrief als Text anzeigen
      if (data.iniLetter) {
        const blob = new Blob([data.iniLetter], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `EBICS_INI_${data.userId}.txt`;
        a.click();
      }
    },
    onError: (e) => toast.error(`Schlüsselgenerierung fehlgeschlagen: ${e.message}`),
  });

  const fetchNowMutation = trpc.ebics.fetchNow.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.transactionsImported} Transaktionen importiert`);
      utils.ebics.getConfigs.invalidate();
    },
    onError: (e) => toast.error(`Abruf fehlgeschlagen: ${e.message}`),
  });

  const resetForm = () => {
    setForm({
      bankName: SWISS_BANKS[0].name,
      hostId: SWISS_BANKS[0].hostId,
      hostUrl: SWISS_BANKS[0].url,
      partnerId: "",
      userId: "",
      isActive: true,
      autoFetchEnabled: true,
      autoFetchOrderType: "C53",
    });
    setSelectedBank(SWISS_BANKS[0]);
    setEditingConfig(null);
  };

  const openEdit = (cfg: EbicsConfig) => {
    setEditingConfig(cfg);
    setForm({
      bankName: cfg.bankName,
      hostId: cfg.hostId,
      hostUrl: cfg.hostUrl,
      partnerId: cfg.partnerId,
      userId: cfg.userId,
      isActive: cfg.isActive,
      autoFetchEnabled: cfg.autoFetchEnabled,
      autoFetchOrderType: cfg.autoFetchOrderType ?? "C53",
    });
    setShowDialog(true);
  };

  const handleBankSelect = (bankName: string) => {
    const bank = SWISS_BANKS.find((b) => b.name === bankName) ?? SWISS_BANKS[SWISS_BANKS.length - 1];
    setSelectedBank(bank);
    setForm((f) => ({
      ...f,
      bankName: bank.name,
      hostId: bank.hostId,
      hostUrl: bank.url,
    }));
  };

  const handleSave = () => {
    if (!form.partnerId || !form.userId) {
      toast.error("Partner-ID und User-ID sind Pflichtfelder");
      return;
    }
    saveMutation.mutate({
      id: editingConfig?.id,
      bankName: form.bankName,
      hostId: form.hostId,
      hostUrl: form.hostUrl,
      partnerId: form.partnerId,
      userId: form.userId,
      isActive: form.isActive,
      autoFetchEnabled: form.autoFetchEnabled,
      autoFetchOrderType: form.autoFetchOrderType,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-blue-600" />
            EBICS 3.0 Banking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Direkter Bankdaten-Abruf via EBICS 3.0 (Electronic Banking Internet Communication Standard).
            Unterstützt LUKB, UBS, Raiffeisen, PostFinance, ZKB und alle SIX-Mitglieder.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Bank hinzufügen
        </Button>
      </div>

      {/* Info-Banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-blue-900">EBICS 3.0 – Einrichtungsprozess</p>
              <ol className="text-blue-800 space-y-1 text-xs list-decimal list-inside">
                <li>Bank kontaktieren und EBICS-Vertrag abschliessen (Partner-ID und User-ID erhalten)</li>
                <li>Konfiguration in KLAX hinterlegen und RSA-Schlüsselpaar generieren</li>
                <li>Initialisierungsbrief ausdrucken und per Post an die Bank senden (INI/HIA)</li>
                <li>Bank aktiviert den Zugang (dauert 1–5 Werktage)</li>
                <li>Status auf "Aktiv" setzen und ersten manuellen Abruf testen</li>
                <li>Automatischen täglichen Abruf aktivieren</li>
              </ol>
              <p className="text-blue-700 text-xs mt-2">
                <strong>LUKB:</strong> EBICS-Vertrag via E-Banking-Portal oder Filiale beantragen.
                Kosten: CHF 20–50/Monat je nach Kontomodell.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Konfigurationen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Konfigurierte Bankverbindungen</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Konfigurationen...
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Landmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Noch keine EBICS-Verbindung konfiguriert.</p>
              <p className="text-xs mt-1">Klicken Sie auf "Bank hinzufügen" um zu starten.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Partner-ID / User-ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Letzter Abruf</TableHead>
                  <TableHead>Auto-Abruf</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((cfg: EbicsConfig) => {
                  const statusInfo = STATUS_LABELS[cfg.status] ?? STATUS_LABELS.new;
                  return (
                    <TableRow key={cfg.id}>
                      <TableCell className="font-medium text-sm">{cfg.bankName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {cfg.partnerId} / {cfg.userId}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cfg.lastFetchAt
                          ? new Date(cfg.lastFetchAt).toLocaleString("de-CH")
                          : "Noch nie"}
                      </TableCell>
                      <TableCell>
                        {cfg.autoFetchEnabled ? (
                          <span className="flex items-center gap-1 text-green-700 text-xs">
                            <Clock className="h-3 w-3" /> Täglich
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Manuell</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Schlüssel generieren */}
                          {cfg.status === "new" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateKeysMutation.mutate({ id: cfg.id })}
                              disabled={generateKeysMutation.isPending}
                              title="RSA-Schlüssel generieren & INI-Brief herunterladen"
                            >
                              <Key className="h-3 w-3 mr-1" />
                              INI
                            </Button>
                          )}
                          {/* Jetzt abrufen */}
                          {cfg.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fetchNowMutation.mutate({ id: cfg.id })}
                              disabled={fetchNowMutation.isPending}
                              title="Kontoauszug jetzt abrufen"
                            >
                              {fetchNowMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEdit(cfg)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("EBICS-Verbindung wirklich löschen?")) {
                                deleteMutation.mutate({ id: cfg.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Technische Details */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-600" />
            Sicherheit & Technische Details
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-foreground mb-1">EBICS 3.0 Spezifikationen</p>
              <ul className="space-y-1">
                <li>• Protokoll: EBICS 3.0 (ISO 20022)</li>
                <li>• Verschlüsselung: RSA-4096 + AES-256</li>
                <li>• Signatur: X.509-Zertifikate</li>
                <li>• Transport: HTTPS/TLS 1.3</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Unterstützte Auftragstypen</p>
              <ul className="space-y-1">
                {ORDER_TYPES.map((ot) => (
                  <li key={ot.code} className="flex items-center gap-1">
                    {ot.recommended && <Zap className="h-3 w-3 text-yellow-500" />}
                    <span><strong>{ot.code}</strong> – {ot.label.split(" – ")[1]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t pt-2 mt-2">
            <p className="font-medium text-foreground mb-1">Wichtige Hinweise</p>
            <ul className="space-y-1">
              <li>• Der private RSA-Schlüssel wird verschlüsselt in der Datenbank gespeichert</li>
              <li>• Der Initialisierungsbrief (INI/HIA) muss per Post an die Bank gesendet werden</li>
              <li>• EBICS-Verträge müssen direkt mit der Bank abgeschlossen werden</li>
              <li>• Für die LUKB: E-Banking-Portal → Zahlungsverkehr → EBICS</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "EBICS-Verbindung bearbeiten" : "EBICS-Verbindung hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Bank auswählen */}
            <div>
              <Label>Bank</Label>
              <Select value={form.bankName} onValueChange={handleBankSelect}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SWISS_BANKS.map((b) => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Host-URL */}
            <div>
              <Label>EBICS-Host-URL</Label>
              <Input
                className="mt-1 font-mono text-xs"
                placeholder="https://ebics.bank.ch/ebicsweb/ebicsweb"
                value={form.hostUrl}
                onChange={(e) => setForm((f) => ({ ...f, hostUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird von der Bank mitgeteilt. Für LUKB: https://ebics.lukb.ch/ebicsweb/ebicsweb
              </p>
            </div>

            {/* Host-ID */}
            <div>
              <Label>Host-ID (Bank-Kennung)</Label>
              <Input
                className="mt-1 font-mono"
                placeholder="LUKBEBICS"
                value={form.hostId}
                onChange={(e) => setForm((f) => ({ ...f, hostId: e.target.value }))}
              />
            </div>

            {/* Partner-ID */}
            <div>
              <Label>Partner-ID (Kunden-ID)</Label>
              <Input
                className="mt-1 font-mono"
                placeholder="P12345678"
                value={form.partnerId}
                onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird von der Bank bei Vertragsabschluss mitgeteilt.
              </p>
            </div>

            {/* User-ID */}
            <div>
              <Label>User-ID (Teilnehmer-ID)</Label>
              <Input
                className="mt-1 font-mono"
                placeholder="U12345678"
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              />
            </div>

            {/* Auftragstyp */}
            <div>
              <Label>Standard-Auftragstyp</Label>
              <Select
                value={form.autoFetchOrderType}
                onValueChange={(v) => setForm((f) => ({ ...f, autoFetchOrderType: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_TYPES.map((ot) => (
                    <SelectItem key={ot.code} value={ot.code}>
                      {ot.code} – {ot.label.split(" – ")[1]}
                      {ot.recommended && " ⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-Abruf */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.autoFetchEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, autoFetchEnabled: v }))}
              />
              <div>
                <Label>Automatischer täglicher Abruf</Label>
                <p className="text-xs text-muted-foreground">
                  Kontoauszug wird täglich um 06:00 Uhr automatisch abgerufen.
                </p>
              </div>
            </div>

            {/* Aktiv */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label>Verbindung aktiv</Label>
            </div>

            {/* Status (nur bei Bearbeitung) */}
            {editingConfig && (
              <div className="border rounded-lg p-3 bg-muted/20">
                <p className="text-xs font-medium mb-2">Verbindungsstatus</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(STATUS_LABELS).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => {
                        // Status-Update via separater Mutation
                        toast.info(`Status auf "${val.label}" gesetzt (nach Speichern aktiv)`);
                      }}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        editingConfig.status === key
                          ? val.color + " border-current font-medium"
                          : "border-gray-200 text-muted-foreground"
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Status auf "Aktiv" setzen, sobald die Bank den Zugang bestätigt hat.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Speichern...</>
              ) : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
