/**
 * Seed script: Kontenplan WM Weibel Mueller AG, Eröffnungssalden 2025, Mitarbeiter, Bankkonten
 * Run: npx tsx server/seed.ts
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { accounts, employees, bankAccounts, fiscalYears, openingBalances } from "../drizzle/schema";
import dotenv from "dotenv";
dotenv.config();



// ─── Kontenplan ───────────────────────────────────────────────────────────────
const ACCOUNTS = [
  // AKTIVEN – Umlaufvermögen
  { number: "1000", name: "CHF Kasse", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", isBankAccount: false, sortOrder: 10 },
  { number: "1010", name: "Bankguthaben", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", isBankAccount: true, sortOrder: 20 },
  { number: "1021", name: "Bank Cler", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", isBankAccount: true, sortOrder: 30 },
  { number: "1031", name: "LUKB Kontokorrent", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", isBankAccount: true, sortOrder: 40 },
  { number: "1032", name: "LUKB mw ...3555 8320 9", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", isBankAccount: true, sortOrder: 50 },
  { number: "1033", name: "LUKB jm ...3555 8310 0", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", isBankAccount: true, sortOrder: 60 },
  { number: "1040", name: "LUKB Mietzinsdepot", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", isBankAccount: false, sortOrder: 70 },
  { number: "1050", name: "Debitoren", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", isBankAccount: false, sortOrder: 80 },
  { number: "1051", name: "Angefangene Arbeiten", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", isBankAccount: false, sortOrder: 90 },
  { number: "1060", name: "Guthaben Verrechnungssteuer", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", isBankAccount: false, sortOrder: 100 },
  { number: "1070", name: "Darlehen jm", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", isBankAccount: false, sortOrder: 110 },
  { number: "1071", name: "Kontokorrent jm", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", isBankAccount: false, sortOrder: 120 },
  { number: "1080", name: "Darlehen mw", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", isBankAccount: false, sortOrder: 130 },
  { number: "1081", name: "Kontokorrent mw", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", isBankAccount: false, sortOrder: 140 },
  { number: "1082", name: "Durchlaufkonto VISA mw", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Durchlaufkonten", isBankAccount: false, sortOrder: 150 },
  { number: "1090", name: "TA", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Transitorische Aktiven", isBankAccount: false, sortOrder: 160 },
  // AKTIVEN – Anlagevermögen
  { number: "1110", name: "Geräte", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Sachanlagen", isBankAccount: false, sortOrder: 200 },
  { number: "1111", name: "Hardware", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Sachanlagen", isBankAccount: false, sortOrder: 210 },
  { number: "1113", name: "Mobiliar/Einrichtungen", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Sachanlagen", isBankAccount: false, sortOrder: 220 },
  { number: "1200", name: "Beteiligung SDC Zürich", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Finanzanlagen", isBankAccount: false, sortOrder: 230 },
  // PASSIVEN – Fremdkapital
  { number: "2000", name: "Kreditoren", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristig", isBankAccount: false, sortOrder: 300 },
  { number: "2010", name: "Darlehen LUKB Mahtabi", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristig", isBankAccount: false, sortOrder: 310 },
  { number: "2020", name: "Darlehen jm", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristig", isBankAccount: false, sortOrder: 320 },
  { number: "2030", name: "Kontokorrent jm", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristig", isBankAccount: false, sortOrder: 330 },
  { number: "2035", name: "Darlehen Hr. Mölle", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristig", isBankAccount: false, sortOrder: 340 },
  { number: "2040", name: "Mehrwertsteuer", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristig", isBankAccount: false, sortOrder: 350 },
  { number: "2051", name: "LUKB Darlehen 1 SDC", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristig", isBankAccount: false, sortOrder: 360 },
  { number: "2052", name: "LUKB Darlehen 2 SDC", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristig", isBankAccount: false, sortOrder: 370 },
  { number: "2053", name: "LUKB Darlehen 3 SDC", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristig", isBankAccount: false, sortOrder: 380 },
  { number: "2079", name: "Darlehen MWC GmbH", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristig", isBankAccount: false, sortOrder: 390 },
  { number: "2090", name: "TP", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Transitorische Passiven", isBankAccount: false, sortOrder: 400 },
  // PASSIVEN – Eigenkapital
  { number: "2200", name: "Aktienkapital", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Grundkapital", isBankAccount: false, sortOrder: 500 },
  { number: "2220", name: "Gesetzliche Reserven", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Reserven", isBankAccount: false, sortOrder: 510 },
  { number: "2290", name: "Gewinn-/Verlustvortrag", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Gewinnvortrag", isBankAccount: false, sortOrder: 520 },
  // AUFWAND – Drittaufwand
  { number: "3000", name: "Fremdhonorar", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Fremdleistungen", isBankAccount: false, sortOrder: 600 },
  { number: "3001", name: "Fremdhonorar mw", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Fremdleistungen", isBankAccount: false, sortOrder: 610 },
  { number: "3002", name: "Fremdhonorar jm", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Fremdleistungen", isBankAccount: false, sortOrder: 620 },
  { number: "3010", name: "SDC", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Fremdleistungen", isBankAccount: false, sortOrder: 630 },
  // AUFWAND – Personalaufwand
  { number: "4000", name: "mw brutto", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Löhne", isBankAccount: false, sortOrder: 700 },
  { number: "4001", name: "jm brutto", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Löhne", isBankAccount: false, sortOrder: 710 },
  { number: "4005", name: "Personal brutto", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Löhne", isBankAccount: false, sortOrder: 720 },
  { number: "4010", name: "AHV", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Sozialversicherungen", isBankAccount: false, sortOrder: 730 },
  { number: "4025", name: "KTG/UVG/UVGZ", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Sozialversicherungen", isBankAccount: false, sortOrder: 740 },
  { number: "4040", name: "BVG", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Sozialversicherungen", isBankAccount: false, sortOrder: 750 },
  { number: "4090", name: "Weiterbildung", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Weiterbildung", isBankAccount: false, sortOrder: 760 },
  // AUFWAND – Mietaufwand
  { number: "4100", name: "Mietaufwand", accountType: "expense", normalBalance: "debit", category: "Mietaufwand", subCategory: "Miete", isBankAccount: false, sortOrder: 800 },
  // AUFWAND – Zinsaufwand
  { number: "4220", name: "Zinsen", accountType: "expense", normalBalance: "debit", category: "Zinsaufwand", subCategory: "Zinsen", isBankAccount: false, sortOrder: 900 },
  { number: "4221", name: "Bankspesen", accountType: "expense", normalBalance: "debit", category: "Zinsaufwand", subCategory: "Bankspesen", isBankAccount: false, sortOrder: 910 },
  { number: "4222", name: "Bankspesen mw", accountType: "expense", normalBalance: "debit", category: "Zinsaufwand", subCategory: "Bankspesen", isBankAccount: false, sortOrder: 920 },
  // AUFWAND – Unterhalt und Reparatur
  { number: "4300", name: "Geräte", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Geräte", isBankAccount: false, sortOrder: 1000 },
  { number: "4301", name: "Hardware", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Hardware", isBankAccount: false, sortOrder: 1010 },
  { number: "4302", name: "Software, Cloud & ITBrtung", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Software & IT", isBankAccount: false, sortOrder: 1020 },
  { number: "4303", name: "Mobilien", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Mobilien", isBankAccount: false, sortOrder: 1030 },
  { number: "4305", name: "Software & ITBeratung mw", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Software & IT", isBankAccount: false, sortOrder: 1040 },
  { number: "4306", name: "Software & ITBeratung jm", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Software & IT", isBankAccount: false, sortOrder: 1050 },
  // AUFWAND – Abschreibungen
  { number: "4400", name: "Abschreibungen", accountType: "expense", normalBalance: "debit", category: "Abschreibungen", subCategory: "Abschreibungen", isBankAccount: false, sortOrder: 1100 },
  // AUFWAND – Versicherungen
  { number: "4500", name: "Sachversicherungen", accountType: "expense", normalBalance: "debit", category: "Versicherungen", subCategory: "Sachversicherungen", isBankAccount: false, sortOrder: 1200 },
  // AUFWAND – Betriebs- und Hilfsmaterial
  { number: "4600", name: "Strom", accountType: "expense", normalBalance: "debit", category: "Betriebs- und Hilfsmaterial", subCategory: "Energie", isBankAccount: false, sortOrder: 1300 },
  // AUFWAND – Verwaltungsaufwand
  { number: "4700", name: "Büromaterial", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Büromaterial", isBankAccount: false, sortOrder: 1400 },
  { number: "4701", name: "Büromaterial mw", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Büromaterial", isBankAccount: false, sortOrder: 1410 },
  { number: "4702", name: "Büromaterial jm", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Büromaterial", isBankAccount: false, sortOrder: 1420 },
  { number: "4710", name: "Fachliteratur", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Fachliteratur", isBankAccount: false, sortOrder: 1430 },
  { number: "4711", name: "Fachliteratur mw", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Fachliteratur", isBankAccount: false, sortOrder: 1440 },
  { number: "4712", name: "Fachliteratur jm", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Fachliteratur", isBankAccount: false, sortOrder: 1450 },
  { number: "4720", name: "Kommunikation/Internet/Porto", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Kommunikation", isBankAccount: false, sortOrder: 1460 },
  { number: "4721", name: "Kommunikation mw", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Kommunikation", isBankAccount: false, sortOrder: 1470 },
  { number: "4722", name: "Kommunikation jm", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Kommunikation", isBankAccount: false, sortOrder: 1480 },
  { number: "4730", name: "Beiträge und Gebühren", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Beiträge", isBankAccount: false, sortOrder: 1490 },
  { number: "4731", name: "Beiträge und Gebühren mw", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Beiträge", isBankAccount: false, sortOrder: 1500 },
  { number: "4732", name: "Beiträge und Gebühren jm", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Beiträge", isBankAccount: false, sortOrder: 1510 },
  { number: "4740", name: "Rechts- und Beratungsaufwand", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Beratung", isBankAccount: false, sortOrder: 1520 },
  { number: "4741", name: "Rechts- und Beratungsaufwand mw", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Beratung", isBankAccount: false, sortOrder: 1530 },
  { number: "4742", name: "Rechts- und Beratungsaufwand jm", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Beratung", isBankAccount: false, sortOrder: 1540 },
  { number: "4790", name: "Übriger Betriebs- und Verwaltungsaufwand", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Übriger Aufwand", isBankAccount: false, sortOrder: 1550 },
  { number: "4792", name: "Übriger Betriebs- und Verwaltungsaufwand jm", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Übriger Aufwand", isBankAccount: false, sortOrder: 1560 },
  { number: "4799", name: "Diverser Aufwand", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Übriger Aufwand", isBankAccount: false, sortOrder: 1570 },
  // AUFWAND – Werbeaufwand
  { number: "4800", name: "Eigenwerbung", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Werbung", isBankAccount: false, sortOrder: 1600 },
  { number: "4810", name: "Kundengeschenke", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Kundengeschenke", isBankAccount: false, sortOrder: 1610 },
  { number: "4811", name: "Kundengeschenke mw", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Kundengeschenke", isBankAccount: false, sortOrder: 1620 },
  { number: "4812", name: "Kundengeschenke jm", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Kundengeschenke", isBankAccount: false, sortOrder: 1630 },
  { number: "4820", name: "Reisespesen", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Spesen", isBankAccount: false, sortOrder: 1640 },
  { number: "4821", name: "Reisespesen mw", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Spesen", isBankAccount: false, sortOrder: 1650 },
  { number: "4822", name: "Reisespesen jm", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Spesen", isBankAccount: false, sortOrder: 1660 },
  { number: "4830", name: "Fahrzeuge", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Fahrzeuge", isBankAccount: false, sortOrder: 1670 },
  { number: "4850", name: "Geschäftsreisen", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Spesen", isBankAccount: false, sortOrder: 1680 },
  { number: "4890", name: "Repräsentationsspesen", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Repräsentation", isBankAccount: false, sortOrder: 1690 },
  { number: "4891", name: "Repräsentationsspesen mw", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Repräsentation", isBankAccount: false, sortOrder: 1700 },
  { number: "4892", name: "Repräsentationsspesen jm", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Repräsentation", isBankAccount: false, sortOrder: 1710 },
  // AUFWAND – Übriger Aufwand
  { number: "4900", name: "Steuern", accountType: "expense", normalBalance: "debit", category: "Übriger Aufwand", subCategory: "Steuern", isBankAccount: false, sortOrder: 1800 },
  { number: "4910", name: "MWST", accountType: "expense", normalBalance: "debit", category: "Übriger Aufwand", subCategory: "MWST", isVatRelevant: true, isBankAccount: false, sortOrder: 1810 },
  { number: "4990", name: "Spenden", accountType: "expense", normalBalance: "debit", category: "Übriger Aufwand", subCategory: "Spenden", isBankAccount: false, sortOrder: 1820 },
  // ERTRAG – Dienstleistungsertrag
  { number: "6000", name: "Beratung", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Beratung", isVatRelevant: true, defaultVatRate: "8.1", isBankAccount: false, sortOrder: 2000 },
  { number: "6001", name: "Beratung mw", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Beratung", isVatRelevant: true, defaultVatRate: "8.1", isBankAccount: false, sortOrder: 2010 },
  { number: "6002", name: "Beratung jm", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Beratung", isVatRelevant: true, defaultVatRate: "8.1", isBankAccount: false, sortOrder: 2020 },
  { number: "6010", name: "VV", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Vermögensverwaltung", isVatRelevant: false, isBankAccount: false, sortOrder: 2030 },
  { number: "6011", name: "VV mw", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Vermögensverwaltung", isVatRelevant: false, isBankAccount: false, sortOrder: 2040 },
  { number: "6012", name: "VV jm", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Vermögensverwaltung", isVatRelevant: false, isBankAccount: false, sortOrder: 2050 },
  { number: "6020", name: "Retrozessionen", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Retrozessionen", isVatRelevant: false, isBankAccount: false, sortOrder: 2060 },
  { number: "6021", name: "Retrozessionen mw", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Retrozessionen", isVatRelevant: false, isBankAccount: false, sortOrder: 2070 },
  // ERTRAG – Kapitalertrag
  { number: "6700", name: "Zinsertrag", accountType: "revenue", normalBalance: "credit", category: "Kapitalertrag", subCategory: "Zinsen", isVatRelevant: false, isBankAccount: false, sortOrder: 2100 },
  // ERTRAG – Übriger Ertrag
  { number: "6800", name: "Übriger Ertrag", accountType: "revenue", normalBalance: "credit", category: "Übriger Ertrag", subCategory: "Übriger Ertrag", isVatRelevant: false, isBankAccount: false, sortOrder: 2200 },
] as const;

// ─── Eröffnungssalden per 01.01.2026 (= Bilanz 31.12.2025) ───────────────────
const OPENING_BALANCES_2026: Record<string, string> = {
  "1000": "280.05",
  "1010": "13609.35",
  "1050": "91500.00",
  "1051": "35000.00",
  "1080": "87768.05",
  "1090": "16355.09",
  "1110": "1300.00",
  "1111": "400.00",
  "1113": "9400.00",
  "1200": "850000.00",
  "2000": "7828.05",
  "2010": "50000.00",
  "2020": "87000.00",
  "2030": "0.00",
  "2035": "150000.00",
  "2040": "0.00",
  "2051": "200000.00",
  "2052": "200000.00",
  "2053": "200000.00",
  "2079": "20000.00",
  "2090": "26288.38",
  "2200": "100000.00",
  "2220": "50000.00",
  "2290": "53223.58",
};

async function seed() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);
  console.log("Seeding Kontenplan...");
  for (const acc of ACCOUNTS) {
    await db.insert(accounts).values({
      number: acc.number,
      name: acc.name,
      accountType: acc.accountType as any,
      normalBalance: acc.normalBalance as any,
      category: acc.category,
      subCategory: acc.subCategory,
      isBankAccount: acc.isBankAccount,
      isVatRelevant: (acc as any).isVatRelevant ?? false,
      defaultVatRate: (acc as any).defaultVatRate ?? null,
      sortOrder: acc.sortOrder,
    }).onDuplicateKeyUpdate({ set: { name: acc.name, category: acc.category, subCategory: acc.subCategory, sortOrder: acc.sortOrder } });
  }
  console.log(`✓ ${ACCOUNTS.length} Konten geseedet`);

  // Fiscal years
  await db.insert(fiscalYears).values(
    { year: 2023, startDate: new Date("2023-01-01"), endDate: new Date("2023-12-31"), isClosed: true }
  ).onDuplicateKeyUpdate({ set: { isClosed: true } });
  await db.insert(fiscalYears).values(
    { year: 2024, startDate: new Date("2024-01-01"), endDate: new Date("2024-12-31"), isClosed: true }
  ).onDuplicateKeyUpdate({ set: { isClosed: true } });
  await db.insert(fiscalYears).values(
    { year: 2025, startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), isClosed: true }
  ).onDuplicateKeyUpdate({ set: { isClosed: true } });
  await db.insert(fiscalYears).values(
    { year: 2026, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), isClosed: false }
  ).onDuplicateKeyUpdate({ set: { isClosed: false } });
  console.log("✓ Geschäftsjahre geseedet");

  // Opening balances 2026
  const allAccounts = await db.select().from(accounts);
  const accountMap = new Map(allAccounts.map(a => [a.number, a.id]));
  
  for (const [number, balance] of Object.entries(OPENING_BALANCES_2026)) {
    const accountId = accountMap.get(number);
    if (accountId) {
      await db.insert(openingBalances).values({
        accountId,
        fiscalYear: 2026,
        balance,
      }).onDuplicateKeyUpdate({ set: { balance } });
    }
  }
  console.log("✓ Eröffnungssalden 2026 geseedet");

  // Employees
  const mwGrossId = accountMap.get("4000");
  const jmGrossId = accountMap.get("4001");
  const mwKkId = accountMap.get("1081");
  const jmKkId = accountMap.get("1071");

  await db.insert(employees).values([
    {
      code: "mw",
      firstName: "Marc",
      lastName: "Weibel",
      grossSalaryAccountId: mwGrossId,
      salaryAccountId: mwKkId,
    },
    {
      code: "jm",
      firstName: "J.",
      lastName: "Mueller",
      grossSalaryAccountId: jmGrossId,
      salaryAccountId: jmKkId,
    },
  ]).onDuplicateKeyUpdate({ set: { isActive: true } });
  console.log("✓ Mitarbeiter geseedet (mw, jm)");

  // Bank accounts
  const lukbWmId = accountMap.get("1031");
  const lukbMwId = accountMap.get("1032");
  const lukbJmId = accountMap.get("1033");

  if (lukbWmId) {
    await db.insert(bankAccounts).values([
      { accountId: lukbWmId, name: "LUKB Kontokorrent (WM)", bank: "LUKB", currency: "CHF", owner: "wm" },
      { accountId: lukbMwId!, name: "LUKB mw ...3555 8320 9", bank: "LUKB", currency: "CHF", owner: "mw" },
      { accountId: lukbJmId!, name: "LUKB jm ...3555 8310 0", bank: "LUKB", currency: "CHF", owner: "jm" },
    ]).onDuplicateKeyUpdate({ set: { isActive: true } });
    console.log("✓ Bankkonten geseedet");
  }

  console.log("\n✅ Seeding abgeschlossen!");
  await connection.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
