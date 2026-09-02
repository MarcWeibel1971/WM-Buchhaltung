/**
 * AP4.5: Kanonischer Schweizer KMU-Kontenplan (eine einzige Quelle).
 *
 * Bis AP4 existierten zwei divergierende Seeds (MINIMAL_KMU_ACCOUNTS im
 * organizationsRouter vs. Käfer-Template im settingsRouter) mit abweichenden
 * Namen/Kategorien. Dieses Modul ist die kanonische, versionierte Quelle für
 * beide Wege: Onboarding-Seed (minimal/voll) und Template-Import in den
 * Einstellungen. Minimal ist per Konstruktion eine identische Untermenge
 * von Voll – keine Abweichung zwischen Versprechen und Ergebnis möglich.
 *
 * Änderungen am Kontenplan: hier vornehmen und KMU_KONTENPLAN_VERSION erhöhen.
 */
export const KMU_KONTENPLAN_VERSION = 1;

export interface KmuAccountDef {
  number: string;
  name: string;
  accountType: "asset" | "liability" | "expense" | "revenue" | "equity";
  normalBalance: "debit" | "credit";
  category: string;
  subCategory: string;
  sortOrder: number;
  /** true = konto ist mwst-relevant (Erlös/Vorsteuer), steuert MWST-Flags bei Buchungen. */
  isVatRelevant?: boolean;
}

