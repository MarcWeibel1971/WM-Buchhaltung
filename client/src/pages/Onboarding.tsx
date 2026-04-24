import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Building2, CheckCircle2, LogOut, ArrowLeft, Search } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
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
  const { logout } = useAuth();

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
    vatSaldoRate: "",
    vatPeriod: "quarterly" as "quarterly" | "semi-annual",
    email: "",
    phone: "",
    website: "",
    seedKmuKontenplan: true,
    initialFiscalYear: new Date().getFullYear(),
  });

  // UID Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFromSearch, setSelectedFromSearch] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: searchResults, isLoading: isSearching } = trpc.uidSearch.search.useQuery(
    { name: debouncedQuery },
    { enabled: debouncedQuery.length >= 3 }
  );

  // Debounce the search input
  const handleNameChange = useCallback((value: string) => {
    setSearchQuery(value);
    setForm((prev) => ({ ...prev, name: value }));
    setSelectedFromSearch(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length >= 3) {
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(value);
        setShowDropdown(true);
      }, 400);
    } else {
      setShowDropdown(false);
      setDebouncedQuery("");
    }
  }, []);

  // Select a company from search results
  const handleSelectCompany = useCallback((company: NonNullable<typeof searchResults>[number]) => {
    setForm((prev) => ({
      ...prev,
      name: company.name,
      legalForm: company.legalForm || prev.legalForm,
      uid: company.uidFormatted || prev.uid,
      street: company.street || prev.street,
      zipCode: company.zipCode || prev.zipCode,
      city: company.town || prev.city,
      canton: company.canton || prev.canton,
      vatNumber: company.vatStatus === "active" ? company.vatNumber : prev.vatNumber,
    }));
    setSearchQuery(company.name);
    setSelectedFromSearch(true);
    setShowDropdown(false);
    toast.success(`Daten von "${company.name}" aus dem Handelsregister übernommen`);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: async (data) => {
      toast.success(`Organisation "${data.name}" angelegt`);
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.organizations.listMine.invalidate(),
        utils.organizations.getCurrent.invalidate(),
      ]);
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
      vatSaldoRate: form.vatMethod === "saldo" && form.vatSaldoRate ? form.vatSaldoRate : undefined,
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

  // KLAX-Onboarding Stepper (visuell)
  const STEPS = [
    { key: "company", label: "Firma" },
    { key: "chart",   label: "Kontenplan" },
    { key: "bank",    label: "Bank" },
    { key: "docs",    label: "Belege" },
    { key: "done",    label: "Fertig" },
  ];
  const activeStepIndex = 0; // diese Seite ist Schritt 1 (Firma)

  return (
    <div
      className="min-h-screen flex items-start justify-center py-10 px-4"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      <div className="w-full max-w-[720px]">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <a
            href="/landing"
            className="flex items-center gap-1.5 text-[12.5px] hover:underline"
            style={{ color: "var(--ink-3)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Zur Startseite
          </a>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
            >
              <span className="font-semibold text-[13px]">K</span>
            </div>
            <span className="display text-[15px] font-medium">KLAX</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-[12.5px] hover:underline"
            style={{ color: "var(--ink-3)" }}
          >
            <LogOut className="h-4 w-4" /> Abmelden
          </button>
        </div>

        {/* Stepper (visuell) */}
        <div className="klax-card p-4 mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const done = i < activeStepIndex;
              const active = i === activeStepIndex;
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                      style={{
                        background: done ? "var(--pos)" : active ? "var(--klax-accent)" : "var(--surface-2)",
                        color: done || active ? "#fff" : "var(--ink-3)",
                      }}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span
                      className="text-[12px] hidden sm:inline"
                      style={{ color: active ? "var(--ink)" : "var(--ink-3)", fontWeight: active ? 500 : 400 }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="mx-2 h-px flex-1" style={{ background: "var(--hair)" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Editorial */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--klax-accent-soft)", color: "var(--klax-accent)" }}
          >
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="display text-[26px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Willkommen bei KLAX
          </h1>
          <p className="text-[13.5px]" style={{ color: "var(--ink-3)" }}>
            Legen Sie jetzt Ihre Firma an. Danach richtet KLAX Kontenplan, Bank
            und Belege für Sie ein.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Neue Organisation</CardTitle>
            <CardDescription>
              Geben Sie den Firmennamen ein – die Daten werden automatisch aus dem
              Schweizer Handelsregister geladen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Firma mit Handelsregister-Suche */}
              <div className="space-y-4">
                <div className="relative" ref={dropdownRef}>
                  <Label htmlFor="name">Firmenname *</Label>
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      id="name"
                      value={searchQuery}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onFocus={() => {
                        if (searchResults && searchResults.length > 0 && !selectedFromSearch) {
                          setShowDropdown(true);
                        }
                      }}
                      placeholder="Firmenname eingeben (z.B. Muster AG)"
                      required
                      autoFocus
                      autoComplete="off"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {!selectedFromSearch && searchQuery.length >= 3 && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Search className="h-3 w-3" />
                      Suche im Schweizer Handelsregister...
                    </p>
                  )}
                  {selectedFromSearch && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Daten aus dem Handelsregister übernommen
                    </p>
                  )}

                  {/* Search Results Dropdown */}
                  {showDropdown && searchResults && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {searchResults.map((company, idx) => (
                        <button
                          key={`${company.uid}-${idx}`}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-0"
                          onClick={() => handleSelectCompany(company)}
                        >
                          <div className="font-medium text-sm">{company.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {company.uidFormatted}
                            {company.town && ` · ${company.zipCode} ${company.town}`}
                            {company.legalForm && company.legalForm !== "Andere" && ` · ${company.legalForm}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && searchResults && searchResults.length === 0 && debouncedQuery.length >= 3 && !isSearching && (
                    <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Keine Firma gefunden. Sie können die Daten manuell eingeben.
                      </p>
                    </div>
                  )}
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
                {form.vatMethod === "saldo" && (
                  <div>
                    <Label htmlFor="vatSaldoRate">Saldosteuersatz (ESTV)</Label>
                    <Select
                      value={form.vatSaldoRate}
                      onValueChange={(v) => setForm({ ...form, vatSaldoRate: v })}
                    >
                      <SelectTrigger id="vatSaldoRate">
                        <SelectValue placeholder="Satz wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.1">0.1%</SelectItem>
                        <SelectItem value="0.6">0.6%</SelectItem>
                        <SelectItem value="1.3">1.3%</SelectItem>
                        <SelectItem value="2.1">2.1%</SelectItem>
                        <SelectItem value="3.0">3.0%</SelectItem>
                        <SelectItem value="3.7">3.7%</SelectItem>
                        <SelectItem value="4.5">4.5%</SelectItem>
                        <SelectItem value="5.3">5.3%</SelectItem>
                        <SelectItem value="6.2">6.2%</SelectItem>
                        <SelectItem value="6.8">6.8%</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gemäss ESTV-Verordnung über die Saldosteuersätze nach Branchen (ab 1.1.2024)
                    </p>
                  </div>
                )}
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
                    onChange={(e) =>
                      setForm({ ...form, website: e.target.value })
                    }
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
