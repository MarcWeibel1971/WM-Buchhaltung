/**
 * Nemotron 3 Nano Omni Helper
 * NVIDIA's multimodal reasoning model via OpenRouter (kostenlos)
 * Modell: nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
 * Fähigkeiten: Text, Bild, Audio, Video → Text
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const NEMOTRON_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

interface NemotronMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
      >;
}

interface NemotronOptions {
  messages: NemotronMessage[];
  maxTokens?: number;
  temperature?: number;
  enableReasoning?: boolean;
  responseFormat?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: object;
    };
  };
}

interface NemotronResponse {
  content: string;
  reasoning?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens: number;
    cost: number;
  };
}

/**
 * Ruft Nemotron 3 Nano Omni via OpenRouter auf.
 * Unterstützt Text und Bilder (base64 oder URL).
 */
export async function invokeNemotron(options: NemotronOptions): Promise<NemotronResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY nicht gesetzt");
  }

  const body: Record<string, unknown> = {
    model: NEMOTRON_MODEL,
    messages: options.messages,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.1,
  };

  if (options.enableReasoning) {
    body.reasoning = { enabled: true };
  }

  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://wmbuchhaltung-g3uypyrz.manus.space",
      "X-Title": "KLAX Buchhaltung",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nemotron API Fehler ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string | null;
        reasoning?: string;
        reasoning_details?: Array<{ text: string }>;
      };
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      completion_tokens_details?: { reasoning_tokens?: number };
      cost: number;
    };
  };

  const choice = data.choices[0];
  const content = choice?.message?.content ?? "";
  const reasoning =
    choice?.message?.reasoning ??
    choice?.message?.reasoning_details?.map((d) => d.text).join("") ??
    undefined;

  return {
    content,
    reasoning,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      cost: data.usage?.cost ?? 0,
    },
  };
}

/**
 * Analysiert ein Dokument (PDF-Seite als Bild oder URL) mit Nemotron.
 * Gibt strukturierte JSON-Daten zurück.
 */
export async function analyzeDocumentWithNemotron(params: {
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
  additionalContext?: string;
}): Promise<{
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  vatAmount: number;
  vatRate: number;
  currency: string;
  iban: string;
  qrReference: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    suggestedAccount: string;
    confidence: number;
  }>;
  documentType: string;
  confidence: number;
  notes: string;
}> {
  const imageContent =
    params.imageBase64
      ? {
          type: "image_url" as const,
          image_url: {
            url: `data:${params.mimeType ?? "image/jpeg"};base64,${params.imageBase64}`,
            detail: "high" as const,
          },
        }
      : params.imageUrl
      ? {
          type: "image_url" as const,
          image_url: { url: params.imageUrl, detail: "high" as const },
        }
      : null;

  const messages: NemotronMessage[] = [
    {
      role: "system",
      content: `Du bist ein Schweizer Buchhaltungsexperte (KMU-Buchhaltung, Schweizer Kontenplan SKR04).
Analysiere das Dokument und extrahiere alle relevanten Buchungsdaten.
Schweizer Besonderheiten:
- MWST-Sätze: 8.1% (Standard), 3.8% (Sonderfall Beherbergung), 2.6% (reduziert)
- QR-IBAN beginnt mit CH oder LI
- QR-Referenz: 27-stellig (QRR) oder ISO-Referenz
- Kontenplan: 1000-1999 Aktiven, 2000-2999 Passiven, 3000-3999 Ertrag, 4000-6999 Aufwand
- Vorsteuer-Konto: 1170 (bei Eingangsrechnungen mit MWST)
Antworte ausschliesslich mit validem JSON.`,
    },
    {
      role: "user",
      content: [
        ...(imageContent ? [imageContent] : []),
        {
          type: "text" as const,
          text: `Analysiere dieses Dokument und extrahiere alle Buchungsdaten.${
            params.additionalContext ? `\n\nZusatzkontext: ${params.additionalContext}` : ""
          }

Antworte mit folgendem JSON-Schema:
{
  "vendor": "Lieferantenname",
  "invoiceNumber": "Rechnungsnummer",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "totalAmount": 0.00,
  "vatAmount": 0.00,
  "vatRate": 8.1,
  "currency": "CHF",
  "iban": "CH...",
  "qrReference": "27-stellige Referenz oder leer",
  "lineItems": [
    {
      "description": "Beschreibung",
      "quantity": 1,
      "unitPrice": 0.00,
      "total": 0.00,
      "suggestedAccount": "6000",
      "confidence": 0.95
    }
  ],
  "documentType": "invoice|credit_note|bank_statement|credit_card|receipt|other",
  "confidence": 0.95,
  "notes": "Besonderheiten oder Hinweise"
}`,
        },
      ],
    },
  ];

  const result = await invokeNemotron({
    messages,
    maxTokens: 2048,
    temperature: 0.05,
    enableReasoning: false,
  });

  // JSON aus der Antwort extrahieren
  let jsonStr = result.content;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  } else {
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`Nemotron JSON-Parse-Fehler: ${result.content.slice(0, 200)}`);
  }
}

/**
 * Beantwortet eine Buchhaltungsfrage mit Kontext und Reasoning.
 */
export async function askNemotronAccounting(params: {
  question: string;
  context: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ answer: string; reasoning?: string }> {
  const messages: NemotronMessage[] = [
    {
      role: "system",
      content: `Du bist KLAX, ein KI-Buchhaltungsassistent für Schweizer KMU (WM Weibel Mueller AG).
Du kennst den Schweizer Kontenplan (SKR04), MWST-Recht (MWSTG), OR-Buchführungspflicht und Schweizer Buchhaltungsstandards.
Antworte präzise, professionell und auf Deutsch. Nenne immer konkrete Kontonummern wenn relevant.

Aktueller Buchungskontext:
${params.context}`,
    },
    ...(params.history ?? []).map((h) => ({
      role: h.role,
      content: h.content,
    })),
    {
      role: "user" as const,
      content: params.question,
    },
  ];

  const result = await invokeNemotron({
    messages,
    maxTokens: 1024,
    temperature: 0.2,
    enableReasoning: true,
  });

  return {
    answer: result.content,
    reasoning: result.reasoning,
  };
}