/** Voller Käfer-KMU-Kontenrahmen (63 Konten) mit MWST-Flags. */
export const KMU_ACCOUNTS_VOLL: KmuAccountDef[] = [
  { number: "1000", name: "Kasse", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", sortOrder: 1000 },
  { number: "1010", name: "Post", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", sortOrder: 1010 },
  { number: "1020", name: "Bank", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", sortOrder: 1020 },
  { number: "1100", name: "Debitoren (Forderungen aus L+L)", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", sortOrder: 1100 },
  { number: "1109", name: "Delkredere", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", sortOrder: 1109 },
  { number: "1170", name: "Vorsteuer (Vorsteuer auf Materialaufwand)", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", sortOrder: 1170 },
  { number: "1171", name: "Vorsteuer (Vorsteuer auf Investitionen)", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", sortOrder: 1171 },
  { number: "1176", name: "Verrechnungssteuer", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", sortOrder: 1176 },
  { number: "1200", name: "Warenvorrat / Handelswaren", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Vorräte", sortOrder: 1200 },
  { number: "1210", name: "Rohmaterial", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Vorräte", sortOrder: 1210 },
  { number: "1300", name: "Aktive Rechnungsabgrenzung", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Transitorische Aktiven", sortOrder: 1300 },
  { number: "1400", name: "Wertschriften", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Finanzanlagen", sortOrder: 1400 },
  { number: "1440", name: "Darlehen", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Finanzanlagen", sortOrder: 1440 },
  { number: "1500", name: "Maschinen und Apparate", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Mobile Sachanlagen", sortOrder: 1500 },
  { number: "1510", name: "Mobiliar und Einrichtungen", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Mobile Sachanlagen", sortOrder: 1510 },
  { number: "1520", name: "Büromaschinen / Informatik", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Mobile Sachanlagen", sortOrder: 1520 },
  { number: "1530", name: "Fahrzeuge", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Mobile Sachanlagen", sortOrder: 1530 },
  { number: "1600", name: "Immobilien", accountType: "asset", normalBalance: "debit", category: "Anlagevermögen", subCategory: "Immobile Sachanlagen", sortOrder: 1600 },
  { number: "2000", name: "Kreditoren (Verbindlichkeiten aus L+L)", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital", sortOrder: 2000 },
  { number: "2030", name: "Kontokorrent Sozialversicherungen", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital", sortOrder: 2030 },
  { number: "2100", name: "Bankverbindlichkeiten kurzfristig", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital", sortOrder: 2100 },
  { number: "2200", name: "Geschuldete MWST", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital", sortOrder: 2200 },
  { number: "2206", name: "Verrechnungssteuer", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital", sortOrder: 2206 },
  { number: "2300", name: "Passive Rechnungsabgrenzung", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Transitorische Passiven", sortOrder: 2300 },
  { number: "2400", name: "Bankverbindlichkeiten langfristig", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristiges Fremdkapital", sortOrder: 2400 },
  { number: "2450", name: "Hypotheken", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristiges Fremdkapital", sortOrder: 2450 },
  { number: "2500", name: "Rückstellungen", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Langfristiges Fremdkapital", sortOrder: 2500 },
  { number: "2800", name: "Aktienkapital / Stammkapital", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Eigenkapital", sortOrder: 2800 },
  { number: "2900", name: "Gesetzliche Reserven", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Reserven", sortOrder: 2900 },
  { number: "2950", name: "Gewinnvortrag / Verlustvortrag", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Reserven", sortOrder: 2950 },
  { number: "2979", name: "Jahresgewinn / Jahresverlust", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Reserven", sortOrder: 2979 },
  { number: "3000", name: "Produktionserlöse / Dienstleistungserlöse", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Betriebsertrag", sortOrder: 3000, isVatRelevant: true },
  { number: "3200", name: "Handelserlöse", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Betriebsertrag", sortOrder: 3200, isVatRelevant: true },
  { number: "3400", name: "Übrige Erlöse", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Betriebsertrag", sortOrder: 3400, isVatRelevant: true },
  { number: "3800", name: "Erlösminderungen", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Erlösminderungen", sortOrder: 3800, isVatRelevant: true },
  { number: "3900", name: "Eigenleistungen / Eigenverbrauch", accountType: "revenue", normalBalance: "credit", category: "Dienstleistungsertrag", subCategory: "Eigenleistungen", sortOrder: 3900 },
  { number: "4000", name: "Materialaufwand / Warenaufwand", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Materialaufwand", sortOrder: 4000, isVatRelevant: true },
  { number: "4200", name: "Handelswarenaufwand", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Materialaufwand", sortOrder: 4200, isVatRelevant: true },
  { number: "4400", name: "Drittleistungen", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Drittleistungen", sortOrder: 4400, isVatRelevant: true },
  { number: "5000", name: "Löhne", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Löhne", sortOrder: 5000 },
  { number: "5700", name: "Sozialversicherungsaufwand", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Sozialleistungen", sortOrder: 5700 },
  { number: "5800", name: "Übriger Personalaufwand", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Übriger Personalaufwand", sortOrder: 5800 },
  { number: "5810", name: "Aus- und Weiterbildung", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Übriger Personalaufwand", sortOrder: 5810 },
  { number: "5820", name: "Spesen", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Übriger Personalaufwand", sortOrder: 5820 },
  { number: "6000", name: "Raumaufwand / Miete", accountType: "expense", normalBalance: "debit", category: "Mietaufwand", subCategory: "Raumaufwand", sortOrder: 6000, isVatRelevant: true },
  { number: "6100", name: "Unterhalt und Reparaturen", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Unterhalt", sortOrder: 6100, isVatRelevant: true },
  { number: "6200", name: "Fahrzeugaufwand", accountType: "expense", normalBalance: "debit", category: "Unterhalt und Reparatur", subCategory: "Fahrzeuge", sortOrder: 6200, isVatRelevant: true },
  { number: "6300", name: "Versicherungen", accountType: "expense", normalBalance: "debit", category: "Versicherungen", subCategory: "Sachversicherungen", sortOrder: 6300, isVatRelevant: true },
  { number: "6400", name: "Energie- und Entsorgungsaufwand", accountType: "expense", normalBalance: "debit", category: "Betriebs- und Hilfsmaterial", subCategory: "Energie", sortOrder: 6400, isVatRelevant: true },
  { number: "6500", name: "Verwaltungsaufwand", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Büroaufwand", sortOrder: 6500, isVatRelevant: true },
  { number: "6510", name: "Telefon / Internet", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Kommunikation", sortOrder: 6510, isVatRelevant: true },
  { number: "6520", name: "Buchführung / Beratung", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Beratung", sortOrder: 6520, isVatRelevant: true },
  { number: "6570", name: "Informatikaufwand", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Informatik", sortOrder: 6570, isVatRelevant: true },
  { number: "6600", name: "Werbeaufwand", accountType: "expense", normalBalance: "debit", category: "Werbeaufwand", subCategory: "Werbung", sortOrder: 6600, isVatRelevant: true },
  { number: "6700", name: "Übriger Betriebsaufwand", accountType: "expense", normalBalance: "debit", category: "Übriger Aufwand", subCategory: "Diverses", sortOrder: 6700, isVatRelevant: true },
  { number: "6800", name: "Abschreibungen auf Sachanlagen", accountType: "expense", normalBalance: "debit", category: "Abschreibungen", subCategory: "Sachanlagen", sortOrder: 6800 },
  { number: "6900", name: "Finanzaufwand", accountType: "expense", normalBalance: "debit", category: "Zinsaufwand", subCategory: "Finanzaufwand", sortOrder: 6900, isVatRelevant: true },
  { number: "6950", name: "Finanzertrag", accountType: "revenue", normalBalance: "credit", category: "Kapitalertrag", subCategory: "Finanzertrag", sortOrder: 6950 },
  { number: "7000", name: "Betriebsfremder Aufwand", accountType: "expense", normalBalance: "debit", category: "Übriger Aufwand", subCategory: "Betriebsfremd", sortOrder: 7000 },
  { number: "7500", name: "Ausserordentlicher Aufwand", accountType: "expense", normalBalance: "debit", category: "Übriger Aufwand", subCategory: "Ausserordentlich", sortOrder: 7500 },
  { number: "8000", name: "Betriebsfremder Ertrag", accountType: "revenue", normalBalance: "credit", category: "Übriger Ertrag", subCategory: "Betriebsfremd", sortOrder: 8000 },
  { number: "8500", name: "Ausserordentlicher Ertrag", accountType: "revenue", normalBalance: "credit", category: "Übriger Ertrag", subCategory: "Ausserordentlich", sortOrder: 8500 },
  { number: "9000", name: "Eröffnungsbilanz", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Eröffnung", sortOrder: 9000 },
];

/** Minimal-Variante (14 Konten): die wichtigsten Konten zum sofort Loslegen. */
export const KMU_MINIMAL_NUMBERS = [
  "1000",
  "1020",
  "1100",
  "1170",
  "2000",
  "2200",
  "2800",
  "3000",
  "4000",
  "5000",
  "6000",
  "6500",
  "6900",
  "9000",
] as const;

export const KMU_ACCOUNTS_MINIMAL: KmuAccountDef[] = KMU_ACCOUNTS_VOLL.filter((a) =>
  (KMU_MINIMAL_NUMBERS as readonly string[]).includes(a.number),
);

export type KmuChartTemplate = "minimal" | "voll";

/** Liefert die kanonische Kontenliste für die gewählte Variante. */
export function getKmuAccounts(template: KmuChartTemplate): KmuAccountDef[] {
  return template === "voll" ? KMU_ACCOUNTS_VOLL : KMU_ACCOUNTS_MINIMAL;
}

/**
 * Standard-Konten-Zuordnung für automatische Buchungen (Rechnungsausgang,
 * Zahlungsabgleich, Eröffnungsbilanz). Alle referenzierten Konten sind in
 * beiden Varianten (minimal UND voll) enthalten – das wird im Test sichergestellt.
 */
export const STANDARD_ACCOUNTS = {
  kasse: "1000",
  bank: "1020",
  debitoren: "1100",
  vorsteuer: "1170",
  kreditoren: "2000",
  mwstGeschuldet: "2200",
  eigenkapital: "2800",
  dienstleistungsertrag: "3000",
  materialaufwand: "4000",
  lohnaufwand: "5000",
  raumaufwand: "6000",
  verwaltungsaufwand: "6500",
  finanzaufwand: "6900",
  eroeffnungsbilanz: "9000",
} as const;
