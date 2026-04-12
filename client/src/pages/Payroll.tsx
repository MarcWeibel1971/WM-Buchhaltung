import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Check, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

export default function Payroll() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);

  const { data: employees } = trpc.payroll.getEmployees.useQuery();
  const { data: payrollList, refetch } = trpc.payroll.list.useQuery({ year });
  const utils = trpc.useUtils();

  const approveMutation = trpc.payroll.approve.useMutation({
    onSuccess: () => { toast.success("Lohnbuchung erstellt"); refetch(); utils.reports.dashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Lohnbuchhaltung</h2>
          <p className="text-sm text-muted-foreground">Lohnabrechnung für mw und jm</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023,2024,2025,2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Lohnabrechnung
          </Button>
        </div>
      </div>

      {/* Employees overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {employees?.map(emp => (
          <div key={emp.id} className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {emp.code.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">{emp.firstName} {emp.lastName}</div>
                <div className="text-xs text-muted-foreground">{emp.code}</div>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground text-xs">AHV-Nr.:</span> {emp.ahvNumber ?? "–"}
            </div>
          </div>
        ))}
      </div>

      {/* Payroll list */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Lohnabrechnungen {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Monat</th>
                <th>Mitarbeiter</th>
                <th className="text-right">Brutto CHF</th>
                <th className="text-right">AHV CHF</th>
                <th className="text-right">BVG CHF</th>
                <th className="text-right">Netto CHF</th>
                <th>Status</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!payrollList?.length ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Keine Lohnabrechnungen für {year}
                  </td>
                </tr>
              ) : payrollList.map(({ payroll: p, employee: emp }) => (
                <tr key={p.id}>
                  <td className="text-sm font-medium">{MONTHS[p.month - 1]}</td>
                  <td className="text-sm">{emp.firstName} {emp.lastName} ({emp.code})</td>
                  <td className="text-right font-mono text-sm">{formatCHF(p.grossSalary as string)}</td>
                  <td className="text-right font-mono text-sm text-muted-foreground">
                    {formatCHF((parseFloat(p.ahvEmployee as string) + parseFloat(p.ahvEmployer as string)).toFixed(2))}
                  </td>
                  <td className="text-right font-mono text-sm text-muted-foreground">
                    {formatCHF((parseFloat(p.bvgEmployee as string) + parseFloat(p.bvgEmployer as string)).toFixed(2))}
                  </td>
                  <td className="text-right font-mono text-sm font-semibold">{formatCHF(p.netSalary as string)}</td>
                  <td>
                    {p.status === "draft"
                      ? <span className="badge-pending">Entwurf</span>
                      : <span className="badge-approved">Verbucht</span>}
                  </td>
                  <td className="text-right">
                    {p.status === "draft" && (
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                        onClick={() => approveMutation.mutate({ payrollId: p.id })}>
                        <Check className="h-3 w-3" /> Verbuchen
                      </Button>
                    )}
                    {p.status === "approved" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        <FileText className="h-3 w-3" /> Lohnausweis
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreatePayrollDialog
          employees={employees ?? []}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refetch(); }}
        />
      )}
    </div>
  );
}

function CreatePayrollDialog({ employees, onClose, onSaved }: {
  employees: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [grossSalary, setGrossSalary] = useState("");
  const [ahvEmployee, setAhvEmployee] = useState("");
  const [ahvEmployer, setAhvEmployer] = useState("");
  const [bvgEmployee, setBvgEmployee] = useState("");
  const [bvgEmployer, setBvgEmployer] = useState("");
  const [ktgEmployee, setKtgEmployee] = useState("0");
  const [ktgEmployer, setKtgEmployer] = useState("0");

  const selectedEmp = employees.find(e => e.id === employeeId);

  // Auto-fill from employee data
  const fillFromEmployee = (emp: any) => {
    if (!emp) return;
    const gross = 10000; // Default, user will adjust
    setGrossSalary(gross.toFixed(2));
    // AHV: ~5.3% each side
    const ahv = (gross * 0.053).toFixed(2);
    setAhvEmployee(ahv);
    setAhvEmployer(ahv);
    // BVG: rough estimate
    const bvg = (gross * 0.08).toFixed(2);
    setBvgEmployee(bvg);
    setBvgEmployer(bvg);
  };

  const createMutation = trpc.payroll.create.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });

  const net = grossSalary
    ? (parseFloat(grossSalary) - parseFloat(ahvEmployee || "0") - parseFloat(bvgEmployee || "0") - parseFloat(ktgEmployee || "0")).toFixed(2)
    : "0.00";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lohnabrechnung erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mitarbeiter</label>
              <Select value={String(employeeId || "")} onValueChange={v => {
                const id = parseInt(v); setEmployeeId(id);
                fillFromEmployee(employees.find(e => e.id === id));
              }}>
                <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName} ({e.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Jahr</label>
              <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2023,2024,2025,2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Monat</label>
              <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bruttolohn CHF</label>
              <Input className="font-mono text-right" value={grossSalary} onChange={e => setGrossSalary(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">AHV Arbeitnehmer CHF</label>
              <Input className="font-mono text-right" value={ahvEmployee} onChange={e => setAhvEmployee(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">AHV Arbeitgeber CHF</label>
              <Input className="font-mono text-right" value={ahvEmployer} onChange={e => setAhvEmployer(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">BVG Arbeitnehmer CHF</label>
              <Input className="font-mono text-right" value={bvgEmployee} onChange={e => setBvgEmployee(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">BVG Arbeitgeber CHF</label>
              <Input className="font-mono text-right" value={bvgEmployer} onChange={e => setBvgEmployer(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 flex justify-between text-sm">
            <span className="font-medium">Nettolohn</span>
            <span className="font-mono font-bold">CHF {net}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={!employeeId || !grossSalary || createMutation.isPending}
            onClick={() => createMutation.mutate({
              employeeId, year, month,
              grossSalary, ahvEmployee: ahvEmployee || "0", ahvEmployer: ahvEmployer || "0",
              bvgEmployee: bvgEmployee || "0", bvgEmployer: bvgEmployer || "0",
              ktgUvgEmployee: ktgEmployee, ktgUvgEmployer: ktgEmployer,
            })}
          >
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
