import { trpc } from "@/lib/trpc";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { BarChart3, Download, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { jsPDF } from "jspdf";
import Accounts from "./Accounts";

function exportToPdf(title: string, year: number, rows: Array<{label: string; amount: number; indent?: number; bold?: boolean}>, company?: { companyName?: string | null; legalForm?: string | null; street?: string | null; zipCode?: string | null; city?: string | null; uid?: string | null; vatNumber?: string | null }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;
  
  // Header
  const companyName = company?.companyName ?? 'WM Weibel Mueller AG';
  const companyAddress = [company?.street, [company?.zipCode, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const companyUid = company?.uid ? `UID: ${company.uid}` : '';
  const companyVat = company?.vatNumber ? `MWST-Nr.: ${company.vatNumber}` : '';
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageW / 2, y, { align: 'center' });
  y += 7;
  if (companyAddress) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(companyAddress, pageW / 2, y, { align: 'center' });
    y += 5;
  }
  if (companyUid || companyVat) {
    doc.setFontSize(8);
    const uidVatLine = [companyUid, companyVat].filter(Boolean).join('  |  ');
    doc.text(uidVatLine, pageW / 2, y, { align: 'center' });
    y += 5;
  }
  doc.setTextColor(0, 0, 0);
  y += 3;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${title} ${year}`, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-CH')}`, pageW / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 10;
  
  // Table
  doc.setFontSize(9);
  rows.forEach(row => {
    if (y > 270) { doc.addPage(); y = 20; }
    const indent = (row.indent ?? 0) * 5;
    if (row.bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(245, 245, 245);
      doc.rect(14, y - 4, pageW - 28, 7, 'F');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.text(row.label, 15 + indent, y);
    const amtStr = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2 }).format(Math.abs(row.amount));
    doc.text(`CHF ${amtStr}`, pageW - 15, y, { align: 'right' });
    y += 6;
  });
  
  doc.save(`${title.replace(/\s/g, '_')}_${year}.pdf`);
}

