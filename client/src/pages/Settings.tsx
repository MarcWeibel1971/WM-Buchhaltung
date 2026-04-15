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
  ArrowUpDown, FileSpreadsheet, LayoutTemplate,
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
import { useMemo, useState as useReactState } from "react";
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
  { id: "dsg", label: "Datenschutz (DSG)", icon: ShieldCheck },
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
  const [activeTab, setActiveTab] = useState<TabId>("company");
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
        {activeTab === "dsg" && <DsgTab />}
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
      companyName: (current as Record<string, unknown>).companyName as string ?? "WM Weibel Mueller AG",
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
      companyName: form.companyName || "WM Weibel Mueller AG",
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
  const { data: bankAccounts, isLoading, refetch } = trpc.settings.getBankAccounts.useQuery();
  const updateMut = trpc.settings.updateBankAccount.useMutation({
    onSuccess: () => { toast.success("Gespeichert"); refetch(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; iban: string; bank: string; owner: string }>({ name: "", iban: "", bank: "", owner: "" });

  const startEdit = (ba: NonNullable<typeof bankAccounts>[number]) => {
    setEditForm({ name: ba.name, iban: ba.iban ?? "", bank: ba.bank ?? "", owner: ba.owner ?? "" });
    setEditId(ba.id);
  };

  if (isLoading) return <div className="text-muted-foreground">Lädt...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bankkonten</h1>
        <p className="text-muted-foreground text-sm mt-1">IBAN und Bankverbindungen der Geschäftskonten</p>
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
                  <Button size="sm" variant="ghost" onClick={() => startEdit(ba)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
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

  const filtered = (rules ?? []).filter(r =>
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
            {(rules ?? []).length} gelernte Regeln – automatische Kategorisierung von Bankbuchungen
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

function OpeningBalancesTab() {
  const { fiscalYear } = useFiscalYear();
  const [editYear, setEditYear] = useState(fiscalYear);
  const [localBalances, setLocalBalances] = useState<Record<number, string>>({});
  const [isDirty, setIsDirty] = useState(false);

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
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Sync local state when data loads
  useState(() => {
    if (rows) {
      const init: Record<number, string> = {};
      rows.forEach(r => { if (r.balance !== 0) init[r.accountId] = String(r.balance); });
      setLocalBalances(init);
    }
  });

  // Re-init when rows change (year switch)
  const prevYear = useRef(editYear);
  useEffect(() => {
    if (rows && editYear !== prevYear.current) {
      prevYear.current = editYear;
      const init: Record<number, string> = {};
      rows.forEach(r => { if (r.balance !== 0) init[r.accountId] = String(r.balance); });
      setLocalBalances(init);
      setIsDirty(false);
    } else if (rows && !isDirty) {
      const init: Record<number, string> = {};
      rows.forEach(r => { if (r.balance !== 0) init[r.accountId] = String(r.balance); });
      setLocalBalances(init);
    }
  }, [rows, editYear]);

  const getValue = (accountId: number) => localBalances[accountId] ?? "";

  const handleChange = (accountId: number, val: string) => {
    setLocalBalances(prev => ({ ...prev, [accountId]: val }));
    setIsDirty(true);
  };

  // Compute totals
  const assets = rows?.filter(r => r.accountType === "asset") ?? [];
  const liabilities = rows?.filter(r => r.accountType === "liability" || r.accountType === "equity") ?? [];

  const totalAssets = assets.reduce((sum, r) => {
    const v = parseFloat(localBalances[r.accountId] || "0") || 0;
    return sum + v;
  }, 0);
  const totalLiabilities = liabilities.reduce((sum, r) => {
    const v = parseFloat(localBalances[r.accountId] || "0") || 0;
    return sum + v;
  }, 0);
  const diff = Math.abs(totalAssets - totalLiabilities);
  const isBalanced = diff < 0.01;

  const handleSave = () => {
    const balances = (rows ?? []).map(r => ({
      accountId: r.accountId,
      balance: parseFloat(localBalances[r.accountId] || "0") || 0,
    }));
    saveMut.mutate({ fiscalYear: editYear, balances });
  };

  const formatCHF = (n: number) =>
    new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const renderAccountGroup = (
    title: string,
    accounts: typeof rows,
    total: number
  ) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {title}
      </h3>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground">
              <th className="text-left px-3 py-2 w-20">Konto</th>
              <th className="text-left px-3 py-2">Bezeichnung</th>
              <th className="text-right px-3 py-2 w-40">Saldo CHF</th>
            </tr>
          </thead>
          <tbody>
            {accounts?.map(r => (
              <tr key={r.accountId} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{r.accountNumber}</td>
                <td className="px-3 py-1.5 text-sm">{r.accountName}</td>
                <td className="px-3 py-1.5 text-right">
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 text-right font-mono text-sm w-36 ml-auto"
                    value={getValue(r.accountId)}
                    placeholder="0.00"
                    onChange={e => handleChange(r.accountId, e.target.value)}
                  />
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-sm">Total {title}</td>
              <td className="px-3 py-2 text-right font-mono text-sm">{formatCHF(total)}</td>
            </tr>
          </tbody>
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
            Manuelle Erfassung der Eröffnungssalden für das erste Geschäftsjahr.
            Aktiven müssen gleich Passiven sein.
          </p>
        </div>
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
          {renderAccountGroup("Aktiven", assets, totalAssets)}
          {renderAccountGroup("Passiven (Fremdkapital & Eigenkapital)", liabilities, totalLiabilities)}

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

function ChartOfAccountsTab() {
  const { data: allAccounts, isLoading, refetch } = trpc.settings.getAllAccounts.useQuery();
  const utils = trpc.useUtils();
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
                              onClick={() => toggleActiveMut.mutate({ id: acc.id, isActive: !acc.isActive })}
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
                                    if (confirm(`Konto ${acc.number} ${acc.name} wirklich löschen?`))
                                      deleteMut.mutate({ id: acc.id });
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
              Laden Sie eine Excel- oder CSV-Datei hoch. Die Datei muss mindestens die Spalten
              "Nummer" (oder "Konto") und "Name" (oder "Bezeichnung") enthalten.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Datei wählen
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
                    const parsed = rows.map((r: Record<string, any>) => {
                      const num = String(r["Nummer"] ?? r["Konto"] ?? r["Nr"] ?? r["number"] ?? "").trim();
                      const name = String(r["Name"] ?? r["Bezeichnung"] ?? r["Kontoname"] ?? r["name"] ?? "").trim();
                      const cat = String(r["Kategorie"] ?? r["category"] ?? "").trim() || undefined;
                      const sub = String(r["Unterkategorie"] ?? r["subCategory"] ?? "").trim() || undefined;
                      // Determine account type from number
                      const n = parseInt(num);
                      let accountType: string = "expense";
                      if (n >= 1000 && n < 2000) accountType = "asset";
                      else if (n >= 2000 && n < 2800) accountType = "liability";
                      else if (n >= 2800 && n < 3000) accountType = "equity";
                      else if (n >= 3000 && n < 4000) accountType = "revenue";
                      else if (n >= 4000 && n < 9000) accountType = "expense";
                      else if (n >= 9000) accountType = "equity";
                      return { number: num, name, accountType, category: cat, subCategory: sub };
                    }).filter((a: any) => a.number && a.name);
                    setImportPreview(parsed);
                    toast.success(`${parsed.length} Konten aus Datei gelesen`);
                  } catch (err) {
                    toast.error("Fehler beim Lesen der Datei");
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
            WM Weibel Mueller AG ist verantwortlich für die Bearbeitung der Personendaten in dieser Anwendung.
            Bei Fragen zum Datenschutz wenden Sie sich bitte an die Geschäftsleitung.
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
