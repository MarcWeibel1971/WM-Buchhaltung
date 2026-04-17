import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Users, Shield, Landmark, BookOpen, Scale, ListTree,
  Pencil, Trash2, Plus, Check, X, AlertTriangle, TrendingDown, Loader2,
  GripVertical, ChevronRight, ChevronDown, Upload, Eye, EyeOff,
  ShieldCheck, FileText, Download, UserX, ClipboardList,
  ArrowUpDown, FileSpreadsheet, LayoutTemplate, Truck, UserCheck, FileStack,
  CreditCard, ExternalLink, CheckCircle, Crown, Undo2,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useMemo, useState as useReactState, useCallback } from "react";
import { toast } from "sonner";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "company", label: "Unternehmen", icon: Building2 },
  { id: "bank", label: "Bankkonten", icon: Landmark },
  { id: "chartOfAccounts", label: "Kontenplan", icon: ListTree },
  { id: "employees", label: "Mitarbeiter", icon: Users },
  { id: "insurance", label: "Versicherungen", icon: Shield },
  { id: "rules", label: "Buchungsregeln", icon: BookOpen },
  { id: "opening", label: "Eröffnungssalden", icon: Scale },
  { id: "depreciation", label: "Abschreibungen", icon: TrendingDown },
  { id: "suppliers", label: "Lieferanten", icon: Truck },
  { id: "customers", label: "Kunden", icon: UserCheck },
  { id: "templates", label: "Vorlagen", icon: FileStack },
  { id: "dsg", label: "Datenschutz (DSG)", icon: ShieldCheck },
  { id: "subscription", label: "Abonnement", icon: CreditCard },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── Insurance type labels ────────────────────────────────────────────────────

const INSURANCE_LABELS: Record<string, string> = {
  ahv: "AHV/IV/EO",
  uvg: "UVG (Berufsunfall)",
  ktg: "KTG (Krankentaggeld)",
  bvg: "BVG (Pensionskasse)",
  fak: "FAK (Familienzulagen)",
};

const INSURANCE_COLORS: Record<string, string> = {
  ahv: "bg-blue-100 text-blue-800",
  uvg: "bg-orange-100 text-orange-800",
  ktg: "bg-purple-100 text-purple-800",
  bvg: "bg-green-100 text-green-800",
  fak: "bg-yellow-100 text-yellow-800",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  // Support ?tab=subscription for Stripe redirect
  const initialTab = (() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && TABS.some(t => t.id === tab)) return tab as TabId;
    return "company" as TabId;
  })();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-1 shrink-0">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Einstellungen
        </h2>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {activeTab === "company" && <CompanyTab />}
        {activeTab === "bank" && <BankTab />}
        {activeTab === "chartOfAccounts" && <ChartOfAccountsTab />}
        {activeTab === "employees" && <EmployeesTab />}
        {activeTab === "insurance" && <InsuranceTab />}
        {activeTab === "rules" && <BookingRulesTab />}
        {activeTab === "opening" && <OpeningBalancesTab />}
        {activeTab === "depreciation" && <DepreciationTab />}
        {activeTab === "suppliers" && <SuppliersTab />}
        {activeTab === "customers" && <CustomersTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "dsg" && <DsgTab />}
        {activeTab === "subscription" && <SubscriptionTab />}
      </main>
    </div>
  );
}

// ─── Company Logo Upload ───────────────────────────────────────────────────────────

