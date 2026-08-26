import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

const templateBytes = fs.readFileSync('/home/ubuntu/upload/WeibelMarcArlesheim,Lohnausweis2024.pdf');
const pdfDoc = await PDFDocument.load(templateBytes);
const page = pdfDoc.getPages()[0];
const { width, height: pH } = page.getSize();
console.log('Page:', width, 'x', pH);

const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

// Overlay helper with generous padding (5px)
const pad = 5;
const overlayRect = (bbox, color) => {
  const [x0, y0, x1, y1] = bbox;
  page.drawRectangle({
    x: x0 - pad,
    y: pH - y1 - pad,
    width: (x1 - x0) + 2 * pad,
    height: (y1 - y0) + 2 * pad,
    color: color
  });
};

const white = rgb(1, 1, 1);
const pink = rgb(0.965, 0.843, 0.843);

// Text helper using pymupdf origin y (baseline from top)
const drawText = (text, x, baselineFromTop, opts) => {
  const font = opts?.font ?? helvetica;
  const size = opts?.size ?? 10;
  const tw = font.widthOfTextAtSize(text, size);
  const xPos = opts?.align === 'right' ? x - tw : x;
  page.drawText(text, { x: xPos, y: pH - baselineFromTop, size, font, color: rgb(0, 0, 0) });
};

// 1. AHV-Nr
overlayRect([190, 50, 280, 68], white);
drawText('756.1234.5678.90', 195, 62.5);

// 2. Year
overlayRect([56, 78, 88, 97], white);
drawText('2025', 61, 91.0);

// 3. Von
overlayRect([155, 78, 205, 97], white);
drawText('01.01.25', 160, 91.3);

// 4. Bis
overlayRect([229, 78, 278, 97], white);
drawText('31.12.25', 234, 91.3);

// 5. Name + Address - generous area
overlayRect([56, 128, 200, 185], white);
drawText('Test Person', 61, 142.9);
drawText('Teststrasse 1', 61, 159.8);
drawText('8000 Zürich', 61, 177.4);

// 6. Amount fields
overlayRect([473, 283, 575, 306], pink);
drawText("150'000", 566, 298.0, { align: 'right' });

overlayRect([473, 454, 575, 477], pink);
drawText("150'000", 566, 469.1, { align: 'right' });

overlayRect([473, 471, 575, 494], pink);
drawText("10'000", 566, 486.3, { align: 'right' });

overlayRect([473, 488, 575, 511], pink);
drawText("13'000", 566, 503.0, { align: 'right' });

overlayRect([473, 522, 575, 545], pink);
drawText("127'000", 566, 537.0, { align: 'right' });

// 7. Bemerkungen
overlayRect([106, 718, 540, 758], white);
drawText('Test Bemerkung Zeile 1', 112, 733.3);
drawText('Test Bemerkung Zeile 2', 112, 749.9);

// 8. Ort und Datum
overlayRect([54, 776, 185, 798], white);
drawText('Luzern, 14.04.26', 60, 791.1);

// 9. Company info
overlayRect([406, 758, 530, 835], white);
drawText('WM Weibel Mueller AG', 412, 773.3);
drawText('Juerg Mueller', 412, 786.6);
drawText('Grendelstrasse 2', 412, 799.8);
drawText('6004 Luzern', 412, 813.0);
drawText('Tel. 041 417 44 44', 412, 826.3);

const pdfBytes = await pdfDoc.save();
fs.writeFileSync('/home/ubuntu/test_lohnausweis3.pdf', pdfBytes);
console.log('Test PDF 3 saved, size:', pdfBytes.length);
