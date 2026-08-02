/**
 * NVIDIA LocateAnything-3B — Hugging Face Inference API Integration
 * =================================================================
 *
 * Vision-Language Model für präzise Dokument-Extraktion via visuellem Grounding.
 * Ergänzt die bestehende Nemotron-Pipeline als zweite Extraktionsstufe:
 *
 *   Stufe 1 (primär):  Nemotron via OpenRouter (kostenlos, schnell)
 *   Stufe 2 (fallback): LocateAnything-3B via HuggingFace (präziser bei
 *                        komplexen Layouts, Tabellen, handschriftlichen Notizen)
 *
 * Stärken gegenüber reinem Text-LLM:
 * - Erkennt exakte Positionen von Feldern (Bounding Boxes) → kein Halluzinieren
 * - Robust bei schlecht strukturierten PDFs (Scan-Qualität, Rotation)
 * - Versteht Schweizer Dokument-Layouts (QR-Rechnung, Lohnausweis, PK-Ausweis)
 * - Tabellen-Extraktion mit Zellen-Koordinaten
 *
 * Model: nvidia/LocateAnything-3B (4B params, BF16)
 * API: HuggingFace Inference Providers (serverless, pay-per-use)
 * Lizenz: nvidia-license (non-commercial / research)
 *
 * @see https://huggingface.co/nvidia/LocateAnything-3B
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoundingBox = {
  x1: number; // Normalisiert 0–1000
  y1: number;
  x2: number;
  y2: number;
  label: string;
  confidence?: number;
};

export type LocateAnythingResult = {
  rawResponse: string;
  boxes: BoundingBox[];
  model: string;
  processingTimeMs: number;
};

export type LocateAnythingOptions = {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  prompt: string;
  generationMode?: "fast" | "slow" | "hybrid";
  maxTokens?: number;
};

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const MODEL_ID = "nvidia/LocateAnything-3B";
const HF_API_PRIMARY = "https://router.huggingface.co/hf-inference/models/nvidia/LocateAnything-3B/v1/chat/completions";
const HF_API_FALLBACK = "https://api-inference.huggingface.co/models/nvidia/LocateAnything-3B";

// ---------------------------------------------------------------------------
// API-Key Resolver
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.HUGGINGFACE_API_KEY ?? process.env.HF_API_KEY;
  if (!key) {
    throw new Error(
      "[LocateAnything] HUGGINGFACE_API_KEY fehlt. " +
      "Bitte als Umgebungsvariable setzen (HUGGINGFACE_API_KEY oder HF_API_KEY)."
    );
  }
  return key;
}

// ---------------------------------------------------------------------------
// Bounding-Box Parser
// ---------------------------------------------------------------------------

function parseBoundingBoxes(text: string): BoundingBox[] {
  const boxes: BoundingBox[] = [];

  // Format 1: <box>x1,y1,x2,y2</box><label>text</label>
  const p1 = /<box>(\d+),(\d+),(\d+),(\d+)<\/box>\s*<label>(.*?)<\/label>/g;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(text)) !== null) {
    boxes.push({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], label: m[5].trim() });
  }
  if (boxes.length) return boxes;

  // Format 2: [x1, y1, x2, y2] label
  const p2 = /\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]\s*(.+?)(?:\n|$)/g;
  while ((m = p2.exec(text)) !== null) {
    boxes.push({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], label: m[5].trim() });
  }
  if (boxes.length) return boxes;

  // Format 3: JSON-Array
  try {
    const jm = text.match(/\[[\s\S]*\]/);
    if (jm) {
      const arr = JSON.parse(jm[0]);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const b = item.box ?? item.bbox ?? item.bounding_box;
          if (b) {
            boxes.push({
              x1: b[0] ?? b.x1 ?? 0, y1: b[1] ?? b.y1 ?? 0,
              x2: b[2] ?? b.x2 ?? 0, y2: b[3] ?? b.y2 ?? 0,
              label: item.label ?? item.name ?? item.category ?? "field",
              confidence: item.confidence ?? item.score,
            });
          }
        }
      }
    }
  } catch { /* ignorieren */ }

  return boxes;
}

// ---------------------------------------------------------------------------
// Kern-API
// ---------------------------------------------------------------------------

