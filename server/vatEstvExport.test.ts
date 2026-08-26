import { describe, expect, it } from "vitest";
import { buildEch0217EffectiveXmlDraft, buildEch0217FlatTaxRateXmlDraft, buildEch0217NetTaxRateXmlDraft, buildEstvVatCsv } from "./vatEstvExport";
import { readFileSync } from "node:fs";

describe("buildEstvVatCsv", () => {
  it("exports period data with ESTV references and two-decimal amounts", () => {
    const csv = buildEstvVatCsv({ uid: "CHE123456789", organisationName: "WM AG", year: 2026, period: "Q1", startDate: "2026-01-01", endDate: "2026-03-31", vatMethod: "effective", turnover81: "1000", turnover26: "0", turnover38: "0", vatDue81: "81", vatDue26: "0", vatDue38: "0", inputTax: "10", netVatPayable: "71" });
    expect(csv).toContain('"Ziffer 302 Umsatz Normalsatz 8.1%";"1000.00"');
    expect(csv).toContain('"Ziffer 500 / 510 Zahllast oder Guthaben";"71.00"');
  });

  it("builds an explicitly non-production eCH-0217 effective-method XML draft", () => {
    const xml = buildEch0217EffectiveXmlDraft({ uid: "CHE123456789", organisationName: "WM AG", year: 2026, period: "Q1", startDate: "2026-01-01", endDate: "2026-03-31", vatMethod: "effective", turnover81: "1000", turnover26: "0", turnover38: "0", vatDue81: "81", vatDue26: "0", vatDue38: "0", inputTax: "10", netVatPayable: "71", businessReferenceId: "VAT-2026-Q1", formOfReporting: 1, generatedAt: "2026-03-31T12:00:00Z", applicationManufacturer: "WM", applicationProduct: "Buchhaltung", applicationVersion: "1.0" });
    expect(xml).toContain('xmlns="http://www.ech.ch/xmlns/eCH-0217/2"');
    expect(xml).toContain('xmlns:eCH-0058="http://www.ech.ch/xmlns/eCH-0058/5"');
    expect(xml).toContain("vor ESTV-Upload gegen vollständigen XSD-Satz validieren");
    expect(xml).toContain("<effectiveReportingMethod>");
    expect(xml).toContain("<payableTax>71.00</payableTax>");
  });

  it("keeps the XML draft endpoint organization-scoped and warning-labeled", () => {
    const router = readFileSync(new URL("./vatRouter.ts", import.meta.url), "utf8");
    expect(router).toContain("exportEstvXmlDraft");
    expect(router).toContain("eq(vatPeriods.organizationId, ctx.organizationId)");
    expect(router).toContain("XML-Entwurf: Vor ESTV-Upload");
  });

  it("keeps the XML draft download visibly separated from the production CSV", () => {
    const page = readFileSync(new URL("../client/src/pages/Vat.tsx", import.meta.url), "utf8");
    expect(page).toContain("exportEstvXmlDraft");
    expect(page).toContain("XML-Entwurf");
    expect(page).toContain("Nur XML-Entwurf; vor ESTV-Upload XSD-validieren");
  });

  it("builds a net-tax-rate XML draft only with explicit approved-rate inputs", () => {
    const base = { uid: "CHE123456789", organisationName: "WM AG", year: 2026, period: "S1", startDate: "2026-01-01", endDate: "2026-06-30", netVatPayable: "65", businessReferenceId: "VAT-2026-S1", formOfReporting: 1 as const, generatedAt: "2026-06-30T12:00:00Z", applicationManufacturer: "WM", applicationProduct: "Buchhaltung", applicationVersion: "1.0" };
    expect(buildEch0217NetTaxRateXmlDraft({ ...base, supplies: [{ taxRate: "6.5", turnover: "1000" }] })).toContain("<netTaxRateMethod>");
    expect(() => buildEch0217NetTaxRateXmlDraft({ ...base, supplies: [] })).toThrow("bewilligter Saldosteuersatz");
  });

  it("builds a flat-tax-rate XML draft only with an approved activity", () => {
    const base = { uid: "CHE123456789", organisationName: "WM AG", year: 2026, period: "S1", startDate: "2026-01-01", endDate: "2026-06-30", netVatPayable: "35", businessReferenceId: "VAT-2026-S1-PSS", formOfReporting: 1 as const, generatedAt: "2026-06-30T12:00:00Z", applicationManufacturer: "WM", applicationProduct: "Buchhaltung", applicationVersion: "1.0", taxRate: "3.5", turnover: "1000" };
    expect(buildEch0217FlatTaxRateXmlDraft({ ...base, activity: "Beratung" })).toContain("<flatTaxRateMethod>");
    expect(() => buildEch0217FlatTaxRateXmlDraft({ ...base, activity: "" })).toThrow("bewilligte Tätigkeit");
  });

  it("uses organization-specific approved rates in the protected XML export path", () => {
    const router = readFileSync(new URL("./vatRouter.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/Vat.tsx", import.meta.url), "utf8");
    expect(router).toContain("buildEch0217NetTaxRateXmlDraft");
    expect(router).toContain("taxRate: settings.vatSaldoRate");
    expect(router).toContain("buildEch0217FlatTaxRateXmlDraft");
    expect(router).toContain("activity: settings.vatPauschalActivity");
    expect(router).toContain("taxRate: settings.vatPauschalRate");
    expect(page).not.toContain('vatMethod !== "pauschal" && <Button');
  });
});
