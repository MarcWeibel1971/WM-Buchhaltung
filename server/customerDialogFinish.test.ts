import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("customer dialog completion flows", () => {
  it("keeps successful customer and service dialog closures centralized", () => {
    expect(settings).toContain("const finishCustomerDialog");
    expect(settings).toContain("const finishServiceDialog");
    expect(settings).toContain('finishCustomerDialog("Kunde erstellt")');
    expect(settings).toContain('finishServiceDialog("Dienstleistung aktualisiert")');
  });
});