export async function locateAnything(opts: LocateAnythingOptions): Promise<LocateAnythingResult> {
  const t0 = Date.now();
  const apiKey = getApiKey();

  // Bild-Content aufbauen
  let imageContent: object;
  if (opts.imageBase64) {
    const mime = opts.mimeType ?? "image/png";
    imageContent = {
      type: "image_url",
      image_url: { url: `data:${mime};base64,${opts.imageBase64}` },
    };
  } else if (opts.imageUrl) {
    imageContent = { type: "image_url", image_url: { url: opts.imageUrl } };
  } else {
    throw new Error("[LocateAnything] Weder imageUrl noch imageBase64 angegeben.");
  }

  const payload = {
    model: MODEL_ID,
    messages: [{
      role: "user",
      content: [imageContent, { type: "text", text: opts.prompt }],
    }],
    max_tokens: opts.maxTokens ?? 4096,
    generation_mode: opts.generationMode ?? "fast",
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  let resp = await fetch(HF_API_PRIMARY, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!resp.ok && resp.status !== 429) {
    console.warn(`[LocateAnything] Primary failed (${resp.status}), trying fallback...`);
    resp = await fetch(HF_API_FALLBACK, { method: "POST", headers, body: JSON.stringify(payload) });
  }

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`[LocateAnything] API-Fehler ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const raw: string =
    data.choices?.[0]?.message?.content ??
    data.generated_text ??
    data[0]?.generated_text ??
    JSON.stringify(data);

  return {
    rawResponse: raw,
    boxes: parseBoundingBoxes(raw),
    model: MODEL_ID,
    processingTimeMs: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Schweizer Dokument-Extraktion (spezialisierte Wrapper)
// ---------------------------------------------------------------------------

/**
 * Extrahiert strukturierte Felder aus einer Schweizer Rechnung / QR-Rechnung.
 * Gibt Bounding Boxes für alle erkannten Felder zurück, sodass die
 * Nemotron-Pipeline gezielt auf die relevanten Bereiche fokussieren kann.
 */
export async function extractInvoiceFields(
  imageBase64: string,
  mimeType = "image/png"
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageBase64,
    mimeType,
    prompt:
      "Analysiere diese Schweizer Rechnung / QR-Rechnung. " +
      "Lokalisiere und extrahiere mit Bounding Boxes: " +
      "1) Lieferantenname und Adresse " +
      "2) Rechnungsnummer " +
      "3) Rechnungsdatum und Fälligkeitsdatum " +
      "4) Gesamtbetrag (inkl. MWST) " +
      "5) MWST-Betrag und MWST-Satz " +
      "6) IBAN / QR-IBAN " +
      "7) QR-Referenznummer (27-stellig) " +
      "8) Alle Positionszeilen (Beschreibung, Menge, Preis) " +
      "Gib für jedes Feld eine Bounding Box und den extrahierten Wert als Label zurück.",
    generationMode: "hybrid",
    maxTokens: 4096,
  });
}

/**
 * Extrahiert Felder aus einem Schweizer Lohnausweis (Formular 11).
 */
export async function extractLohnausweis(
  imageBase64: string,
  mimeType = "image/png"
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageBase64,
    mimeType,
    prompt:
      "Analysiere diesen Schweizer Lohnausweis (Formular 11). " +
      "Lokalisiere mit Bounding Boxes: " +
      "1) Arbeitgeber (Name, Adresse) " +
      "2) Arbeitnehmer (Name, Adresse, AHV-Nummer) " +
      "3) Steuerjahr " +
      "4) Bruttolohn (Ziffer 1) " +
      "5) AHV/ALV/NBU-Abzüge (Ziffer 9) " +
      "6) Berufliche Vorsorge BVG (Ziffer 10) " +
      "7) Nettolohn " +
      "8) Quellensteuer (falls vorhanden) " +
      "Gib für jedes Feld Bounding Box + extrahierten Wert zurück.",
    generationMode: "hybrid",
    maxTokens: 4096,
  });
}

/**
 * Extrahiert Felder aus einem Kontoauszug / Kreditkartenabrechnung.
 * Besonders nützlich für tabellarische Transaktionslisten.
 */
export async function extractBankStatement(
  imageBase64: string,
  mimeType = "image/png"
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageBase64,
    mimeType,
    prompt:
      "Analysiere diesen Kontoauszug oder diese Kreditkartenabrechnung. " +
      "Lokalisiere mit Bounding Boxes: " +
      "1) Kontonummer / IBAN " +
      "2) Kontoinhaber " +
      "3) Zeitraum (von/bis) " +
      "4) Alle Transaktionszeilen (Datum, Beschreibung, Betrag, Saldo) " +
      "5) Anfangssaldo und Endsaldo " +
      "Gib für jede Transaktion eine Bounding Box und den Wert zurück.",
    generationMode: "slow",
    maxTokens: 8192,
  });
}

/**
 * Lokalisiert alle Tabellen und strukturierten Datenbereiche in einem Dokument.
 * Nützlich als Vorverarbeitungsschritt für komplexe Dokumente.
 */
export async function detectDocumentStructure(
  imageBase64: string,
  mimeType = "image/png"
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageBase64,
    mimeType,
    prompt:
      "Analysiere die Dokumentstruktur. Lokalisiere mit Bounding Boxes: " +
      "1) Alle Tabellen (mit Kopfzeilen und Datenzellen) " +
      "2) Alle Formularfelder (Bezeichnung + Wert) " +
      "3) Logos und Stempel " +
      "4) Unterschriften und Stempel " +
      "5) QR-Codes und Barcodes " +
      "6) Handschriftliche Notizen " +
      "Beschrifte jeden Bereich mit seiner Funktion.",
    generationMode: "hybrid",
    maxTokens: 4096,
  });
}

/**
 * Extrahiert Text aus einem schlecht lesbaren oder gescannten Dokument (OCR-Grounding).
 * Gibt Bounding Boxes für alle Textblöcke zurück.
 */
export async function ocrGrounding(
  imageBase64: string,
  mimeType = "image/png"
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageBase64,
    mimeType,
    prompt:
      "Erkenne und lokalisiere allen Text in diesem Dokument. " +
      "Gib für jeden Textblock eine Bounding Box und den erkannten Text als Label zurück. " +
      "Achte besonders auf Zahlen, Daten, IBAN-Nummern und Beträge.",
    generationMode: "slow",
    maxTokens: 8192,
  });
}

/**
 * Kombinierter Extraktor: Versucht zuerst Nemotron, fällt auf LocateAnything zurück.
 * Gibt ein angereichertes Ergebnis mit Konfidenz-Score zurück.
 *
 * @param nemotronResult - Bereits vorhandenes Nemotron-Ergebnis (kann null sein)
 * @param imageBase64 - Bild als Base64
 * @param documentType - Dokumenttyp für spezialisierte Prompts
 */
export async function enhanceExtractionWithLocateAnything(
  nemotronResult: Record<string, unknown> | null,
  imageBase64: string,
  documentType: "invoice" | "lohnausweis" | "bank_statement" | "generic" = "generic"
): Promise<{
  enhanced: Record<string, unknown>;
  locateAnythingUsed: boolean;
  boxes: BoundingBox[];
}> {
  // Wenn Nemotron bereits hohe Konfidenz hat, nur anreichern
  const nemotronConfidence = (nemotronResult?.confidence as number) ?? 0;

  if (nemotronConfidence >= 0.85 && nemotronResult) {
    // Nur Bounding Boxes hinzufügen für UI-Highlighting
    let boxResult: LocateAnythingResult;
    try {
      boxResult = await detectDocumentStructure(imageBase64);
    } catch {
      return { enhanced: nemotronResult, locateAnythingUsed: false, boxes: [] };
    }
    return {
      enhanced: { ...nemotronResult, _boundingBoxes: boxResult.boxes },
      locateAnythingUsed: true,
      boxes: boxResult.boxes,
    };
  }

  // Bei niedriger Konfidenz: vollständige LocateAnything-Extraktion
  let extractionResult: LocateAnythingResult;
  try {
    switch (documentType) {
      case "invoice":
        extractionResult = await extractInvoiceFields(imageBase64);
        break;
      case "lohnausweis":
        extractionResult = await extractLohnausweis(imageBase64);
        break;
      case "bank_statement":
        extractionResult = await extractBankStatement(imageBase64);
        break;
      default:
        extractionResult = await detectDocumentStructure(imageBase64);
    }
  } catch (err: unknown) {
    console.error("[LocateAnything] Extraktion fehlgeschlagen:", (err as Error).message);
    return {
      enhanced: nemotronResult ?? {},
      locateAnythingUsed: false,
      boxes: [],
    };
  }

  // Nemotron-Ergebnis mit LocateAnything-Boxes anreichern
  const enhanced: Record<string, unknown> = {
    ...(nemotronResult ?? {}),
    _locateAnythingRaw: extractionResult.rawResponse,
    _boundingBoxes: extractionResult.boxes,
    _processingTimeMs: extractionResult.processingTimeMs,
  };

  return {
    enhanced,
    locateAnythingUsed: true,
    boxes: extractionResult.boxes,
  };
}
