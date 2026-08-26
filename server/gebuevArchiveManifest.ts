import { createHash } from "node:crypto";

export function buildGebuevArchiveManifest({ fiscalYear, journalCsv, documentCount, accountLedgerCount = 0 }: { fiscalYear: number; journalCsv: string; documentCount: number; accountLedgerCount?: number }) {
  return JSON.stringify({
    format: "WM-GeBueV-Archiv",
    version: 1,
    fiscalYear,
    generatedAt: new Date().toISOString(),
    contents: [{ path: `journal/Journal_${fiscalYear}.csv`, sha256: createHash("sha256").update(journalCsv).digest("hex") }, { path: "documents/", count: documentCount }, { path: "account-ledgers/", count: accountLedgerCount }],
  }, null, 2);
}
