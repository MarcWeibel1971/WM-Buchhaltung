/**
 * Create an AcroForms-based invoice PDF template matching the WM Rechnung layout.
 * This script generates a PDF with fillable form fields that can be populated at runtime.
 * 
 * Run: node server/createInvoiceTemplate.mjs
 * Output: server/templates/invoice_template.pdf
 */

import { PDFDocument, PDFFont, rgb, StandardFonts, PDFTextField } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createInvoiceTemplate() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const form = pdfDoc.getForm();
  const pageH = 841.89;
  const pageW = 595.28;
  const leftM = 56;
  const rightM = 56;
  const contentW = pageW - leftM - rightM;

  // Helper: create a text field at a specific position
  function addTextField(name, x, y, width, height, opts = {}) {
    const field = form.createTextField(name);
    field.addToPage(page, {
      x,
      y: pageH - y - height, // Convert from top-down to bottom-up
      width,
      height,
      borderWidth: 0,
      backgroundColor: rgb(1, 1, 1),
    });
    if (opts.fontSize) {
      field.setFontSize(opts.fontSize);
    } else {
      field.setFontSize(0); // Auto-size
    }
    if (opts.alignment === 'right') {
      // pdf-lib doesn't support right alignment on text fields directly
      // We'll handle this in the fill logic
    }
    if (opts.multiline) {
      field.enableMultiline();
    }
    return field;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYOUT (matching the WM Rechnung Vorlage exactly)
  // All Y coordinates are from TOP of page
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Logo area (top left) ──
  // Logo will be embedded as an image at runtime, reserve space
  addTextField('logo_placeholder', leftM, 30, 180, 50, { fontSize: 8 });

  // ── Company Header (below logo) ──
  addTextField('company_name', leftM, 85, 250, 16, { fontSize: 11 });
  addTextField('company_address', leftM, 102, 250, 48, { fontSize: 8, multiline: true });

  // ── Recipient Address (right side, window envelope position) ──
  addTextField('recipient_title', 320, 120, 220, 14, { fontSize: 9 });
  addTextField('recipient_name', 320, 136, 220, 16, { fontSize: 11 });
  addTextField('recipient_street', 320, 154, 220, 14, { fontSize: 9 });
  addTextField('recipient_city', 320, 170, 220, 14, { fontSize: 9 });

  // ── Date and Reference (right-aligned) ──
  addTextField('date_location', 320, 215, 220, 14, { fontSize: 9 });
  addTextField('reference', 320, 231, 220, 14, { fontSize: 9 });

  // ── Subject Line ──
  addTextField('subject', leftM, 265, contentW, 20, { fontSize: 14 });

  // ── Salutation ──
  addTextField('salutation', leftM, 295, contentW, 16, { fontSize: 10 });

  // ── Intro Text ──
  addTextField('intro_text', leftM, 318, contentW, 36, { fontSize: 10, multiline: true });

  // ── Line Items (up to 10 positions) ──
  // Table header is static - drawn at runtime
  let tableY = 370;
  
  // Position items (10 rows max)
  for (let i = 1; i <= 10; i++) {
    addTextField(`pos_${i}`, leftM, tableY + (i - 1) * 18, 25, 16, { fontSize: 9.5 });
    addTextField(`desc_${i}`, leftM + 30, tableY + (i - 1) * 18, contentW - 120, 16, { fontSize: 9.5 });
    addTextField(`amount_${i}`, leftM + contentW - 85, tableY + (i - 1) * 18, 85, 16, { fontSize: 9.5 });
  }

  // ── Totals area (below items, positioned dynamically) ──
  // These will be positioned relative to the last item
  const totalsY = tableY + 10 * 18 + 10;
  addTextField('subtotal_label', leftM + contentW - 220, totalsY, 130, 16, { fontSize: 9 });
  addTextField('subtotal_amount', leftM + contentW - 85, totalsY, 85, 16, { fontSize: 9 });

  addTextField('vat_label', leftM + contentW - 220, totalsY + 18, 130, 16, { fontSize: 9 });
  addTextField('vat_amount', leftM + contentW - 85, totalsY + 18, 85, 16, { fontSize: 9 });

  addTextField('total_label', leftM + contentW - 220, totalsY + 40, 130, 18, { fontSize: 11 });
  addTextField('total_amount', leftM + contentW - 85, totalsY + 40, 85, 18, { fontSize: 11 });

  // ── Payment Terms ──
  addTextField('payment_terms', leftM, totalsY + 70, contentW, 16, { fontSize: 9 });

  // ── Closing Text ──
  addTextField('closing_text', leftM, totalsY + 96, contentW, 36, { fontSize: 10, multiline: true });

  // ── Greeting ──
  addTextField('greeting', leftM, totalsY + 140, contentW, 16, { fontSize: 10 });

  // ── Signature ──
  addTextField('signer_company', leftM, totalsY + 168, 300, 16, { fontSize: 10 });
  addTextField('signer_name', leftM, totalsY + 186, 300, 16, { fontSize: 10 });
  addTextField('signer_title', leftM, totalsY + 204, 300, 14, { fontSize: 9 });

  // ── Footer line ──
  addTextField('footer', leftM, pageH - 30, contentW, 14, { fontSize: 7 });

  // Save the template
  const outputDir = path.join(__dirname, 'templates');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(outputDir, 'invoice_template.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Template created: ${outputPath} (${pdfBytes.length} bytes)`);
}

createInvoiceTemplate().catch(console.error);
