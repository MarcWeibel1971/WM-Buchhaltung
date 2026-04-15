import { useState } from "react";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Phase 1c Onboarding:
 * Wird angezeigt wenn der eingeloggte User noch keine Organisation hat.
 * Nach erfolgreichem Create wird user.currentOrganizationId gesetzt und
 * die Auth-Query invalidiert, sodass der Layout neu rendert.
 */
export default function Onboarding() {
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    name: "",
    legalForm: "",
    street: "",
    zipCode: "",
    city: "",
    canton: "",
    uid: "",
    vatNumber: "",
    vatMethod: "effective" as "effective" | "saldo" | "pauschal",
    vatPeriod: "quarterly" as "quarterly" | "semi-annual",
    email: "",
    phone: "",
    website: "",
    seedKmuKontenplan: true,
    initialFiscalYear: new Date().getFullYear(),
  });

  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: async (data) => {
      toast.success(`Organisation "${data.name}" angelegt`);
      // Auth + Orgs neu laden, damit das Layout / der Guard die neue Org findet
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.organizations.listMine.invalidate(),
        utils.organizations.getCurrent.invalidate(),
      ]);
      // Kurzes Delay für die Query-Invalidierung, dann Reload
      setTimeout(() => window.location.href = "/", 500);
    },
    onError: (err) => {
      toast.error(err.message || "Anlegen fehlgeschlagen");
    },
  });

  const canSubmit = form.name.trim().length > 0 && !createMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate({
      name: form.name.trim(),
      legalForm: form.legalForm || undefined,
      street: form.street || undefined,
      zipCode: form.zipCode || undefined,
      city: form.city || undefined,
      canton: form.canton || undefined,
      country: "Schweiz",
      uid: form.uid || undefined,
      vatNumber: form.vatNumber || undefined,
      vatMethod: form.vatMethod,
      vatPeriod: form.vatPeriod,
      fiscalYearStartMonth: 1,
      email: form.email || undefined,
      phone: form.phone || undefined,
      website: form.website || undefined,
      seedKmuKontenplan: form.seedKmuKontenplan,
      initialFiscalYear: form.initialFiscalYear,
      makeCurrent: true,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Willkommen!</h1>
          <p className="text-muted-foreground text-sm">
            Legen Sie jetzt Ihre Firma an, um mit der Buchhaltung zu starten.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Neue Organisation</CardTitle>
            <CardDescription>
              Sie können später weitere Firmen hinzufügen oder diese Daten in den
              Einstellungen anpassen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Firma */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Firmenname *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Meine Firma AG"
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="legalForm">Rechtsform</Label>
                    <Select
                      value={form.legalForm}
                      onValueChange={(v) => setForm({ ...form, legalForm: v })}
                    >
                      <SelectTrigger id="legalForm">
                        <SelectValue placeholder="z.B. AG" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AG">AG</SelectItem>
                        <SelectItem value="GmbH">GmbH</SelectItem>
                        <SelectItem value="Einzelfirma">Einzelfirma</SelectItem>
                        <SelectItem value="Kollektivgesellschaft">Kollektivgesellschaft</SelectItem>
                        <SelectItem value="Verein">Verein</SelectItem>
                        <SelectItem value="Stiftung">Stiftung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="uid">UID</Label>
                    <Input
                      id="uid"
                      value={form.uid}
                      onChange={(e) => setForm({ ...form, uid: e.target.value })}
                      placeholder="CHE-123.456.789"
                    />
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div className="space-y-4 pt-2 border-t">
                <h3 className="text-sm font-semibold text-foreground">Adresse</h3>
                <div>
                  <Label htmlFor="street">Strasse</Label>
                  <Input
                    id="street"
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    placeholder="Musterstrasse 1"
                  />
                </div>
                <div className="grid grid-cols-[1fr_2fr_1fr] gap-3">
                  <div>
                    <Label htmlFor="zipCode">PLZ</Label>
                    <Input
                      id="zipCode"
                      value={form.zipCode}
                      onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                      placeholder="6000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">Ort</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Luzern"
                    />
                  </div>
                  <div>
                    <Label htmlFor="canton">Kanton</Label>
                    <Input
                      id="canton"
                      value={form.canton}
                      onChange={(e) => setForm({ ...form, canton: e.target.value })}
                      placeholder="LU"
                    />
                  </div>
                </div>
              </div>

              {/* MWST */}
              <div className="space-y-4 pt-2 border-t">
                <h3 className="text-sm font-semibold text-foreground">MWST</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="vatNumber">MWST-Nr.</Label>
                    <Input
                      id="vatNumber"
                      value={form.vatNumber}
                      onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                      placeholder="CHE-123.456.789 MWST"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vatMethod">Methode</Label>
                    <Select
                      value={form.vatMethod}
                      onValueChange={(v) => setForm({ ...form, vatMethod: v as typeof form.vatMethod })}
                    >
                      <SelectTrigger id="vatMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="effective">Effektiv</SelectItem>
                        <SelectItem value="saldo">Saldosteuersatz</SelectItem>
                        <SelectItem value="pauschal">Pauschal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="vatPeriod">Abrechnungsperiode</Label>
                  <Select
                    value={form.vatPeriod}
                    onValueChange={(v) => setForm({ ...form, vatPeriod: v as typeof form.vatPeriod })}
                  >
                    <SelectTrigger id="vatPeriod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quarterly">Quartalsweise</SelectItem>
                      <SelectItem value="semi-annual">Halbjährlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Kontakt */}
              <div className="space-y-4 pt-2 border-t">
                <h3 className="text-sm font-semibold text-foreground">Kontakt (optional)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>
              </div>

              {/* Onboarding-Optionen */}
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold text-foreground">Startpaket</h3>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="seedKmu"
                    checked={form.seedKmuKontenplan}
                    onCheckedChange={(v) =>
                      setForm({ ...form, seedKmuKontenplan: v === true })
                    }
                  />
                  <div className="flex-1">
                    <Label htmlFor="seedKmu" className="cursor-pointer">
                      Standard-KMU-Kontenplan importieren
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Erstellt einen Basiskontenplan nach Käfer, den Sie später
                      in den Einstellungen erweitern können.
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="fy">Erstes Geschäftsjahr</Label>
                  <Input
                    id="fy"
                    type="number"
                    value={form.initialFiscalYear}
                    onChange={(e) =>
                      setForm({ ...form, initialFiscalYear: parseInt(e.target.value) || new Date().getFullYear() })
                    }
                    min={2000}
                    max={2100}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Anlegen...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Organisation anlegen und starten
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
