import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Plus, Check, FileText, Calculator, Download, Trash2, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
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
  const [expandedPeriods, setExpandedPeriods] = useState<Set<number>>(new Set());

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

  const handleSubmit = (vatPeriodId: number) => {
    toast.info("Einreichung wird vorbereitet (Funktion in Kürze verfügbar)");
  };

  const toggleExpand = (id: number) => {
    setExpandedPeriods(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
                <th className="w-8"></th>
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
                  <td colSpan={vatMethod !== "saldo" ? 8 : 7} className="text-center py-12 text-muted-foreground">
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
                const isExpanded = expandedPeriods.has(vp.id);
                return (
                  <VatPeriodRow
                    key={vp.id}
                    vp={vp}
                    vatMethod={vatMethod}
                    saldoRate={saldoRate}
                    totalTurnover={totalTurnover}
                    taxDue={taxDue}
                    inputTax={inputTax}
                    netTax={netTax}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(vp.id)}
                    onDetail={() => setSelectedPeriod(vp)}
                    onSubmit={() => handleSubmit(vp.id)}
                    onDelete={() => setDeleteConfirm(vp.id)}
                  />
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

// ─── Expandable Period Row ──────────────────────────────────────────────────────
function VatPeriodRow({ vp, vatMethod, saldoRate, totalTurnover, taxDue, inputTax, netTax, isExpanded, onToggle, onDetail, onSubmit, onDelete }: {
  vp: any;
  vatMethod: string;
  saldoRate: number;
  totalTurnover: number;
  taxDue: number;
  inputTax: number;
  netTax: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onSubmit: () => void;
  onDelete: () => void;
}) {
  const { data: detail, isLoading: detailLoading } = trpc.vat.detail.useQuery(
    { vatPeriodId: vp.id },
    { enabled: isExpanded }
  );

  return (
    <>
      <tr className="cursor-pointer hover:bg-muted/30" onClick={onToggle}>
        <td className="w-8 text-center">
          {isExpanded
            ? <ChevronDown className="h-4 w-4 inline text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 inline text-muted-foreground" />
          }
        </td>
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
        <td className="text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
              onClick={onDetail}>
              <FileText className="h-3 w-3" /> Detail
            </Button>
            {vp.status === "open" && (
              <>
                <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                  onClick={onSubmit}>
                  <Check className="h-3 w-3" /> Einreichen
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={onDelete}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={vatMethod !== "saldo" ? 8 : 7} className="p-0 bg-muted/20">
            <VatDetailInline detail={detail} isLoading={detailLoading} vatMethod={vatMethod} saldoRate={saldoRate} period={vp} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Inline Detail (expandable rows) ────────────────────────────────────────────
function VatDetailInline({ detail, isLoading, vatMethod, saldoRate, period }: {
  detail: any;
  isLoading: boolean;
  vatMethod: string;
  saldoRate: number;
  period: any;
}) {
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
  const detailRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
        Transaktionen werden geladen...
      </div>
    );
  }

  if (!detail?.transactions?.length) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Keine MWST-relevanten Transaktionen in dieser Periode.
      </div>
    );
  }

  const revenueTransactions = detail.transactions.filter((t: any) => t.category === 'revenue');
  const expenseTransactions = detail.transactions.filter((t: any) => t.category === 'expense');

  const totalRevenue = revenueTransactions.reduce((s: number, t: any) => s + t.totalAmount, 0);
  const totalRevenueVat = revenueTransactions.reduce((s: number, t: any) => s + t.vatAmount, 0);
  const totalExpenseVat = expenseTransactions.reduce((s: number, t: any) => s + t.vatAmount, 0);

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 15;
    const leftM = 14;
    const rightM = pageW - 14;

    // Header
    const companyName = company?.companyName ?? 'WM Weibel Mueller AG';
    const companyAddress = [company?.street, [company?.zipCode, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const vatNr = company?.vatNumber ? `MWST-Nr.: ${company.vatNumber}` : '';

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    if (companyAddress) { doc.text(companyAddress, pageW / 2, y, { align: 'center' }); y += 3.5; }
    if (vatNr) { doc.text(vatNr, pageW / 2, y, { align: 'center' }); y += 3.5; }
    doc.setTextColor(0, 0, 0);
    y += 3;

    // Title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`MWST-ABRECHNUNG ${period.period} ${period.year}`, pageW / 2, y, { align: 'center' });
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Periode: ${formatDate(period.startDate)} – ${formatDate(period.endDate)}`, pageW / 2, y, { align: 'center' });
    if (vatMethod === "saldo") {
      y += 3.5;
      doc.text(`Saldosteuersatz-Methode (${saldoRate}%)`, pageW / 2, y, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
    y += 6;

    // Summary section
    const drawSummaryLine = (label: string, value: string, bold: boolean = false) => {
      if (bold) {
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(235, 235, 235);
        doc.rect(leftM, y - 3.5, rightM - leftM, 5.5, 'F');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.setFontSize(9);
      doc.text(label, leftM + 1, y);
      doc.text(value, rightM - 1, y, { align: 'right' });
      y += 5;
    };

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Zusammenfassung', leftM, y);
    y += 5;

    if (vatMethod === "saldo") {
      drawSummaryLine('Bruttoumsatz', `CHF ${formatCHF(totalRevenue)}`);
      drawSummaryLine(`MWST (${saldoRate}%)`, `CHF ${formatCHF(totalRevenueVat)}`);
      drawSummaryLine('Zahllast', `CHF ${formatCHF(totalRevenueVat)}`, true);
    } else {
      const turnover81 = parseFloat(period.turnover81 || "0");
      const turnover26 = parseFloat(period.turnover26 || "0");
      const turnover38 = parseFloat(period.turnover38 || "0");
      const vatDue81 = parseFloat(period.vatDue81 || "0");
      const vatDue26 = parseFloat(period.vatDue26 || "0");
      const vatDue38 = parseFloat(period.vatDue38 || "0");
      const inputTaxVal = parseFloat(period.inputTax || "0");
      const taxDue = vatDue81 + vatDue26 + vatDue38;
      const netTax = taxDue - inputTaxVal;
      drawSummaryLine('Umsatz 8.1%', `CHF ${formatCHF(turnover81)}`);
      drawSummaryLine('MWST 8.1%', `CHF ${formatCHF(vatDue81)}`);
      if (turnover26 > 0) drawSummaryLine('Umsatz 2.6%', `CHF ${formatCHF(turnover26)}`);
      if (vatDue26 > 0) drawSummaryLine('MWST 2.6%', `CHF ${formatCHF(vatDue26)}`);
      if (turnover38 > 0) drawSummaryLine('Umsatz 3.8%', `CHF ${formatCHF(turnover38)}`);
      if (vatDue38 > 0) drawSummaryLine('MWST 3.8%', `CHF ${formatCHF(vatDue38)}`);
      drawSummaryLine('Total MWST geschuldet', `CHF ${formatCHF(taxDue)}`, true);
      drawSummaryLine('Vorsteuer', `CHF ${formatCHF(inputTaxVal)}`);
      drawSummaryLine(netTax > 0 ? 'Zahllast' : 'Guthaben', `CHF ${formatCHF(Math.abs(netTax))}`, true);
    }
    y += 4;

    // Transaction detail table
    const drawTransactionTable = (title: string, transactions: any[]) => {
      if (transactions.length === 0) return;

      // Check if we need a new page
      if (y > pageH - 30) { doc.addPage(); y = 15; }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, leftM, y);
      y += 5;

      // Table header
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(220, 220, 220);
      doc.rect(leftM, y - 3, rightM - leftM, 4.5, 'F');
      doc.text('Datum', leftM + 1, y);
      doc.text('Beleg', leftM + 22, y);
      doc.text('Beschreibung', leftM + 40, y);
      doc.text('Betrag CHF', rightM - 45, y, { align: 'right' });
      doc.text('MWST-Satz', rightM - 22, y, { align: 'right' });
      doc.text('MWST CHF', rightM - 1, y, { align: 'right' });
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      let totalAmt = 0;
      let totalVat = 0;

      for (const txn of transactions) {
        if (y > pageH - 15) { doc.addPage(); y = 15; }

        const desc = txn.description.length > 55 ? txn.description.substring(0, 52) + '...' : txn.description;
        doc.text(formatDate(txn.bookingDate), leftM + 1, y);
        doc.text(txn.entryNumber || '-', leftM + 22, y);
        doc.text(desc, leftM + 40, y);
        doc.text(formatCHF(Math.abs(txn.totalAmount)), rightM - 45, y, { align: 'right' });
        doc.text(`${txn.effectiveVatRate.toFixed(1)}%`, rightM - 22, y, { align: 'right' });
        doc.text(formatCHF(Math.abs(txn.vatAmount)), rightM - 1, y, { align: 'right' });
        totalAmt += Math.abs(txn.totalAmount);
        totalVat += Math.abs(txn.vatAmount);
        y += 3.8;
      }

      // Total line
      doc.setLineWidth(0.3);
      doc.line(leftM, y - 1, rightM, y - 1);
      y += 1.5;
      doc.setFont('helvetica', 'bold');
      doc.text('Total', leftM + 1, y);
      doc.text(formatCHF(totalAmt), rightM - 45, y, { align: 'right' });
      doc.text(formatCHF(totalVat), rightM - 1, y, { align: 'right' });
      y += 6;
    };

    drawTransactionTable('Umsatzsteuer – Ertragskonten (MWST geschuldet)', revenueTransactions);
    if (vatMethod !== "saldo") {
      drawTransactionTable('Vorsteuer – Aufwandkonten (Vorsteuerabzug)', expenseTransactions);
    }

    // Footer
    y += 2;
    if (y > pageH - 15) { doc.addPage(); y = 15; }
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-CH')} | ${detail.transactions.length} MWST-relevante Transaktionen`, pageW / 2, y, { align: 'center' });

    doc.save(`MWST_Detail_${period.period}_${period.year}.pdf`);
    toast.success("PDF exportiert");
  };

  const handlePrint = () => {
    const printContent = detailRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error("Pop-up blockiert. Bitte erlauben Sie Pop-ups."); return; }
    printWindow.document.write(`
      <html><head><title>MWST-Abrechnung ${period.period} ${period.year}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #333; margin: 20px; }
        h3 { font-size: 14px; margin: 16px 0 8px; }
        h4 { font-size: 12px; margin: 12px 0 6px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #f0f0f0; font-weight: 600; text-align: left; padding: 4px 8px; border-bottom: 2px solid #ccc; font-size: 10px; }
        td { padding: 3px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
        .text-right { text-align: right; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .total-row { font-weight: bold; border-top: 2px solid #333; }
        .section-title { background: #f5f5f5; padding: 6px 8px; font-weight: 600; margin: 8px 0 4px; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      <h3>${company?.companyName ?? 'WM Weibel Mueller AG'}</h3>
      <p style="color:#888;font-size:9px;">${company?.vatNumber ? 'MWST-Nr.: ' + company.vatNumber : ''}</p>
      <h3>MWST-Abrechnung ${period.period} ${period.year}</h3>
      <p style="color:#666;font-size:10px;">Periode: ${formatDate(period.startDate)} – ${formatDate(period.endDate)}${vatMethod === "saldo" ? ` | Saldosteuersatz ${saldoRate}%` : ''}</p>
      ${printContent.innerHTML}
      <p style="color:#aaa;font-size:8px;margin-top:20px;">Erstellt am ${new Date().toLocaleDateString('de-CH')}</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Export/Print buttons */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {detail.transactions.length} MWST-relevante Transaktionen
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handlePrint}>
            <Printer className="h-3 w-3" /> Drucken
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExportPdf}>
            <Download className="h-3 w-3" /> PDF Export
          </Button>
        </div>
      </div>

      <div ref={detailRef}>
        {/* Revenue transactions */}
        {revenueTransactions.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Umsatzsteuer – Ertragskonten ({revenueTransactions.length})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold">Datum</th>
                    <th className="text-left px-3 py-2 font-semibold">Beleg</th>
                    <th className="text-left px-3 py-2 font-semibold">Beschreibung</th>
                    <th className="text-right px-3 py-2 font-semibold">Betrag CHF</th>
                    <th className="text-right px-3 py-2 font-semibold">MWST-Satz</th>
                    <th className="text-right px-3 py-2 font-semibold">MWST CHF</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueTransactions.map((txn: any) => (
                    <tr key={txn.entryId} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-mono">{formatDate(txn.bookingDate)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{txn.entryNumber || '-'}</td>
                      <td className="px-3 py-1.5 max-w-[300px] truncate" title={txn.description}>{txn.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatCHF(txn.totalAmount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{txn.effectiveVatRate.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono amount-negative">{formatCHF(txn.vatAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td colSpan={3} className="px-3 py-2">Total Umsatzsteuer</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCHF(totalRevenue)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right font-mono amount-negative">{formatCHF(totalRevenueVat)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Expense transactions (Vorsteuer) - only for effective method */}
        {vatMethod !== "saldo" && expenseTransactions.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Vorsteuer – Aufwandkonten ({expenseTransactions.length})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold">Datum</th>
                    <th className="text-left px-3 py-2 font-semibold">Beleg</th>
                    <th className="text-left px-3 py-2 font-semibold">Beschreibung</th>
                    <th className="text-right px-3 py-2 font-semibold">Betrag CHF</th>
                    <th className="text-right px-3 py-2 font-semibold">MWST-Satz</th>
                    <th className="text-right px-3 py-2 font-semibold">Vorsteuer CHF</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseTransactions.map((txn: any) => (
                    <tr key={txn.entryId} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-mono">{formatDate(txn.bookingDate)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{txn.entryNumber || '-'}</td>
                      <td className="px-3 py-1.5 max-w-[300px] truncate" title={txn.description}>{txn.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatCHF(txn.totalAmount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{txn.effectiveVatRate.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono amount-positive">{formatCHF(txn.vatAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td colSpan={3} className="px-3 py-2">Total Vorsteuer</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCHF(expenseTransactions.reduce((s: number, t: any) => s + t.totalAmount, 0))}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right font-mono amount-positive">{formatCHF(totalExpenseVat)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Dialog ──────────────────────────────────────────────────────────────
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

// ─── Detail Dialog (existing, enhanced) ─────────────────────────────────────────
function VatDetailDialog({ period, vatMethod, saldoRate, onClose }: {
  period: any; vatMethod: string; saldoRate: number; onClose: () => void;
}) {
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
  const { data: detail, isLoading: detailLoading } = trpc.vat.detail.useQuery({ vatPeriodId: period.id });

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

          {/* Transaction detail in dialog */}
          {detailLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              Transaktionen laden...
            </div>
          ) : detail?.transactions?.length ? (
            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">Datum</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Beschreibung</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Betrag</th>
                    <th className="text-right px-2 py-1.5 font-semibold">MWST</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.transactions.map((txn: any) => (
                    <tr key={txn.entryId} className="border-t border-border/50">
                      <td className="px-2 py-1 font-mono">{formatDate(txn.bookingDate)}</td>
                      <td className="px-2 py-1 truncate max-w-[200px]" title={txn.description}>{txn.description}</td>
                      <td className="px-2 py-1 text-right font-mono">{formatCHF(txn.totalAmount)}</td>
                      <td className="px-2 py-1 text-right font-mono">{formatCHF(txn.vatAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">Keine MWST-relevanten Transaktionen</p>
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
