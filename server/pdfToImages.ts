/**
 * PDF zu Bilder Konverter
 * Nutzt pdftoppm (poppler-utils) um PDF-Seiten in PNG-Bilder zu konvertieren.
 * Diese werden dann als Base64 an Nemotron gesendet.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

/**
 * Konvertiert eine PDF-URL in ein Array von Base64-PNG-Bildern (eine pro Seite).
 * Maximal `maxPages` Seiten werden verarbeitet.
 */
export async function pdfUrlToImages(
  pdfUrl: string,
  maxPages = 5
): Promise<Array<{ base64: string; pageNumber: number }>> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "klax-pdf-"));

  try {
    // PDF herunterladen
    const pdfPath = path.join(tmpDir, "document.pdf");
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`PDF-Download fehlgeschlagen: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(pdfPath, Buffer.from(buffer));

    // PDF-Seiten in PNG konvertieren (150 DPI, gut für OCR)
    const outputPrefix = path.join(tmpDir, "page");
    await execAsync(
      `pdftoppm -png -r 150 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`
    );

    // Generierte PNG-Dateien einlesen
    const files = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    const images: Array<{ base64: string; pageNumber: number }> = [];
    for (let i = 0; i < Math.min(files.length, maxPages); i++) {
      const filePath = path.join(tmpDir, files[i]);
      const data = fs.readFileSync(filePath);
      images.push({
        base64: data.toString("base64"),
        pageNumber: i + 1,
      });
    }

    return images;
  } finally {
    // Temporäres Verzeichnis aufräumen
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorieren
    }
  }
}

/**
 * Konvertiert eine lokale PDF-Datei in Base64-PNG-Bilder.
 */
export async function pdfFileToImages(
  pdfPath: string,
  maxPages = 5
): Promise<Array<{ base64: string; pageNumber: number }>> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "klax-pdf-"));

  try {
    const outputPrefix = path.join(tmpDir, "page");
    await execAsync(
      `pdftoppm -png -r 150 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`
    );

    const files = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    const images: Array<{ base64: string; pageNumber: number }> = [];
    for (let i = 0; i < Math.min(files.length, maxPages); i++) {
      const filePath = path.join(tmpDir, files[i]);
      const data = fs.readFileSync(filePath);
      images.push({
        base64: data.toString("base64"),
        pageNumber: i + 1,
      });
    }

    return images;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorieren
    }
  }
}
