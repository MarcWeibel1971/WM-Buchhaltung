import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Plus, Check, FileText, Calculator, Download, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const PERIODS = [
  { value: "Q1", label: "Q1 (Jan–Mrz)" },
  { value: "Q2", label: "Q2 (Apr–Jun)" },
  { value: "Q3", label: "Q3 (Jul–Sep)" },
  { value: "Q4", label: "Q4 (Okt–Dez)" },
  { value: "S1", label: "S1 (Jan–Jun)" },
  { value: "S2", label: "S2 (Jul–Dez)" },
];

export default function Vat() {
  const { fiscalYear: year } = useFiscalYear();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: vatPeriods, refetch } = trpc.vat.list.useQuery({ year });
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
  const utils = trpc.useUtils();

  const vatMethod = company?.vatMethod ?? "effective";
  const saldoRate = company?.vatSaldoRate ? parseFloat(company.vatSaldoRate as string) : 6.2;

  const deleteMutation = trpc.vat.delete.useMutation({
    onSuccess: () => {
      toast.success("MWST-Abrechnung gelöscht");
      refetch();
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // submit not yet in router – show toast placeholder
  const handleSubmit = (vatPeriodId: number) => {
    toast.info("Einreichung wird vorbereitet (Funktion in Kürze verfügbar)");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">MWST-Abrechnung</h2>
          <p className="text-sm text-muted-foreground">
            {vatMethod === "saldo"
              ? `Saldosteuersatz-Methode (${saldoRate}%)`
              : "Schweizer Mehrwertsteuer (8.1% / 2.6% / 3.8%)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Neue Abrechnung
          </Button>
        </div>
      </div>

      {/* MWST Rates Info */}
      {vatMethod === "saldo" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-primary">{saldoRate}%</div>
            <div className="text-sm font-medium mt-1">Saldosteuersatz</div>
            <div className="text-xs text-muted-foreground">Auf den Bruttoumsatz</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-muted-foreground">0%</div>
            <div className="text-sm font-medium mt-1">Vorsteuer</div>
            <div className="text-xs text-muted-foreground">Kein Vorsteuerabzug bei Saldosteuersatz</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {[
            { rate: "8.1%", label: "Normalsatz", desc: "Standardleistungen" },
            { rate: "2.6%", label: "Sondersatz", desc: "Beherbergung" },
            { rate: "3.8%", label: "Redukt. Satz", desc: "Lebensmittel etc." },
          ].map(r => (
            <div key={r.rate} className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-primary">{r.rate}</div>
              <div className="text-sm font-medium mt-1">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* VAT Periods */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Abrechnungsperioden {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Periode</th>
                <th className="text-right">Umsatz CHF</th>
                <th className="text-right">MWST geschuldet CHF</th>
                {vatMethod !== "saldo" && <th className="text-right">Vorsteuer CHF</th>}
                <th className="text-right">Zahllast CHF</th>
                <th>Status</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!vatPeriods?.length ? (
                <tr>
                  <td colSpan={vatMethod !== "saldo" ? 7 : 6} className="text-center py-12 text-muted-foreground">
                    <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Keine Abrechnungen für {year}
                  </td>
                </tr>
              ) : vatPeriods.map(vp => {
                const vatDue81 = parseFloat(vp.vatDue81 as string || "0");
                const vatDue26 = parseFloat(vp.vatDue26 as string || "0");
                const vatDue38 = parseFloat(vp.vatDue38 as string || "0");
                const taxDue = vatDue81 + vatDue26 + vatDue38;
                const inputTax = parseFloat(vp.inputTax as string || "0");
                const netTax = taxDue - inputTax;
                const totalTurnover = parseFloat(vp.turnover81 as string||"0")+parseFloat(vp.turnover26 as string||"0")+parseFloat(vp.turnover38 as string||"0");
                return (
                  <tr key={vp.id}>
                    <td className="text-sm font-medium">{vp.period}</td>
                    <td className="text-right font-mono text-sm">{formatCHF(totalTurnover)}</td>
                    <td className="text-right font-mono text-sm amount-negative">{formatCHF(taxDue)}</td>
                    {vatMethod !== "saldo" && (
                      <td className="text-right font-mono text-sm amount-positive">{formatCHF(inputTax)}</td>
                    )}
                    <td className={`text-right font-mono text-sm font-semibold ${netTax > 0 ? "amount-negative" : "amount-positive"}`}>
                      {formatCHF(Math.abs(netTax))}
                      <span className="text-xs text-muted-foreground ml-1">{netTax > 0 ? "zu zahlen" : "Guthaben"}</span>
                    </td>
                    <td>
                      {vp.status === "open"
                        ? <span className="badge-pending">Offen</span>
                        : vp.status === "submitted"
                        ? <span className="badge-approved">Eingereicht</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Bezahlt</span>}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                          onClick={() => setSelectedPeriod(vp)}>
                          <FileText className="h-3 w-3" /> Detail
                        </Button>
                        {vp.status === "open" && (
                          <>
                            <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                              onClick={() => handleSubmit(vp.id)}>
                              <Check className="h-3 w-3" /> Einreichen
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(vp.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <CreateVatDialog
          year={year}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refetch(); }}
        />
      )}

      {/* Detail Dialog */}
      {selectedPeriod && (
        <VatDetailDialog
          period={selectedPeriod}
          vatMethod={vatMethod}
          saldoRate={saldoRate}
          onClose={() => setSelectedPeriod(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm !== null && (
        <Dialog open onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="w-[min(95vw,28rem)] max-w-none">
            <DialogHeader>
              <DialogTitle>MWST-Abrechnung löschen?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Möchten Sie diese MWST-Abrechnung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Abbrechen</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deleteConfirm })}>
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateVatDialog({ year, onClose, onSaved }: {
  year: number; onClose: () => void; onSaved: () => void;
}) {
  const [period, setPeriod] = useState("Q1");

  const createMutation = trpc.vat.create.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[min(95vw,32rem)] max-w-none">
        <DialogHeader>
          <DialogTitle>MWST-Abrechnung erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Periode</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Die MWST-Beträge werden automatisch aus den genehmigten Buchungen der gewählten Periode berechnet.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={createMutation.isPending}
            onClick={() => {
              const periodDates: Record<string, [string, string]> = {
                Q1: [`${year}-01-01`, `${year}-03-31`],
                Q2: [`${year}-04-01`, `${year}-06-30`],
                Q3: [`${year}-07-01`, `${year}-09-30`],
                Q4: [`${year}-10-01`, `${year}-12-31`],
                S1: [`${year}-01-01`, `${year}-06-30`],
                S2: [`${year}-07-01`, `${year}-12-31`],
              };
              const [startDate, endDate] = periodDates[period] ?? [`${year}-01-01`, `${year}-12-31`];
              createMutation.mutate({ year, period, startDate, endDate });
            }}
          >
            Berechnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VatDetailDialog({ period, vatMethod, saldoRate, onClose }: {
  period: any; vatMethod: string; saldoRate: number; onClose: () => void;
}) {
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
  const taxDue = parseFloat(period.vatDue81||"0") + parseFloat(period.vatDue26||"0") + parseFloat(period.vatDue38||"0");
  const inputTax = parseFloat(period.inputTax||"0");
  const netTax = taxDue - inputTax;
  const totalTurnover = parseFloat(period.turnover81||"0") + parseFloat(period.turnover26||"0") + parseFloat(period.turnover38||"0");

  const exportVatPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;
    const companyName = company?.companyName ?? 'WM Weibel Mueller AG';
    const companyAddress = [company?.street, [company?.zipCode, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const vatNr = company?.vatNumber ? `MWST-Nr.: ${company.vatNumber}` : '';
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageW / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,100,100);
    if (companyAddress) { doc.text(companyAddress, pageW / 2, y, { align: 'center' }); y += 4; }
    if (vatNr) { doc.text(vatNr, pageW / 2, y, { align: 'center' }); y += 4; }
    doc.setTextColor(0,0,0); y += 4;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(`MWST-ABRECHNUNG ${period.period} ${period.year}`, pageW / 2, y, { align: 'center' }); y += 3;
    if (vatMethod === "saldo") {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,100,100);
      doc.text(`Saldosteuersatz-Methode (${saldoRate}%)`, pageW / 2, y + 4, { align: 'center' });
      doc.setTextColor(0,0,0); y += 10;
    } else {
      y += 7;
    }

    const lines: Array<[string, string, boolean]> = vatMethod === "saldo"
      ? [
          [`Bruttoumsatz`, `CHF ${formatCHF(totalTurnover)}`, false],
          [`MWST (${saldoRate}%)`, `CHF ${formatCHF(taxDue)}`, false],
          [`Zahllast`, `CHF ${formatCHF(Math.abs(netTax))}`, true],
        ]
      : [
          [`Umsatz 8.1%`, `CHF ${formatCHF(period.turnover81||'0')}`, false],
          [`MWST 8.1%`, `CHF ${formatCHF(period.vatDue81||'0')}`, false],
          [`MWST 2.6%`, `CHF ${formatCHF(period.vatDue26||'0')}`, false],
          [`MWST 3.8%`, `CHF ${formatCHF(period.vatDue38||'0')}`, false],
          [`Total MWST geschuldet`, `CHF ${formatCHF(taxDue)}`, true],
          [`Vorsteuer`, `CHF ${formatCHF(inputTax)}`, false],
          [netTax > 0 ? 'Zahllast' : 'Guthaben', `CHF ${formatCHF(Math.abs(netTax))}`, true],
        ];
    doc.setFontSize(9);
    lines.forEach(([label, value, bold]) => {
      if (bold) { doc.setFont('helvetica','bold'); doc.setFillColor(240,240,240); doc.rect(14, y-4, pageW-28, 7, 'F'); }
      else doc.setFont('helvetica','normal');
      doc.text(label, 15, y);
      doc.text(value, pageW-15, y, { align: 'right' });
      y += 6;
    });
    y += 6; doc.setFontSize(8); doc.setTextColor(150,150,150);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-CH')}`, pageW/2, y, { align: 'center' });
    doc.save(`MWST_${period.period}_${period.year}.pdf`);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[min(95vw,36rem)] max-w-none">
        <DialogHeader>
          <DialogTitle>MWST-Abrechnung {period.period} {period.year}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {vatMethod === "saldo" ? (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="text-xs text-muted-foreground mb-2">Saldosteuersatz-Methode ({saldoRate}%)</div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bruttoumsatz</span>
                <span className="font-mono">CHF {formatCHF(totalTurnover)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MWST ({saldoRate}%)</span>
                <span className="font-mono amount-negative">CHF {formatCHF(taxDue)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
                <span>Zahllast</span>
                <span className="font-mono amount-negative">CHF {formatCHF(Math.abs(netTax))}</span>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Umsatz 8.1%</span>
                <span className="font-mono">CHF {formatCHF(period.turnover81||"0")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MWST 8.1%</span>
                <span className="font-mono amount-negative">CHF {formatCHF(period.vatDue81||"0")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MWST 2.6%</span>
                <span className="font-mono amount-negative">CHF {formatCHF(period.vatDue26||"0")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MWST 3.8%</span>
                <span className="font-mono amount-negative">CHF {formatCHF(period.vatDue38||"0")}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-medium">
                <span>Total MWST geschuldet</span>
                <span className="font-mono amount-negative">CHF {formatCHF(taxDue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vorsteuer</span>
                <span className="font-mono amount-positive">CHF {formatCHF(inputTax)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
                <span>{netTax > 0 ? "Zahllast" : "Guthaben"}</span>
                <span className={`font-mono ${netTax > 0 ? "amount-negative" : "amount-positive"}`}>
                  CHF {formatCHF(Math.abs(netTax))}
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schliessen</Button>
          <Button variant="default" className="gap-2" onClick={exportVatPdf}>
            <Download className="h-4 w-4" /> PDF Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
