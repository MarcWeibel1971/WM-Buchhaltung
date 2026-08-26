import { describe, expect, it } from "vitest";
import { getAccountType, getSwissKmuCategory } from "../client/src/components/ChartOfAccountsImportDialog";

describe("ChartOfAccountsImportDialog import mapping", () => {
  it("honours explicit account types before using a number-based fallback", () => {
    expect(getAccountType("Ertrag", 4000)).toBe("revenue");
    expect(getAccountType("", 1020)).toBe("asset");
    expect(getAccountType("", 2300)).toBe("liability");
    expect(getAccountType("", 6800)).toBe("expense");
    expect(getAccountType("", 9000)).toBe("equity");
  });

  it("assigns Swiss KMU categories at range boundaries", () => {
    expect(getSwissKmuCategory(1000)).toEqual({
      category: "Umlaufvermögen",
      subCategory: "Flüssige Mittel",
    });
    expect(getSwissKmuCategory(2100)).toEqual({
      category: "Kurzfristiges Fremdkapital",
      subCategory: "Kurzfristige Finanzverbindlichkeiten",
    });
    expect(getSwissKmuCategory(9000)).toEqual({
      category: "Abschluss",
      subCategory: "Abschlusskonten",
    });
    expect(getSwissKmuCategory(999)).toEqual({});
  });
});