function formatCHF(val: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function AccountRow({ account, balance, indent = 0 }: { account: any; balance: number; indent?: number }) {
  if (Math.abs(balance) < 0.01) return null;
  return (
    <tr>
      <td className="py-1.5 text-sm" style={{ paddingLeft: `${12 + indent * 16}px` }}>
        <span className="font-mono text-xs text-muted-foreground mr-2">{account.number}</span>
        {account.name}
      </td>
      <td className={`text-right py-1.5 font-mono text-sm ${balance >= 0 ? "" : "text-red-600"}`}>
        {formatCHF(Math.abs(balance))}
      </td>
    </tr>
  );
}

export default function Reports() {
  const { fiscalYear: year } = useFiscalYear();
  const prevYear = year - 1;

  const { data: bs } = trpc.reports.balanceSheet.useQuery({ fiscalYear: year });
  const { data: bsPrev } = trpc.reports.balanceSheet.useQuery({ fiscalYear: prevYear });
  const { data: is } = trpc.reports.incomeStatement.useQuery({ fiscalYear: year });
  const { data: isPrev } = trpc.reports.incomeStatement.useQuery({ fiscalYear: prevYear });
  const { data: company } = trpc.settings.getCompanySettings.useQuery();

  const totalAssets = bs?.assets.reduce((s, a) => s + a.balance, 0) ?? 0;
  const totalLiabilities = bs?.liabilities.reduce((s, a) => s + a.balance, 0) ?? 0;
  const totalEquity = bs?.equity.reduce((s, a) => s + a.balance, 0) ?? 0;
  const totalRevenue = is?.revenues.reduce((s, r) => s + r.balance, 0) ?? 0;
  const totalExpenses = is?.expenses.reduce((s, e) => s + e.balance, 0) ?? 0;
  const profit = totalRevenue - totalExpenses;

  const totalAssetsPrev = bsPrev?.assets.reduce((s, a) => s + a.balance, 0) ?? 0;
  const totalRevenuePrev = isPrev?.revenues.reduce((s, r) => s + r.balance, 0) ?? 0;
  const totalExpensesPrev = isPrev?.expenses.reduce((s, e) => s + e.balance, 0) ?? 0;
  const profitPrev = totalRevenuePrev - totalExpensesPrev;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Berichte</h2>
          <p className="text-sm text-muted-foreground">Erfolgsrechnung, Bilanz und Konten</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            const rows = [
              { label: 'AKTIVEN', amount: totalAssets, bold: true },
              ...(bs?.assets ?? []).map(a => ({ label: `${a.account.number} ${a.account.name}`, amount: a.balance, indent: 1 })),
              { label: 'Total Aktiven', amount: totalAssets, bold: true },
              { label: '', amount: 0 },
              { label: 'PASSIVEN', amount: totalLiabilities, bold: true },
              ...(bs?.liabilities ?? []).map(a => ({ label: `${a.account.number} ${a.account.name}`, amount: a.balance, indent: 1 })),
              { label: 'Eigenkapital', amount: totalEquity, bold: true },
              ...(bs?.equity ?? []).map(a => ({ label: `${a.account.number} ${a.account.name}`, amount: a.balance, indent: 1 })),
              { label: 'Total Passiven', amount: totalLiabilities + totalEquity, bold: true },
            ];
            exportToPdf('Bilanz', year, rows, company ?? undefined);
          }}>
            <Download className="h-4 w-4" /> PDF Export
          </Button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bilanzsumme</div>
          <div className="text-xl font-bold font-mono">CHF {formatCHF(totalAssets)}</div>
          {totalAssetsPrev > 0 && (
            <div className="text-xs text-muted-foreground mt-1">Vorjahr: {formatCHF(totalAssetsPrev)}</div>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ertrag</div>
          <div className="text-xl font-bold font-mono amount-positive">CHF {formatCHF(totalRevenue)}</div>
          {totalRevenuePrev > 0 && (
            <div className="text-xs text-muted-foreground mt-1">Vorjahr: {formatCHF(totalRevenuePrev)}</div>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aufwand</div>
          <div className="text-xl font-bold font-mono amount-negative">CHF {formatCHF(totalExpenses)}</div>
          {totalExpensesPrev > 0 && (
            <div className="text-xs text-muted-foreground mt-1">Vorjahr: {formatCHF(totalExpensesPrev)}</div>
          )}
        </div>
        <div className={`bg-card rounded-xl border p-4 shadow-sm ${profit >= 0 ? "border-green-200" : "border-red-200"}`}>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ergebnis</div>
          <div className={`text-xl font-bold font-mono ${profit >= 0 ? "amount-positive" : "amount-negative"}`}>
            CHF {formatCHF(profit)}
          </div>
          {profitPrev !== 0 && (
            <div className="text-xs text-muted-foreground mt-1">Vorjahr: {formatCHF(profitPrev)}</div>
          )}
        </div>
      </div>

      <Tabs defaultValue="income-statement">
        <TabsList>
          <TabsTrigger value="income-statement">Erfolgsrechnung</TabsTrigger>
          <TabsTrigger value="balance-sheet">Bilanz</TabsTrigger>
          <TabsTrigger value="accounts">Konten</TabsTrigger>
        </TabsList>

        {/* Erfolgsrechnung */}
        <TabsContent value="income-statement">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Erfolgsrechnung {year}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Vergleich mit {prevYear}</span>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => {
                  const rows = [
                    { label: 'ERTRAG', amount: totalRevenue, bold: true },
                    ...(is?.revenues ?? []).filter(r => Math.abs(r.balance) > 0.01).map(r => ({ label: `${r.account.number} ${r.account.name}`, amount: r.balance, indent: 1 })),
                    { label: 'Total Ertrag', amount: totalRevenue, bold: true },
                    { label: '', amount: 0 },
                    { label: 'AUFWAND', amount: totalExpenses, bold: true },
                    ...(is?.expenses ?? []).filter(e => Math.abs(e.balance) > 0.01).map(e => ({ label: `${e.account.number} ${e.account.name}`, amount: e.balance, indent: 1 })),
                    { label: 'Total Aufwand', amount: totalExpenses, bold: true },
                    { label: '', amount: 0 },
                    { label: profit >= 0 ? 'Jahresgewinn' : 'Jahresverlust', amount: profit, bold: true },
                  ];
                  exportToPdf('Erfolgsrechnung', year, rows, company ?? undefined);
                }}>
                  <Download className="h-3 w-3" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konto</th>
                    <th className="text-right px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{year}</th>
                    <th className="text-right px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{prevYear}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ertrag */}
                  <tr className="bg-green-50/50">
                    <td colSpan={3} className="px-5 py-2 text-xs font-bold text-green-700 uppercase tracking-wide">
                      Ertrag
                    </td>
                  </tr>
                  {is?.revenues.filter(r => Math.abs(r.balance) > 0.01).map(r => {
                    const prev = isPrev?.revenues.find(p => p.account.id === r.account.id)?.balance ?? 0;
                    return (
                      <tr key={r.account.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="px-5 py-1.5 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{r.account.number}</span>
                          {r.account.name}
                        </td>
                        <td className="text-right px-5 py-1.5 font-mono text-sm amount-positive">{formatCHF(r.balance)}</td>
                        <td className="text-right px-5 py-1.5 font-mono text-sm text-muted-foreground">{prev > 0 ? formatCHF(prev) : "–"}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-green-50 border-t border-green-200">
                    <td className="px-5 py-2 text-sm font-bold">Total Ertrag</td>
                    <td className="text-right px-5 py-2 font-mono font-bold amount-positive">{formatCHF(totalRevenue)}</td>
                    <td className="text-right px-5 py-2 font-mono text-muted-foreground">{formatCHF(totalRevenuePrev)}</td>
                  </tr>

                  {/* Aufwand */}
                  <tr className="bg-red-50/50">
                    <td colSpan={3} className="px-5 py-2 text-xs font-bold text-red-700 uppercase tracking-wide">
                      Aufwand
                    </td>
                  </tr>
                  {is?.expenses.filter(e => Math.abs(e.balance) > 0.01).map(e => {
                    const prev = isPrev?.expenses.find(p => p.account.id === e.account.id)?.balance ?? 0;
                    return (
                      <tr key={e.account.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="px-5 py-1.5 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{e.account.number}</span>
                          {e.account.name}
                        </td>
                        <td className="text-right px-5 py-1.5 font-mono text-sm amount-negative">{formatCHF(e.balance)}</td>
                        <td className="text-right px-5 py-1.5 font-mono text-sm text-muted-foreground">{prev > 0 ? formatCHF(prev) : "–"}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-red-50 border-t border-red-200">
                    <td className="px-5 py-2 text-sm font-bold">Total Aufwand</td>
                    <td className="text-right px-5 py-2 font-mono font-bold amount-negative">{formatCHF(totalExpenses)}</td>
                    <td className="text-right px-5 py-2 font-mono text-muted-foreground">{formatCHF(totalExpensesPrev)}</td>
                  </tr>

                  {/* Ergebnis */}
                  <tr className={`border-t-2 ${profit >= 0 ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"}`}>
                    <td className="px-5 py-3 text-base font-bold">
                      {profit >= 0 ? "Jahresgewinn" : "Jahresverlust"}
                    </td>
                    <td className={`text-right px-5 py-3 font-mono text-base font-bold ${profit >= 0 ? "amount-positive" : "amount-negative"}`}>
                      CHF {formatCHF(Math.abs(profit))}
                    </td>
                    <td className={`text-right px-5 py-3 font-mono text-muted-foreground ${profitPrev >= 0 ? "amount-positive" : "amount-negative"}`}>
                      CHF {formatCHF(Math.abs(profitPrev))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Bilanz */}
        <TabsContent value="balance-sheet">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aktiven */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-blue-50/50">
                <h3 className="font-semibold text-blue-800">Aktiven</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {bs?.assets.filter(a => Math.abs(a.balance) > 0.01).map(a => (
                    <tr key={a.account.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-5 py-1.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{a.account.number}</span>
                        {a.account.name}
                      </td>
                      <td className="text-right px-5 py-1.5 font-mono text-sm">{formatCHF(a.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-blue-300 bg-blue-50">
                    <td className="px-5 py-3 font-bold text-sm">Total Aktiven</td>
                    <td className="text-right px-5 py-3 font-mono font-bold">{formatCHF(totalAssets)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Passiven */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-orange-50/50">
                <h3 className="font-semibold text-orange-800">Passiven</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {bs?.liabilities.filter(l => Math.abs(l.balance) > 0.01).map(l => (
                    <tr key={l.account.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-5 py-1.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{l.account.number}</span>
                        {l.account.name}
                      </td>
                      <td className="text-right px-5 py-1.5 font-mono text-sm">{formatCHF(l.balance)}</td>
                    </tr>
                  ))}
                  {bs?.equity.filter(e => Math.abs(e.balance) > 0.01).map(e => (
                    <tr key={e.account.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-5 py-1.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{e.account.number}</span>
                        {e.account.name}
                      </td>
                      <td className="text-right px-5 py-1.5 font-mono text-sm">{formatCHF(e.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-orange-300 bg-orange-50">
                    <td className="px-5 py-3 font-bold text-sm">Total Passiven</td>
                    <td className="text-right px-5 py-3 font-mono font-bold">
                      {formatCHF(totalLiabilities + totalEquity)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Konten */}
        <TabsContent value="accounts">
          <Accounts />
        </TabsContent>
      </Tabs>
    </div>
  );
}
