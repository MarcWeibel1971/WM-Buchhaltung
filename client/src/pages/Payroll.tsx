import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Plus, Check, FileText, Users, CalendarDays, Award, RefreshCw, Calculator, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

// ─── Offizieller Lohnausweis Form. 11 (Schweiz) ─────────────────────────────────
// Exaktes Layout nach offiziellem Schweizer Formular 11 mit rosa Wertfeldern
function generateOfficialLohnausweis(summary: any, emp: any, company: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth(); // 210mm
  const PH = doc.internal.pageSize.getHeight(); // 297mm
  const M = 10; // margin
  const LM = M; // left margin
  const RM = PW - M; // right margin
  const W = RM - LM; // usable width

  // Colors matching the official form
  const PINK: [number,number,number] = [255, 220, 220]; // rosa Wertfelder
  const LIGHT_GRAY: [number,number,number] = [245, 245, 245];
  const GRAY_TEXT: [number,number,number] = [100, 100, 100];

  // Format CHF as integer (official form uses whole francs only)
  const chf = (v: number) => {
    const rounded = Math.round(v);
    return rounded.toLocaleString('de-CH');
  };

  const drawLine = (x1: number, yy: number, x2: number, width = 0.3) => {
    doc.setLineWidth(width); doc.setDrawColor(0,0,0); doc.line(x1, yy, x2, yy);
  };

  const drawBox = (x: number, yy: number, w: number, h: number) => {
    doc.setLineWidth(0.3); doc.setDrawColor(0,0,0); doc.rect(x, yy, w, h, 'S');
  };

  const pinkBox = (x: number, yy: number, w: number, h: number) => {
    doc.setFillColor(...PINK); doc.rect(x, yy, w, h, 'F');
    drawBox(x, yy, w, h);
  };

  // Value column position (right side for amounts)
  const valW = 30; // width of value column
  const valX = RM - valW; // x position of value column
  const signW = 8; // width of sign column (+, -, =)
  const signX = valX - signW;

  let y = 8;

  // ===== ROW A: Lohnausweis title =====
  doc.setLineWidth(0.5); doc.setDrawColor(0,0,0);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('A', LM + 2, y + 4);
  // X mark for Lohnausweis
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('X', LM + 7, y + 5);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('Lohnausweis', LM + 14, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text('Certificat de salaire \u2013 Certificato di salario', LM + 42, y + 4);
  drawLine(LM, y + 7, RM, 0.5);
  y += 8;

  // ===== ROW B: Rentenbescheinigung =====
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('B', LM + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text('Rentenbescheinigung \u2013 Attestation de rentes \u2013 Attestazione delle rendite', LM + 14, y + 4);
  drawLine(LM, y + 7, RM, 0.5);
  y += 8;

  // ===== ROW C/D/E: AHV-Nr, Jahr, von-bis =====
  const midX = LM + W * 0.55; // divider between left and right sections

  // C: AHV-Nr
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_TEXT);
  doc.text('C', LM + 1, y + 3);
  doc.text('AHV-Nr. \u2013 No AVS \u2013 N. AVS', LM + 5, y + 3);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0,0,0);
  doc.text(emp?.ahvNumber ?? '', LM + 5, y + 8);
  drawLine(LM, y + 10, midX, 0.3);

  // F: Unentgeltliche Befoerderung (right side)
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_TEXT);
  doc.text('F', midX + 2, y + 3);
  doc.text('Unentgeltliche Bef\u00f6rderung zwischen Wohn- und Arbeitsort', midX + 6, y + 3);
  doc.text('Transport gratuit entre le domicile et le lieu de travail', midX + 6, y + 6.5);
  drawBox(RM - 6, y + 1, 5, 5); // checkbox
  drawLine(midX, y + 10, RM, 0.3);
  y += 11;

  // D/E: Jahr, von, bis
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_TEXT);
  doc.text('D', LM + 1, y + 3);
  doc.text('Jahr \u2013 Ann\u00e9e \u2013 Anno', LM + 5, y + 6);
  doc.text('E', LM + 30, y + 3);
  doc.text('von \u2013 du \u2013 dal', LM + 34, y + 3);
  doc.text('bis \u2013 au \u2013 al', LM + 65, y + 3);

  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0,0,0);
  doc.text(String(summary.year), LM + 8, y + 8);

  const empStart = emp?.employmentStart ? new Date(emp.employmentStart) : new Date(summary.year, 0, 1);
  const empEnd = emp?.employmentEnd ? new Date(emp.employmentEnd) : new Date(summary.year, 11, 31);
  const startYear = empStart.getFullYear();
  const endYear = empEnd.getFullYear();
  const fromDate = startYear === summary.year ? empStart.toLocaleDateString('de-CH', { day:'2-digit', month:'2-digit', year:'2-digit' }) : `01.01.${String(summary.year).slice(2)}`;
  const toDate = endYear === summary.year ? empEnd.toLocaleDateString('de-CH', { day:'2-digit', month:'2-digit', year:'2-digit' }) : `31.12.${String(summary.year).slice(2)}`;
  doc.text(fromDate, LM + 38, y + 8);
  doc.text(toDate, LM + 68, y + 8);
  drawLine(LM, y + 10, midX, 0.3);

  // G: Kantinenverpflegung (right side)
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_TEXT);
  doc.text('G', midX + 2, y + 3);
  doc.text('Kantinenverpflegung/Lunch-Checks', midX + 6, y + 3);
  doc.text('Repas \u00e0 la cantine/ch\u00e8ques-repas', midX + 6, y + 6.5);
  drawBox(RM - 6, y + 1, 5, 5); // checkbox
  drawLine(midX, y + 10, RM, 0.3);
  y += 11;

  // Vertical divider between left and right
  doc.setLineWidth(0.3); doc.setDrawColor(0,0,0);
  doc.line(midX, y - 32, midX, y);

  // ===== Employee address block =====
  const addrH = 30;
  drawBox(LM, y, midX - LM, addrH);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(0,0,0);
  doc.text(`${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`, LM + 4, y + 8);
  if (emp?.street) doc.text(emp.street, LM + 4, y + 14);
  const cityLine = [emp?.zipCode, emp?.city].filter(Boolean).join(' ');
  if (cityLine) doc.text(cityLine, LM + 4, y + 20);

  // Right side: H label + "Nur ganze Frankenbetraege" note
  drawBox(midX, y, RM - midX, addrH);
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_TEXT);
  doc.text('H', RM - 5, y + 3);
  doc.text('Nur ganze Frankenbetr\u00e4ge', RM - 4, y + 10, { align: 'right' });
  doc.text('Que des montants entiers', RM - 4, y + 14, { align: 'right' });
  doc.text('Unicamente importi interi', RM - 4, y + 18, { align: 'right' });
  y += addrH + 2;

  // ===== SALARY SECTION (Ziffern 1-15) =====
  const gross = summary.totals.grossSalary;
  const ahvTotal = summary.totals.ahvEmployee + (summary.totals.ktgUvgEmployee || 0);
  const bvgEmp = summary.totals.bvgEmployee;
  const net = summary.totals.netSalary;

  const salaryStartY = y;
  const rowH = 6.5; // row height
  const numCol = LM + 1; // number column
  const lblCol = LM + 8; // label column
  const subLblCol = LM + 25; // sub-label column

  // Helper: draw a salary row with optional pink value field
  const salRow = (num: string, label: string, amount: number | null, sign: string, opts: { bold?: boolean; sub?: boolean; multiline?: string } = {}) => {
    const rh = opts.multiline ? rowH + 4 : rowH;
    // Pink value field on the right
    if (amount !== null && amount !== 0) {
      pinkBox(valX, y, valW, rh);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0,0,0);
      doc.text(chf(amount), RM - 2, y + rh/2 + 1.5, { align: 'right' });
    } else {
      pinkBox(valX, y, valW, rh);
    }
    // Sign column
    if (sign) {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0,0,0);
      doc.text(sign, signX + signW/2, y + rh/2 + 1.5, { align: 'center' });
    }
    // Number
    doc.setFontSize(7.5); doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setTextColor(0,0,0);
    if (num) doc.text(num + '.', opts.sub ? numCol + 4 : numCol, y + rh/2 + 1);
    // Label
    const lx = opts.sub ? subLblCol : lblCol;
    doc.setFontSize(opts.sub ? 6.5 : 7.5); doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.text(label, lx, y + rh/2 + 1);
    if (opts.multiline) {
      doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_TEXT);
      doc.text(opts.multiline, lx, y + rh/2 + 4.5);
      doc.setTextColor(0,0,0);
    }
    // Bottom line
    drawLine(LM, y + rh, RM, 0.15);
    y += rh;
  };

  // Ziffer 1: Lohn
  salRow('1', 'Lohn  soweit nicht unter Ziffer 2\u20137 aufzuf\u00fchren  /Rente', gross, '',
    { multiline: 'Salaire  qui ne concerne pas les chiffres 2 \u00e0 7 ci-dessous  /Rente' });

  // Ziffer 2: Gehaltsnebenleistungen
  salRow('2', 'Gehaltsnebenleistungen', null, '+');
  salRow('2.1', 'Verpflegung, Unterkunft \u2013 Pension, logement', null, '+', { sub: true });
  salRow('2.2', 'Privatanteil Gesch\u00e4ftswagen \u2013 Part priv\u00e9e voiture de service', null, '+', { sub: true });
  salRow('2.3', 'Andere \u2013 Autres \u2013 Altre', null, '+', { sub: true });

  // Ziffern 3-7
  salRow('3', 'Unregelm\u00e4ssige Leistungen \u2013 Prestations non p\u00e9riodiques', null, '+');
  salRow('4', 'Kapitalleistungen \u2013 Prestations en capital', null, '+');
  salRow('5', 'Beteiligungsrechte gem\u00e4ss Beiblatt', null, '+');
  salRow('6', 'Verwaltungsratsentsch\u00e4digungen', null, '+');
  salRow('7', 'Andere Leistungen \u2013 Autres prestations', null, '+');

  // Ziffer 8: Bruttolohn total (highlighted)
  doc.setFillColor(...LIGHT_GRAY); doc.rect(LM, y, signX - LM, rowH + 1, 'F');
  pinkBox(valX, y, valW, rowH + 1);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0,0,0);
  doc.text('8.', numCol, y + rowH/2 + 1.5);
  doc.text('Bruttolohn total / Rente', lblCol, y + rowH/2 + 1.5);
  doc.text('=', signX + signW/2, y + rowH/2 + 1.5, { align: 'center' });
  doc.setFontSize(9);
  doc.text(chf(gross), RM - 2, y + rowH/2 + 1.5, { align: 'right' });
  drawLine(LM, y + rowH + 1, RM, 0.4);
  y += rowH + 2;

  // Ziffer 9: AHV
  salRow('9', 'Beitr\u00e4ge AHV/IV/EO/ALV/NBUV', ahvTotal, '\u2013');

  // Ziffer 10: BVG
  salRow('10', 'Berufliche Vorsorge  2. S\u00e4ule', null, '\u2013');
  salRow('10.1', 'Ordentliche Beitr\u00e4ge \u2013 Cotisations ordinaires', bvgEmp, '\u2013', { sub: true });
  salRow('10.2', 'Beitr\u00e4ge f\u00fcr den Einkauf \u2013 Cotisations pour le rachat', null, '\u2013', { sub: true });

  // Ziffer 11: Nettolohn (highlighted)
  const netRowH = rowH + 2;
  doc.setFillColor(...LIGHT_GRAY); doc.rect(LM, y, signX - LM, netRowH, 'F');
  pinkBox(valX, y, valW, netRowH);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0,0,0);
  doc.text('11.', numCol, y + netRowH/2 + 0.5);
  doc.text('Nettolohn/Rente', lblCol, y + netRowH/2 + 0.5);
  doc.text('=', signX + signW/2, y + netRowH/2 + 0.5, { align: 'center' });
  doc.setFontSize(9);
  doc.text(chf(net), RM - 2, y + netRowH/2 + 0.5, { align: 'right' });
  doc.setFontSize(5.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...GRAY_TEXT);
  doc.text('In die Steuererkl\u00e4rung \u00fcbertragen \u2013 A reporter sur la d\u00e9claration d\'imp\u00f4t', lblCol, y + netRowH - 1);
  doc.setTextColor(0,0,0);
  drawLine(LM, y + netRowH, RM, 0.4);
  y += netRowH + 1;

  // Ziffer 12: Quellensteuer
  salRow('12', 'Quellensteuerabzug \u2013 Retenue de l\'imp\u00f4t \u00e0 la source', null, '');

  // Ziffer 13: Spesenverg\u00fctungen
  salRow('13', 'Spesenverg\u00fctungen \u2013 Allocations pour frais', null, '');
  salRow('13.1', 'Effektive Spesen \u2013 Frais effectifs', null, '', { sub: true });
  salRow('13.1.1', 'Reise, Verpflegung, \u00dcbernachtung', null, '', { sub: true });
  salRow('13.1.2', '\u00dcbrige \u2013 Autres \u2013 Altre', null, '', { sub: true });
  salRow('13.2', 'Pauschalspesen \u2013 Frais forfaitaires', null, '', { sub: true });
  salRow('13.2.1', 'Repr\u00e4sentation', null, '', { sub: true });
  salRow('13.2.2', 'Auto \u2013 Voiture \u2013 Automobile', null, '', { sub: true });
  salRow('13.2.3', '\u00dcbrige \u2013 Autres \u2013 Altre', null, '', { sub: true });
  salRow('13.3', 'Beitr\u00e4ge an die Weiterbildung', null, '', { sub: true });

  // Ziffer 14: Weitere Gehaltsnebenleistungen
  salRow('14', 'Weitere Gehaltsnebenleistungen', null, '');

  // Ziffer 15: Bemerkungen
  const remarks = emp?.lohnausweisRemarks ?? '';
  drawLine(LM, y, RM, 0.15);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(0,0,0);
  doc.text('15.', numCol, y + 4);
  doc.text('Bemerkungen \u2013 Observations \u2013 Osservazioni', lblCol, y + 4);
  y += 7;
  if (remarks) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(remarks, W - 15);
    doc.text(lines, lblCol, y);
    y += lines.length * 4.5;
  } else {
    y += 6;
  }

  // Outer border around salary section
  drawBox(LM, salaryStartY, W, y - salaryStartY);

  y += 4;

  // ===== FOOTER: Ort und Datum / Arbeitgeber =====
  if (y > PH - 30) { doc.addPage(); y = 15; }

  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_TEXT);
  doc.text('I', LM + 1, y + 3);
  doc.text('Ort und Datum \u2013 Lieu et date \u2013 Luogo e data', LM + 5, y + 3);
  doc.text('Die Richtigkeit und Vollst\u00e4ndigkeit best\u00e4tigt', PW / 2 + 5, y + 3);
  doc.text('inkl. genauer Anschrift und Telefonnummer des Arbeitgebers', PW / 2 + 5, y + 6.5);
  doc.setTextColor(0,0,0);
  y += 10;

  const city = company?.city ?? 'Luzern';
  const today = new Date().toLocaleDateString('de-CH', { day:'2-digit', month:'2-digit', year:'2-digit' });
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(`${city}, ${today}`, LM + 5, y);

  // Employer info (right column)
  const compName = company?.companyName ?? 'Meine Firma';
  const ownerName = company?.ownerName ?? '';
  const compStreet = company?.street ?? '';
  const compCity = [company?.zipCode, company?.city].filter(Boolean).join(' ');
  const compPhone = company?.phone ?? '';
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(compName, RM - 2, y, { align: 'right' });
  y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  if (ownerName) { doc.text(ownerName, RM - 2, y, { align: 'right' }); y += 4; }
  if (compStreet) { doc.text(compStreet, RM - 2, y, { align: 'right' }); y += 4; }
  if (compCity) { doc.text(compCity, RM - 2, y, { align: 'right' }); y += 4; }
  if (compPhone) { doc.text(`Tel. ${compPhone}`, RM - 2, y, { align: 'right' }); y += 4; }

  // Form number
  doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text('Form. 11', LM, PH - 5);

  doc.save(`Lohnausweis_offiziell_${emp?.code ?? 'MA'}_${summary.year}.pdf`);
}

