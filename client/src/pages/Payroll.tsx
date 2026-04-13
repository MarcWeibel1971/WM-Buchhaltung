import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Plus, Check, FileText, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

function generateLohnausweis(p: any, emp: any, company?: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company header
  const companyName = company?.companyName ?? 'WM Weibel Mueller AG';
  const companyAddress = [company?.street, [company?.zipCode, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const companyUid = company?.uid ? `UID: ${company.uid}` : '';

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 15, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  if (companyAddress) { doc.text(companyAddress, 15, y); y += 4; }
  if (companyUid) { doc.text(companyUid, 15, y); y += 4; }
  doc.setTextColor(0, 0, 0);
  y += 4;

  // Title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('LOHNAUSWEIS', pageW / 2, y, { align: 'center' });
  y += 6;
  const monthName = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][p.month - 1];
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${monthName} ${p.year}`, pageW / 2, y, { align: 'center' });
  y += 10;

  // Employee info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Arbeitnehmer', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`, 60, y);
  y += 5;
  if (emp?.ahvNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text('AHV-Nummer', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(emp.ahvNumber, 60, y);
    y += 5;
  }
  y += 5;

  // Salary table
  const tableY = y;
  doc.setFillColor(240, 240, 240);
  doc.rect(14, tableY - 4, pageW - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Position', 15, tableY);
  doc.text('CHF', pageW - 15, tableY, { align: 'right' });
  y += 7;

  const rows: Array<[string, string]> = [
    ['Bruttolohn', formatCHF(p.grossSalary)],
    ['– AHV Arbeitnehmer', formatCHF(p.ahvEmployee)],
    ['– BVG Arbeitnehmer', formatCHF(p.bvgEmployee)],
  ];
  if (parseFloat(p.ktgUvgEmployee ?? '0') > 0) rows.push(['– KTG/UVG Arbeitnehmer', formatCHF(p.ktgUvgEmployee)]);

  doc.setFont('helvetica', 'normal');
  rows.forEach(([label, amount]) => {
    doc.text(label, 15, y);
    doc.text(amount, pageW - 15, y, { align: 'right' });
    y += 5;
  });

  // Net salary
  y += 2;
  doc.setFillColor(220, 240, 220);
  doc.rect(14, y - 4, pageW - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Nettolohn', 15, y);
  doc.text(formatCHF(p.netSalary), pageW - 15, y, { align: 'right' });
  y += 10;

  // Employer costs
  doc.setFont('helvetica', 'bold');
  doc.text('Arbeitgeberkosten (informativ)', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const empRows: Array<[string, string]> = [
    ['AHV Arbeitgeber', formatCHF(p.ahvEmployer)],
    ['BVG Arbeitgeber', formatCHF(p.bvgEmployer)],
  ];
  if (parseFloat(p.ktgUvgEmployer ?? '0') > 0) empRows.push(['KTG/UVG Arbeitgeber', formatCHF(p.ktgUvgEmployer)]);
  empRows.forEach(([label, amount]) => {
    doc.text(label, 15, y);
    doc.text(amount, pageW - 15, y, { align: 'right' });
    y += 5;
  });

  // Footer
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-CH')}`, pageW / 2, y, { align: 'center' });

  doc.save(`Lohnausweis_${emp?.code ?? 'MA'}_${p.year}_${String(p.month).padStart(2,'0')}.pdf`);
}

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

// ─── Jahreslohnausweis PDF ────────────────────────────────────────────────────
function generateJahreslohnausweis(summary: any, emp: any, company?: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 18;

  // Company header (left)
  const companyName = company?.companyName ?? 'WM Weibel Mueller AG';
  const companyAddress = [company?.street, [company?.zipCode, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const companyUid = company?.uid ? `UID: ${company.uid}` : '';
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(companyName, 15, y); y += 5;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,100,100);
  if (companyAddress) { doc.text(companyAddress, 15, y); y += 4; }
  if (companyUid) { doc.text(companyUid, 15, y); y += 4; }
  doc.setTextColor(0,0,0); y += 3;

  // Title
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('JAHRESLOHNAUSWEIS', pageW / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Geschäftsjahr ${summary.year}`, pageW / 2, y, { align: 'center' }); y += 8;

  // Employee info
  doc.setFontSize(9);
  const infoRows: Array<[string, string]> = [
    ['Arbeitnehmer', `${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`],
    ['Personalnummer', emp?.code ?? '–'],
  ];
  if (emp?.ahvNumber) infoRows.push(['AHV-Nummer', emp.ahvNumber]);
  if (emp?.employmentStart) infoRows.push(['Eintritt', new Date(emp.employmentStart).toLocaleDateString('de-CH')]);
  infoRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, 15, y);
    doc.setFont('helvetica', 'normal'); doc.text(val, 70, y); y += 5;
  });
  y += 4;

  // Monthly table header
  const col = { mon: 15, gross: 65, ahvEmp: 90, bvgEmp: 115, ktgEmp: 140, ded: 160, net: 185 };
  doc.setFillColor(50, 60, 80); doc.rect(14, y - 4, pageW - 28, 7, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('Monat', col.mon, y);
  doc.text('Brutto', col.gross, y, { align: 'right' });
  doc.text('AHV AN', col.ahvEmp, y, { align: 'right' });
  doc.text('BVG AN', col.bvgEmp, y, { align: 'right' });
  doc.text('KTG AN', col.ktgEmp, y, { align: 'right' });
  doc.text('Total Abz.', col.ded, y, { align: 'right' });
  doc.text('Netto', col.net, y, { align: 'right' });
  doc.setTextColor(0,0,0); y += 7;

  // Monthly rows – all 12 months, missing shown as dashes
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  Array.from({ length: 12 }, (_, i) => i + 1).forEach((monthNum, i) => {
    if (y > 265) { doc.addPage(); y = 20; }
    const m = summary.months.find((x: any) => x.month === monthNum);
    if (i % 2 === 0) { doc.setFillColor(248,248,248); doc.rect(14, y-4, pageW-28, 6, 'F'); }
    if (!m) { doc.setTextColor(180,180,180); }
    doc.text(MONTHS[monthNum - 1], col.mon, y);
    doc.text(m ? formatCHF(m.grossSalary) : '–', col.gross, y, { align: 'right' });
    doc.text(m ? formatCHF(m.ahvEmployee) : '–', col.ahvEmp, y, { align: 'right' });
    doc.text(m ? formatCHF(m.bvgEmployee) : '–', col.bvgEmp, y, { align: 'right' });
    doc.text(m ? formatCHF(m.ktgUvgEmployee) : '–', col.ktgEmp, y, { align: 'right' });
    doc.text(m ? formatCHF(m.totalDeductions) : '–', col.ded, y, { align: 'right' });
    doc.text(m ? formatCHF(m.netSalary) : '–', col.net, y, { align: 'right' });
    if (!m) doc.setTextColor(0,0,0);
    y += 6;
  });

  // Totals row
  y += 2;
  doc.setFillColor(220, 235, 255); doc.rect(14, y-4, pageW-28, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('JAHRESTOTAL', col.mon, y);
  doc.text(formatCHF(summary.totals.grossSalary), col.gross, y, { align: 'right' });
  doc.text(formatCHF(summary.totals.ahvEmployee), col.ahvEmp, y, { align: 'right' });
  doc.text(formatCHF(summary.totals.bvgEmployee), col.bvgEmp, y, { align: 'right' });
  doc.text(formatCHF(summary.totals.ktgUvgEmployee), col.ktgEmp, y, { align: 'right' });
  doc.text(formatCHF(summary.totals.totalDeductions), col.ded, y, { align: 'right' });
  doc.text(formatCHF(summary.totals.netSalary), col.net, y, { align: 'right' });
  y += 12;

  // Summary box
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const summaryItems: Array<[string, number, boolean]> = [
    ['Jahresbruttolohn', summary.totals.grossSalary, false],
    ['– Total AN-Abzüge (AHV + BVG + KTG)', summary.totals.totalDeductions, false],
    ['= Jahresnettolohn', summary.totals.netSalary, true],
    ['', 0, false],
    ['Arbeitgeberkosten über Brutto hinaus', summary.totals.totalEmployerAdditions, false],
    ['Total Lohnkosten Arbeitgeber', summary.totals.totalEmployerCost, true],
  ];
  summaryItems.forEach(([label, val, bold]) => {
    if (!label) { y += 2; return; }
    if (bold) { doc.setFillColor(235,245,235); doc.rect(14, y-4, pageW-28, 7, 'F'); doc.setFont('helvetica','bold'); }
    else doc.setFont('helvetica','normal');
    doc.text(label, 15, y);
    doc.text(`CHF ${formatCHF(val)}`, pageW-15, y, { align: 'right' });
    y += 6;
  });

  // Footer
  y += 8;
  doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-CH')}`, pageW/2, y, { align: 'center' });

  doc.save(`Jahreslohnausweis_${emp?.code ?? 'MA'}_${summary.year}.pdf`);
}

export default function Payroll() {
  const { fiscalYear: year } = useFiscalYear();
  const [showCreate, setShowCreate] = useState(false);
  const [annualEmpId, setAnnualEmpId] = useState<number | null>(null);

  const { data: employees } = trpc.payroll.getEmployees.useQuery();
  const { data: payrollList, refetch } = trpc.payroll.list.useQuery({ year });
  const { data: insuranceSettings } = trpc.settings.getInsuranceSettings.useQuery();
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
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

      {/* Tabs: Monatslöhne / Jahreslohnausweis */}
      <Tabs defaultValue="monthly">
        <TabsList className="mb-4">
          <TabsTrigger value="monthly" className="gap-2"><FileText className="h-4 w-4" /> Monatslöhne</TabsTrigger>
          <TabsTrigger value="annual" className="gap-2"><CalendarDays className="h-4 w-4" /> Jahreslohnausweis</TabsTrigger>
        </TabsList>

        {/* Monthly payroll list */}
        <TabsContent value="monthly">
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
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                            onClick={() => {
                              const empData = employees?.find(e => e.id === p.employeeId);
                              generateLohnausweis(p, empData, company);
                            }}>
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
        </TabsContent>

        {/* Annual payroll summary */}
        <TabsContent value="annual">
          <AnnualPayrollView
            year={year}
            employees={employees ?? []}
            company={company}
            annualEmpId={annualEmpId}
            setAnnualEmpId={setAnnualEmpId}
          />
        </TabsContent>
      </Tabs>

      {showCreate && (
        <CreatePayrollDialog
          employees={employees ?? []}
          insuranceSettings={insuranceSettings ?? []}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Jahreslohnausweis Ansicht ────────────────────────────────────────────────
function AnnualPayrollView({ year, employees, company, annualEmpId, setAnnualEmpId }: {
  year: number;
  employees: any[];
  company: any;
  annualEmpId: number | null;
  setAnnualEmpId: (id: number | null) => void;
}) {
  const selectedEmpId = annualEmpId ?? (employees[0]?.id ?? null);
  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  const { data: summary, isLoading } = trpc.payroll.annualSummary.useQuery(
    { year, employeeId: selectedEmpId! },
    { enabled: selectedEmpId !== null }
  );

  return (
    <div className="space-y-4">
      {/* Employee selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mitarbeiter</label>
          <Select value={String(selectedEmpId ?? '')} onValueChange={v => setAnnualEmpId(parseInt(v))}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Mitarbeiter wählen..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName} ({e.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {summary && summary.months.length > 0 && (
          <Button variant="outline" className="gap-2 mt-5" onClick={() => generateJahreslohnausweis(summary, selectedEmp, company)}>
            <FileText className="h-4 w-4" /> PDF Export
          </Button>
        )}
      </div>

      {isLoading && <div className="text-muted-foreground text-sm py-8 text-center">Lädt...</div>}

      {summary && summary.months.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Keine Lohnabrechnungen für {selectedEmp?.firstName} {selectedEmp?.lastName} im Jahr {year}</p>
        </div>
      )}

      {summary && summary.months.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Jahreslohnausweis {year}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedEmp?.firstName} {selectedEmp?.lastName} · {summary.months.length} Monat{summary.months.length !== 1 ? 'e' : ''} verbucht</p>
            </div>
          </div>

          {/* Monthly breakdown table – all 12 months, missing = empty row */}
          <div className="overflow-x-auto">
            <table className="accounting-table">
              <thead>
                <tr>
                  <th>Monat</th>
                  <th className="text-right">Bruttolohn CHF</th>
                  <th className="text-right">AHV AN CHF</th>
                  <th className="text-right">BVG AN CHF</th>
                  <th className="text-right">KTG AN CHF</th>
                  <th className="text-right">Total Abzüge CHF</th>
                  <th className="text-right">Nettolohn CHF</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(monthNum => {
                  const m = summary.months.find((x: any) => x.month === monthNum);
                  return (
                    <tr key={monthNum} className={!m ? 'opacity-40' : ''}>
                      <td className="text-sm font-medium">{MONTHS[monthNum - 1]}</td>
                      <td className="text-right font-mono text-sm">{m ? formatCHF(m.grossSalary) : '–'}</td>
                      <td className="text-right font-mono text-sm text-muted-foreground">{m ? formatCHF(m.ahvEmployee) : '–'}</td>
                      <td className="text-right font-mono text-sm text-muted-foreground">{m ? formatCHF(m.bvgEmployee) : '–'}</td>
                      <td className="text-right font-mono text-sm text-muted-foreground">{m ? formatCHF(m.ktgUvgEmployee) : '–'}</td>
                      <td className="text-right font-mono text-sm text-red-600">{m ? formatCHF(m.totalDeductions) : '–'}</td>
                      <td className="text-right font-mono text-sm font-semibold">{m ? formatCHF(m.netSalary) : '–'}</td>
                      <td>
                        {m ? (m.status === 'approved'
                          ? <span className="badge-approved">Verbucht</span>
                          : <span className="badge-pending">Entwurf</span>)
                          : <span className="text-xs text-muted-foreground">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
                  <td className="text-sm font-bold px-4 py-3">JAHRESTOTAL</td>
                  <td className="text-right font-mono text-sm px-4 py-3">{formatCHF(summary.totals.grossSalary)}</td>
                  <td className="text-right font-mono text-sm px-4 py-3 text-muted-foreground">{formatCHF(summary.totals.ahvEmployee)}</td>
                  <td className="text-right font-mono text-sm px-4 py-3 text-muted-foreground">{formatCHF(summary.totals.bvgEmployee)}</td>
                  <td className="text-right font-mono text-sm px-4 py-3 text-muted-foreground">{formatCHF(summary.totals.ktgUvgEmployee)}</td>
                  <td className="text-right font-mono text-sm px-4 py-3 text-red-600">{formatCHF(summary.totals.totalDeductions)}</td>
                  <td className="text-right font-mono text-sm px-4 py-3">{formatCHF(summary.totals.netSalary)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 border-t border-border">
            <div className="bg-muted/40 rounded-lg p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Jahresbruttolohn</div>
              <div className="text-lg font-bold font-mono">CHF {formatCHF(summary.totals.grossSalary)}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Total AN-Abzüge</div>
              <div className="text-lg font-bold font-mono text-red-700">CHF {formatCHF(summary.totals.totalDeductions)}</div>
              <div className="text-xs text-muted-foreground mt-1">AHV + BVG + KTG</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Jahresnettolohn</div>
              <div className="text-lg font-bold font-mono text-green-800">CHF {formatCHF(summary.totals.netSalary)}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Total Lohnkosten AG</div>
              <div className="text-lg font-bold font-mono text-blue-800">CHF {formatCHF(summary.totals.totalEmployerCost)}</div>
              <div className="text-xs text-muted-foreground mt-1">inkl. AG-Anteile</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePayrollDialog({ employees, insuranceSettings, onClose, onSaved }: {
  employees: any[]; insuranceSettings: any[]; onClose: () => void; onSaved: () => void;
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

  // Auto-fill from employee data using DB insurance settings
  const fillFromEmployee = (emp: any) => {
    if (!emp) return;
    const gross = 10000; // Default, user will adjust
    setGrossSalary(gross.toFixed(2));
    recalcInsurance(gross, emp);
  };

  const recalcInsurance = (grossVal: number, emp?: any) => {
    // AHV from DB or fallback 5.3%
    const ahvSetting = insuranceSettings.find((s: any) => s.insuranceType === 'ahv' && s.isActive);
    const ahvEmpRate = ahvSetting ? parseFloat(ahvSetting.employeeRate ?? '0.053') : 0.053;
    const ahvEmprRate = ahvSetting ? parseFloat(ahvSetting.employerRate ?? '0.053') : 0.053;
    setAhvEmployee((grossVal * ahvEmpRate).toFixed(2));
    setAhvEmployer((grossVal * ahvEmprRate).toFixed(2));
    // BVG from DB or fallback 8%
    const bvgSetting = insuranceSettings.find((s: any) => s.insuranceType === 'bvg' && s.isActive);
    const bvgEmpRate = bvgSetting ? parseFloat(bvgSetting.employeeRate ?? '0.08') : 0.08;
    const bvgEmprRate = bvgSetting ? parseFloat(bvgSetting.employerRate ?? '0.08') : 0.08;
    setBvgEmployee((grossVal * bvgEmpRate).toFixed(2));
    setBvgEmployer((grossVal * bvgEmprRate).toFixed(2));
    // KTG from DB or fallback 0
    const ktgSetting = insuranceSettings.find((s: any) => (s.insuranceType === 'ktg' || s.insuranceType === 'uvg') && s.isActive);
    const ktgEmpRate = ktgSetting ? parseFloat(ktgSetting.employeeRate ?? '0') : 0;
    const ktgEmprRate = ktgSetting ? parseFloat(ktgSetting.employerRate ?? '0') : 0;
    setKtgEmployee((grossVal * ktgEmpRate).toFixed(2));
    setKtgEmployer((grossVal * ktgEmprRate).toFixed(2));
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
              <Input className="font-mono text-right" value={grossSalary} onChange={e => {
                setGrossSalary(e.target.value);
                const g = parseFloat(e.target.value);
                if (!isNaN(g) && g > 0) recalcInsurance(g);
              }} placeholder="0.00" />
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
