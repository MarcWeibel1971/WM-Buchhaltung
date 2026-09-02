#!/usr/bin/env node
/**
 * AP4.4 – Integrationstest Kernkette (P1-1):
 *   Rechnung → QR-PDF → CAMT-Zahlung → Match → Freigabe → bezahlt → mahnfrei
 * für beide Referenz-Pfade (QRR mit QR-IBAN, SCOR mit normaler IBAN).
 *
 * Läuft in CI gegen eine frische Testdatenbank (Job core-chain-integration)
 * und lokal gegen jeden dev-Server:
 *   DATABASE_URL=mysql://... BASE_URL=http://localhost:3000 node scripts/e2e-core-chain.mjs
 *
 * Exit 0 = alle Checks bestanden, Exit 1 = mindestens ein Fehler.
 */
import mysql from "mysql2/promise";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL fehlt (Testdatenbank, migriert)");
  process.exit(1);
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra ? ` | ${extra}` : ""));
  if (!cond) failures++;
}

// ── HTTP/tRPC-Helfer (superjson-Format, Cookie-Session) ─────────────────────
let cookies = new Map();
function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
async function call(proc, payload, { query = false, expectError = false } = {}) {
  let res;
  if (query) {
    res = await fetch(`${BASE}/api/trpc/${proc}?input=${encodeURIComponent(JSON.stringify({ json: payload ?? null }))}`, {
      headers: { cookie: cookieHeader() },
    });
  } else {
    res = await fetch(`${BASE}/api/trpc/${proc}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader() },
      body: JSON.stringify({ json: payload }),
    });
  }
  storeCookies(res);
  const body = await res.json();
  if (body.error) {
    if (expectError) return body.error.json;
    throw new Error(`${proc}: ${JSON.stringify(body.error).slice(0, 300)}`);
  }
  return body.result.data.json;
}

// ── DB-Helfer ────────────────────────────────────────────────────────────────
const db = await mysql.createConnection(DB_URL);
async function sqlOne(q, params = []) {
  const [rows] = await db.execute(q, params);
  return rows[0];
}

// ── Setup: User + Org + Kunde + Bankkonto ────────────────────────────────────
const uniq = Math.random().toString(16).slice(2, 10);
const email = `corechain-${uniq}@test.local`;
await call("auth.register", { email, password: "Test1234!", name: "CoreChain", origin: BASE });
await db.execute("UPDATE users SET emailVerified=1 WHERE email=?", [email]);
await call("auth.login", { email, password: "Test1234!" });
const org = await call("organizations.create", {
  name: `CoreChain AG ${uniq}`, city: "Luzern", zipCode: "6004", street: "Weg 1",
  seedKmuKontenplan: true, initialFiscalYear: 2026, makeCurrent: true,
});
const ORG_ID = org.id;
const cust = await call("customers.create", {
  name: "CoreChain Kunde GmbH", customerNumber: `K-${uniq}`,
  street: "Musterstrasse 5", zipCode: "6004", city: "Luzern", country: "Schweiz",
});
const CUST_ID = cust.id ?? cust.customerId;
await call("settings.createBankAccount", {
  accountNumber: "1020", name: "Bank CoreChain", iban: "CH9300762011623852957",
});
const ba = await sqlOne("SELECT id FROM bank_accounts WHERE organizationId=? LIMIT 1", [ORG_ID]);
const BA_ID = ba.id;

// ── Kernkette pro Referenz-Pfad ──────────────────────────────────────────────
const PATHS = [
  { type: "SCOR", iban: "CH9300762011623852957", refPattern: /^RF\d{2}[A-Z0-9]+$/ },
  { type: "QRR", iban: "CH4431999123000889012", refPattern: /^\d{27}$/ },
];

for (const p of PATHS) {
  console.log(`\n── Pfad ${p.type} ──`);
  await call("qrBill.saveQrSettings", { iban: p.iban, referenceType: p.type, currency: "CHF" });

  // 1) Rechnung erstellen + verbuchen (Referenz wird generiert)
  const created = await call("invoices.create", {
    customerId: CUST_ID, invoiceDate: "2026-09-01", paymentTermDays: 30,
    subject: `Kernkette ${p.type}`,
    items: [{ position: 1, description: "Beratung", unitPrice: 1000.0, vatRate: 8.1 }],
  });
  const INV_ID = created.id ?? created.invoiceId;
  const issued = await call("invoices.issue", { id: INV_ID });
  const REF = (issued.qrReference ?? "").replace(/\s/g, "");
  check(`${p.type}: Referenz generiert und Format korrekt`, p.refPattern.test(REF), REF);
  const invRow = await sqlOne("SELECT invoiceNumber FROM invoices WHERE id=?", [INV_ID]);
  const INV_NR = invRow.invoiceNumber;

  // 2) QR-PDF generieren + abrufbar (Storage-Kette)
  const pdf = await call("invoices.generatePdf", { id: INV_ID, regenerate: false });
  check(`${p.type}: QR-PDF generiert`, Boolean(pdf.url), pdf.filename ?? "");
  const pdfRes = await fetch(pdf.url.startsWith("http") ? pdf.url : `${BASE}${pdf.url}`,
    { headers: { cookie: cookieHeader() } });
  const pdfHead = Buffer.from(await pdfRes.arrayBuffer()).subarray(0, 4).toString("latin1");
  check(`${p.type}: QR-PDF abrufbar (%PDF)`, pdfRes.status === 200 && pdfHead === "%PDF",
    `HTTP ${pdfRes.status}`);

  // 3) CAMT-Zahlung simulieren → Match auf offene Rechnung
  const imp = await call("bankImport.importTransactions", {
    bankAccountId: BA_ID,
    transactions: [{
      transactionDate: "2026-09-05", amount: "1081.00", currency: "CHF",
      description: `Gutschrift CoreChain Kunde ${p.type}`, reference: REF,
      counterparty: "CoreChain Kunde GmbH",
    }],
  });
  check(`${p.type}: Import + Match`, imp.imported === 1 && imp.invoiceMatched === 1,
    JSON.stringify(imp).slice(0, 120));

  // 4) Match sichtbar + Buchungsvorschlag
  const txs = await call("bankImport.getTransactionsByStatus", { status: "all" }, { query: true });
  const tx = txs.find((t) => (t.reference ?? "").replace(/\s/g, "") === REF);
  check(`${p.type}: QR-Match sichtbar`, tx?.matchedInvoiceNumber === INV_NR,
    `${tx?.matchedInvoiceNumber} vs ${INV_NR}`);
  check(`${p.type}: Buchungsvorschlag (Soll/Haben)`,
    Boolean(tx?.suggestedDebitAccountId) && Boolean(tx?.suggestedCreditAccountId));

  // 5) Freigabe → Rechnung bezahlt
  await call("bankImport.approveTransaction", {
    transactionId: tx.id,
    debitAccountId: tx.suggestedDebitAccountId,
    creditAccountId: tx.suggestedCreditAccountId,
  });
  const paid = await sqlOne("SELECT status, paidAmount FROM invoices WHERE id=?", [INV_ID]);
  check(`${p.type}: Rechnung bezahlt`, paid.status === "paid" && String(paid.paidAmount) === "1081.00",
    `${paid.status} ${paid.paidAmount}`);

  // 6) Mahnfrei: bezahlte Rechnung erscheint nicht in offenen Posten
  const positions = await call("reminders.openPositions", { onlyOverdue: false }, { query: true });
  const stillOpen = JSON.stringify(positions).includes(INV_NR);
  check(`${p.type}: mahnfrei (nicht in offenen Posten)`, !stillOpen);
}

await db.end();
if (failures > 0) {
  console.error(`\n${failures} Check(s) FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log("\nKERNKETTE QRR+SCOR OK");
