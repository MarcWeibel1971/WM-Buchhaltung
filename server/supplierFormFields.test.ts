import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/SupplierFormFields.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("SupplierFormFields", () => {
  it("keeps supplier name and contact fields actively wired", () => {
    expect(component).toContain("Kontaktperson");
    expect(component).toContain("Strasse");
    expect(component).toContain("PLZ");
    expect(component).toContain("Land");
    expect(component).toContain("BIC / SWIFT");
    expect(component).toContain("E-Mail");
    expect(component).toContain("onNameChange");
    expect(settings).toContain("<SupplierFormFields name={formName}");
    expect(settings).toContain("street={formStreet}");
    expect(settings).toContain("zip={formZip}");
    expect(settings).toContain("iban={formIban}");
  });
});
