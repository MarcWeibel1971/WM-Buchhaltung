import { useState } from "react";
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
  Building2, Users, Shield, Landmark, BookOpen,
  Pencil, Trash2, Plus, Check, X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "company", label: "Unternehmen", icon: Building2 },
  { id: "bank", label: "Bankkonten", icon: Landmark },
  { id: "employees", label: "Mitarbeiter", icon: Users },
  { id: "insurance", label: "Versicherungen", icon: Shield },
  { id: "rules", label: "Buchungsregeln", icon: BookOpen },
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
        {activeTab === "employees" && <EmployeesTab />}
        {activeTab === "insurance" && <InsuranceTab />}
        {activeTab === "rules" && <BookingRulesTab />}
      </main>
    </div>
  );
}

// ─── Company Tab ──────────────────────────────────────────────────────────────

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

  const emptyForm = () => ({ code: "", firstName: "", lastName: "", ahvNumber: "", address: "", dateOfBirth: "", employmentStart: "" });

  const openNew = () => { setEditEmp(emptyForm()); setDialogOpen(true); };
  const openEdit = (e: NonNullable<typeof emps>[number]) => {
    setEditEmp({
      id: String(e.id),
      code: e.code,
      firstName: e.firstName,
      lastName: e.lastName,
      ahvNumber: e.ahvNumber ?? "",
      address: e.address ?? "",
      dateOfBirth: e.dateOfBirth ?? "",
      employmentStart: e.employmentStart ?? "",
      salaryAccountId: e.salaryAccountId ? String(e.salaryAccountId) : "",
      grossSalaryAccountId: e.grossSalaryAccountId ? String(e.grossSalaryAccountId) : "",
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
      dateOfBirth: editEmp.dateOfBirth || undefined,
      employmentStart: editEmp.employmentStart || undefined,
      salaryAccountId: (editEmp.salaryAccountId && editEmp.salaryAccountId !== '0') ? parseInt(editEmp.salaryAccountId) : undefined,
      grossSalaryAccountId: (editEmp.grossSalaryAccountId && editEmp.grossSalaryAccountId !== '0') ? parseInt(editEmp.grossSalaryAccountId) : undefined,
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
        <DialogContent className="sm:max-w-md">
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
              <div className="col-span-2">
                <Label>Adresse</Label>
                <Textarea value={editEmp.address} onChange={e => setEditEmp(f => ({ ...f!, address: e.target.value }))} className="mt-1" rows={2} />
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
      validFrom: s.validFrom ?? "",
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!editItem) return;
    upsert.mutate({
      id: editItem.id ? parseInt(editItem.id) : undefined,
      insuranceType: editItem.insuranceType as "uvg" | "ktg" | "bvg" | "ahv" | "fak",
      insurerName: editItem.insurerName || undefined,
      policyNumber: editItem.policyNumber || undefined,
      employeeRate: editItem.employeeRate ? parseFloat(editItem.employeeRate) : undefined,
      employerRate: editItem.employerRate ? parseFloat(editItem.employerRate) : undefined,
      maxInsuredSalary: editItem.maxInsuredSalary ? parseFloat(editItem.maxInsuredSalary) : undefined,
      minInsuredSalary: editItem.minInsuredSalary ? parseFloat(editItem.minInsuredSalary) : undefined,
      validFrom: editItem.validFrom || undefined,
      notes: editItem.notes || undefined,
    });
  };

  // Swiss defaults for quick-add
  const DEFAULTS: Record<string, { employeeRate: string; employerRate: string; maxInsuredSalary: string; note: string }> = {
    ahv: { employeeRate: "5.3", employerRate: "5.3", maxInsuredSalary: "", note: "AHV/IV/EO 2026: je 5.3%" },
    uvg: { employeeRate: "0.66", employerRate: "2.97", maxInsuredSalary: "148200", note: "UVG 2026: AN 0.66%, AG 2.97%, max. CHF 148'200" },
    ktg: { employeeRate: "0.5", employerRate: "0.5", maxInsuredSalary: "", note: "KTG: typisch je 0.5% (je nach Versicherer)" },
    bvg: { employeeRate: "7.5", employerRate: "7.5", maxInsuredSalary: "88200", note: "BVG 2026: min. je 7.5%, koordinierter Lohn max. CHF 88'200" },
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
                <TableCell className="text-right font-mono text-sm">{s.employeeRate ? `${parseFloat(s.employeeRate).toFixed(2)}%` : "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{s.employerRate ? `${parseFloat(s.employerRate).toFixed(2)}%` : "—"}</TableCell>
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
        <DialogContent className="sm:max-w-md">
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
              <div>
                <Label>AN-Beitrag %</Label>
                <Input type="number" step="0.01" value={editItem.employeeRate} onChange={e => setEditItem(f => ({ ...f!, employeeRate: e.target.value }))} className="mt-1" placeholder="5.30" />
              </div>
              <div>
                <Label>AG-Beitrag %</Label>
                <Input type="number" step="0.01" value={editItem.employerRate} onChange={e => setEditItem(f => ({ ...f!, employerRate: e.target.value }))} className="mt-1" placeholder="5.30" />
              </div>
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