function CompanyLogoUpload({ logoUrl, onUploaded }: { logoUrl: string | null; onUploaded: () => void }) {
  const uploadMut = trpc.settings.uploadCompanyLogo.useMutation({
    onSuccess: () => { toast.success("Logo hochgeladen"); onUploaded(); },
    onError: (e) => toast.error(`Logo-Upload fehlgeschlagen: ${e.message}`),
  });
  const deleteMut = trpc.settings.deleteCompanyLogo.useMutation({
    onSuccess: () => { toast.success("Logo entfernt"); onUploaded(); },
    onError: (e) => toast.error(e.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte ein Bild auswählen (PNG, JPG, SVG)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Datei zu gross (max. 5 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadMut.mutate({ base64, filename: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-6">
      <div className="w-40 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt="Firmenlogo" className="max-w-full max-h-full object-contain p-2" />
        ) : (
          <span className="text-muted-foreground text-xs text-center px-2">Kein Logo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploadMut.isPending} />
          <Button variant="outline" size="sm" asChild disabled={uploadMut.isPending}>
            <span>
              {uploadMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {logoUrl ? 'Logo ändern' : 'Logo hochladen'}
            </span>
          </Button>
        </label>
        {logoUrl && (
          <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Entfernen
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Company Tab ──────────────────────────────────────────────────────────────────

function CompanyTab() {
  const { data, isLoading, refetch } = trpc.settings.getCompanySettings.useQuery();
  const upsert = trpc.settings.upsertCompanySettings.useMutation({
    onSuccess: () => { toast.success("Unternehmensdaten wurden aktualisiert."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const current = data ?? {};
  const val = (key: string) => (editing ? (form[key] ?? "") : ((current as Record<string, unknown>)[key] as string ?? ""));
  const set = (key: string, v: string) => setForm(f => ({ ...f, [key]: v }));

  const startEdit = () => {
    setForm({
      companyName: (current as Record<string, unknown>).companyName as string ?? "Meine Firma",
      legalForm: (current as Record<string, unknown>).legalForm as string ?? "AG",
      street: (current as Record<string, unknown>).street as string ?? "",
      zipCode: (current as Record<string, unknown>).zipCode as string ?? "",
      city: (current as Record<string, unknown>).city as string ?? "",
      canton: (current as Record<string, unknown>).canton as string ?? "LU",
      country: (current as Record<string, unknown>).country as string ?? "Schweiz",
      uid: (current as Record<string, unknown>).uid as string ?? "",
      vatNumber: (current as Record<string, unknown>).vatNumber as string ?? "",
      vatMethod: (current as Record<string, unknown>).vatMethod as string ?? "effective",
      vatSaldoRate: (current as Record<string, unknown>).vatSaldoRate as string ?? "6.20",
      vatPeriod: (current as Record<string, unknown>).vatPeriod as string ?? "quarterly",
      fiscalYearStartMonth: String((current as Record<string, unknown>).fiscalYearStartMonth ?? 1),
      phone: (current as Record<string, unknown>).phone as string ?? "",
      email: (current as Record<string, unknown>).email as string ?? "",
      website: (current as Record<string, unknown>).website as string ?? "",
      hrNumber: (current as Record<string, unknown>).hrNumber as string ?? "",
    });
    setEditing(true);
  };

  const save = () => {
    upsert.mutate({
      companyName: form.companyName || "Meine Firma",
      legalForm: form.legalForm || undefined,
      street: form.street || undefined,
      zipCode: form.zipCode || undefined,
      city: form.city || undefined,
      canton: form.canton || undefined,
      country: form.country || undefined,
      uid: form.uid || undefined,
      vatNumber: form.vatNumber || undefined,
      vatMethod: (form.vatMethod as "effective" | "saldo" | "pauschal") || undefined,
      vatSaldoRate: form.vatSaldoRate || undefined,
      vatPeriod: (form.vatPeriod as "quarterly" | "semi-annual") || undefined,
      fiscalYearStartMonth: form.fiscalYearStartMonth ? parseInt(form.fiscalYearStartMonth) : undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      hrNumber: form.hrNumber || undefined,
    });
    setEditing(false);
  };

  if (isLoading) return <div className="text-muted-foreground">Lädt...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unternehmensdaten</h1>
          <p className="text-muted-foreground text-sm mt-1">Firmenstammdaten, MWST und Geschäftsjahr</p>
        </div>
        {!editing ? (
          <Button onClick={startEdit} variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={save} size="sm" disabled={upsert.isPending}>
              <Check className="h-4 w-4 mr-2" /> Speichern
            </Button>
            <Button onClick={() => setEditing(false)} variant="outline" size="sm">
              <X className="h-4 w-4 mr-2" /> Abbrechen
            </Button>
          </div>
        )}
      </div>

      {/* ── Company Logo ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Firmenlogo</CardTitle><CardDescription>Logo für Rechnungen und die Webseite</CardDescription></CardHeader>
        <CardContent>
          <CompanyLogoUpload logoUrl={(current as Record<string, unknown>).logoUrl as string | null} onUploaded={() => refetch()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Firmenangaben</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Firmenname</Label>
            {editing ? <Input value={val("companyName")} onChange={e => set("companyName", e.target.value)} className="mt-1" />
              : <p className="mt-1 font-medium">{val("companyName") || "—"}</p>}
          </div>
          <div>
            <Label>Rechtsform</Label>
            {editing ? (
              <Select value={val("legalForm")} onValueChange={v => set("legalForm", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AG">AG</SelectItem>
                  <SelectItem value="GmbH">GmbH</SelectItem>
                  <SelectItem value="Einzelfirma">Einzelfirma</SelectItem>
                  <SelectItem value="Kollektivgesellschaft">Kollektivgesellschaft</SelectItem>
                </SelectContent>
              </Select>
            ) : <p className="mt-1">{val("legalForm") || "—"}</p>}
          </div>
          <div>
            <Label>Handelsregisternummer</Label>
            {editing ? <Input value={val("hrNumber")} onChange={e => set("hrNumber", e.target.value)} className="mt-1" placeholder="CHE-xxx.xxx.xxx" />
              : <p className="mt-1">{val("hrNumber") || "—"}</p>}
          </div>
          <div>
            <Label>UID</Label>
            {editing ? <Input value={val("uid")} onChange={e => set("uid", e.target.value)} className="mt-1" placeholder="CHE-xxx.xxx.xxx" />
              : <p className="mt-1">{val("uid") || "—"}</p>}
          </div>
          <div>
            <Label>MWST-Nummer</Label>
            {editing ? <Input value={val("vatNumber")} onChange={e => set("vatNumber", e.target.value)} className="mt-1" placeholder="CHE-xxx.xxx.xxx MWST" />
              : <p className="mt-1">{val("vatNumber") || "—"}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Adresse</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Strasse</Label>
            {editing ? <Input value={val("street")} onChange={e => set("street", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("street") || "—"}</p>}
          </div>
          <div>
            <Label>PLZ</Label>
            {editing ? <Input value={val("zipCode")} onChange={e => set("zipCode", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("zipCode") || "—"}</p>}
          </div>
          <div>
            <Label>Ort</Label>
            {editing ? <Input value={val("city")} onChange={e => set("city", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("city") || "—"}</p>}
          </div>
          <div>
            <Label>Kanton</Label>
            {editing ? <Input value={val("canton")} onChange={e => set("canton", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("canton") || "—"}</p>}
          </div>
          <div>
            <Label>Land</Label>
            {editing ? <Input value={val("country")} onChange={e => set("country", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("country") || "—"}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">MWST &amp; Geschäftsjahr</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>MWST-Methode</Label>
            {editing ? (
              <Select value={val("vatMethod")} onValueChange={v => set("vatMethod", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="effective">Effektive Methode</SelectItem>
                  <SelectItem value="saldo">Saldosteuersatz</SelectItem>
                  <SelectItem value="pauschal">Pauschalsteuersatz</SelectItem>
                </SelectContent>
              </Select>
            ) : <p className="mt-1">{val("vatMethod") === "effective" ? "Effektive Methode" : val("vatMethod") === "saldo" ? "Saldosteuersatz" : val("vatMethod") || "—"}</p>}
          </div>
          {val("vatMethod") === "saldo" && (
            <div>
              <Label>Saldosteuersatz (%)</Label>
              {editing ? (
                <Input className="mt-1" value={val("vatSaldoRate")} onChange={e => set("vatSaldoRate", e.target.value)} placeholder="6.20" />
              ) : <p className="mt-1">{val("vatSaldoRate") || "6.20"}%</p>}
            </div>
          )}
          <div>
            <Label>Abrechnungsperiode</Label>
            {editing ? (
              <Select value={val("vatPeriod")} onValueChange={v => set("vatPeriod", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarterly">Quartalsweise</SelectItem>
                  <SelectItem value="semi-annual">Halbjährlich</SelectItem>
                </SelectContent>
              </Select>
            ) : <p className="mt-1">{val("vatPeriod") === "quarterly" ? "Quartalsweise" : val("vatPeriod") === "semi-annual" ? "Halbjährlich" : val("vatPeriod") || "—"}</p>}
          </div>
          <div>
            <Label>Geschäftsjahr Beginn (Monat)</Label>
            {editing ? (
              <Select value={val("fiscalYearStartMonth")} onValueChange={v => set("fiscalYearStartMonth", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"].map((m, i) => (
                    <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : <p className="mt-1">{["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][parseInt(val("fiscalYearStartMonth") || "1") - 1] || "Januar"}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Kontakt</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Telefon</Label>
            {editing ? <Input value={val("phone")} onChange={e => set("phone", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("phone") || "—"}</p>}
          </div>
          <div>
            <Label>E-Mail</Label>
            {editing ? <Input value={val("email")} onChange={e => set("email", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("email") || "—"}</p>}
          </div>
          <div className="col-span-2">
            <Label>Website</Label>
            {editing ? <Input value={val("website")} onChange={e => set("website", e.target.value)} className="mt-1" />
              : <p className="mt-1">{val("website") || "—"}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Bank Tab ─────────────────────────────────────────────────────────────────

function BankTab() {
  const utils = trpc.useUtils();
  const { data: bankAccounts, isLoading, refetch } = trpc.settings.getBankAccounts.useQuery();
  const updateMut = trpc.settings.updateBankAccount.useMutation({
    onSuccess: () => { toast.success("Gespeichert"); refetch(); utils.accounts.list.invalidate(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.settings.createBankAccount.useMutation({
    onSuccess: () => { toast.success("Bankkonto erstellt (auch im Kontenplan)"); refetch(); utils.accounts.list.invalidate(); setShowCreate(false); resetCreateForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.settings.deleteBankAccount.useMutation({
    onSuccess: (data) => {
      if (data.accountDeleted) {
        toast.success("Bankkonto und Kontenplan-Eintrag gel\u00f6scht");
      } else {
        toast.success(data.message || "Bankkonto gel\u00f6scht");
      }
      refetch();
      utils.accounts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; iban: string; bank: string; owner: string }>({ name: "", iban: "", bank: "", owner: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ accountNumber: "", name: "", iban: "", bank: "", owner: "" });

  const resetCreateForm = () => setCreateForm({ accountNumber: "", name: "", iban: "", bank: "", owner: "" });

  const startEdit = (ba: NonNullable<typeof bankAccounts>[number]) => {
    setEditForm({ name: ba.name, iban: ba.iban ?? "", bank: ba.bank ?? "", owner: ba.owner ?? "" });
    setEditId(ba.id);
  };

  if (isLoading) return <div className="text-muted-foreground">Lädt...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bankkonten</h1>
          <p className="text-muted-foreground text-sm mt-1">IBAN und Bankverbindungen der Geschäftskonten</p>
        </div>
        <Button onClick={() => { resetCreateForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Neues Bankkonto
        </Button>
      </div>

      <div className="space-y-4">
        {(bankAccounts ?? []).map(ba => (
          <Card key={ba.id}>
            <CardContent className="pt-4">
              {editId === ba.id ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 font-medium text-sm text-muted-foreground">
                    Konto {ba.accountNumber} – {ba.accountName}
                  </div>
                  <div>
                    <Label>Bezeichnung</Label>
                    <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Bank</Label>
                    <Input value={editForm.bank} onChange={e => setEditForm(f => ({ ...f, bank: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="col-span-2">
                    <Label>IBAN</Label>
                    <Input value={editForm.iban} onChange={e => setEditForm(f => ({ ...f, iban: e.target.value }))} className="mt-1 font-mono" placeholder="CH00 0000 0000 0000 0000 0" />
                  </div>
                  <div>
                    <Label>Inhaber (Kürzel)</Label>
                    <Input value={editForm.owner} onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))} className="mt-1" placeholder="mw, jm, wm" />
                  </div>
                  <div className="col-span-2 flex gap-2 justify-end">
                    <Button size="sm" onClick={() => updateMut.mutate({ id: ba.id, ...editForm })} disabled={updateMut.isPending}>
                      <Check className="h-4 w-4 mr-1" /> Speichern
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                      <X className="h-4 w-4 mr-1" /> Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{ba.accountNumber}</span>
                      <span className="text-muted-foreground">–</span>
                      <span className="font-medium">{ba.name}</span>
                      {ba.owner && <Badge variant="outline" className="text-xs">{ba.owner}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{ba.bank ?? "—"}</div>
                    <div className="font-mono text-sm">{ba.iban ?? <span className="text-muted-foreground italic">Keine IBAN hinterlegt</span>}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(ba)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                      if (confirm(`Bankkonto "${ba.name}" wirklich löschen?`)) deleteMut.mutate({ id: ba.id });
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Bank Account Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetCreateForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neues Bankkonto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Das Bankkonto wird automatisch auch im Kontenplan angelegt (Kategorie: Umlaufvermögen / Flüssige Mittel).
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Kontonummer *</Label>
                <Input value={createForm.accountNumber} onChange={e => setCreateForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="1099" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Bezeichnung *</Label>
                <Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="ZKB Geschäftskonto" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Bank</Label>
              <Input value={createForm.bank} onChange={e => setCreateForm(f => ({ ...f, bank: e.target.value }))} placeholder="Zürcher Kantonalbank" className="mt-1" />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input value={createForm.iban} onChange={e => setCreateForm(f => ({ ...f, iban: e.target.value }))} placeholder="CH00 0000 0000 0000 0000 0" className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Inhaber (Kürzel)</Label>
              <Input value={createForm.owner} onChange={e => setCreateForm(f => ({ ...f, owner: e.target.value }))} placeholder="mw, jm, wm" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetCreateForm(); }}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (!createForm.accountNumber.trim() || !createForm.name.trim()) {
                  toast.error("Kontonummer und Bezeichnung sind erforderlich");
                  return;
                }
                createMut.mutate({
                  accountNumber: createForm.accountNumber.trim(),
                  name: createForm.name.trim(),
                  iban: createForm.iban.trim() || undefined,
                  bank: createForm.bank.trim() || undefined,
                  owner: createForm.owner.trim() || undefined,
                });
              }}
              disabled={createMut.isPending}
            >
              {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab() {
  const { data: emps, isLoading, refetch } = trpc.settings.getEmployees.useQuery();
  const { data: allAccounts } = trpc.accounts.list.useQuery();
  // Only salary-relevant accounts (4xxx Personalaufwand, 2xxx Verbindlichkeiten)
  const salaryAccounts = (allAccounts ?? []).filter(a =>
    a.number.startsWith('4') || a.number.startsWith('2') || a.number.startsWith('1')
  );
  const upsert = trpc.settings.upsertEmployee.useMutation({
    onSuccess: () => { toast.success("Gespeichert"); refetch(); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deactivate = trpc.settings.deleteEmployee.useMutation({
    onSuccess: () => { toast.success("Mitarbeiter deaktiviert"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Record<string, string> | null>(null);

  const emptyForm = () => ({ code: "", firstName: "", lastName: "", ahvNumber: "", address: "", street: "", zipCode: "", city: "", dateOfBirth: "", employmentStart: "", employmentEnd: "", lohnausweisRemarks: "" });

  const openNew = () => { setEditEmp(emptyForm()); setDialogOpen(true); };
  const openEdit = (e: NonNullable<typeof emps>[number]) => {
    setEditEmp({
      id: String(e.id),
      code: e.code,
      firstName: e.firstName,
      lastName: e.lastName,
      ahvNumber: e.ahvNumber ?? "",
      address: e.address ?? "",
      street: (e as any).street ?? "",
      zipCode: (e as any).zipCode ?? "",
      city: (e as any).city ?? "",
      dateOfBirth: e.dateOfBirth ?? "",
      employmentStart: e.employmentStart ?? "",
      employmentEnd: (e as any).employmentEnd ?? "",
      salaryAccountId: e.salaryAccountId ? String(e.salaryAccountId) : "",
      grossSalaryAccountId: e.grossSalaryAccountId ? String(e.grossSalaryAccountId) : "",
      lohnausweisRemarks: (e as any).lohnausweisRemarks ?? "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!editEmp) return;
    upsert.mutate({
      id: editEmp.id ? parseInt(editEmp.id) : undefined,
      code: editEmp.code,
      firstName: editEmp.firstName,
      lastName: editEmp.lastName,
      ahvNumber: editEmp.ahvNumber || undefined,
      address: editEmp.address || undefined,
      street: editEmp.street || undefined,
      zipCode: editEmp.zipCode || undefined,
      city: editEmp.city || undefined,
      dateOfBirth: editEmp.dateOfBirth || undefined,
      employmentStart: editEmp.employmentStart || undefined,
      employmentEnd: editEmp.employmentEnd || undefined,
      salaryAccountId: (editEmp.salaryAccountId && editEmp.salaryAccountId !== '0') ? parseInt(editEmp.salaryAccountId) : undefined,
      grossSalaryAccountId: (editEmp.grossSalaryAccountId && editEmp.grossSalaryAccountId !== '0') ? parseInt(editEmp.grossSalaryAccountId) : undefined,
      lohnausweisRemarks: editEmp.lohnausweisRemarks || undefined,
    });
  };

  if (isLoading) return <div className="text-muted-foreground">Lädt...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mitarbeiterstamm</h1>
          <p className="text-muted-foreground text-sm mt-1">Lohnbezüger und Mitarbeiterdaten</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Neuer Mitarbeiter
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kürzel</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>AHV-Nr.</TableHead>
              <TableHead>Eintritt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(emps ?? []).map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono font-bold">{e.code}</TableCell>
                <TableCell>{e.firstName} {e.lastName}</TableCell>
                <TableCell className="font-mono text-sm">{e.ahvNumber ?? "—"}</TableCell>
                <TableCell className="text-sm">{e.employmentStart ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={e.isActive ? "default" : "secondary"}>
                    {e.isActive ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {e.isActive && (
                      <Button size="icon" variant="ghost" onClick={() => deactivate.mutate({ id: e.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(emps ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Keine Mitarbeiter erfasst
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(95vw,42rem)] max-w-none">
          <DialogHeader>
            <DialogTitle>{editEmp?.id ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</DialogTitle>
          </DialogHeader>
          {editEmp && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <div>
                <Label>Kürzel *</Label>
                <Input value={editEmp.code} onChange={e => setEditEmp(f => ({ ...f!, code: e.target.value }))} className="mt-1" placeholder="mw" />
              </div>
              <div />
              <div>
                <Label>Vorname *</Label>
                <Input value={editEmp.firstName} onChange={e => setEditEmp(f => ({ ...f!, firstName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Nachname *</Label>
                <Input value={editEmp.lastName} onChange={e => setEditEmp(f => ({ ...f!, lastName: e.target.value }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>AHV-Nummer</Label>
                <Input value={editEmp.ahvNumber} onChange={e => setEditEmp(f => ({ ...f!, ahvNumber: e.target.value }))} className="mt-1 font-mono" placeholder="756.xxxx.xxxx.xx" />
              </div>
              <div>
                <Label>Geburtsdatum</Label>
                <Input type="date" value={editEmp.dateOfBirth} onChange={e => setEditEmp(f => ({ ...f!, dateOfBirth: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Eintrittsdatum</Label>
                <Input type="date" value={editEmp.employmentStart} onChange={e => setEditEmp(f => ({ ...f!, employmentStart: e.target.value }))} className="mt-1" />
              </div>
              <div className="col-span-2 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Adresse (für Lohnausweis)</p>
              </div>
              <div className="col-span-2">
                <Label>Strasse</Label>
                <Input value={editEmp.street} onChange={e => setEditEmp(f => ({ ...f!, street: e.target.value }))} className="mt-1" placeholder="Hofmattweg 69" />
              </div>
              <div>
                <Label>PLZ</Label>
                <Input value={editEmp.zipCode} onChange={e => setEditEmp(f => ({ ...f!, zipCode: e.target.value }))} className="mt-1" placeholder="4144" />
              </div>
              <div>
                <Label>Ort</Label>
                <Input value={editEmp.city} onChange={e => setEditEmp(f => ({ ...f!, city: e.target.value }))} className="mt-1" placeholder="Arlesheim" />
              </div>
              <div>
                <Label>Austrittsdatum</Label>
                <Input type="date" value={editEmp.employmentEnd} onChange={e => setEditEmp(f => ({ ...f!, employmentEnd: e.target.value }))} className="mt-1" />
              </div>
              <div />
              <div className="col-span-2">
                <Label>Bemerkungen Lohnausweis (Ziffer 15)</Label>
                <Textarea value={editEmp.lohnausweisRemarks} onChange={e => setEditEmp(f => ({ ...f!, lohnausweisRemarks: e.target.value }))} className="mt-1" rows={2} placeholder="z.B. Privatanteil Mobile CHF 4'900 im Lohn enthalten" />
              </div>
              <div className="col-span-2 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lohnkonten</p>
              </div>
              <div className="col-span-2">
                <Label>Nettolohn-Konto (Haben bei Verbuchung)</Label>
                <Select value={editEmp.salaryAccountId || "0"} onValueChange={v => setEditEmp(f => ({ ...f!, salaryAccountId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Konto wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">— kein Konto —</SelectItem>
                    {salaryAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        <span className="font-mono text-xs">{a.number}</span> {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Bruttolohn-Konto (Soll bei Verbuchung)</Label>
                <Select value={editEmp.grossSalaryAccountId || "0"} onValueChange={v => setEditEmp(f => ({ ...f!, grossSalaryAccountId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Konto wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">— kein Konto —</SelectItem>
                    {salaryAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        <span className="font-mono text-xs">{a.number}</span> {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={upsert.isPending}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Insurance Tab ────────────────────────────────────────────────────────────

function InsuranceTab() {
  const { data: settings, isLoading, refetch } = trpc.settings.getInsuranceSettings.useQuery();
  const upsert = trpc.settings.upsertInsuranceSetting.useMutation({
    onSuccess: () => { toast.success("Gespeichert"); refetch(); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.settings.deleteInsuranceSetting.useMutation({
    onSuccess: () => { toast.success("Gelöscht"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, string> | null>(null);

  const emptyForm = (type = "uvg") => ({
    insuranceType: type,
    insurerName: "",
    policyNumber: "",
    employeeRate: "",
    employerRate: "",
    maxInsuredSalary: "",
    minInsuredSalary: "",
    bvgEmployeeMonthly: "",
    bvgEmployerMonthly: "",
    validFrom: "",
    notes: "",
  });

  const openNew = (type = "uvg") => { setEditItem(emptyForm(type)); setDialogOpen(true); };
  const openEdit = (s: NonNullable<typeof settings>[number]) => {
    setEditItem({
      id: String(s.id),
      insuranceType: s.insuranceType,
      insurerName: s.insurerName ?? "",
      policyNumber: s.policyNumber ?? "",
      employeeRate: s.employeeRate ?? "",
      employerRate: s.employerRate ?? "",
      maxInsuredSalary: s.maxInsuredSalary ?? "",
      minInsuredSalary: s.minInsuredSalary ?? "",
      bvgEmployeeMonthly: (s as any).bvgEmployeeMonthly ?? "",
      bvgEmployerMonthly: (s as any).bvgEmployerMonthly ?? "",
      validFrom: s.validFrom ?? "",
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!editItem) return;
    const isBvg = editItem.insuranceType === 'bvg';
    upsert.mutate({
      id: editItem.id ? parseInt(editItem.id) : undefined,
      insuranceType: editItem.insuranceType as "uvg" | "ktg" | "bvg" | "ahv" | "fak",
      insurerName: editItem.insurerName || undefined,
      policyNumber: editItem.policyNumber || undefined,
      // For BVG: rates are informational only; monthly CHF amounts are used for calculation
      employeeRate: !isBvg && editItem.employeeRate ? parseFloat(editItem.employeeRate) : undefined,
      employerRate: !isBvg && editItem.employerRate ? parseFloat(editItem.employerRate) : undefined,
      maxInsuredSalary: editItem.maxInsuredSalary ? parseFloat(editItem.maxInsuredSalary) : undefined,
      minInsuredSalary: editItem.minInsuredSalary ? parseFloat(editItem.minInsuredSalary) : undefined,
      bvgEmployeeMonthly: isBvg && editItem.bvgEmployeeMonthly ? parseFloat(editItem.bvgEmployeeMonthly) : undefined,
      bvgEmployerMonthly: isBvg && editItem.bvgEmployerMonthly ? parseFloat(editItem.bvgEmployerMonthly) : undefined,
      validFrom: editItem.validFrom || undefined,
      notes: editItem.notes || undefined,
    });
  };

  // Swiss defaults for quick-add
  const DEFAULTS: Record<string, { employeeRate: string; employerRate: string; maxInsuredSalary: string; note: string }> = {
    ahv: { employeeRate: "5.3", employerRate: "5.3", maxInsuredSalary: "", note: "AHV/IV/EO 2026: je 5.3%" },
    uvg: { employeeRate: "0.66", employerRate: "2.97", maxInsuredSalary: "148200", note: "UVG 2026: AN 0.66%, AG 2.97%, max. CHF 148'200" },
    ktg: { employeeRate: "0.5", employerRate: "0.5", maxInsuredSalary: "", note: "KTG: typisch je 0.5% (je nach Versicherer)" },
    bvg: { employeeRate: "7.5", employerRate: "7.5", maxInsuredSalary: "88200", note: "BVG 2026: monatliche CHF-Beträge pro Mitarbeiter (je nach Alter/Lohnklasse)" },
    fak: { employeeRate: "0", employerRate: "2.0", maxInsuredSalary: "", note: "FAK: nur AG-Beitrag, ca. 2%" },
  };

  if (isLoading) return <div className="text-muted-foreground">Lädt...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Versicherungen &amp; Sozialversicherungen</h1>
          <p className="text-muted-foreground text-sm mt-1">Beitragssätze für Lohnabzüge (AHV, BVG, UVG, KTG, FAK)</p>
        </div>
        <Button size="sm" onClick={() => openNew()}>
          <Plus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      </div>

      {/* Swiss reference card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-800">Schweizer Richtwerte 2026</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 text-xs text-blue-700">
            {Object.entries(DEFAULTS).map(([type, d]) => (
              <div key={type} className="flex items-center justify-between">
                <span><strong>{INSURANCE_LABELS[type]}</strong>: {d.note}</span>
                <Button size="sm" variant="outline" className="h-6 text-xs ml-2 border-blue-300" onClick={() => openNew(type)}>
                  <Plus className="h-3 w-3 mr-1" /> Erfassen
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Existing settings */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Versicherung</TableHead>
              <TableHead>Versicherer</TableHead>
              <TableHead className="text-right">AN-Satz %</TableHead>
              <TableHead className="text-right">AG-Satz %</TableHead>
              <TableHead className="text-right">Max. Lohn</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(settings ?? []).map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${INSURANCE_COLORS[s.insuranceType] ?? "bg-gray-100 text-gray-800"}`}>
                    {INSURANCE_LABELS[s.insuranceType] ?? s.insuranceType}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{s.insurerName ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {s.insuranceType === 'bvg'
                    ? ((s as any).bvgEmployeeMonthly ? `CHF ${parseFloat((s as any).bvgEmployeeMonthly).toFixed(2)}/Mt.` : "—")
                    : (s.employeeRate ? `${parseFloat(s.employeeRate).toFixed(2)}%` : "—")}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {s.insuranceType === 'bvg'
                    ? ((s as any).bvgEmployerMonthly ? `CHF ${parseFloat((s as any).bvgEmployerMonthly).toFixed(2)}/Mt.` : "—")
                    : (s.employerRate ? `${parseFloat(s.employerRate).toFixed(2)}%` : "—")}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{s.maxInsuredSalary ? `CHF ${parseFloat(s.maxInsuredSalary).toLocaleString("de-CH")}` : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate({ id: s.id })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(settings ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Noch keine Versicherungsparameter erfasst. Verwenden Sie die Richtwerte oben.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(95vw,36rem)] max-w-none">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "Versicherung bearbeiten" : "Versicherung hinzufügen"}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2">
                <Label>Versicherungstyp *</Label>
                <Select value={editItem.insuranceType} onValueChange={v => setEditItem(f => ({ ...f!, insuranceType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INSURANCE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Versicherer</Label>
                <Input value={editItem.insurerName} onChange={e => setEditItem(f => ({ ...f!, insurerName: e.target.value }))} className="mt-1" placeholder="z.B. AXA, Helvetia, Swica..." />
              </div>
              <div className="col-span-2">
                <Label>Policen-Nr.</Label>
                <Input value={editItem.policyNumber} onChange={e => setEditItem(f => ({ ...f!, policyNumber: e.target.value }))} className="mt-1" />
              </div>
              {editItem.insuranceType === 'bvg' ? (
                <>
                  <div>
                    <Label>AN-Beitrag CHF/Monat</Label>
                    <Input type="number" step="0.05" value={editItem.bvgEmployeeMonthly} onChange={e => setEditItem(f => ({ ...f!, bvgEmployeeMonthly: e.target.value }))} className="mt-1" placeholder="z.B. 450.00" />
                    <p className="text-xs text-muted-foreground mt-1">Fester monatlicher Betrag (je nach Alter/Lohnklasse)</p>
                  </div>
                  <div>
                    <Label>AG-Beitrag CHF/Monat</Label>
                    <Input type="number" step="0.05" value={editItem.bvgEmployerMonthly} onChange={e => setEditItem(f => ({ ...f!, bvgEmployerMonthly: e.target.value }))} className="mt-1" placeholder="z.B. 450.00" />
                    <p className="text-xs text-muted-foreground mt-1">Mindestens gleich hoch wie AN-Beitrag</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>AN-Beitrag %</Label>
                    <Input type="number" step="0.01" value={editItem.employeeRate} onChange={e => setEditItem(f => ({ ...f!, employeeRate: e.target.value }))} className="mt-1" placeholder="5.30" />
                  </div>
                  <div>
                    <Label>AG-Beitrag %</Label>
                    <Input type="number" step="0.01" value={editItem.employerRate} onChange={e => setEditItem(f => ({ ...f!, employerRate: e.target.value }))} className="mt-1" placeholder="5.30" />
                  </div>
                </>
              )}
              <div>
                <Label>Max. versicherter Lohn</Label>
                <Input type="number" value={editItem.maxInsuredSalary} onChange={e => setEditItem(f => ({ ...f!, maxInsuredSalary: e.target.value }))} className="mt-1" placeholder="148200" />
              </div>
              <div>
                <Label>Gültig ab</Label>
                <Input type="date" value={editItem.validFrom} onChange={e => setEditItem(f => ({ ...f!, validFrom: e.target.value }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Notizen</Label>
                <Textarea value={editItem.notes} onChange={e => setEditItem(f => ({ ...f!, notes: e.target.value }))} className="mt-1" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={upsert.isPending}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Booking Rules Tab ────────────────────────────────────────────────────────

function BookingRulesTab() {
  const { data: rules, isLoading, refetch } = trpc.settings.getBookingRules.useQuery();
  const toggle = trpc.settings.toggleBookingRule.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.settings.deleteBookingRule.useMutation({
    onSuccess: () => { toast.success("Buchungsregel gelöscht"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.settings.updateBookingRule.useMutation({
    onSuccess: () => { toast.success("Gespeichert"); refetch(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const startEdit = (r: NonNullable<typeof rules>[number]) => {
    setEditForm({
      counterpartyPattern: r.counterpartyPattern,
      bookingTextTemplate: r.bookingTextTemplate ?? "",
      debitAccountId: r.debitAccountId ? String(r.debitAccountId) : "",
      creditAccountId: r.creditAccountId ? String(r.creditAccountId) : "",
      priority: String(r.priority),
    });
    setEditId(r.id);
  };

  const saveEdit = (id: number) => {
    update.mutate({
      id,
      counterpartyPattern: editForm.counterpartyPattern,
      bookingTextTemplate: editForm.bookingTextTemplate || undefined,
      debitAccountId: editForm.debitAccountId ? parseInt(editForm.debitAccountId) : undefined,
      creditAccountId: editForm.creditAccountId ? parseInt(editForm.creditAccountId) : undefined,
      priority: editForm.priority ? parseInt(editForm.priority) : undefined,
    });
  };

  // Nur kundenspezifische Regeln anzeigen (globale Regeln sind im Admin-Bereich)
  const orgRules = (rules ?? []).filter((r: any) => r.scope !== "global");
  const filtered = orgRules.filter(r =>
    !search || r.counterpartyPattern.toLowerCase().includes(search.toLowerCase()) ||
    (r.bookingTextTemplate ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="text-muted-foreground">Lädt...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Buchungsregeln</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {orgRules.length} mandantenspezifische Regeln – automatische Kategorisierung von Bankbuchungen
          </p>
        </div>
        <Input
          placeholder="Suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-60"
        />
      </div>

      <div className="rounded-md border overflow-auto max-h-[calc(100vh-220px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gegenpartei-Muster</TableHead>
              <TableHead>Buchungstext-Template</TableHead>
              <TableHead>Soll</TableHead>
              <TableHead>Haben</TableHead>
              <TableHead className="text-right">Prio</TableHead>
              <TableHead className="text-right">Verwendet</TableHead>
              <TableHead>Aktiv</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id} className={!r.isActive ? "opacity-50" : ""}>
                {editId === r.id ? (
                  <>
                    <TableCell><Input value={editForm.counterpartyPattern} onChange={e => setEditForm(f => ({ ...f, counterpartyPattern: e.target.value }))} className="h-7 text-xs" /></TableCell>
                    <TableCell><Input value={editForm.bookingTextTemplate} onChange={e => setEditForm(f => ({ ...f, bookingTextTemplate: e.target.value }))} className="h-7 text-xs" /></TableCell>
                    <TableCell><Input value={editForm.debitAccountId} onChange={e => setEditForm(f => ({ ...f, debitAccountId: e.target.value }))} className="h-7 text-xs w-20" placeholder="ID" /></TableCell>
                    <TableCell><Input value={editForm.creditAccountId} onChange={e => setEditForm(f => ({ ...f, creditAccountId: e.target.value }))} className="h-7 text-xs w-20" placeholder="ID" /></TableCell>
                    <TableCell><Input value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="h-7 text-xs w-16" /></TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(r.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-mono text-xs max-w-[160px] truncate" title={r.counterpartyPattern}>{r.counterpartyPattern}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground" title={r.bookingTextTemplate ?? ""}>{r.bookingTextTemplate ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.debitAccountNumber ? (
                        <span className="font-mono">{r.debitAccountNumber}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.creditAccountNumber ? (
                        <span className="font-mono">{r.creditAccountNumber}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.priority}</TableCell>
                    <TableCell className="text-right text-xs">{r.usageCount}</TableCell>
                    <TableCell>
                      <Switch
                        checked={r.isActive}
                        onCheckedChange={v => toggle.mutate({ id: r.id, isActive: v })}
                        className="scale-75"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate({ id: r.id })}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Keine Buchungsregeln gefunden
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Opening Balances Tab ─────────────────────────────────────────────────────

// Sortable row for drag & drop in opening balances
function SortableOBRow({ row, value, onChange }: {
  row: { accountId: number; accountNumber: string; accountName: string; isActive: boolean };
  value: string;
  onChange: (val: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.accountId });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className={`border-t border-border/40 hover:bg-muted/20 ${!row.isActive ? 'opacity-50' : ''}`}>
      <td className="px-1 py-1.5 w-8">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground w-20">{row.accountNumber}</td>
      <td className="px-2 py-1.5 text-sm">
        {row.accountName}
        {!row.isActive && <Badge variant="outline" className="ml-2 text-[10px] py-0">inaktiv</Badge>}
      </td>
      <td className="px-2 py-1.5 text-right">
        <Input
          type="number"
          step="0.01"
          className="h-7 text-right font-mono text-sm w-36 ml-auto"
          value={value}
          placeholder="0.00"
          onChange={e => onChange(e.target.value)}
        />
      </td>
    </tr>
  );
}

function OpeningBalancesTab() {
  const { fiscalYear } = useFiscalYear();
  const [editYear, setEditYear] = useState(fiscalYear);
  const [localBalances, setLocalBalances] = useState<Record<number, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addNumber, setAddNumber] = useState("");
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<"asset" | "liability" | "equity">("asset");
  const [addCategory, setAddCategory] = useState("");
  const [localOrder, setLocalOrder] = useState<{ assets: number[]; liabilities: number[] }>({ assets: [], liabilities: [] });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { data: rows, isLoading, refetch } = trpc.settings.getOpeningBalances.useQuery(
    { fiscalYear: editYear },
    { refetchOnWindowFocus: false }
  );

  const saveMut = trpc.settings.upsertOpeningBalances.useMutation({
    onSuccess: () => {
      toast.success("Eröffnungssalden gespeichert");
      setIsDirty(false);
      refetch();
    },
    onError: (err) => { toast.error(err.message); },
  });

  const createAccountMut = trpc.settings.createAccount.useMutation({
    onSuccess: (result) => {
      toast.success(`Konto ${addNumber} erstellt und zum Kontenplan hinzugefügt`);
      setShowAddAccount(false);
      setAddNumber(""); setAddName(""); setAddType("asset"); setAddCategory("");
      refetch();
    },
    onError: (err) => { toast.error(err.message); },
  });

  // Re-init when rows change
  const prevYear = useRef(editYear);
  useEffect(() => {
    if (rows) {
      if (editYear !== prevYear.current || !isDirty) {
        prevYear.current = editYear;
        const init: Record<number, string> = {};
        rows.forEach(r => { if (r.balance !== 0) init[r.accountId] = String(r.balance); });
        setLocalBalances(init);
        if (editYear !== prevYear.current) setIsDirty(false);
      }
      // Init local order
      const assetIds = rows.filter(r => r.accountType === "asset").map(r => r.accountId);
      const liabIds = rows.filter(r => r.accountType === "liability" || r.accountType === "equity").map(r => r.accountId);
      setLocalOrder({ assets: assetIds, liabilities: liabIds });
    }
  }, [rows, editYear]);

  const getValue = (accountId: number) => localBalances[accountId] ?? "";
  const handleChange = (accountId: number, val: string) => {
    setLocalBalances(prev => ({ ...prev, [accountId]: val }));
    setIsDirty(true);
  };

  // Ordered rows
  const assetRows = useMemo(() => {
    if (!rows) return [];
    const assetMap = new Map(rows.filter(r => r.accountType === "asset").map(r => [r.accountId, r]));
    return localOrder.assets.map(id => assetMap.get(id)).filter(Boolean) as NonNullable<typeof rows>;
  }, [rows, localOrder.assets]);

  const liabilityRows = useMemo(() => {
    if (!rows) return [];
    const liabMap = new Map(rows.filter(r => r.accountType === "liability" || r.accountType === "equity").map(r => [r.accountId, r]));
    return localOrder.liabilities.map(id => liabMap.get(id)).filter(Boolean) as NonNullable<typeof rows>;
  }, [rows, localOrder.liabilities]);

  const totalAssets = assetRows.reduce((sum, r) => sum + (parseFloat(localBalances[r.accountId] || "0") || 0), 0);
  const totalLiabilities = liabilityRows.reduce((sum, r) => sum + (parseFloat(localBalances[r.accountId] || "0") || 0), 0);
  const diff = Math.abs(totalAssets - totalLiabilities);
  const isBalanced = diff < 0.01;

  const handleSave = () => {
    const balances = (rows ?? []).map(r => ({
      accountId: r.accountId,
      balance: parseFloat(localBalances[r.accountId] || "0") || 0,
    }));
    saveMut.mutate({ fiscalYear: editYear, balances });
  };

  const handleAddAccount = () => {
    if (!addNumber || !addName) { toast.error("Kontonummer und Name sind erforderlich"); return; }
    const normalBalance = addType === "asset" ? "debit" as const : "credit" as const;
    createAccountMut.mutate({
      number: addNumber,
      name: addName,
      accountType: addType,
      normalBalance,
      category: addCategory || undefined,
      isActive: true,
      sortOrder: 0,
    });
  };

  const handleDragEnd = (group: "assets" | "liabilities") => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder(prev => {
      const list = [...prev[group]];
      const oldIndex = list.indexOf(active.id as number);
      const newIndex = list.indexOf(over.id as number);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return { ...prev, [group]: arrayMove(list, oldIndex, newIndex) };
    });
    setIsDirty(true);
  };

  const formatCHF = (n: number) =>
    new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const renderAccountGroup = (
    title: string,
    groupRows: NonNullable<typeof rows>,
    total: number,
    group: "assets" | "liabilities"
  ) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {title}
      </h3>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground">
              <th className="w-8"></th>
              <th className="text-left px-2 py-2 w-20">Konto</th>
              <th className="text-left px-2 py-2">Bezeichnung</th>
              <th className="text-right px-2 py-2 w-40">Saldo CHF</th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(group)}>
            <SortableContext items={groupRows.map(r => r.accountId)} strategy={verticalListSortingStrategy}>
              <tbody>
                {groupRows.map(r => (
                  <SortableOBRow
                    key={r.accountId}
                    row={r}
                    value={getValue(r.accountId)}
                    onChange={(val) => handleChange(r.accountId, val)}
                  />
                ))}
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td></td>
                  <td colSpan={2} className="px-2 py-2 text-sm">Total {title}</td>
                  <td className="px-2 py-2 text-right font-mono text-sm">{formatCHF(total)}</td>
                </tr>
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Eröffnungssalden</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manuelle Erfassung der Eröffnungssalden. Nur aktive Konten aus dem Kontenplan werden angezeigt.
            Aktiven müssen gleich Passiven sein.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddAccount(true)}>
            <Plus className="h-4 w-4 mr-1" /> Neues Konto
          </Button>
          <Select value={String(editYear)} onValueChange={v => { setEditYear(parseInt(v)); setIsDirty(false); }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2026, 2025, 2024, 2023].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-2 p-3 rounded-lg mb-4 text-xs bg-blue-50 border border-blue-200 text-blue-800">
        <GripVertical className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Konten per Drag & Drop umsortieren. Neue Konten werden automatisch im Kontenplan erstellt. Inaktive Konten im Kontenplan werden hier ausgeblendet.</span>
      </div>

      {/* Balance indicator */}
      {isDirty && (
        <div className={`flex items-center gap-3 p-3 rounded-lg mb-4 text-sm font-medium ${
          isBalanced
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-amber-50 border border-amber-200 text-amber-800"
        }`}>
          {isBalanced ? (
            <Check className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          )}
          <span>
            Aktiven: {formatCHF(totalAssets)} | Passiven: {formatCHF(totalLiabilities)}
            {!isBalanced && ` | Differenz: CHF ${formatCHF(diff)}`}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {renderAccountGroup("Aktiven", assetRows, totalAssets, "assets")}
          {renderAccountGroup("Passiven (Fremdkapital & Eigenkapital)", liabilityRows, totalLiabilities, "liabilities")}

          {/* Save button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Beim Speichern wird die Eröffnungsbilanz-Buchung im Journal automatisch aktualisiert.
            </p>
            <Button
              onClick={handleSave}
              disabled={!isDirty || !isBalanced || saveMut.isPending}
              className="min-w-32"
            >
              {saveMut.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </>
      )}

      {/* Add Account Dialog */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Konto erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Das Konto wird sowohl hier in den Eröffnungssalden als auch im Kontenplan erstellt.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Kontonummer</Label>
                <Input value={addNumber} onChange={e => setAddNumber(e.target.value)} placeholder="z.B. 1099" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Bezeichnung</Label>
                <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="z.B. Bankkonto ZKB" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kontotyp</Label>
                <Select value={addType} onValueChange={v => setAddType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Aktiven</SelectItem>
                    <SelectItem value="liability">Fremdkapital</SelectItem>
                    <SelectItem value="equity">Eigenkapital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Kategorie (optional)</Label>
                <Input value={addCategory} onChange={e => setAddCategory(e.target.value)} placeholder="z.B. Flüssige Mittel" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccount(false)}>Abbrechen</Button>
            <Button onClick={handleAddAccount} disabled={createAccountMut.isPending}>
              {createAccountMut.isPending ? "Erstellen..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Depreciation Settings Tab ───────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  linear: "Linear",
  degressive: "Degressiv",
};

function DepreciationTab() {
  const { data: settings, isLoading, refetch } = trpc.yearEnd.listDepreciationSettings.useQuery();
  const { data: allAccounts } = trpc.accounts.list.useQuery();
  const createMut = trpc.yearEnd.createDepreciationSetting.useMutation({
    onSuccess: () => { toast.success("Abschreibungssatz erstellt"); refetch(); setShowAdd(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.yearEnd.updateDepreciationSetting.useMutation({
    onSuccess: () => { toast.success("Abschreibungssatz aktualisiert"); refetch(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.yearEnd.deleteDepreciationSetting.useMutation({
    onSuccess: () => { toast.success("Abschreibungssatz gelöscht"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form state
  const [formAccountId, setFormAccountId] = useState<string>("");
  const [formRate, setFormRate] = useState("");
  const [formMethod, setFormMethod] = useState<"linear" | "degressive">("linear");
  const [formExpenseAccountId, setFormExpenseAccountId] = useState<string>("");
  const [formActive, setFormActive] = useState(true);

  // Filter accounts: only asset accounts for depreciation (Anlagevermögen: Sachanlagen, Finanzanlagen, Immaterielle Werte)
  const assetAccounts = (allAccounts || []).filter(a => {
    const num = parseInt(a.number);
    // Include: 1100-1199 (mobile Sachanlagen like Geräte, Hardware, Mobiliar)
    // 1200-1299 (Finanzanlagen, Beteiligungen)
    // 1400-1499 (Finanzanlagen gemäss KMU)
    // 1500-1599 (Mobile Sachanlagen gemäss KMU)
    // 1600-1699 (Immobile Sachanlagen)
    // 1700-1799 (Immaterielle Werte)
    return (num >= 1100 && num < 1300) || (num >= 1400 && num < 1800);
  });

  // Filter accounts: expense accounts for depreciation (4400 Abschreibungen + 6800 gemäss KMU)
  const expenseAccounts = (allAccounts || []).filter(a => {
    const num = parseInt(a.number);
    return (num >= 4400 && num < 4500) || (num >= 6800 && num < 6900);
  });

  const resetForm = () => {
    setFormAccountId("");
    setFormRate("");
    setFormMethod("linear");
    setFormExpenseAccountId("");
    setFormActive(true);
  };

  const startEdit = (setting: NonNullable<typeof settings>[number]) => {
    setEditId(setting.id);
    setFormAccountId(String(setting.accountId));
    setFormRate(setting.depreciationRate);
    setFormMethod(setting.method as "linear" | "degressive");
    setFormExpenseAccountId(setting.depreciationExpenseAccountId ? String(setting.depreciationExpenseAccountId) : "");
    setFormActive(setting.isActive);
  };

  const handleCreate = () => {
    if (!formAccountId || !formRate) { toast.error("Konto und Satz sind Pflichtfelder"); return; }
    createMut.mutate({
      accountId: parseInt(formAccountId),
      depreciationRate: formRate,
      method: formMethod,
      depreciationExpenseAccountId: formExpenseAccountId ? parseInt(formExpenseAccountId) : undefined,
    });
  };

  const handleUpdate = () => {
    if (!editId) return;
    updateMut.mutate({
      id: editId,
      depreciationRate: formRate || undefined,
      method: formMethod,
      depreciationExpenseAccountId: formExpenseAccountId ? parseInt(formExpenseAccountId) : null,
      isActive: formActive,
    });
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Abschreibungssätze</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Definieren Sie die jährlichen Abschreibungssätze für Ihr Anlagevermögen.
            Diese werden beim Jahresabschluss automatisch als Buchungsvorschläge generiert.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Neuer Satz
        </Button>
      </div>

      {/* Info box */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-muted-foreground">
              <strong className="text-blue-700 dark:text-blue-400">Steuerlich zulässige Abschreibungssätze (Schweiz):</strong>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
                <span>Mobiliar/Einrichtungen: 25%</span>
                <span>Büromaschinen: 40%</span>
                <span>Fahrzeuge: 40%</span>
                <span>Werkzeuge/Geräte: 40%</span>
                <span>Immobilien (Geschäft): 4%</span>
                <span>EDV/Software: 40%</span>
                <span>Immaterielle Anlagen: 40%</span>
                <span>Goodwill: 40%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add form */}
      {showAdd && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Neuer Abschreibungssatz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Anlagekonto *</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                  <SelectContent>
                    {assetAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Abschreibungssatz (%) *</Label>
                <Input
                  className="mt-1" type="number" step="0.1" min="0" max="100"
                  value={formRate} onChange={e => setFormRate(e.target.value)}
                  placeholder="z.B. 25"
                />
              </div>
              <div>
                <Label>Methode</Label>
                <Select value={formMethod} onValueChange={v => setFormMethod(v as "linear" | "degressive")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear (gleichmässig)</SelectItem>
                    <SelectItem value="degressive">Degressiv (vom Buchwert)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aufwandkonto (optional)</Label>
                <Select value={formExpenseAccountId} onValueChange={setFormExpenseAccountId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Standard: 6800" /></SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <Label>Aktiv</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={createMut.isPending} size="sm">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Erstellen
              </Button>
              <Button onClick={() => setShowAdd(false)} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" /> Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Konto</TableHead>
              <TableHead>Satz</TableHead>
              <TableHead>Methode</TableHead>
              <TableHead>Aufwandkonto</TableHead>
              <TableHead className="text-center">Aktiv</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!settings || settings.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Noch keine Abschreibungssätze definiert.
                </TableCell>
              </TableRow>
            )}
            {(settings || []).map(s => (
              <TableRow key={s.id}>
                {editId === s.id ? (
                  <>
                    <TableCell className="font-medium">{s.accountNumber} {s.accountName}</TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.1" min="0" max="100" className="w-20"
                        value={formRate} onChange={e => setFormRate(e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={formMethod} onValueChange={v => setFormMethod(v as "linear" | "degressive")}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Linear</SelectItem>
                          <SelectItem value="degressive">Degressiv</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={formExpenseAccountId} onValueChange={setFormExpenseAccountId}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Standard" /></SelectTrigger>
                        <SelectContent>
                          {expenseAccounts.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={formActive} onCheckedChange={setFormActive} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={handleUpdate} disabled={updateMut.isPending}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium">{s.accountNumber} {s.accountName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{s.depreciationRate}%</Badge>
                    </TableCell>
                    <TableCell>{METHOD_LABELS[s.method] || s.method}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.expenseAccountNumber ? `${s.expenseAccountNumber} ${s.expenseAccountName}` : "Standard (6800)"}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.isActive ? (
                        <Badge variant="default" className="bg-green-100 text-green-700">Aktiv</Badge>
                      ) : (
                        <Badge variant="secondary">Inaktiv</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { if (confirm("Abschreibungssatz löschen?")) deleteMut.mutate({ id: s.id }); }}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


// ─── Chart of Accounts (Kontenplan) Tab ─────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Aktiven",
  liability: "Passiven",
  expense: "Aufwand",
  revenue: "Ertrag",
  equity: "Eigenkapital",
};

const VAT_RATES = [
  { value: "8.10", label: "8.1% (Normal)" },
  { value: "2.60", label: "2.6% (Reduziert)" },
  { value: "3.80", label: "3.8% (Beherbergung)" },
  { value: "0.00", label: "0% (Befreit)" },
];

interface AccountRow {
  id: number;
  number: string;
  name: string;
  accountType: string;
  normalBalance: string;
  category: string | null;
  subCategory: string | null;
  isBankAccount: boolean | null;
  isVatRelevant: boolean | null;
  defaultVatRate: string | null;
  isActive: boolean;
  sortOrder: number | null;
}

interface TreeCategory {
  key: string;
  label: string;
  subCategories: TreeSubCategory[];
}

interface TreeSubCategory {
  key: string;
  label: string;
  accounts: AccountRow[];
}

function buildTree(accounts: AccountRow[]): TreeCategory[] {
  const catMap = new Map<string, Map<string, AccountRow[]>>();
  
  // Define the standard category order based on Swiss chart of accounts
  const catOrder = [
    "Umlaufvermögen", "Anlagevermögen",  // Aktiven
    "Fremdkapital", "Eigenkapital",  // Passiven
    "Drittaufwand", "Personalaufwand", "Mietaufwand", "Zinsaufwand",
    "Unterhalt und Reparatur", "Abschreibungen", "Versicherungen",
    "Betriebs- und Hilfsmaterial", "Verwaltungsaufwand", "Werbeaufwand",
    "Übriger Aufwand",  // Aufwand
    "Dienstleistungsertrag", "Kapitalertrag", "Übriger Ertrag",  // Ertrag
  ];

  for (const acc of accounts) {
    const cat = acc.category || "Ohne Kategorie";
    const sub = acc.subCategory || "Allgemein";
    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const subMap = catMap.get(cat)!;
    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub)!.push(acc);
  }

  const tree: TreeCategory[] = [];
  // Sort by predefined order, then alphabetically for unknown categories
  const sortedCats = Array.from(catMap.keys()).sort((a: string, b: string) => {
    const ia = catOrder.indexOf(a);
    const ib = catOrder.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, "de");
  });

  for (const cat of sortedCats) {
    const subMap = catMap.get(cat)!;
    const subCategories: TreeSubCategory[] = [];
    subMap.forEach((accs: AccountRow[], sub: string) => {
      subCategories.push({
        key: `${cat}::${sub}`,
        label: sub,
        accounts: accs.sort((a: AccountRow, b: AccountRow) => a.number.localeCompare(b.number)),
      });
    });
    tree.push({ key: cat, label: cat, subCategories });
  }
  return tree;
}

// Undo action types for Kontenplan
type UndoAction =
  | { type: "toggleActive"; id: number; previousActive: boolean; accountLabel: string }
  | { type: "updateVat"; id: number; previousVatRelevant: boolean; previousVatRate: string | null; accountLabel: string }
  | { type: "updateAccount"; id: number; previousName: string; previousNumber: string; accountLabel: string }
  | { type: "deleteAccount"; accountData: { number: string; name: string; accountType: string; normalBalance: string; category?: string; subCategory?: string; isBankAccount?: boolean; isVatRelevant?: boolean; defaultVatRate?: string | null }; accountLabel: string }
  | { type: "createAccount"; id: number; accountLabel: string };

function ChartOfAccountsTab() {
  const { data: allAccounts, isLoading, refetch } = trpc.settings.getAllAccounts.useQuery();
  const utils = trpc.useUtils();

  // Undo stack
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack(prev => [...prev.slice(-19), action]); // keep last 20
  }, []);

  const updateMut = trpc.settings.updateAccount.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.bankAccountCreated) {
        toast.success("Bankkonto automatisch in Bankkonten erstellt");
        utils.settings.getBankAccounts.invalidate();
      } else if (data.bankAccountRemoved) {
        toast.info("Bankkonto-Eintrag entfernt");
        utils.settings.getBankAccounts.invalidate();
      } else if (data.bankAccountKept) {
        toast.warning(data.reason || "Bankkonto hat Transaktionen und wurde beibehalten");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.settings.createAccount.useMutation({
    onSuccess: (data) => {
      toast.success("Konto erstellt");
      if (data.bankAccountCreated) {
        toast.success("Bankkonto automatisch in Bankkonten erstellt");
        utils.settings.getBankAccounts.invalidate();
      }
      // Push undo for create
      if (data.id) {
        pushUndo({ type: "createAccount", id: data.id, accountLabel: `${addNumber} ${addName}` });
      }
      refetch(); setShowAdd(false); resetAddForm();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.settings.deleteAccount.useMutation({
    onSuccess: () => { toast.success("Konto gelöscht"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleActiveMut = trpc.settings.toggleAccountActive.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const updateVatMut = trpc.settings.updateAccountVat.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const reorderMut = trpc.settings.updateAccountSortOrder.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const bulkImportMut = trpc.settings.bulkImportAccounts.useMutation({
    onSuccess: (data) => {
      toast.success(`Import: ${data.created} erstellt, ${data.updated} aktualisiert, ${data.skipped} übersprungen`);
      refetch();
      setShowImport(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: kmuTemplate } = trpc.settings.getKmuTemplate.useQuery();

  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showKmuConfirm, setShowKmuConfirm] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importPreview, setImportPreview] = useState<Array<{number: string; name: string; accountType: string; category?: string; subCategory?: string}>>([]);
  const [dragEnabled, setDragEnabled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isPdfParsing, setIsPdfParsing] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Add form state
  const [addNumber, setAddNumber] = useState("");
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<string>("expense");
  const [addCategory, setAddCategory] = useState("");
  const [addSubCategory, setAddSubCategory] = useState("");
  const [addIsBankAccount, setAddIsBankAccount] = useState(false);

  const resetAddForm = () => {
    setAddNumber(""); setAddName(""); setAddType("expense");
    setAddCategory(""); setAddSubCategory(""); setAddIsBankAccount(false);
  };

  // Undo handler
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    switch (action.type) {
      case "toggleActive":
        toggleActiveMut.mutate({ id: action.id, isActive: action.previousActive });
        toast.info(`Rückgängig: ${action.accountLabel} ${action.previousActive ? "aktiviert" : "deaktiviert"}`);
        break;
      case "updateVat":
        updateVatMut.mutate({
          id: action.id,
          isVatRelevant: action.previousVatRelevant,
          defaultVatRate: action.previousVatRate,
        });
        toast.info(`Rückgängig: MWST für ${action.accountLabel} zurückgesetzt`);
        break;
      case "updateAccount":
        updateMut.mutate({
          id: action.id,
          name: action.previousName,
          number: action.previousNumber,
        });
        toast.info(`Rückgängig: ${action.accountLabel} zurückgesetzt`);
        break;
      case "createAccount":
        deleteMut.mutate({ id: action.id });
        toast.info(`Rückgängig: Konto ${action.accountLabel} gelöscht`);
        break;
      case "deleteAccount":
        createMut.mutate({
          number: action.accountData.number,
          name: action.accountData.name,
          accountType: action.accountData.accountType as any,
          normalBalance: action.accountData.normalBalance as any,
          category: action.accountData.category,
          subCategory: action.accountData.subCategory,
          isBankAccount: action.accountData.isBankAccount ?? false,
        });
        toast.info(`Rückgängig: Konto ${action.accountLabel} wiederhergestellt`);
        break;
    }
  }, [undoStack, toggleActiveMut, updateVatMut, updateMut, deleteMut, createMut]);

  // Keyboard shortcut Ctrl+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        // Only if not editing an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo]);

  const tree = useMemo(() => {
    if (!allAccounts) return [];
    let filtered = allAccounts as AccountRow[];
    if (!showInactive) filtered = filtered.filter(a => a.isActive);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.number.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        (a.category || "").toLowerCase().includes(term) ||
        (a.subCategory || "").toLowerCase().includes(term)
      );
    }
    return buildTree(filtered);
  }, [allAccounts, showInactive, searchTerm]);

  const toggleCat = (key: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSub = (key: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const cats = new Set<string>(tree.map((c: TreeCategory) => c.key));
    const subs = new Set<string>(tree.flatMap((c: TreeCategory) => c.subCategories.map((s: TreeSubCategory) => s.key)));
    setExpandedCats(cats);
    setExpandedSubs(subs);
  };

  const collapseAll = () => {
    setExpandedCats(new Set());
    setExpandedSubs(new Set());
  };

  const startEdit = (acc: AccountRow) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditNumber(acc.number);
  };

  const saveEdit = (acc: AccountRow) => {
    pushUndo({
      type: "updateAccount",
      id: acc.id,
      previousName: acc.name,
      previousNumber: acc.number,
      accountLabel: `${acc.number} ${acc.name}`,
    });
    updateMut.mutate({
      id: acc.id,
      name: editName !== acc.name ? editName : undefined,
      number: editNumber !== acc.number ? editNumber : undefined,
    });
    setEditingId(null);
  };

  const handleCreateAccount = () => {
    const num = parseInt(addNumber);
    let normalBalance: "debit" | "credit" = "debit";
    let accountType = addType as "asset" | "liability" | "expense" | "revenue" | "equity";
    if (accountType === "liability" || accountType === "revenue" || accountType === "equity") {
      normalBalance = "credit";
    }
    createMut.mutate({
      number: addNumber,
      name: addName,
      accountType,
      normalBalance,
      category: addCategory || undefined,
      subCategory: addSubCategory || undefined,
      isBankAccount: addIsBankAccount,
    });
  };

  const totalAccounts = allAccounts?.length ?? 0;
  const activeAccounts = allAccounts?.filter(a => a.isActive).length ?? 0;

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kontenplan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeAccounts} aktive Konten von {totalAccounts} total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {undoStack.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleUndo} className="text-orange-600 border-orange-300 hover:bg-orange-50">
              <Undo2 className="h-4 w-4 mr-1" /> Rückgängig
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={expandAll}>Alle öffnen</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>Alle schliessen</Button>
          <Button variant={dragEnabled ? "default" : "outline"} size="sm" onClick={() => setDragEnabled(!dragEnabled)}>
            <ArrowUpDown className="h-4 w-4 mr-1" /> {dragEnabled ? "Sortierung beenden" : "Sortieren"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowKmuConfirm(true)}>
            <LayoutTemplate className="h-4 w-4 mr-1" /> KMU-Vorlage
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Neues Konto
          </Button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex gap-3 items-center">
        <Input
          placeholder="Suche nach Kontonummer, Name, Kategorie..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label className="text-sm">Inaktive anzeigen</Label>
        </div>
      </div>

      {/* Add account dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Konto erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kontonummer *</Label>
                <Input value={addNumber} onChange={e => setAddNumber(e.target.value)} placeholder="z.B. 4710" />
              </div>
              <div>
                <Label>Kontoname *</Label>
                <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="z.B. Fachliteratur" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Kontotyp</Label>
                <Select value={addType} onValueChange={setAddType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kategorie</Label>
                <Input value={addCategory} onChange={e => setAddCategory(e.target.value)} placeholder="z.B. Verwaltungsaufwand" />
              </div>
              <div>
                <Label>Unterkategorie</Label>
                <Input value={addSubCategory} onChange={e => setAddSubCategory(e.target.value)} placeholder="z.B. Fachliteratur" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={addIsBankAccount}
                onCheckedChange={setAddIsBankAccount}
              />
              <Label className="text-sm">Bankkonto (erstellt automatisch Eintrag unter Bankkonten)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetAddForm(); }}>Abbrechen</Button>
            <Button onClick={handleCreateAccount} disabled={!addNumber || !addName || createMut.isPending}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tree view */}
      <div className="space-y-1">
        {tree.map((cat: TreeCategory) => (
          <div key={cat.key} className="border rounded-lg overflow-hidden">
            {/* Category header */}
            <button
              className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left font-semibold"
              onClick={() => toggleCat(cat.key)}
            >
              {expandedCats.has(cat.key) ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              <span>{cat.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {cat.subCategories.reduce((sum: number, s: TreeSubCategory) => sum + s.accounts.length, 0)} Konten
              </Badge>
            </button>

            {expandedCats.has(cat.key) && (
              <div className="pl-4">
                {cat.subCategories.map((sub: TreeSubCategory) => (
                  <div key={sub.key}>
                    {/* Subcategory header */}
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left text-sm font-medium text-muted-foreground"
                      onClick={() => toggleSub(sub.key)}
                    >
                      {expandedSubs.has(sub.key) ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{sub.label}</span>
                      <span className="ml-auto text-xs">{sub.accounts.length}</span>
                    </button>

                    {expandedSubs.has(sub.key) && (
                      <SortableAccountList
                        accounts={sub.accounts}
                        dragEnabled={dragEnabled}
                        onDragEnd={(oldIndex, newIndex) => {
                          const reordered = arrayMove(sub.accounts, oldIndex, newIndex);
                          const updates = reordered.map((a, i) => ({ id: a.id, sortOrder: i }));
                          reorderMut.mutate({ updates });
                        }}
                      >
                        {sub.accounts.map((acc: AccountRow) => (
                          <SortableAccountRow key={acc.id} id={acc.id} dragEnabled={dragEnabled}>
                            <div
                              className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 text-sm group hover:bg-muted/20 transition-colors ${
                                !acc.isActive ? "opacity-50" : ""
                              }`}
                            >
                            {dragEnabled && (
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                            )}
                            {/* Category move dropdown (only in drag mode) */}
                            {dragEnabled && (
                              <Select
                                value={`${acc.category || "Ohne Kategorie"}::${acc.subCategory || "Allgemein"}`}
                                onValueChange={(val) => {
                                  const [newCat, newSub] = val.split("::");
                                  reorderMut.mutate({
                                    updates: [{
                                      id: acc.id,
                                      sortOrder: acc.sortOrder ?? 0,
                                      category: newCat === "Ohne Kategorie" ? undefined : newCat,
                                      subCategory: newSub === "Allgemein" ? undefined : newSub,
                                    }],
                                  });
                                }}
                              >
                                <SelectTrigger className="w-44 h-7 text-xs">
                                  <SelectValue placeholder="Kategorie" />
                                </SelectTrigger>
                                <SelectContent>
                                  {tree.flatMap((c: TreeCategory) =>
                                    c.subCategories.map((s: TreeSubCategory) => (
                                      <SelectItem key={s.key} value={s.key}>
                                        {c.label} / {s.label}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                            {/* Account number */}
                            {editingId === acc.id ? (
                              <Input
                                value={editNumber}
                                onChange={e => setEditNumber(e.target.value)}
                                className="w-20 h-7 text-sm font-mono"
                              />
                            ) : (
                              <span className="font-mono text-xs w-12 shrink-0 font-semibold">{acc.number}</span>
                            )}

                            {/* Account name */}
                            {editingId === acc.id ? (
                              <Input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="flex-1 h-7 text-sm"
                                onKeyDown={e => { if (e.key === "Enter") saveEdit(acc); if (e.key === "Escape") setEditingId(null); }}
                              />
                            ) : (
                              <span className="flex-1 truncate">{acc.name}</span>
                            )}

                            {/* Account type badge */}
                            <Badge variant="outline" className="text-xs shrink-0">
                              {ACCOUNT_TYPE_LABELS[acc.accountType] || acc.accountType}
                            </Badge>

                            {/* Bank account indicator */}
                            {acc.isBankAccount && (
                              <Badge variant="secondary" className="text-xs shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Bank
                              </Badge>
                            )}

                            {/* VAT toggle */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Switch
                                checked={!!acc.isVatRelevant}
                                onCheckedChange={(checked) => {
                                  pushUndo({
                                    type: "updateVat",
                                    id: acc.id,
                                    previousVatRelevant: !!acc.isVatRelevant,
                                    previousVatRate: acc.defaultVatRate,
                                    accountLabel: `${acc.number} ${acc.name}`,
                                  });
                                  updateVatMut.mutate({
                                    id: acc.id,
                                    isVatRelevant: checked,
                                    defaultVatRate: checked ? (acc.defaultVatRate || "8.10") : null,
                                  });
                                }}
                              />
                              <span className="text-xs text-muted-foreground w-10">MWST</span>
                            </div>

                            {/* VAT rate selector (only if VAT relevant) */}
                            {acc.isVatRelevant ? (
                              <Select
                                value={acc.defaultVatRate || "8.10"}
                                onValueChange={(val) => {
                                  pushUndo({
                                    type: "updateVat",
                                    id: acc.id,
                                    previousVatRelevant: true,
                                    previousVatRate: acc.defaultVatRate,
                                    accountLabel: `${acc.number} ${acc.name}`,
                                  });
                                  updateVatMut.mutate({
                                    id: acc.id,
                                    isVatRelevant: true,
                                    defaultVatRate: val,
                                  });
                                }}
                              >
                                <SelectTrigger className="w-28 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VAT_RATES.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="w-28" />
                            )}

                            {/* Active toggle */}
                            <button
                              className="shrink-0"
                              onClick={() => {
                                pushUndo({
                                  type: "toggleActive",
                                  id: acc.id,
                                  previousActive: acc.isActive,
                                  accountLabel: `${acc.number} ${acc.name}`,
                                });
                                toggleActiveMut.mutate({ id: acc.id, isActive: !acc.isActive });
                              }}
                              title={acc.isActive ? "Deaktivieren" : "Aktivieren"}
                            >
                              {acc.isActive ? (
                                <Eye className="h-4 w-4 text-green-600" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              )}
                            </button>

                            {/* Edit / Save / Cancel */}
                            {editingId === acc.id ? (
                              <div className="flex gap-1 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => saveEdit(acc)}>
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" onClick={() => startEdit(acc)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  onClick={() => {
                                    if (confirm(`Konto ${acc.number} ${acc.name} wirklich löschen?`)) {
                                      pushUndo({
                                        type: "deleteAccount",
                                        accountData: {
                                          number: acc.number,
                                          name: acc.name,
                                          accountType: acc.accountType,
                                          normalBalance: acc.normalBalance,
                                          category: acc.category || undefined,
                                          subCategory: acc.subCategory || undefined,
                                          isBankAccount: acc.isBankAccount ?? false,
                                          isVatRelevant: acc.isVatRelevant ?? false,
                                          defaultVatRate: acc.defaultVatRate,
                                        },
                                        accountLabel: `${acc.number} ${acc.name}`,
                                      });
                                      deleteMut.mutate({ id: acc.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                          </SortableAccountRow>
                        ))}
                      </SortableAccountList>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {tree.length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? "Keine Konten gefunden für diese Suche." : "Noch keine Konten vorhanden."}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kontenplan importieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Laden Sie eine Excel-/CSV-Datei oder ein PDF mit dem Kontenplan hoch.
              Bei Excel/CSV werden die Spalten "Nummer" und "Name" automatisch erkannt.
              Bei PDF wird der Kontenplan per KI extrahiert.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isPdfParsing}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel/CSV
              </Button>
              <Button variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={isPdfParsing}>
                {isPdfParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                {isPdfParsing ? "KI analysiert..." : "PDF/Bild"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const XLSX = await import("xlsx");
                    const data = await file.arrayBuffer();
                    const wb = XLSX.read(data);
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
                    // Helper: find column value by trying multiple header variants (with/without *)
                    const getCol = (r: Record<string, any>, ...keys: string[]) => {
                      for (const k of keys) {
                        if (r[k] !== undefined && r[k] !== null) return String(r[k]).trim();
                        if (r[k + "*"] !== undefined && r[k + "*"] !== null) return String(r[k + "*"]).trim();
                      }
                      return "";
                    };
                    // Map Kontoart from file to internal type
                    const mapAccountType = (kontoart: string, num: number): string => {
                      const lower = kontoart.toLowerCase();
                      if (lower === "aktiv" || lower === "aktiva" || lower === "asset") return "asset";
                      if (lower === "passiv" || lower === "passiva" || lower === "liability") return "liability";
                      if (lower === "aufwand" || lower === "expense") return "expense";
                      if (lower === "ertrag" || lower === "revenue" || lower === "income") return "revenue";
                      if (lower === "komplett" || lower === "equity" || lower === "eigenkapital") return "equity";
                      // Fallback: determine from account number
                      if (num >= 1000 && num < 2000) return "asset";
                      if (num >= 2000 && num < 2800) return "liability";
                      if (num >= 2800 && num < 3000) return "equity";
                      if (num >= 3000 && num < 4000) return "revenue";
                      if (num >= 4000 && num < 9000) return "expense";
                      if (num >= 9000) return "equity";
                      return "expense";
                    };
                    // Automatische Kategorie-Zuordnung nach Schweizer KMU-Kontenrahmen
                    const autoCategory = (num: number): { category: string; subCategory: string } => {
                      if (num >= 1000 && num < 1100) return { category: "Umlaufverm\u00f6gen", subCategory: "Fl\u00fcssige Mittel" };
                      if (num >= 1100 && num < 1200) return { category: "Umlaufverm\u00f6gen", subCategory: "Kurzfristige Forderungen" };
                      if (num >= 1200 && num < 1300) return { category: "Umlaufverm\u00f6gen", subCategory: "Vorr\u00e4te" };
                      if (num >= 1300 && num < 1400) return { category: "Umlaufverm\u00f6gen", subCategory: "Aktive Rechnungsabgrenzung" };
                      if (num >= 1400 && num < 1500) return { category: "Anlageverm\u00f6gen", subCategory: "Finanzanlagen" };
                      if (num >= 1500 && num < 1600) return { category: "Anlageverm\u00f6gen", subCategory: "Mobile Sachanlagen" };
                      if (num >= 1600 && num < 1700) return { category: "Anlageverm\u00f6gen", subCategory: "Immobile Sachanlagen" };
                      if (num >= 1700 && num < 2000) return { category: "Anlageverm\u00f6gen", subCategory: "Immaterielle Anlagen" };
                      if (num >= 2000 && num < 2100) return { category: "Kurzfristiges Fremdkapital", subCategory: "Kurzfristige Verbindlichkeiten" };
                      if (num >= 2100 && num < 2200) return { category: "Kurzfristiges Fremdkapital", subCategory: "Kurzfristige Finanzverbindlichkeiten" };
                      if (num >= 2200 && num < 2300) return { category: "Kurzfristiges Fremdkapital", subCategory: "Passive Rechnungsabgrenzung" };
                      if (num >= 2300 && num < 2400) return { category: "Kurzfristiges Fremdkapital", subCategory: "Kurzfristige R\u00fcckstellungen" };
                      if (num >= 2400 && num < 2500) return { category: "Langfristiges Fremdkapital", subCategory: "Langfristige Finanzverbindlichkeiten" };
                      if (num >= 2500 && num < 2600) return { category: "Langfristiges Fremdkapital", subCategory: "Langfristige R\u00fcckstellungen" };
                      if (num >= 2600 && num < 2800) return { category: "Langfristiges Fremdkapital", subCategory: "\u00dcbrige langfristige Verbindlichkeiten" };
                      if (num >= 2800 && num < 2900) return { category: "Eigenkapital", subCategory: "Grund-/Stammkapital" };
                      if (num >= 2900 && num < 3000) return { category: "Eigenkapital", subCategory: "Reserven / Gewinnvortrag" };
                      if (num >= 3000 && num < 3200) return { category: "Betriebsertrag", subCategory: "Produktionsertrag" };
                      if (num >= 3200 && num < 3400) return { category: "Betriebsertrag", subCategory: "Handelsertrag" };
                      if (num >= 3400 && num < 3600) return { category: "Betriebsertrag", subCategory: "Dienstleistungsertrag" };
                      if (num >= 3600 && num < 3800) return { category: "Betriebsertrag", subCategory: "\u00dcbriger Ertrag" };
                      if (num >= 3800 && num < 4000) return { category: "Betriebsertrag", subCategory: "Erl\u00f6sminderungen" };
                      if (num >= 4000 && num < 4500) return { category: "Aufwand f\u00fcr Material/Waren", subCategory: "Materialaufwand" };
                      if (num >= 4500 && num < 5000) return { category: "Aufwand f\u00fcr Material/Waren", subCategory: "Drittleistungen" };
                      if (num >= 5000 && num < 5800) return { category: "Personalaufwand", subCategory: "L\u00f6hne und Geh\u00e4lter" };
                      if (num >= 5800 && num < 6000) return { category: "Personalaufwand", subCategory: "Sozialversicherungsaufwand" };
                      if (num >= 6000 && num < 6100) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Raumaufwand" };
                      if (num >= 6100 && num < 6200) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Unterhalt und Reparaturen" };
                      if (num >= 6200 && num < 6300) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Fahrzeugaufwand" };
                      if (num >= 6300 && num < 6400) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Versicherungen" };
                      if (num >= 6400 && num < 6500) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Energie und Entsorgung" };
                      if (num >= 6500 && num < 6600) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Verwaltungsaufwand" };
                      if (num >= 6600 && num < 6700) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Informatikaufwand" };
                      if (num >= 6700 && num < 6800) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "\u00dcbriger Betriebsaufwand" };
                      if (num >= 6800 && num < 6900) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Abschreibungen" };
                      if (num >= 6900 && num < 7000) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Finanzaufwand" };
                      if (num >= 7000 && num < 7500) return { category: "Betriebsfremder Aufwand/Ertrag", subCategory: "Betriebsfremder Ertrag" };
                      if (num >= 7500 && num < 8000) return { category: "Betriebsfremder Aufwand/Ertrag", subCategory: "Betriebsfremder Aufwand" };
                      if (num >= 8000 && num < 8500) return { category: "Ausserordentlicher Aufwand/Ertrag", subCategory: "Ausserordentlicher Ertrag" };
                      if (num >= 8500 && num < 9000) return { category: "Ausserordentlicher Aufwand/Ertrag", subCategory: "Ausserordentlicher Aufwand" };
                      if (num >= 9000) return { category: "Abschluss", subCategory: "Abschlusskonten" };
                      return { category: "", subCategory: "" };
                    };
                    const parsed = rows.map((r: Record<string, any>) => {
                      const num = getCol(r, "Nummer", "Konto", "Nr", "number", "Account", "Kontonummer");
                      const name = getCol(r, "Name", "Bezeichnung", "Kontoname", "name", "Description");
                      const kontoart = getCol(r, "Kontoart", "Typ", "Type", "accountType", "Art");
                      const gruppe = getCol(r, "Gruppe", "Group", "Kategorie", "category");
                      const n = parseInt(num);
                      // Skip group/header rows (numbers < 1000 are typically group headers)
                      if (isNaN(n) || n < 1000) return null;
                      // Skip rows explicitly marked as "Gruppe"
                      if (kontoart.toLowerCase() === "gruppe" || kontoart.toLowerCase() === "group") return null;
                      const accountType = mapAccountType(kontoart, n);
                      // Auto-assign category from file or from number-based rules
                      const fileCat = getCol(r, "Kategorie", "category");
                      const fileSub = getCol(r, "Unterkategorie", "subCategory");
                      const auto = autoCategory(n);
                      const cat = fileCat || auto.category || undefined;
                      const sub = fileSub || auto.subCategory || undefined;
                      return { number: num, name, accountType, category: cat, subCategory: sub };
                    }).filter((a): a is NonNullable<typeof a> => a !== null && !!a.number && !!a.name);
                    setImportPreview(parsed);
                    toast.success(`${parsed.length} Konten aus Datei gelesen`);
                  } catch (err) {
                    toast.error("Fehler beim Lesen der Datei");
                  }
                  e.target.value = "";
                }}
              />
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsPdfParsing(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const resp = await fetch("/api/upload/chart-of-accounts-pdf", {
                      method: "POST",
                      body: formData,
                    });
                    if (!resp.ok) {
                      const err = await resp.json().catch(() => ({}));
                      throw new Error(err.error || "Upload fehlgeschlagen");
                    }
                    const result = await resp.json();
                    // Reuse autoCategory for PDF-imported accounts
                    const autoCatPdf = (num: number): { category: string; subCategory: string } => {
                      if (num >= 1000 && num < 1100) return { category: "Umlaufverm\u00f6gen", subCategory: "Fl\u00fcssige Mittel" };
                      if (num >= 1100 && num < 1200) return { category: "Umlaufverm\u00f6gen", subCategory: "Kurzfristige Forderungen" };
                      if (num >= 1200 && num < 1300) return { category: "Umlaufverm\u00f6gen", subCategory: "Vorr\u00e4te" };
                      if (num >= 1300 && num < 1400) return { category: "Umlaufverm\u00f6gen", subCategory: "Aktive Rechnungsabgrenzung" };
                      if (num >= 1400 && num < 1500) return { category: "Anlageverm\u00f6gen", subCategory: "Finanzanlagen" };
                      if (num >= 1500 && num < 1600) return { category: "Anlageverm\u00f6gen", subCategory: "Mobile Sachanlagen" };
                      if (num >= 1600 && num < 1700) return { category: "Anlageverm\u00f6gen", subCategory: "Immobile Sachanlagen" };
                      if (num >= 1700 && num < 2000) return { category: "Anlageverm\u00f6gen", subCategory: "Immaterielle Anlagen" };
                      if (num >= 2000 && num < 2100) return { category: "Kurzfristiges Fremdkapital", subCategory: "Kurzfristige Verbindlichkeiten" };
                      if (num >= 2100 && num < 2200) return { category: "Kurzfristiges Fremdkapital", subCategory: "Kurzfristige Finanzverbindlichkeiten" };
                      if (num >= 2200 && num < 2300) return { category: "Kurzfristiges Fremdkapital", subCategory: "Passive Rechnungsabgrenzung" };
                      if (num >= 2300 && num < 2400) return { category: "Kurzfristiges Fremdkapital", subCategory: "Kurzfristige R\u00fcckstellungen" };
                      if (num >= 2400 && num < 2500) return { category: "Langfristiges Fremdkapital", subCategory: "Langfristige Finanzverbindlichkeiten" };
                      if (num >= 2500 && num < 2600) return { category: "Langfristiges Fremdkapital", subCategory: "Langfristige R\u00fcckstellungen" };
                      if (num >= 2600 && num < 2800) return { category: "Langfristiges Fremdkapital", subCategory: "\u00dcbrige langfristige Verbindlichkeiten" };
                      if (num >= 2800 && num < 2900) return { category: "Eigenkapital", subCategory: "Grund-/Stammkapital" };
                      if (num >= 2900 && num < 3000) return { category: "Eigenkapital", subCategory: "Reserven / Gewinnvortrag" };
                      if (num >= 3000 && num < 3200) return { category: "Betriebsertrag", subCategory: "Produktionsertrag" };
                      if (num >= 3200 && num < 3400) return { category: "Betriebsertrag", subCategory: "Handelsertrag" };
                      if (num >= 3400 && num < 3600) return { category: "Betriebsertrag", subCategory: "Dienstleistungsertrag" };
                      if (num >= 3600 && num < 3800) return { category: "Betriebsertrag", subCategory: "\u00dcbriger Ertrag" };
                      if (num >= 3800 && num < 4000) return { category: "Betriebsertrag", subCategory: "Erl\u00f6sminderungen" };
                      if (num >= 4000 && num < 4500) return { category: "Aufwand f\u00fcr Material/Waren", subCategory: "Materialaufwand" };
                      if (num >= 4500 && num < 5000) return { category: "Aufwand f\u00fcr Material/Waren", subCategory: "Drittleistungen" };
                      if (num >= 5000 && num < 5800) return { category: "Personalaufwand", subCategory: "L\u00f6hne und Geh\u00e4lter" };
                      if (num >= 5800 && num < 6000) return { category: "Personalaufwand", subCategory: "Sozialversicherungsaufwand" };
                      if (num >= 6000 && num < 6100) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Raumaufwand" };
                      if (num >= 6100 && num < 6200) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Unterhalt und Reparaturen" };
                      if (num >= 6200 && num < 6300) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Fahrzeugaufwand" };
                      if (num >= 6300 && num < 6400) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Versicherungen" };
                      if (num >= 6400 && num < 6500) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Energie und Entsorgung" };
                      if (num >= 6500 && num < 6600) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Verwaltungsaufwand" };
                      if (num >= 6600 && num < 6700) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Informatikaufwand" };
                      if (num >= 6700 && num < 6800) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "\u00dcbriger Betriebsaufwand" };
                      if (num >= 6800 && num < 6900) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Abschreibungen" };
                      if (num >= 6900 && num < 7000) return { category: "\u00dcbriger Betriebsaufwand", subCategory: "Finanzaufwand" };
                      if (num >= 7000 && num < 7500) return { category: "Betriebsfremder Aufwand/Ertrag", subCategory: "Betriebsfremder Ertrag" };
                      if (num >= 7500 && num < 8000) return { category: "Betriebsfremder Aufwand/Ertrag", subCategory: "Betriebsfremder Aufwand" };
                      if (num >= 8000 && num < 8500) return { category: "Ausserordentlicher Aufwand/Ertrag", subCategory: "Ausserordentlicher Ertrag" };
                      if (num >= 8500 && num < 9000) return { category: "Ausserordentlicher Aufwand/Ertrag", subCategory: "Ausserordentlicher Aufwand" };
                      if (num >= 9000) return { category: "Abschluss", subCategory: "Abschlusskonten" };
                      return { category: "", subCategory: "" };
                    };
                    if (result.accounts && result.accounts.length > 0) {
                      setImportPreview(result.accounts.map((a: any) => {
                        const n = parseInt(a.number);
                        const auto = autoCatPdf(isNaN(n) ? 0 : n);
                        return {
                          number: a.number,
                          name: a.name,
                          accountType: a.accountType,
                          category: auto.category || undefined,
                          subCategory: auto.subCategory || undefined,
                        };
                      }));
                      toast.success(`${result.accounts.length} Konten per KI aus PDF extrahiert`);
                    } else {
                      toast.error("Keine Konten im PDF gefunden");
                    }
                  } catch (err: any) {
                    toast.error(err.message || "PDF-Analyse fehlgeschlagen");
                  } finally {
                    setIsPdfParsing(false);
                  }
                  e.target.value = "";
                }}
              />
              <Select value={importMode} onValueChange={(v: any) => setImportMode(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Zusammenführen (Merge)</SelectItem>
                  <SelectItem value="replace">Ersetzen (Replace)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {importMode === "replace" && (
              <p className="text-sm text-destructive">
                Achtung: Im Ersetzen-Modus werden alle Konten ohne Buchungen gelöscht und durch die importierten ersetzt.
              </p>
            )}
            {importPreview.length > 0 && (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Kategorie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.slice(0, 50).map((a, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{a.number}</TableCell>
                        <TableCell className="text-sm">{a.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{ACCOUNT_TYPE_LABELS[a.accountType] || a.accountType}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.category || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importPreview.length > 50 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">... und {importPreview.length - 50} weitere</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImport(false); setImportPreview([]); }}>Abbrechen</Button>
            <Button
              onClick={() => bulkImportMut.mutate({ accounts: importPreview as any, mode: importMode })}
              disabled={importPreview.length === 0 || bulkImportMut.isPending}
            >
              {bulkImportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              {importPreview.length} Konten importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KMU Template Confirm Dialog */}
      <Dialog open={showKmuConfirm} onOpenChange={setShowKmuConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schweizer KMU-Kontenrahmen laden</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {kmuTemplate?.description}
            </p>
            <p className="text-sm">
              Der Standard-Kontenplan enthält <strong>{kmuTemplate?.accounts.length ?? 0} Konten</strong> nach dem
              Käfer-Kontenrahmen. Bestehende Konten mit gleicher Nummer werden aktualisiert, neue werden hinzugefügt.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKmuConfirm(false)}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (kmuTemplate) {
                  bulkImportMut.mutate({ accounts: kmuTemplate.accounts as any, mode: "merge" });
                  setShowKmuConfirm(false);
                }
              }}
              disabled={bulkImportMut.isPending}
            >
              {bulkImportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LayoutTemplate className="h-4 w-4 mr-1" />}
              KMU-Vorlage laden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sortable Account Components ────────────────────────────────────────────────

function SortableAccountRow({ id, dragEnabled, children }: { id: number; dragEnabled: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !dragEnabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(dragEnabled ? listeners : {})}>
      {children}
    </div>
  );
}

function SortableAccountList({ accounts, dragEnabled, onDragEnd, children }: {
  accounts: AccountRow[];
  dragEnabled: boolean;
  onDragEnd: (oldIndex: number, newIndex: number) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = accounts.findIndex(a => a.id === active.id);
    const newIndex = accounts.findIndex(a => a.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onDragEnd(oldIndex, newIndex);
    }
  };

  if (!dragEnabled) {
    return <div className="pl-6">{children}</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={accounts.map(a => a.id)} strategy={verticalListSortingStrategy}>
        <div className="pl-6">{children}</div>
      </SortableContext>
    </DndContext>
  );
}


// ─── DSG (Datenschutz) Tab ───────────────────────────────────────────────────

function DsgTab() {
  const [activeSection, setActiveSection] = useReactState<"audit" | "export" | "privacy">("audit");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Datenschutz (DSG-Konformität)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Funktionen zur Einhaltung des Schweizer Datenschutzgesetzes (DSG, in Kraft seit 1. September 2023).
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {[
          { id: "audit" as const, label: "Audit-Log", icon: ClipboardList },
          { id: "export" as const, label: "Datenexport / Löschung", icon: Download },
          { id: "privacy" as const, label: "Datenschutzerklärung", icon: FileText },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-t-lg transition-colors ${
              activeSection === s.id
                ? "bg-primary/10 text-primary font-medium border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "audit" && <AuditLogSection />}
      {activeSection === "export" && <DataExportSection />}
      {activeSection === "privacy" && <PrivacySection />}
    </div>
  );
}

// ─── Audit Log Section ───────────────────────────────────────────────────────

function AuditLogSection() {
  const [page, setPage] = useReactState(1);
  const [actionFilter, setActionFilter] = useReactState<string>("");
  const [entityFilter, setEntityFilter] = useReactState("");

  const { data, isLoading } = trpc.dsg.auditLog.useQuery({
    page,
    pageSize: 30,
    action: actionFilter ? actionFilter as any : undefined,
    entityType: entityFilter || undefined,
  });

  const actionLabels: Record<string, string> = {
    create: "Erstellt",
    read: "Gelesen",
    update: "Geändert",
    delete: "Gelöscht",
    export: "Exportiert",
    login: "Anmeldung",
    logout: "Abmeldung",
  };

  const actionColors: Record<string, string> = {
    create: "bg-green-100 text-green-800",
    read: "bg-blue-100 text-blue-800",
    update: "bg-yellow-100 text-yellow-800",
    delete: "bg-red-100 text-red-800",
    export: "bg-purple-100 text-purple-800",
    login: "bg-cyan-100 text-cyan-800",
    logout: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit-Log</CardTitle>
          <CardDescription>Protokoll aller datenschutzrelevanten Aktionen (Art. 7 DSG: Datensicherheit)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Aktionen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                <SelectItem value="create">Erstellt</SelectItem>
                <SelectItem value="read">Gelesen</SelectItem>
                <SelectItem value="update">Geändert</SelectItem>
                <SelectItem value="delete">Gelöscht</SelectItem>
                <SelectItem value="export">Exportiert</SelectItem>
                <SelectItem value="login">Anmeldung</SelectItem>
                <SelectItem value="logout">Abmeldung</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
              placeholder="Entitätstyp filtern..."
              className="w-[200px]"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Benutzer</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead>Entität</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.entries?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Noch keine Audit-Log-Einträge vorhanden.
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.entries?.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString("de-CH")}
                      </TableCell>
                      <TableCell className="text-sm">{entry.userName ?? entry.userId}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={actionColors[entry.action] ?? ""}>
                          {actionLabels[entry.action] ?? entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{entry.entityType}{entry.entityId ? ` #${entry.entityId}` : ""}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{entry.details}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data && data.total > 30 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Seite {data.page} von {Math.ceil(data.total / data.pageSize)}
                    {" "}({data.total} Einträge)
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Zurück</Button>
                    <Button variant="outline" size="sm" disabled={page * 30 >= data.total} onClick={() => setPage(p => p + 1)}>Weiter</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Data Export / Anonymization Section ─────────────────────────────────────

function DataExportSection() {
  const { data: emps } = trpc.payroll.getEmployees.useQuery();
  const [selectedEmp, setSelectedEmp] = useReactState<string>("");
  const [exportFormat, setExportFormat] = useReactState<"json" | "csv">("json");
  const [confirmName, setConfirmName] = useReactState("");
  const [showAnonymize, setShowAnonymize] = useReactState(false);

  const exportMut = trpc.dsg.exportPersonalData.useMutation({
    onSuccess: (result) => {
      // Download the file
      const blob = new Blob([result.data], { type: result.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Datenexport erstellt");
    },
    onError: (e) => toast.error(e.message),
  });

  const anonymizeMut = trpc.dsg.anonymizeEmployee.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setShowAnonymize(false);
      setConfirmName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedEmployee = emps?.find(e => String(e.id) === selectedEmp);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datenexport (Art. 25 DSG – Auskunftsrecht)</CardTitle>
          <CardDescription>
            Exportieren Sie alle personenbezogenen Daten eines Mitarbeiters. Dies umfasst Stammdaten, Lohnabrechnungen und Audit-Protokoll.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Mitarbeiter</Label>
              <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                <SelectContent>
                  {emps?.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  if (!selectedEmp) { toast.error("Bitte Mitarbeiter wählen"); return; }
                  exportMut.mutate({ employeeId: parseInt(selectedEmp), format: exportFormat });
                }}
                disabled={!selectedEmp || exportMut.isPending}
              >
                {exportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Exportieren
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Datenanonymisierung (Löschungsrecht)
          </CardTitle>
          <CardDescription>
            Anonymisieren Sie personenbezogene Daten eines ehemaligen Mitarbeiters. Die Buchhaltungsdaten bleiben erhalten,
            aber alle personenbezogenen Informationen (Name, AHV-Nr., Adresse, Geburtsdatum) werden unwiderruflich entfernt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm">
            <p className="font-medium text-destructive">Achtung: Diese Aktion kann nicht rückgängig gemacht werden!</p>
            <p className="text-muted-foreground mt-1">
              Mitarbeiter mit Lohnabrechnungen im aktuellen Jahr können nicht anonymisiert werden.
              Gesetzliche Aufbewahrungsfristen (10 Jahre) müssen beachtet werden.
            </p>
          </div>

          {selectedEmployee && (
            <div className="space-y-3">
              <p className="text-sm">
                Ausgewählter Mitarbeiter: <strong>{selectedEmployee.firstName} {selectedEmployee.lastName}</strong>
              </p>
              {!showAnonymize ? (
                <Button variant="destructive" size="sm" onClick={() => setShowAnonymize(true)}>
                  <UserX className="h-4 w-4 mr-2" />
                  Anonymisierung starten
                </Button>
              ) : (
                <div className="space-y-3 border rounded-lg p-4">
                  <Label>Zur Bestätigung den vollen Namen eingeben:</Label>
                  <Input
                    value={confirmName}
                    onChange={e => setConfirmName(e.target.value)}
                    placeholder={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={confirmName !== `${selectedEmployee.firstName} ${selectedEmployee.lastName}` || anonymizeMut.isPending}
                      onClick={() => anonymizeMut.mutate({ employeeId: parseInt(selectedEmp), confirmName })}
                    >
                      {anonymizeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Unwiderruflich anonymisieren
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowAnonymize(false); setConfirmName(""); }}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!selectedEmployee && (
            <p className="text-sm text-muted-foreground">Bitte wählen Sie oben einen Mitarbeiter aus.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Privacy Policy Section ──────────────────────────────────────────────────

function PrivacySection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datenschutzerklärung</CardTitle>
          <CardDescription>Gemäss dem Schweizer Datenschutzgesetz (DSG), in Kraft seit 1. September 2023</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground">
          <h3 className="text-base font-semibold mt-0">1. Verantwortliche Stelle</h3>
          <p>
            Die in den Unternehmens­einstellungen hinterlegte Firma ist verantwortlich
            für die Bearbeitung der Personendaten in dieser Anwendung. Bei Fragen
            zum Datenschutz wenden Sie sich bitte an die Geschäftsleitung.
          </p>

          <h3 className="text-base font-semibold">2. Erhobene Daten</h3>
          <p>Im Rahmen der Buchhaltung werden folgende personenbezogene Daten bearbeitet:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Mitarbeiterdaten: Name, Adresse, AHV-Nummer, Geburtsdatum, Anstellungsdaten</li>
            <li>Lohndaten: Bruttolohn, Abzüge, Nettolohn, Sozialversicherungsbeiträge</li>
            <li>Bankdaten: IBAN-Nummern für Zahlungsverkehr</li>
            <li>Nutzungsdaten: Anmeldezeitpunkte, durchgeführte Aktionen (Audit-Log)</li>
          </ul>

          <h3 className="text-base font-semibold">3. Zweck der Datenbearbeitung</h3>
          <p>
            Die Daten werden ausschliesslich für die Führung der Buchhaltung, Lohnbuchhaltung,
            den Zahlungsverkehr und die Erfüllung gesetzlicher Pflichten (MWST, Sozialversicherungen,
            Steuern) bearbeitet.
          </p>

          <h3 className="text-base font-semibold">4. Datensicherheit (Art. 8 DSG)</h3>
          <p>
            Die Anwendung setzt technische und organisatorische Massnahmen zum Schutz der Daten ein:
            verschlüsselte Übertragung (HTTPS/TLS), Zugriffskontrolle durch Authentifizierung,
            Audit-Logging aller datenschutzrelevanten Aktionen, und regelmässige Datensicherung.
          </p>

          <h3 className="text-base font-semibold">5. Auskunftsrecht (Art. 25 DSG)</h3>
          <p>
            Betroffene Personen haben das Recht, Auskunft über die zu ihrer Person bearbeiteten Daten
            zu verlangen. Der Datenexport kann unter «Datenexport / Löschung» durchgeführt werden.
          </p>

          <h3 className="text-base font-semibold">6. Recht auf Löschung (Art. 32 DSG)</h3>
          <p>
            Betroffene Personen können die Löschung (Anonymisierung) ihrer Daten verlangen, sofern
            keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Die Anonymisierung kann unter
            «Datenexport / Löschung» durchgeführt werden.
          </p>

          <h3 className="text-base font-semibold">7. Aufbewahrungsfristen</h3>
          <p>
            Buchhaltungsunterlagen werden gemäss Art. 958f OR während 10 Jahren aufbewahrt.
            Lohnausweise und Sozialversicherungsabrechnungen unterliegen ebenfalls gesetzlichen
            Aufbewahrungsfristen. Nach Ablauf der Fristen werden die Daten gelöscht oder anonymisiert.
          </p>

          <h3 className="text-base font-semibold">8. Datenübermittlung</h3>
          <p>
            Personendaten werden nicht an Dritte weitergegeben, ausser zur Erfüllung gesetzlicher
            Pflichten (Steuerbehörden, Sozialversicherungen) oder mit ausdrücklicher Einwilligung
            der betroffenen Person.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


// ─── Suppliers (Lieferanten) Tab ─────────────────────────────────────────────

function SuppliersTab() {
  const [search, setSearch] = useReactState("");
  const [showInactive, setShowInactive] = useReactState(false);
  const [showDialog, setShowDialog] = useReactState(false);
  const [editSupplier, setEditSupplier] = useReactState<any>(null);
  const [showImportDialog, setShowImportDialog] = useReactState(false);
  const [importPreview, setImportPreview] = useReactState<Array<{name:string;street?:string;zipCode?:string;city?:string;country?:string;iban?:string;bic?:string;paymentTermDays?:number;contactPerson?:string;email?:string;phone?:string;notes?:string}>>([]);

  // Form state
  const [formName, setFormName] = useReactState("");
  const [formStreet, setFormStreet] = useReactState("");
  const [formZip, setFormZip] = useReactState("");
  const [formCity, setFormCity] = useReactState("");
  const [formCountry, setFormCountry] = useReactState("Schweiz");
  const [formIban, setFormIban] = useReactState("");
  const [formBic, setFormBic] = useReactState("");
  const [formPaymentDays, setFormPaymentDays] = useReactState("30");
  const [formContact, setFormContact] = useReactState("");
  const [formEmail, setFormEmail] = useReactState("");
  const [formPhone, setFormPhone] = useReactState("");
  const [formNotes, setFormNotes] = useReactState("");
  const [formAccountId, setFormAccountId] = useReactState<string>("");
  const [formMatchPattern, setFormMatchPattern] = useReactState("");

  const { data: suppliersList, refetch } = trpc.suppliers.list.useQuery({
    includeInactive: showInactive,
    search: search || undefined,
  });
  const { data: accountsList } = trpc.accounts.list.useQuery();
  const expenseAccounts = useMemo(() =>
    (accountsList ?? []).filter(a => a.accountType === "expense" && a.isActive).sort((a, b) => a.number.localeCompare(b.number)),
    [accountsList]
  );

  const createMut = trpc.suppliers.create.useMutation({
    onSuccess: () => { toast.success("Lieferant erstellt"); refetch(); setShowDialog(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.suppliers.update.useMutation({
    onSuccess: () => { toast.success("Lieferant aktualisiert"); refetch(); setShowDialog(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.suppliers.delete.useMutation({
    onSuccess: () => { toast.success("Lieferant deaktiviert"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const importFromDocsMut = trpc.suppliers.importFromDocuments.useMutation({
    onSuccess: (data) => {
      toast.success(`Import: ${data.created} erstellt, ${data.linked} verknüpft, ${data.skipped} übersprungen`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const importFromListMut = trpc.suppliers.importFromList.useMutation({
    onSuccess: (data) => {
      toast.success(`Import: ${data.created} erstellt, ${data.skipped} übersprungen`);
      refetch();
      setShowImportDialog(false);
      setImportPreview([]);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormName(""); setFormStreet(""); setFormZip(""); setFormCity("");
    setFormCountry("Schweiz"); setFormIban(""); setFormBic("");
    setFormPaymentDays("30"); setFormContact(""); setFormEmail("");
    setFormPhone(""); setFormNotes(""); setFormAccountId(""); setFormMatchPattern("");
    setEditSupplier(null);
  }

  function openCreate() {
    resetForm();
    setShowDialog(true);
  }

  function openEdit(s: any) {
    setEditSupplier(s);
    setFormName(s.name || "");
    setFormStreet(s.street || "");
    setFormZip(s.zipCode || "");
    setFormCity(s.city || "");
    setFormCountry(s.country || "Schweiz");
    setFormIban(s.iban || "");
    setFormBic(s.bic || "");
    setFormPaymentDays(String(s.paymentTermDays ?? 30));
    setFormContact(s.contactPerson || "");
    setFormEmail(s.email || "");
    setFormPhone(s.phone || "");
    setFormNotes(s.notes || "");
    setFormAccountId(s.defaultDebitAccountId ? String(s.defaultDebitAccountId) : "");
    setFormMatchPattern(s.matchPattern || "");
    setShowDialog(true);
  }

  function handleSave() {
    if (!formName.trim()) { toast.error("Name ist erforderlich"); return; }
    const data = {
      name: formName.trim(),
      street: formStreet || undefined,
      zipCode: formZip || undefined,
      city: formCity || undefined,
      country: formCountry || undefined,
      iban: formIban || undefined,
      bic: formBic || undefined,
      paymentTermDays: parseInt(formPaymentDays) || 30,
      contactPerson: formContact || undefined,
      email: formEmail || undefined,
      phone: formPhone || undefined,
      notes: formNotes || undefined,
      defaultDebitAccountId: formAccountId ? parseInt(formAccountId) : undefined,
      matchPattern: formMatchPattern || undefined,
    };
    if (editSupplier) {
      updateMut.mutate({ id: editSupplier.id, ...data });
    } else {
      createMut.mutate(data);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      const parsed = rows.map((r: Record<string, any>) => {
        const name = String(r["Name"] ?? r["Firma"] ?? r["Lieferant"] ?? r["name"] ?? r["company"] ?? "").trim();
        const street = String(r["Strasse"] ?? r["Adresse"] ?? r["street"] ?? r["address"] ?? "").trim() || undefined;
        const zipCode = String(r["PLZ"] ?? r["Postleitzahl"] ?? r["zipCode"] ?? r["zip"] ?? "").trim() || undefined;
        const city = String(r["Ort"] ?? r["Stadt"] ?? r["city"] ?? "").trim() || undefined;
        const country = String(r["Land"] ?? r["country"] ?? "").trim() || undefined;
        const iban = String(r["IBAN"] ?? r["iban"] ?? "").trim() || undefined;
        const bic = String(r["BIC"] ?? r["SWIFT"] ?? r["bic"] ?? "").trim() || undefined;
        const paymentTermDays = parseInt(String(r["Zahlungsfrist"] ?? r["paymentTermDays"] ?? r["Tage"] ?? "")) || undefined;
        const contactPerson = String(r["Kontakt"] ?? r["Kontaktperson"] ?? r["contactPerson"] ?? "").trim() || undefined;
        const email = String(r["E-Mail"] ?? r["Email"] ?? r["email"] ?? "").trim() || undefined;
        const phone = String(r["Telefon"] ?? r["Tel"] ?? r["phone"] ?? "").trim() || undefined;
        const notes = String(r["Notizen"] ?? r["Bemerkung"] ?? r["notes"] ?? "").trim() || undefined;
        return { name, street, zipCode, city, country, iban, bic, paymentTermDays, contactPerson, email, phone, notes };
      }).filter(s => s.name.length > 0);
      setImportPreview(parsed);
      toast.success(`${parsed.length} Lieferanten aus Datei gelesen`);
    } catch (err) {
      toast.error("Fehler beim Lesen der Datei");
    }
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lieferanten-Stammdaten</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lieferanten mit IBAN, Zahlungsfristen und Kontaktdaten für ISO 20022 Zahlungen
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => importFromDocsMut.mutate()} disabled={importFromDocsMut.isPending}>
            {importFromDocsMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Aus Rechnungen
          </Button>
          <Button variant="outline" onClick={() => { setShowImportDialog(true); setImportPreview([]); }}>
            <Upload className="h-4 w-4 mr-2" /> CSV/Excel Import
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Neuer Lieferant
          </Button>
        </div>
      </div>

      {/* Import from documents result */}
      {importFromDocsMut.data && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span className="font-medium">Rechnungs-Import abgeschlossen:</span>
              <span>{importFromDocsMut.data.created} neu erstellt, {importFromDocsMut.data.linked} verknüpft, {importFromDocsMut.data.skipped} übersprungen</span>
              <span className="text-muted-foreground">({importFromDocsMut.data.total} Rechnungen geprüft)</span>
            </div>
            {importFromDocsMut.data.details.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto">
                {importFromDocsMut.data.details.map((d, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    {d.supplierName} – {d.action}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Input
          placeholder="Suche nach Name, Ort oder IBAN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          <Label className="text-sm text-muted-foreground">Inaktive anzeigen</Label>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead>Zahlungsfrist</TableHead>
                <TableHead>Aufwandkonto</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!suppliersList || suppliersList.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Keine Lieferanten erfasst
                  </TableCell>
                </TableRow>
              ) : suppliersList.map(s => (
                <TableRow key={s.id} className={!s.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {s.name}
                    {!s.isActive && <Badge variant="secondary" className="ml-2 text-xs">Inaktiv</Badge>}
                    {s.notes === "Automatisch aus Rechnung erstellt" && <Badge variant="outline" className="ml-2 text-xs text-blue-600 border-blue-300">Auto</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[s.street, [s.zipCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {s.iban ? s.iban.replace(/(.{4})/g, "$1 ").trim() : <span className="text-orange-500 text-xs">Keine IBAN</span>}
                  </TableCell>
                  <TableCell className="text-sm">{s.paymentTermDays} Tage</TableCell>
                  <TableCell className="text-sm">
                    {(s as any).defaultDebitAccount
                      ? `${(s as any).defaultDebitAccount.number} ${(s as any).defaultDebitAccount.name}`
                      : <span className="text-muted-foreground">–</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.contactPerson || s.email || s.phone || "–"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {s.isActive && (
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => {
                          if (confirm(`Lieferant "${s.name}" wirklich deaktivieren?`)) {
                            deleteMut.mutate({ id: s.id });
                          }
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSupplier ? "Lieferant bearbeiten" : "Neuer Lieferant"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="z.B. AXA Versicherungen AG" />
              </div>
              <div>
                <Label>Kontaktperson</Label>
                <Input value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="Max Mustermann" />
              </div>
            </div>
            <div>
              <Label>Strasse</Label>
              <Input value={formStreet} onChange={e => setFormStreet(e.target.value)} placeholder="Musterstrasse 1" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>PLZ</Label>
                <Input value={formZip} onChange={e => setFormZip(e.target.value)} placeholder="6000" />
              </div>
              <div>
                <Label>Ort</Label>
                <Input value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="Luzern" />
              </div>
              <div>
                <Label>Land</Label>
                <Input value={formCountry} onChange={e => setFormCountry(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>IBAN</Label>
                <Input value={formIban} onChange={e => setFormIban(e.target.value)} placeholder="CH93 0076 2011 6238 5295 7" className="font-mono" />
              </div>
              <div>
                <Label>BIC / SWIFT</Label>
                <Input value={formBic} onChange={e => setFormBic(e.target.value)} placeholder="UBSWCHZH80A" className="font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>E-Mail</Label>
                <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} type="email" placeholder="info@lieferant.ch" />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+41 41 000 00 00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Zahlungsfrist (Tage)</Label>
                <Input value={formPaymentDays} onChange={e => setFormPaymentDays(e.target.value)} type="number" />
              </div>
              <div>
                <Label>Standard-Aufwandkonto</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger><SelectValue placeholder="Konto wählen" /></SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Match-Pattern (für Bankimport)</Label>
              <Input value={formMatchPattern} onChange={e => setFormMatchPattern(e.target.value)} placeholder="z.B. AXA, Mobility, Swisscom" />
              <p className="text-xs text-muted-foreground mt-1">
                Komma-getrennte Begriffe, die in Bankimport-Transaktionen automatisch diesem Lieferanten zugeordnet werden.
              </p>
            </div>
            <div>
              <Label>Notizen</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Interne Notizen..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editSupplier ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV/Excel Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) { setShowImportDialog(false); setImportPreview([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lieferanten importieren (CSV/Excel)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Laden Sie eine Excel- oder CSV-Datei hoch. Unterstützte Spalten:
              <strong> Name/Firma/Lieferant</strong>, Strasse/Adresse, PLZ, Ort/Stadt, Land, IBAN, BIC/SWIFT, Zahlungsfrist, Kontakt/Kontaktperson, E-Mail/Email, Telefon/Tel, Notizen/Bemerkung.
              Duplikate (gleicher Name oder IBAN) werden automatisch übersprungen.
            </p>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="supplier-import-file"
                onChange={handleImportFile}
              />
              <Button variant="outline" asChild>
                <label htmlFor="supplier-import-file" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" /> Datei wählen
                </label>
              </Button>
            </div>
            {importPreview.length > 0 && (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>IBAN</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Zahlungsfrist</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.slice(0, 50).map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{s.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[s.street, [s.zipCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{s.iban || "–"}</TableCell>
                        <TableCell className="text-xs">{s.email || "–"}</TableCell>
                        <TableCell className="text-xs">{s.paymentTermDays ? `${s.paymentTermDays} Tage` : "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importPreview.length > 50 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">... und {importPreview.length - 50} weitere</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportPreview([]); }}>Abbrechen</Button>
            <Button
              onClick={() => importFromListMut.mutate({ suppliers: importPreview })}
              disabled={importPreview.length === 0 || importFromListMut.isPending}
            >
              {importFromListMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              {importPreview.length} Lieferanten importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Customers (Kunden) Tab ──────────────────────────────────────────────────

function CustomersTab() {
  const [search, setSearch] = useReactState("");
  const [showDialog, setShowDialog] = useReactState(false);
  const [editCustomer, setEditCustomer] = useReactState<any>(null);
  const [showServiceDialog, setShowServiceDialog] = useReactState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useReactState<number | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useReactState<number | null>(null);
  const [showImportDialog, setShowImportDialog] = useReactState(false);
  const [importPreview, setImportPreview] = useReactState<Array<{name:string;company?:string;street?:string;zipCode?:string;city?:string;country?:string;email?:string;phone?:string;salutation?:string;notes?:string}>>([]);

  // Customer form
  const [cCustNr, setCCustNr] = useReactState("");
  const [cFirstName, setCFirstName] = useReactState("");
  const [cLastName, setCLastName] = useReactState("");
  const [cCompany, setCCompany] = useReactState("");
  const [cSpouseFirstName, setCSpouseFirstName] = useReactState("");
  const [cSpouseLastName, setCSpouseLastName] = useReactState("");
  const [cMaritalStatus, setCMaritalStatus] = useReactState("");
  const [cBirthDate, setCBirthDate] = useReactState("");
  const [cSpouseBirthDate, setCSpouseBirthDate] = useReactState("");
  const [cStreet, setCStreet] = useReactState("");
  const [cZip, setCZip] = useReactState("");
  const [cCity, setCCity] = useReactState("");
  const [cCountry, setCCountry] = useReactState("Schweiz");
  const [cEmail, setCEmail] = useReactState("");
  const [cPhone, setCPhone] = useReactState("");
  const [cSalutation, setCSalutation] = useReactState("");
  const [cNotes, setCNotes] = useReactState("");

  // Service form
  const [sDesc, setSDesc] = useReactState("");
  const [sAccountId, setSAccountId] = useReactState("");
  const [sHourlyRate, setSHourlyRate] = useReactState("");
  const [sIsDefault, setSIsDefault] = useReactState(false);
  const [editService, setEditService] = useReactState<any>(null);

  const { data: customersList, refetch } = trpc.customers.list.useQuery({ search: search || undefined });
  const { data: accountsList } = trpc.accounts.list.useQuery();
  const revenueAccounts = useMemo(() =>
    (accountsList ?? []).filter(a => a.accountType === "revenue" && a.isActive).sort((a, b) => a.number.localeCompare(b.number)),
    [accountsList]
  );

  const createCust = trpc.customers.create.useMutation({
    onSuccess: () => { toast.success("Kunde erstellt"); refetch(); setShowDialog(false); resetCustForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateCust = trpc.customers.update.useMutation({
    onSuccess: () => { toast.success("Kunde aktualisiert"); refetch(); setShowDialog(false); resetCustForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCust = trpc.customers.delete.useMutation({
    onSuccess: () => { toast.success("Kunde deaktiviert"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const addService = trpc.customers.addService.useMutation({
    onSuccess: () => { toast.success("Dienstleistung hinzugefügt"); refetch(); setShowServiceDialog(false); resetServiceForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateService = trpc.customers.updateService.useMutation({
    onSuccess: () => { toast.success("Dienstleistung aktualisiert"); refetch(); setShowServiceDialog(false); resetServiceForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteService = trpc.customers.deleteService.useMutation({
    onSuccess: () => { toast.success("Dienstleistung entfernt"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const importFromListMut = trpc.customers.importFromList.useMutation({
    onSuccess: (data) => {
      toast.success(`Import: ${data.created} erstellt, ${data.skipped} übersprungen`);
      refetch();
      setShowImportDialog(false);
      setImportPreview([]);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetCustForm() {
    setCCustNr(""); setCFirstName(""); setCLastName(""); setCCompany("");
    setCSpouseFirstName(""); setCSpouseLastName(""); setCMaritalStatus("");
    setCBirthDate(""); setCSpouseBirthDate("");
    setCStreet(""); setCZip(""); setCCity("");
    setCCountry("Schweiz"); setCEmail(""); setCPhone(""); setCSalutation(""); setCNotes("");
    setEditCustomer(null);
  }

  function resetServiceForm() {
    setSDesc(""); setSAccountId(""); setSHourlyRate(""); setSIsDefault(false); setEditService(null);
  }

  function openCreateCust() { resetCustForm(); setShowDialog(true); }

  function openEditCust(c: any) {
    setEditCustomer(c);
    setCCustNr(c.customerNumber || "");
    setCFirstName(c.firstName || ""); setCLastName(c.lastName || "");
    setCCompany(c.company || "");
    setCSpouseFirstName(c.spouseFirstName || ""); setCSpouseLastName(c.spouseLastName || "");
    setCMaritalStatus(c.maritalStatus || "");
    setCBirthDate(c.birthDate || ""); setCSpouseBirthDate(c.spouseBirthDate || "");
    setCStreet(c.street || "");
    setCZip(c.zipCode || ""); setCCity(c.city || ""); setCCountry(c.country || "Schweiz");
    setCEmail(c.email || ""); setCPhone(c.phone || ""); setCSalutation(c.salutation || "");
    setCNotes(c.notes || "");
    setShowDialog(true);
  }

  function handleSaveCust() {
    if (!cLastName.trim()) { toast.error("Nachname ist erforderlich"); return; }
    const displayName = [cLastName.trim(), cFirstName.trim()].filter(Boolean).join(" ");
    const data = {
      name: displayName,
      customerNumber: cCustNr || undefined,
      firstName: cFirstName.trim() || undefined,
      lastName: cLastName.trim() || undefined,
      company: cCompany || undefined,
      spouseFirstName: cSpouseFirstName || undefined,
      spouseLastName: cSpouseLastName || undefined,
      maritalStatus: cMaritalStatus || undefined,
      birthDate: cBirthDate || undefined,
      spouseBirthDate: cSpouseBirthDate || undefined,
      street: cStreet || undefined,
      zipCode: cZip || undefined, city: cCity || undefined, country: cCountry || undefined,
      email: cEmail || undefined, phone: cPhone || undefined, salutation: cSalutation || undefined,
      notes: cNotes || undefined,
    };
    if (editCustomer) {
      updateCust.mutate({ id: editCustomer.id, ...data });
    } else {
      createCust.mutate(data);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      const parsed = rows.map((r: Record<string, any>) => {
        const name = String(r["Name"] ?? r["Kunde"] ?? r["Kontakt"] ?? r["name"] ?? "").trim();
        const company = String(r["Firma"] ?? r["Unternehmen"] ?? r["company"] ?? "").trim() || undefined;
        const street = String(r["Strasse"] ?? r["Adresse"] ?? r["street"] ?? r["address"] ?? "").trim() || undefined;
        const zipCode = String(r["PLZ"] ?? r["Postleitzahl"] ?? r["zipCode"] ?? r["zip"] ?? "").trim() || undefined;
        const city = String(r["Ort"] ?? r["Stadt"] ?? r["city"] ?? "").trim() || undefined;
        const country = String(r["Land"] ?? r["country"] ?? "").trim() || undefined;
        const email = String(r["E-Mail"] ?? r["Email"] ?? r["email"] ?? "").trim() || undefined;
        const phone = String(r["Telefon"] ?? r["Tel"] ?? r["phone"] ?? "").trim() || undefined;
        const salutation = String(r["Anrede"] ?? r["salutation"] ?? "").trim() || undefined;
        const notes = String(r["Notizen"] ?? r["Bemerkung"] ?? r["notes"] ?? "").trim() || undefined;
        return { name, company, street, zipCode, city, country, email, phone, salutation, notes };
      }).filter(c => c.name.length > 0);
      setImportPreview(parsed);
      toast.success(`${parsed.length} Kunden aus Datei gelesen`);
    } catch (err) {
      toast.error("Fehler beim Lesen der Datei");
    }
    e.target.value = "";
  }

  function openAddService(custId: number) {
    resetServiceForm();
    setSelectedCustomerId(custId);
    setShowServiceDialog(true);
  }

  function openEditService(svc: any, custId: number) {
    setEditService(svc);
    setSelectedCustomerId(custId);
    setSDesc(svc.description || "");
    setSAccountId(svc.revenueAccountId ? String(svc.revenueAccountId) : "");
    setSHourlyRate(svc.hourlyRate ? String(svc.hourlyRate) : "");
    setSIsDefault(svc.isDefault || false);
    setShowServiceDialog(true);
  }

  function handleSaveService() {
    if (!sDesc.trim() || !sAccountId) { toast.error("Beschreibung und Ertragskonto sind erforderlich"); return; }
    const data = {
      customerId: selectedCustomerId!,
      description: sDesc.trim(),
      revenueAccountId: parseInt(sAccountId),
      hourlyRate: sHourlyRate ? parseFloat(sHourlyRate) : undefined,
      isDefault: sIsDefault,
    };
    if (editService) {
      updateService.mutate({ id: editService.id, ...data });
    } else {
      addService.mutate(data);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kunden-Stammdaten</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kunden mit Dienstleistungen und Ertragskonten-Zuordnung
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowImportDialog(true); setImportPreview([]); }}>
            <Upload className="h-4 w-4 mr-2" /> CSV/Excel Import
          </Button>
          <Button onClick={openCreateCust}>
            <Plus className="h-4 w-4 mr-2" /> Neuer Kunde
          </Button>
        </div>
      </div>

      <Input
        placeholder="Suche nach Name, Firma oder Ort..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="space-y-3">
        {(!customersList || customersList.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Keine Kunden erfasst
            </CardContent>
          </Card>
        ) : customersList.map((c: any) => (
          <Card key={c.id} className={!c.isActive ? "opacity-50" : ""}>
            <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedCustomer === c.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <div className="font-semibold">
                      {c.customerNumber && <span className="font-mono text-muted-foreground mr-2">{c.customerNumber}</span>}
                      {c.lastName || c.firstName ? [c.lastName, c.firstName].filter(Boolean).join(" ") : c.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {[c.company, [c.zipCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                      {c.email && ` · ${c.email}`}
                      {c.spouseFirstName && ` · Partner: ${[c.spouseFirstName, c.spouseLastName].filter(Boolean).join(" ")}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {(c.services ?? []).length} Dienstleistung{(c.services ?? []).length !== 1 ? "en" : ""}
                  </Badge>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditCust(c); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {c.isActive && (
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Kunde "${c.name}" wirklich deaktivieren?`)) deleteCust.mutate({ id: c.id });
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {expandedCustomer === c.id && (
              <CardContent className="pt-0 px-4 pb-4">
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Dienstleistungen & Ertragskonten</h4>
                    <Button size="sm" variant="outline" onClick={() => openAddService(c.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Dienstleistung
                    </Button>
                  </div>
                  {(!c.services || c.services.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-2">Keine Dienstleistungen zugeordnet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dienstleistung</TableHead>
                          <TableHead>Ertragskonto</TableHead>
                          <TableHead>Stundenansatz</TableHead>
                          <TableHead>Standard</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {c.services.map((svc: any) => (
                          <TableRow key={svc.id}>
                            <TableCell className="font-medium">{svc.description}</TableCell>
                            <TableCell className="text-sm">
                              {svc.revenueAccount ? `${svc.revenueAccount.number} ${svc.revenueAccount.name}` : "–"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {svc.hourlyRate ? `CHF ${Number(svc.hourlyRate).toFixed(2)}/h` : "–"}
                            </TableCell>
                            <TableCell>
                              {svc.isDefault && <Badge className="text-xs bg-green-100 text-green-800">Primär</Badge>}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditService(svc, c.id)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                                  if (confirm("Dienstleistung entfernen?")) deleteService.mutate({ id: svc.id });
                                }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {c.salutation && (
                    <p className="text-xs text-muted-foreground mt-2">Anrede: {c.salutation}</p>
                  )}
                  {c.notes && (
                    <p className="text-xs text-muted-foreground mt-1">Notizen: {c.notes}</p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Customer Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetCustForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCustomer ? "Kunde bearbeiten" : "Neuer Kunde"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Row 1: Kunden-Nr, Nachname, Vorname, Firma */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-2">
                <Label>Kunden-Nr.</Label>
                <Input value={cCustNr} onChange={e => setCCustNr(e.target.value)} placeholder="784" className="font-mono" />
              </div>
              <div className="col-span-3">
                <Label>Nachname *</Label>
                <Input value={cLastName} onChange={e => setCLastName(e.target.value)} placeholder="Meier" />
              </div>
              <div className="col-span-3">
                <Label>Vorname</Label>
                <Input value={cFirstName} onChange={e => setCFirstName(e.target.value)} placeholder="Peter" />
              </div>
              <div className="col-span-4">
                <Label>Firma</Label>
                <Input value={cCompany} onChange={e => setCCompany(e.target.value)} placeholder="Meier AG" />
              </div>
            </div>
            {/* Row 2: Zivilstand, Geburtsdatum */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Zivilstand</Label>
                <Select value={cMaritalStatus} onValueChange={setCMaritalStatus}>
                  <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ledig">Ledig</SelectItem>
                    <SelectItem value="verheiratet">Verheiratet</SelectItem>
                    <SelectItem value="geschieden">Geschieden</SelectItem>
                    <SelectItem value="verwitwet">Verwitwet</SelectItem>
                    <SelectItem value="eingetragene_partnerschaft">Eingetragene Partnerschaft</SelectItem>
                    <SelectItem value="getrennt">Getrennt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Geburtsdatum</Label>
                <Input type="date" value={cBirthDate} onChange={e => setCBirthDate(e.target.value)} />
              </div>
              <div>
                <Label>Anrede (für Rechnungen)</Label>
                <Input value={cSalutation} onChange={e => setCSalutation(e.target.value)} placeholder="Sehr geehrter Herr Meier" />
              </div>
            </div>
            {/* Row 3: Ehepartner */}
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Ehepartner / Partner</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Nachname</Label>
                  <Input value={cSpouseLastName} onChange={e => setCSpouseLastName(e.target.value)} placeholder="Meier" />
                </div>
                <div>
                  <Label>Vorname</Label>
                  <Input value={cSpouseFirstName} onChange={e => setCSpouseFirstName(e.target.value)} placeholder="Anna" />
                </div>
                <div>
                  <Label>Geburtsdatum</Label>
                  <Input type="date" value={cSpouseBirthDate} onChange={e => setCSpouseBirthDate(e.target.value)} />
                </div>
              </div>
            </div>
            {/* Row 4: Adresse */}
            <div>
              <Label>Strasse</Label>
              <Input value={cStreet} onChange={e => setCStreet(e.target.value)} placeholder="Musterstrasse 1" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>PLZ</Label>
                <Input value={cZip} onChange={e => setCZip(e.target.value)} placeholder="6000" />
              </div>
              <div>
                <Label>Ort</Label>
                <Input value={cCity} onChange={e => setCCity(e.target.value)} placeholder="Luzern" />
              </div>
              <div>
                <Label>Land</Label>
                <Input value={cCountry} onChange={e => setCCountry(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>E-Mail</Label>
                <Input value={cEmail} onChange={e => setCEmail(e.target.value)} type="email" />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={cPhone} onChange={e => setCPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notizen</Label>
              <Textarea value={cNotes} onChange={e => setCNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetCustForm(); }}>Abbrechen</Button>
            <Button onClick={handleSaveCust} disabled={createCust.isPending || updateCust.isPending}>
              {(createCust.isPending || updateCust.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editCustomer ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV/Excel Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) { setShowImportDialog(false); setImportPreview([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kunden importieren (CSV/Excel)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Laden Sie eine Excel- oder CSV-Datei hoch. Unterstützte Spalten:
              <strong> Name/Kunde/Kontakt</strong>, Firma/Unternehmen, Strasse/Adresse, PLZ, Ort/Stadt, Land, E-Mail/Email, Telefon/Tel, Anrede, Notizen/Bemerkung.
              Duplikate (gleicher Name oder Firma) werden automatisch übersprungen.
            </p>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="customer-import-file"
                onChange={handleImportFile}
              />
              <Button variant="outline" asChild>
                <label htmlFor="customer-import-file" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" /> Datei wählen
                </label>
              </Button>
            </div>
            {importPreview.length > 0 && (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Telefon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.slice(0, 50).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{c.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.company || "–"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[c.street, [c.zipCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                        </TableCell>
                        <TableCell className="text-xs">{c.email || "–"}</TableCell>
                        <TableCell className="text-xs">{c.phone || "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importPreview.length > 50 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">... und {importPreview.length - 50} weitere</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportPreview([]); }}>Abbrechen</Button>
            <Button
              onClick={() => importFromListMut.mutate({ customers: importPreview })}
              disabled={importPreview.length === 0 || importFromListMut.isPending}
            >
              {importFromListMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              {importPreview.length} Kunden importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={(open) => { if (!open) { setShowServiceDialog(false); resetServiceForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editService ? "Dienstleistung bearbeiten" : "Neue Dienstleistung"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Beschreibung *</Label>
              <Input value={sDesc} onChange={e => setSDesc(e.target.value)} placeholder="z.B. Finanzberatung, Steuererklärung" />
            </div>
            <div>
              <Label>Ertragskonto *</Label>
              <Select value={sAccountId} onValueChange={setSAccountId}>
                <SelectTrigger><SelectValue placeholder="Ertragskonto wählen" /></SelectTrigger>
                <SelectContent>
                  {revenueAccounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stundenansatz (CHF)</Label>
              <Input value={sHourlyRate} onChange={e => setSHourlyRate(e.target.value)} type="number" step="0.50" placeholder="250.00" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={sIsDefault} onCheckedChange={setSIsDefault} />
              <Label>Primäre Dienstleistung (häufigste)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowServiceDialog(false); resetServiceForm(); }}>Abbrechen</Button>
            <Button onClick={handleSaveService} disabled={addService.isPending || updateService.isPending}>
              {editService ? "Speichern" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Templates (Vorlagen) Tab ────────────────────────────────────────────────

function TemplatesTab() {
  const [showUpload, setShowUpload] = useReactState(false);
  const [uploadName, setUploadName] = useReactState("");
  const [uploadType, setUploadType] = useReactState("invoice");
  const [uploadDesc, setUploadDesc] = useReactState("");
  const [uploadFile, setUploadFile] = useReactState<File | null>(null);

  const { data: templatesList, refetch } = trpc.settings.listTemplates.useQuery();
  const uploadMut = trpc.settings.uploadTemplate.useMutation({
    onSuccess: () => { toast.success("Vorlage hochgeladen"); refetch(); setShowUpload(false); resetUploadForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.settings.deleteTemplate.useMutation({
    onSuccess: () => { toast.success("Vorlage gelöscht"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const setDefaultMut = trpc.settings.setDefaultTemplate.useMutation({
    onSuccess: () => { toast.success("Standardvorlage gesetzt"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function resetUploadForm() {
    setUploadName(""); setUploadType("invoice"); setUploadDesc(""); setUploadFile(null);
  }

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) { toast.error("Name und Datei sind erforderlich"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMut.mutate({
        name: uploadName.trim(),
        templateType: uploadType as any,
        description: uploadDesc || undefined,
        fileData: base64,
        fileName: uploadFile.name,
        mimeType: uploadFile.type,
        fileSize: uploadFile.size,
      });
    };
    reader.readAsDataURL(uploadFile);
  }

  const typeLabels: Record<string, string> = {
    invoice: "Rechnung", letter: "Brief", contract: "Vertrag", other: "Sonstiges",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vorlagen</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Rechnungsvorlagen, Briefvorlagen und andere Dokumentvorlagen verwalten
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-2" /> Vorlage hochladen
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(!templatesList || templatesList.length === 0) ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Keine Vorlagen hochgeladen
            </CardContent>
          </Card>
        ) : templatesList.map((t: any) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <Badge variant="outline" className="text-xs">{typeLabels[t.templateType] || t.templateType}</Badge>
              </div>
              {t.description && <CardDescription className="text-xs">{t.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {(t.fileSize / 1024).toFixed(0)} KB · {t.mimeType?.split("/")[1]?.toUpperCase()}
                  {t.isDefault && <Badge className="ml-2 text-xs bg-green-100 text-green-800">Standard</Badge>}
                </div>
                <div className="flex gap-1">
                  {!t.isDefault && (
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setDefaultMut.mutate({ id: t.id, templateType: t.templateType })}>
                      Als Standard
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(t.s3Url, "_blank")}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                    if (confirm(`Vorlage "${t.name}" wirklich löschen?`)) deleteMut.mutate({ id: t.id });
                  }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={(open) => { if (!open) { setShowUpload(false); resetUploadForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vorlage hochladen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="z.B. Rechnung Standard" />
            </div>
            <div>
              <Label>Typ</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Rechnung</SelectItem>
                  <SelectItem value="letter">Brief</SelectItem>
                  <SelectItem value="contract">Vertrag</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Input value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="Optionale Beschreibung" />
            </div>
            <div>
              <Label>Datei *</Label>
              <Input type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUpload(false); resetUploadForm(); }}>Abbrechen</Button>
            <Button onClick={handleUpload} disabled={uploadMut.isPending}>
              {uploadMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hochladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Subscription Tab ─────────────────────────────────────────────────────────

const PLAN_INFO = {
  starter: {
    name: "Starter",
    description: "Für Einzelunternehmen",
    priceChf: 29,
    features: ["1 Firma", "Doppelte Buchhaltung", "QR-Rechnungen", "Bankimport", "MWST-Abrechnung"],
  },
  professional: {
    name: "Professional",
    description: "Für wachsende KMU",
    priceChf: 59,
    features: ["Bis 3 Firmen", "Alles aus Starter", "Lohnbuchhaltung", "KI-Buchungsvorschläge", "Dokumenten-Scan", "Kreditoren-Verwaltung"],
  },
  enterprise: {
    name: "Enterprise",
    description: "Für Treuhandgesellschaften",
    priceChf: 99,
    features: ["Unbegrenzte Firmen", "Alles aus Professional", "Zeiterfassung", "Mandanten-Verwaltung", "Prioritäts-Support", "Individuelle Anpassungen"],
  },
} as const;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trialing: { label: "Testphase", color: "bg-blue-100 text-blue-800" },
  active: { label: "Aktiv", color: "bg-green-100 text-green-800" },
  past_due: { label: "Zahlung ausstehend", color: "bg-yellow-100 text-yellow-800" },
  canceled: { label: "Gekündigt", color: "bg-red-100 text-red-800" },
  unpaid: { label: "Unbezahlt", color: "bg-red-100 text-red-800" },
  incomplete: { label: "Unvollständig", color: "bg-gray-100 text-gray-800" },
  none: { label: "Kein Abo", color: "bg-gray-100 text-gray-800" },
};

function SubscriptionTab() {
  const subQuery = trpc.stripe.getSubscription.useQuery();
  const createCheckout = trpc.stripe.createCheckout.useMutation();
  const createPortal = trpc.stripe.createPortal.useMutation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const sub = subQuery.data;

  const handleSelectPlan = async (plan: "starter" | "professional" | "enterprise") => {
    setLoadingPlan(plan);
    try {
      const { url } = await createCheckout.mutateAsync({
        plan,
        origin: window.location.origin,
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Erstellen der Checkout-Session");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { url } = await createPortal.mutateAsync({
        returnUrl: `${window.location.origin}/settings?tab=subscription`,
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Öffnen des Kundenportals");
    }
  };

  if (subQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasSubscription = sub && sub.status !== "none";
  const statusInfo = STATUS_LABELS[sub?.status ?? "none"] ?? STATUS_LABELS.none;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Abonnement</h3>
        <p className="text-sm text-muted-foreground">Verwalten Sie Ihren KLAX-Plan und Ihre Zahlungsinformationen.</p>
      </div>

      {/* Current subscription status */}
      {hasSubscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle className="text-base">
                    {PLAN_INFO[sub.plan as keyof typeof PLAN_INFO]?.name ?? sub.plan} Plan
                  </CardTitle>
                  <CardDescription>
                    CHF {PLAN_INFO[sub.plan as keyof typeof PLAN_INFO]?.priceChf ?? "?"}/Monat
                  </CardDescription>
                </div>
              </div>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sub.trialEnd && sub.status === "trialing" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Testphase endet am {new Date(sub.trialEnd).toLocaleDateString("de-CH")}
              </div>
            )}
            {sub.currentPeriodEnd && sub.status === "active" && (
              <div className="text-sm text-muted-foreground">
                Nächste Zahlung am {new Date(sub.currentPeriodEnd).toLocaleDateString("de-CH")}
              </div>
            )}
            {sub.cancelAtPeriodEnd && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Abo wird zum Ende der Periode gekündigt
              </div>
            )}
            <Button onClick={handleManageSubscription} disabled={createPortal.isPending} variant="outline">
              {createPortal.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Wird geladen...</>
              ) : (
                <><ExternalLink className="h-4 w-4 mr-2" />Abo verwalten (Stripe)</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan selection */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {hasSubscription ? "Plan wechseln" : "Plan wählen"}
        </h4>
        <div className="grid md:grid-cols-3 gap-4">
          {(Object.entries(PLAN_INFO) as [string, typeof PLAN_INFO[keyof typeof PLAN_INFO]][]).map(([key, plan]) => {
            const isCurrentPlan = hasSubscription && sub.plan === key;
            return (
              <Card key={key} className={`relative ${isCurrentPlan ? "border-primary border-2" : ""} ${key === "professional" ? "ring-1 ring-blue-200" : ""}`}>
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-4">
                    <Badge className="bg-primary text-primary-foreground">Aktueller Plan</Badge>
                  </div>
                )}
                {key === "professional" && !isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-blue-600 text-white">Beliebt</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">CHF {plan.priceChf}</span>
                    <span className="text-muted-foreground text-sm">/Monat</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-4"
                    variant={isCurrentPlan ? "outline" : key === "professional" ? "default" : "outline"}
                    disabled={isCurrentPlan || loadingPlan === key}
                    onClick={() => handleSelectPlan(key as "starter" | "professional" | "enterprise")}
                  >
                    {loadingPlan === key ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Wird geladen...</>
                    ) : isCurrentPlan ? (
                      "Aktueller Plan"
                    ) : hasSubscription ? (
                      "Wechseln"
                    ) : (
                      "30 Tage kostenlos testen"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground">
        Alle Preise in CHF, exkl. MWST. 30 Tage kostenlose Testphase bei Erstregistrierung.
        Sie können Ihr Abo jederzeit über das Stripe-Kundenportal verwalten oder kündigen.
      </p>
    </div>
  );
}
