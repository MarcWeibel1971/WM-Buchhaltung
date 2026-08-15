/**
 * POS-Terminal Einstellungen
 * Konfiguration für Stripe Terminal und SumUp Webhook-Integration.
 * Zahlungen werden automatisch als Banktransaktionen und Buchungen erfasst.
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
  CreditCard, Plus, Trash2, Pencil, ExternalLink, Copy, Check,
  Loader2, AlertTriangle, CheckCircle, Zap, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

type Provider = "stripe_terminal" | "sumup";

interface PosConfig {
  id: number;
  provider: Provider;
  apiKey?: string | null;
  merchantCode?: string | null;
  webhookSecret?: string | null;
  bankAccountId?: number | null;
  revenueAccountId?: number | null;
  isActive: boolean;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  stripe_terminal: "Stripe Terminal",
  sumup: "SumUp",
};

const PROVIDER_COLORS: Record<Provider, string> = {
  stripe_terminal: "bg-violet-100 text-violet-800",
  sumup: "bg-blue-100 text-blue-800",
};

export default function PosSettingsTab() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PosConfig | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "stripe_terminal" as Provider,
    apiKey: "",
    merchantCode: "",
    webhookSecret: "",
    bankAccountId: "",
    revenueAccountId: "",
    isActive: true,
  });

  const utils = trpc.useUtils();

  // Daten laden
  const { data: configs = [], isLoading } = trpc.pos.getConfig.useQuery();
  const { data: bankAccounts = [] } = trpc.pos.getBankAccounts.useQuery();
  const { data: revenueAccounts = [] } = trpc.pos.getRevenueAccounts.useQuery();
  const { data: webhookUrls } = trpc.pos.getWebhookUrls.useQuery();
  const { data: txData } = trpc.pos.getTransactions.useQuery({ limit: 20, offset: 0 });

  // Mutationen
  const saveMutation = trpc.pos.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("POS-Konfiguration gespeichert");
      utils.pos.getConfig.invalidate();
      setShowDialog(false);
      resetForm();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const deleteMutation = trpc.pos.deleteConfig.useMutation({
    onSuccess: () => {
      toast.success("Konfiguration gelöscht");
      utils.pos.getConfig.invalidate();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const resetForm = () => {
    setForm({
      provider: "stripe_terminal",
      apiKey: "",
      merchantCode: "",
      webhookSecret: "",
      bankAccountId: "",
      revenueAccountId: "",
      isActive: true,
    });
    setEditingConfig(null);
  };

  const openEdit = (cfg: PosConfig) => {
    setEditingConfig(cfg);
    setForm({
      provider: cfg.provider,
      apiKey: cfg.apiKey ?? "",
      merchantCode: cfg.merchantCode ?? "",
      webhookSecret: cfg.webhookSecret ?? "",
      bankAccountId: cfg.bankAccountId ? String(cfg.bankAccountId) : "",
      revenueAccountId: cfg.revenueAccountId ? String(cfg.revenueAccountId) : "",
      isActive: cfg.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      id: editingConfig?.id,
      provider: form.provider,
      apiKey: form.apiKey || undefined,
      merchantCode: form.merchantCode || undefined,
      webhookSecret: form.webhookSecret || undefined,
      bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId) : undefined,
      revenueAccountId: form.revenueAccountId ? parseInt(form.revenueAccountId) : undefined,
      isActive: form.isActive,
    });
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(window.location.origin + text);
    setCopiedUrl(key);
    setTimeout(() => setCopiedUrl(null), 2000);
    toast.success("URL kopiert");
  };

  const transactions = txData?.transactions ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-violet-600" />
            POS / Kartenzahlung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verbinden Sie Ihr EC-Kartenlesegerät (Stripe Terminal oder SumUp) mit KLAX.
            Zahlungen werden automatisch als Banktransaktionen und Buchungen erfasst.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Integration hinzufügen
        </Button>
      </div>

      {/* Webhook-URLs */}
      {webhookUrls && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Webhook-URLs (in Ihrem POS-Dashboard eintragen)
            </CardTitle>
            <CardDescription>
              Tragen Sie diese URLs in Ihrem Stripe- oder SumUp-Dashboard ein, damit Zahlungen automatisch an KLAX gemeldet werden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Stripe Terminal", url: webhookUrls.stripe, key: "stripe" },
              { label: "SumUp", url: webhookUrls.sumup, key: "sumup" },
            ].map(({ label, url, key }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs font-medium w-32 text-muted-foreground">{label}:</span>
                <code className="flex-1 text-xs bg-white border rounded px-2 py-1 font-mono truncate">
                  {window.location.origin}{url}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(url, key)}
                  className="shrink-0"
                >
                  {copiedUrl === key ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Konfigurationen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktive Integrationen</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Konfigurationen...
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Noch keine POS-Integration konfiguriert.</p>
              <p className="text-xs mt-1">Klicken Sie auf "Integration hinzufügen" um zu starten.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anbieter</TableHead>
                  <TableHead>Bankkonto</TableHead>
                  <TableHead>Ertragskonto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((cfg) => {
                  const bankAcc = bankAccounts.find((b) => b.id === cfg.bankAccountId);
                  const revAcc = revenueAccounts.find((a) => a.id === cfg.revenueAccountId);
                  return (
                    <TableRow key={cfg.id}>
                      <TableCell>
                        <Badge className={PROVIDER_COLORS[cfg.provider as Provider]}>
                          {PROVIDER_LABELS[cfg.provider as Provider]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {bankAcc ? `${bankAcc.name} (${bankAcc.iban ?? "–"})` : "–"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {revAcc ? `${revAcc.number} ${revAcc.name}` : "–"}
                      </TableCell>
                      <TableCell>
                        {cfg.isActive ? (
                          <span className="flex items-center gap-1 text-green-700 text-xs">
                            <CheckCircle className="h-3 w-3" /> Aktiv
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <AlertTriangle className="h-3 w-3" /> Inaktiv
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(cfg as PosConfig)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Konfiguration wirklich löschen?")) {
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

      {/* Letzte POS-Transaktionen */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte POS-Zahlungen</CardTitle>
            <CardDescription>Automatisch erfasste Kartenzahlungen</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Anbieter</TableHead>
                  <TableHead>Betrag</TableHead>
                  <TableHead>Karte</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {tx.paidAt ? new Date(tx.paidAt).toLocaleDateString("de-CH") : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge className={PROVIDER_COLORS[tx.provider as Provider]} variant="outline">
                        {PROVIDER_LABELS[tx.provider as Provider] ?? tx.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {tx.currency} {parseFloat(tx.amount).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.cardBrand ? `${tx.cardBrand.toUpperCase()} ****${tx.cardLast4 ?? ""}` : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.status === "completed" ? "default" : "destructive"}>
                        {tx.status === "completed" ? "Erfolgreich" : tx.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Anleitung */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Einrichtungsanleitung
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <div>
            <strong className="text-foreground">Stripe Terminal:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Stripe Dashboard → Entwickler → Webhooks → Endpunkt hinzufügen</li>
              <li>URL: Die obige Stripe-Webhook-URL eintragen</li>
              <li>Events: <code>payment_intent.succeeded</code> auswählen</li>
              <li>Webhook-Signing-Secret kopieren und hier eintragen</li>
              <li>API-Key: Stripe Dashboard → Entwickler → API-Schlüssel (Restricted Key mit Terminal-Rechten)</li>
            </ol>
          </div>
          <div>
            <strong className="text-foreground">SumUp:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>SumUp Developer Portal → Webhooks → Neuer Webhook</li>
              <li>URL: Die obige SumUp-Webhook-URL eintragen</li>
              <li>Events: <code>PAYMENT</code> auswählen</li>
              <li>Merchant Code: SumUp Dashboard → Konto → Händler-Code</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "POS-Integration bearbeiten" : "POS-Integration hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Anbieter */}
            <div>
              <Label>Anbieter</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm((f) => ({ ...f, provider: v as Provider }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe_terminal">Stripe Terminal</SelectItem>
                  <SelectItem value="sumup">SumUp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* API-Key */}
            <div>
              <Label>
                {form.provider === "stripe_terminal" ? "Stripe API-Key (Restricted)" : "SumUp Access Token"}
              </Label>
              <Input
                className="mt-1 font-mono text-xs"
                type="password"
                placeholder={form.provider === "stripe_terminal" ? "rk_live_..." : "sup_sk_..."}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
              {form.apiKey.startsWith("••••") && (
                <p className="text-xs text-muted-foreground mt-1">
                  Gespeicherter Schlüssel (verschlüsselt). Unverändert lassen, um ihn zu behalten — oder neuen Schlüssel eingeben.
                </p>
              )}
            </div>

            {/* Merchant Code (nur SumUp) */}
            {form.provider === "sumup" && (
              <div>
                <Label>Händler-Code (Merchant Code)</Label>
                <Input
                  className="mt-1"
                  placeholder="MC1234567"
                  value={form.merchantCode}
                  onChange={(e) => setForm((f) => ({ ...f, merchantCode: e.target.value }))}
                />
              </div>
            )}

            {/* Webhook-Secret */}
            <div>
              <Label>Webhook-Signing-Secret</Label>
              <Input
                className="mt-1 font-mono text-xs"
                type="password"
                placeholder={form.provider === "stripe_terminal" ? "whsec_..." : "HMAC-Secret"}
                value={form.webhookSecret}
                onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird zur Verifizierung eingehender Webhook-Anfragen verwendet.
              </p>
            </div>

            {/* Bankkonto */}
            <div>
              <Label>Bankkonto (für automatische Buchungen)</Label>
              <Select
                value={form.bankAccountId}
                onValueChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Bankkonto auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} {b.iban ? `(${b.iban})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ertragskonto */}
            <div>
              <Label>Ertragskonto (Haben-Konto bei Buchung)</Label>
              <Select
                value={form.revenueAccountId}
                onValueChange={(v) => setForm((f) => ({ ...f, revenueAccountId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Ertragskonto auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {revenueAccounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.number} – {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Aktiv */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label>Integration aktiv</Label>
            </div>
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
