import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Check, FileText, Calculator } from "lucide-react";
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);

  const { data: vatPeriods, refetch } = trpc.vat.list.useQuery({ year });
  const utils = trpc.useUtils();

  // submit not yet in router – show toast placeholder
  const handleSubmit = (vatPeriodId: number) => {
    toast.info("Einreichung wird vorbereitet (Funktion in Kürze verfügbar)");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">MWST-Abrechnung</h2>
          <p className="text-sm text-muted-foreground">Schweizer Mehrwertsteuer (8.1% / 2.6% / 3.8%)</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2023,2024,2025,2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Neue Abrechnung
          </Button>
        </div>
      </div>

      {/* MWST Rates Info */}
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
                <th className="text-right">Vorsteuer CHF</th>
                <th className="text-right">Zahllast CHF</th>
                <th>Status</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!vatPeriods?.length ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
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
                return (
                  <tr key={vp.id}>
                    <td className="text-sm font-medium">{vp.period}</td>
                    <td className="text-right font-mono text-sm">{formatCHF(parseFloat(vp.turnover81 as string||"0")+parseFloat(vp.turnover26 as string||"0")+parseFloat(vp.turnover38 as string||"0"))}</td>
                    <td className="text-right font-mono text-sm amount-negative">{formatCHF(taxDue)}</td>
                    <td className="text-right font-mono text-sm amount-positive">{formatCHF(inputTax)}</td>
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
                          <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                            onClick={() => handleSubmit(vp.id)}>
                            <Check className="h-3 w-3" /> Einreichen
                          </Button>
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
          onClose={() => setSelectedPeriod(null)}
        />
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
      <DialogContent className="max-w-md">
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
              // Calculate start/end dates based on period
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

function VatDetailDialog({ period, onClose }: { period: any; onClose: () => void }) {
  const taxDue = parseFloat(period.vatDue81||"0") + parseFloat(period.vatDue26||"0") + parseFloat(period.vatDue38||"0");
  const inputTax = parseFloat(period.inputTax||"0");
  const netTax = taxDue - inputTax;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>MWST-Abrechnung {period.period} {period.year}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schliessen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