function generateLohnabrechnung(p: any, emp: any, company?: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company header
  const companyName = company?.companyName ?? 'Meine Firma';
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
  doc.text('LOHNABRECHNUNG', pageW / 2, y, { align: 'center' });
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

  doc.save(`Lohnabrechnung_${emp?.code ?? 'MA'}_${p.year}_${String(p.month).padStart(2,'0')}.pdf`);
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
  const companyName = company?.companyName ?? 'Meine Firma';
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
  const [expandedPayroll, setExpandedPayroll] = useState<{ employeeId: number; month: number } | null>(null);

  const { data: employees } = trpc.payroll.getEmployees.useQuery();
  const { data: payrollList, refetch } = trpc.payroll.list.useQuery({ year });
  const { data: insuranceSettings } = trpc.settings.getInsuranceSettings.useQuery();
  const { data: company } = trpc.settings.getCompanySettings.useQuery();
  const { data: txnData, isLoading: txnLoading } = trpc.payroll.getTransactions.useQuery(
    { employeeId: expandedPayroll?.employeeId!, year, month: expandedPayroll?.month! },
    { enabled: expandedPayroll !== null }
  );
  const utils = trpc.useUtils();

  const approveMutation = trpc.payroll.approve.useMutation({
    onSuccess: () => { toast.success("Lohnbuchung erstellt"); refetch(); utils.reports.dashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const syncMutation = trpc.payroll.syncFromJournal.useMutation({
    onSuccess: (res) => {
      toast.success(`Synchronisiert: ${res.created} neue, ${res.updated} aktualisierte, ${res.skipped} übersprungene Einträge`);
      refetch();
      utils.payroll.annualSummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const recalcMutation = trpc.payroll.recalculate.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.recalculated} von ${res.total} Einträgen neu berechnet (Brutto/Abzüge)`);
      refetch();
      utils.payroll.annualSummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5 max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display text-[22px] font-medium" style={{ color: "var(--ink)" }}>Lohnbuchhaltung</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Schweizer Lohnabrechnung mit AHV / IV / EO / ALV / BVG / UVG
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2"
            onClick={() => recalcMutation.mutate({ year })}
            disabled={recalcMutation.isPending}>
            <Calculator className={`h-4 w-4 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
            Abzüge neu berechnen
          </Button>
          <Button size="sm" variant="outline" className="gap-2"
            onClick={() => syncMutation.mutate({ year })}
            disabled={syncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Synchronisieren
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Lohnabrechnung
          </Button>
        </div>
      </div>

      {/* Sozialversicherungssätze-Leiste {year} */}
      <div className="klax-card--soft p-3 flex items-center gap-4 flex-wrap text-[12px]" style={{ color: "var(--ink-2)" }}>
        <span className="k-label" style={{ marginRight: 4 }}>Sozialvers. {year}</span>
        {[
          { label: "AHV/IV/EO", val: "10.6%" },
          { label: "ALV", val: "2.2%" },
          { label: "BVG", val: "var." },
          { label: "UVG", val: "0.86%" },
          { label: "KTG", val: "1.5%" },
        ].map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span style={{ color: "var(--ink-3)" }}>{s.label}</span>
            <span className="mono font-medium">{s.val}</span>
          </span>
        ))}
      </div>

      {/* Employees overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {employees?.map(emp => (
          <div key={emp.id} className="klax-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                style={{ background: "var(--klax-accent-soft)", color: "var(--klax-accent)" }}
              >
                {emp.code.toUpperCase()}
              </div>
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                  {emp.firstName} {emp.lastName}
                </div>
                <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{emp.code}</div>
              </div>
            </div>
            <div className="text-[12.5px]">
              <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>AHV-Nr.: </span>
              <span className="mono" style={{ color: "var(--ink)" }}>{emp.ahvNumber ?? "–"}</span>
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
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Lohnabrechnungen {year}</h3>
              <Pain001ExportButton year={year} />
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
                  ) : payrollList.map(({ payroll: p, employee: emp }) => {
                    const isExpanded = expandedPayroll?.employeeId === p.employeeId && expandedPayroll?.month === p.month;
                    return (
                      <>
                        <tr
                          key={p.id}
                          className={`cursor-pointer hover:bg-muted/20 ${isExpanded ? 'bg-muted/30' : ''}`}
                          onClick={() => setExpandedPayroll(isExpanded ? null : { employeeId: p.employeeId, month: p.month })}
                        >
                          <td className="text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                              {MONTHS[p.month - 1]}
                            </div>
                          </td>
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
                          <td className="text-right" onClick={e => e.stopPropagation()}>
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
                                  generateLohnabrechnung(p, empData, company);
                                }}>
                                <FileText className="h-3 w-3" /> Lohnabrechnung
                              </Button>
                            )}
                          </td>
                        </tr>
                        {/* Expanded bank transactions */}
                        {isExpanded && (
                          <tr key={`txn-${p.id}`}>
                            <td colSpan={8} className="bg-muted/20 px-6 py-3">
                              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Banktransaktionen</div>
                              {txnLoading ? (
                                <div className="text-sm text-muted-foreground py-2">Lade Transaktionen...</div>
                              ) : !txnData?.length ? (
                                <div className="text-sm text-muted-foreground py-2">Keine Banktransaktionen für diesen Monat gefunden</div>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-muted-foreground">
                                      <th className="text-left pb-1 font-medium">Datum</th>
                                      <th className="text-left pb-1 font-medium">Beschreibung</th>
                                      <th className="text-left pb-1 font-medium">Bankkonto</th>
                                      <th className="text-right pb-1 font-medium">Betrag CHF</th>
                                      <th className="text-left pb-1 font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {txnData.map(tx => (
                                      <tr key={tx.id} className="border-t border-border/30">
                                        <td className="py-1.5 font-mono text-xs">
                                          {new Date(tx.transactionDate).toLocaleDateString('de-CH')}
                                        </td>
                                        <td className="py-1.5 text-xs">
                                          {tx.suggestedBookingText || tx.description || '–'}
                                        </td>
                                        <td className="py-1.5 text-xs text-muted-foreground">
                                          {tx.bankAccountName}
                                        </td>
                                        <td className={`py-1.5 text-right font-mono text-xs font-semibold ${parseFloat(tx.amount as string) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                          {formatCHF(tx.amount as string)}
                                        </td>
                                        <td className="py-1.5 text-xs">
                                          {tx.status === 'pending' ? <span className="badge-pending">Ausstehend</span>
                                            : tx.status === 'matched' ? <span className="badge-approved">Verbucht</span>
                                            : <span className="text-muted-foreground">{tx.status}</span>}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="border-t-2 border-border/50">
                                      <td colSpan={3} className="py-1.5 text-xs font-semibold">Total</td>
                                      <td className="py-1.5 text-right font-mono text-xs font-bold">
                                        {formatCHF(txnData.reduce((sum, tx) => sum + parseFloat(tx.amount as string), 0).toFixed(2))}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
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

  const lohnausweisPdfMutation = trpc.payroll.generateLohnausweisPdf.useMutation({
    onSuccess: (res) => {
      const byteChars = atob(res.base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Lohnausweis PDF erstellt');
    },
    onError: (e: any) => toast.error(`Fehler: ${e.message}`),
  });

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
          <div className="flex gap-2 mt-5">
            <Button variant="outline" className="gap-2" onClick={() => generateJahreslohnausweis(summary, selectedEmp, company)}>
              <FileText className="h-4 w-4" /> Interner Lohnausweis
            </Button>
            <Button variant="default" className="gap-2"
              disabled={lohnausweisPdfMutation.isPending}
              onClick={() => {
                if (!selectedEmpId) return;
                lohnausweisPdfMutation.mutate({ year, employeeId: selectedEmpId });
              }}>
              <Award className={`h-4 w-4 ${lohnausweisPdfMutation.isPending ? 'animate-spin' : ''}`} /> {lohnausweisPdfMutation.isPending ? 'Wird erstellt...' : 'Offizieller Lohnausweis (Form. 11)'}
            </Button>
          </div>
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
    recalcInsurance(gross);
  };

  // Bottom-Up: given gross, calculate all deductions
  const recalcFromGross = (grossVal: number) => {
    // AHV: percentage of gross (fallback 5.3%)
    const ahvSetting = insuranceSettings.find((s: any) => s.insuranceType === 'ahv' && s.isActive);
    const ahvEmpRate = ahvSetting ? parseFloat(ahvSetting.employeeRate ?? '0.053') / 100 : 0.053;
    const ahvEmprRate = ahvSetting ? parseFloat(ahvSetting.employerRate ?? '0.053') / 100 : 0.053;
    setAhvEmployee((grossVal * ahvEmpRate).toFixed(2));
    setAhvEmployer((grossVal * ahvEmprRate).toFixed(2));
    // BVG: fixed monthly CHF amounts (not percentage!)
    const bvgSetting = insuranceSettings.find((s: any) => s.insuranceType === 'bvg' && s.isActive);
    const bvgEmpMonthly = bvgSetting?.bvgEmployeeMonthly ? parseFloat(bvgSetting.bvgEmployeeMonthly) : 0;
    const bvgEmprMonthly = bvgSetting?.bvgEmployerMonthly ? parseFloat(bvgSetting.bvgEmployerMonthly) : 0;
    setBvgEmployee(bvgEmpMonthly.toFixed(2));
    setBvgEmployer(bvgEmprMonthly.toFixed(2));
    // KTG/UVG: percentage of gross
    const ktgSetting = insuranceSettings.find((s: any) => (s.insuranceType === 'ktg' || s.insuranceType === 'uvg') && s.isActive);
    const ktgEmpRate = ktgSetting ? parseFloat(ktgSetting.employeeRate ?? '0') / 100 : 0;
    const ktgEmprRate = ktgSetting ? parseFloat(ktgSetting.employerRate ?? '0') / 100 : 0;
    setKtgEmployee((grossVal * ktgEmpRate).toFixed(2));
    setKtgEmployer((grossVal * ktgEmprRate).toFixed(2));
  };

  // Bottom-Up: given net salary, back-calculate gross
  // Gross = (Net + BVG_AN_monthly + KTG_AN_monthly) / (1 - AHV_AN_rate)
  const recalcFromNet = (netVal: number) => {
    const ahvSetting = insuranceSettings.find((s: any) => s.insuranceType === 'ahv' && s.isActive);
    const ahvEmpRate = ahvSetting ? parseFloat(ahvSetting.employeeRate ?? '0.053') / 100 : 0.053;
    const ahvEmprRate = ahvSetting ? parseFloat(ahvSetting.employerRate ?? '0.053') / 100 : 0.053;
    const bvgSetting = insuranceSettings.find((s: any) => s.insuranceType === 'bvg' && s.isActive);
    const bvgEmpMonthly = bvgSetting?.bvgEmployeeMonthly ? parseFloat(bvgSetting.bvgEmployeeMonthly) : 0;
    const bvgEmprMonthly = bvgSetting?.bvgEmployerMonthly ? parseFloat(bvgSetting.bvgEmployerMonthly) : 0;
    const ktgSetting = insuranceSettings.find((s: any) => (s.insuranceType === 'ktg' || s.insuranceType === 'uvg') && s.isActive);
    const ktgEmpRate = ktgSetting ? parseFloat(ktgSetting.employeeRate ?? '0') / 100 : 0;
    const ktgEmprRate = ktgSetting ? parseFloat(ktgSetting.employerRate ?? '0') / 100 : 0;
    // Gross = (Net + fixed_deductions) / (1 - percentage_deduction_rates)
    const grossVal = (netVal + bvgEmpMonthly) / (1 - ahvEmpRate - ktgEmpRate);
    setGrossSalary(grossVal.toFixed(2));
    setAhvEmployee((grossVal * ahvEmpRate).toFixed(2));
    setAhvEmployer((grossVal * ahvEmprRate).toFixed(2));
    setBvgEmployee(bvgEmpMonthly.toFixed(2));
    setBvgEmployer(bvgEmprMonthly.toFixed(2));
    setKtgEmployee((grossVal * ktgEmpRate).toFixed(2));
    setKtgEmployer((grossVal * ktgEmprRate).toFixed(2));
  };

  // Keep old name for compatibility
  const recalcInsurance = recalcFromGross;

  const createMutation = trpc.payroll.create.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });

  const net = grossSalary
    ? (parseFloat(grossSalary) - parseFloat(ahvEmployee || "0") - parseFloat(bvgEmployee || "0") - parseFloat(ktgEmployee || "0")).toFixed(2)
    : "0.00";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[min(95vw,38rem)] max-w-none">
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nettolohn CHF <span className="text-blue-600">(Bottom-Up)</span></label>
              <Input className="font-mono text-right border-blue-300 focus:border-blue-500" placeholder="0.00" onChange={e => {
                const n = parseFloat(e.target.value);
                if (!isNaN(n) && n > 0) recalcFromNet(n);
              }} />
              <p className="text-xs text-muted-foreground mt-1">Netto eingeben → Brutto wird berechnet</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bruttolohn CHF</label>
              <Input className="font-mono text-right" value={grossSalary} onChange={e => {
                setGrossSalary(e.target.value);
                const g = parseFloat(e.target.value);
                if (!isNaN(g) && g > 0) recalcFromGross(g);
              }} placeholder="0.00" />
              <p className="text-xs text-muted-foreground mt-1">Oder direkt Brutto eingeben</p>
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
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">BVG Arbeitnehmer CHF/Mt.</label>
              <Input className="font-mono text-right" value={bvgEmployee} onChange={e => setBvgEmployee(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">BVG Arbeitgeber CHF/Mt.</label>
              <Input className="font-mono text-right" value={bvgEmployer} onChange={e => setBvgEmployer(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 flex justify-between text-sm">
            <span className="font-medium">Nettolohn (berechnet)</span>
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


// ─── ISO 20022 pain.001 Export Button ─────────────────────────────────────────

function Pain001ExportButton({ year }: { year: number }) {
  const [showDialog, setShowDialog] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const pain001Mut = trpc.qrBill.generatePain001.useMutation({
    onSuccess: (result) => {
      // Download XML file
      const blob = new Blob([result.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Zahlungsdatei erstellt: ${result.summary.nbOfTxs} Zahlungen, CHF ${result.summary.ctrlSum.toLocaleString("de-CH", { minimumFractionDigits: 2 })}`);
      setShowDialog(false);
    },
    onError: (e: any) => toast.error(`Fehler: ${e.message}`),
  });

  const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowDialog(true)}>
        <Download className="h-4 w-4" /> ISO 20022 Export
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zahlungsdatei exportieren (ISO 20022 pain.001)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Erstellt eine ISO 20022 pain.001 Zahlungsdatei für die Sammellohnzahlung.
              Diese Datei kann direkt ins E-Banking hochgeladen werden.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Jahr</label>
                <Input value={year} disabled className="bg-muted" />
              </div>
              <div>
                <label className="text-sm font-medium">Monat</label>
                <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200">Schweizer ISO 20022 Standard</p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                Format: pain.001.001.09 gemäss SIX Swiss Implementation Guidelines.
                Kompatibel mit allen Schweizer Banken.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Abbrechen</Button>
            <Button
              onClick={() => pain001Mut.mutate({ paymentType: "salary", year, month })}
              disabled={pain001Mut.isPending}
              className="gap-2"
            >
              {pain001Mut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Zahlungsdatei erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
