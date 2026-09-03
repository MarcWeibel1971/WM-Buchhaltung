import { describe, it, expect } from "vitest";
import { parseCAMT053, parseCSV, parseMT940, normaliseDate, parseAmount } from "../shared/bankParser";

function camt053(ntries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document><BkToCstmrStmt><Stmt>
  <Acct><Id><IBAN>CH9300762011623852957</IBAN></Id></Acct>
  ${ntries}
</Stmt></BkToCstmrStmt></Document>`;
}

describe("parseCAMT053 – Referenz-Extraktion", () => {
  it("extrahiert strukturierte QR-Referenz aus CdtrRefInf (Priorität)", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">1250.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-07-15</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs>
          <RltdPties><Dbtr><Nm>Muster AG</Nm></Dbtr></RltdPties>
          <RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Prtry>QRR</Prtry></CdOrPrtry></Tp>
            <Ref>260000000000000000000012345</Ref>
          </CdtrRefInf></Strd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs).toHaveLength(1);
    expect(txs[0].reference).toBe("260000000000000000000012345");
    expect(txs[0].amount).toBe("1250.00");
    expect(txs[0].counterparty).toBe("Muster AG");
  });

  it("fällt auf EndToEndId zurück, wenn keine strukturierte Referenz vorhanden", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">80.50</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-07-16</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>ORDER-4711</EndToEndId></Refs>
        </TxDtls></NtryDtls>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs).toHaveLength(1);
    expect(txs[0].reference).toBe("ORDER-4711");
    expect(txs[0].amount).toBe("-80.50");
  });

  it("liefert undefined-Referenz, wenn weder CdtrRefInf noch EndToEndId vorhanden", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">15.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-07-17</Dt></BookgDt>
        <AddtlNtryInf>Kontoführungsgebühr</AddtlNtryInf>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs).toHaveLength(1);
    expect(txs[0].reference).toBeUndefined();
  });
});

// Audit: Tests zu den behobenen Parser-Fehlern
describe("parseCAMT053 – Gegenpartei richtungsabhängig", () => {
  it("CRDT: Gegenpartei ist der Dbtr (+ DbtrAcct-IBAN), nicht der Cdtr (Kontoinhaber)", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">500.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-07-20</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties>
            <Dbtr><Nm>Kunde Meier &amp; Co</Nm></Dbtr>
            <DbtrAcct><Id><IBAN>CH11 0070 0110 0012 3456 7</IBAN></Id></DbtrAcct>
            <Cdtr><Nm>Weibel Müller Treuhand</Nm></Cdtr>
            <CdtrAcct><Id><IBAN>CH9300762011623852957</IBAN></Id></CdtrAcct>
          </RltdPties>
        </TxDtls></NtryDtls>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs).toHaveLength(1);
    expect(txs[0].counterparty).toBe("Kunde Meier & Co");
    expect(txs[0].counterpartyIban).toBe("CH1100700110001234567");
  });

  it("DBIT: Gegenpartei ist der Cdtr (+ CdtrAcct-IBAN)", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">120.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-07-21</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties>
            <Dbtr><Nm>Weibel Müller Treuhand</Nm></Dbtr>
            <DbtrAcct><Id><IBAN>CH9300762011623852957</IBAN></Id></DbtrAcct>
            <Cdtr><Nm>Swisscom AG</Nm></Cdtr>
            <CdtrAcct><Id><IBAN>CH5604835012345678009</IBAN></Id></CdtrAcct>
          </RltdPties>
        </TxDtls></NtryDtls>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs[0].counterparty).toBe("Swisscom AG");
    expect(txs[0].counterpartyIban).toBe("CH5604835012345678009");
  });

  it("Dbtr ohne Nm greift nicht auf den Nm des nachfolgenden Cdtr über", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">10.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-07-21</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties>
            <Dbtr><Id><OrgId><AnyBIC>ABCDCHZZ</AnyBIC></OrgId></Id></Dbtr>
            <Cdtr><Nm>Kontoinhaber</Nm></Cdtr>
          </RltdPties>
        </TxDtls></NtryDtls>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs[0].counterparty).toBeUndefined();
  });
});

describe("parseCAMT053 – Sammelbuchungen und Status", () => {
  it("splittet einen Ntry mit zwei TxDtls in zwei Transaktionen mit Einzelbeträgen", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">300.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-07-22</Dt></BookgDt>
        <ValDt><Dt>2026-07-22</Dt></ValDt>
        <AddtlNtryInf>Sammelgutschrift QR</AddtlNtryInf>
        <NtryDtls>
          <Btch><NbOfTxs>2</NbOfTxs></Btch>
          <TxDtls>
            <Refs><EndToEndId>E2E-1</EndToEndId></Refs>
            <AmtDtls><TxAmt><Amt Ccy="CHF">100.00</Amt></TxAmt></AmtDtls>
            <RltdPties><Dbtr><Nm>Debitor Eins</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>CH1111111111111111111</IBAN></Id></DbtrAcct></RltdPties>
            <RmtInf><Strd><CdtrRefInf><Ref>210000000003139471430009017</Ref></CdtrRefInf></Strd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Refs><EndToEndId>E2E-2</EndToEndId></Refs>
            <Amt Ccy="CHF">200.00</Amt>
            <RltdPties><Dbtr><Nm>Debitor Zwei</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>CH2222222222222222222</IBAN></Id></DbtrAcct></RltdPties>
            <RmtInf><Ustrd>Rechnung 4712</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs).toHaveLength(2);
    expect(txs[0]).toMatchObject({
      transactionDate: "2026-07-22",
      valueDate: "2026-07-22",
      amount: "100.00",
      currency: "CHF",
      reference: "210000000003139471430009017",
      counterparty: "Debitor Eins",
      counterpartyIban: "CH1111111111111111111",
      description: "Sammelgutschrift QR",
    });
    expect(txs[1]).toMatchObject({
      transactionDate: "2026-07-22",
      amount: "200.00",
      reference: "E2E-2",
      counterparty: "Debitor Zwei",
      counterpartyIban: "CH2222222222222222222",
      description: "Rechnung 4712",
    });
  });

  it("Sammelbelastung: Einzelbeträge werden negativ, Gegenpartei = Cdtr", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">75.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-07-23</Dt></BookgDt>
        <NtryDtls>
          <TxDtls><AmtDtls><TxAmt><Amt Ccy="CHF">25.00</Amt></TxAmt></AmtDtls>
            <RltdPties><Cdtr><Nm>Lieferant A</Nm></Cdtr></RltdPties></TxDtls>
          <TxDtls><AmtDtls><TxAmt><Amt Ccy="CHF">50.00</Amt></TxAmt></AmtDtls>
            <RltdPties><Cdtr><Nm>Lieferant B</Nm></Cdtr></RltdPties></TxDtls>
        </NtryDtls>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs.map(t => t.amount)).toEqual(["-25.00", "-50.00"]);
    expect(txs.map(t => t.counterparty)).toEqual(["Lieferant A", "Lieferant B"]);
  });

  it("überspringt Einträge mit Status PDNG (v2 und v8-Schreibweise)", () => {
    const xml = camt053(`
      <Ntry>
        <Amt Ccy="CHF">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>PDNG</Sts>
        <BookgDt><Dt>2026-07-24</Dt></BookgDt>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">20.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>PDNG</Cd></Sts>
        <BookgDt><Dt>2026-07-24</Dt></BookgDt>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">30.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>2026-07-24</Dt></BookgDt>
      </Ntry>`);
    const txs = parseCAMT053(xml);
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe("30.00");
  });
});

describe("parseCSV – Spalten-Layouts und Quoting", () => {
  it("Zwei-Spalten-Layout Gutschrift/Belastung: Betrag = Gutschrift − Belastung", () => {
    const csv = [
      "Datum;Buchungstext;Gutschrift;Belastung;Saldo",
      "01.07.2026;Zahlungseingang Kunde;1'250.00;;10'000.00",
      "02.07.2026;Miete Juli;;2'500.00;7'500.00",
      "03.07.2026;Rückbuchung;;-100.00;7'600.00",
      "03.07.2026;Saldo;;;7'600.00",
    ].join("\n");
    const txs = parseCSV(csv);
    expect(txs).toHaveLength(3);
    expect(txs[0].amount).toBe("1250.00");
    expect(txs[1].amount).toBe("-2500.00");
    expect(txs[2].amount).toBe("-100.00");
  });

  it("englisches Credit/Debit-Layout mit Komma-Trennzeichen", () => {
    const csv = [
      "Date,Description,Credit,Debit",
      "2026-07-01,Invoice 1,\"1,000.00\",",
      "2026-07-02,Supplier,,\"250.50\"",
    ].join("\r\n");
    const txs = parseCSV(csv);
    expect(txs.map(t => t.amount)).toEqual(["1000.00", "-250.50"]);
  });

  it("PostFinance-Layout 'Gutschrift in CHF'/'Lastschrift in CHF'", () => {
    const csv = [
      "Buchungsdatum;Avisierungstext;Gutschrift in CHF;Lastschrift in CHF;Valuta;Saldo in CHF",
      "15.07.2026;GUTSCHRIFT QR;350.00;;15.07.2026;1000.00",
      "16.07.2026;LASTSCHRIFT;;-45.90;16.07.2026;954.10",
    ].join("\n");
    const txs = parseCSV(csv);
    expect(txs.map(t => t.amount)).toEqual(["350.00", "-45.90"]);
  });

  it("Ein-Spalten-Layout bleibt unverändert", () => {
    const csv = "Datum;Betrag;Buchungstext\n01.07.2026;-99.95;Test\n02.07.2026;1'000.00;Eingang";
    const txs = parseCSV(csv);
    expect(txs.map(t => t.amount)).toEqual(["-99.95", "1000.00"]);
  });

  it("Felder in Anführungszeichen dürfen das Trennzeichen und doppelte Anführungszeichen enthalten", () => {
    const csv = [
      "Datum;Betrag;Buchungstext;Name",
      '01.07.2026;100.00;"Zahlung; inkl. ""MwSt""";"Müller; Hans"',
    ].join("\n");
    const txs = parseCSV(csv);
    expect(txs).toHaveLength(1);
    expect(txs[0].description).toBe('Zahlung; inkl. "MwSt"');
    expect(txs[0].counterparty).toBe("Müller; Hans");
    expect(txs[0].amount).toBe("100.00");
  });

  it("Komma-CSV mit Komma im Namen in Anführungszeichen", () => {
    const csv = 'Date,Amount,Description,Name\n2026-07-01,"1,234.50",Rent,"Doe, Jane"';
    const txs = parseCSV(csv);
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe("1234.50");
    expect(txs[0].counterparty).toBe("Doe, Jane");
  });
});

describe("parseAmount – Betragsformate", () => {
  it.each([
    ["1'234.50", 1234.5],
    ["1 234,50", 1234.5],
    ["1.234,50", 1234.5],
    ["-1234.50", -1234.5],
    ["1234.50-", -1234.5],
    ["CHF 1'234.50", 1234.5],
    ["CHF -1'234.50", -1234.5],
    ["1\u00A0234,50", 1234.5],
    ["1’234.50", 1234.5],
    ["(500.00)", -500],
    ["0.5", 0.5],
    ["12", 12],
    ["1,234", 1234],
    ["1.234.567,89", 1234567.89],
    ["−15.00", -15],
  ])("parst %s → %d", (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected, 2);
  });

  it("gibt null für leere oder unbrauchbare Werte", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});

describe("parseMT940 – :61:-Varianten und Währung", () => {
  const wrap = (lines: string[]) => [":20:STMT1", ":25:CH9300762011623852957", ...lines, "-"].join("\n");

  it("normale Gutschrift/Belastung wie bisher", () => {
    const txs = parseMT940(wrap([
      ":60F:C260630CHF1000,00",
      ":61:2607010701C1234,56NTRFNONREF",
      ":86:?20Rechnung 1?32Kunde AG",
      ":61:2607020702D50,00NTRFNONREF",
      ":86:?20Gebühr",
    ]));
    expect(txs).toHaveLength(2);
    expect(txs[0].amount).toBe("1234.56");
    expect(txs[0].counterparty).toBe("Kunde AG");
    expect(txs[1].amount).toBe("-50.00");
    expect(txs[0].currency).toBe("CHF");
  });

  it("RC/RD (Storno) kehren das Vorzeichen um", () => {
    const txs = parseMT940(wrap([
      ":61:260701RC100,00NTRFNONREF",
      ":61:260701RD200,00NTRFNONREF",
    ]));
    expect(txs.map(t => t.amount)).toEqual(["-100.00", "200.00"]);
  });

  it("Funds-Code nach C/D wird toleriert (CF1234,56 / DR…)", () => {
    const txs = parseMT940(wrap([
      ":61:260701CF1234,56NTRFNONREF",
      ":61:260701DR12,00NTRFNONREF",
    ]));
    expect(txs.map(t => t.amount)).toEqual(["1234.56", "-12.00"]);
  });

  it("Beträge ohne Nachkommastellen (1234,)", () => {
    const txs = parseMT940(wrap([":61:260701C1234,NTRFNONREF"]));
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe("1234.00");
  });

  it("Währung aus :60F:/:60M: statt fix CHF", () => {
    const txs = parseMT940(wrap([
      ":60F:C260630EUR1000,00",
      ":61:260701C10,00NTRFNONREF",
    ]));
    expect(txs[0].currency).toBe("EUR");
    const txs2 = parseMT940(wrap([
      ":60M:D260630USD5,00",
      ":61:260701D10,00NTRFNONREF",
    ]));
    expect(txs2[0].currency).toBe("USD");
    // Ohne :60F: bleibt CHF Standard
    expect(parseMT940(wrap([":61:260701C1,00NTRF"]))[0].currency).toBe("CHF");
  });

  it("mehrzeilige :86:-Felder werden zusammengeführt", () => {
    const txs = parseMT940(wrap([
      ":61:260701C10,00NTRFNONREF",
      ":86:?20Teil eins",
      "?21Teil zwei?32Firma",
      "?33Muster",
    ]));
    expect(txs[0].description).toBe("Teil eins Teil zwei");
    expect(txs[0].counterparty).toBe("Firma Muster");
  });
});

describe("normaliseDate – echte Kalenderdaten", () => {
  it("lehnt 31.02., 31.04. und 29.02. in Nicht-Schaltjahren ab", () => {
    expect(normaliseDate("31.02.2026")).toBeNull();
    expect(normaliseDate("2026-04-31")).toBeNull();
    expect(normaliseDate("29.02.2025")).toBeNull();
    expect(normaliseDate("20260230")).toBeNull();
    expect(normaliseDate("260231")).toBeNull();
  });

  it("akzeptiert gültige Grenzfälle", () => {
    expect(normaliseDate("29.02.2024")).toBe("2024-02-29");
    expect(normaliseDate("31.12.2026")).toBe("2026-12-31");
    expect(normaliseDate("30.04.2026")).toBe("2026-04-30");
    expect(normaliseDate("1.1.2026")).toBe("2026-01-01");
  });

  it("CAMT/CSV-Zeilen mit ungültigem Datum werden übersprungen", () => {
    const xml = camt053(`
      <Ntry><Amt Ccy="CHF">1.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-02-30</Dt></BookgDt></Ntry>`);
    expect(parseCAMT053(xml)).toHaveLength(0);
    expect(parseCSV("Datum;Betrag\n31.02.2026;10.00\n28.02.2026;5.00")).toHaveLength(1);
  });
});
