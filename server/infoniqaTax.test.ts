import { describe, expect, it } from "vitest";
import { getInfoniqaTaxId } from "./infoniqaTax";

describe("getInfoniqaTaxId", () => {
  it("uses the line rate before the account default and maps Swiss VAT rates", () => {
    expect(getInfoniqaTaxId({ defaultVatRate: "8.1" }, { vatRate: "2.6" })).toBe("USt26");
    expect(getInfoniqaTaxId({ defaultVatRate: "8.1" }, undefined)).toBe("USt81");
    expect(getInfoniqaTaxId({ defaultVatRate: "3.8" }, undefined)).toBe("USt38");
  });

  it("returns an empty Infoniqa tax identifier for missing or unsupported rates", () => {
    expect(getInfoniqaTaxId(undefined, undefined)).toBe('""');
    expect(getInfoniqaTaxId({ defaultVatRate: "0" }, undefined)).toBe('""');
    expect(getInfoniqaTaxId({ defaultVatRate: "5" }, undefined)).toBe('""');
  });
});
