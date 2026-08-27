import { describe, it, expect } from "vitest";
import { parseCAMT053 } from "../shared/bankParser";

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
