import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/CustomersList.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("CustomersList", () => {
  it("keeps customer and service actions wired in the active customer tab", () => {
    expect(component).toContain("Dienstleistungen");
    expect(component).toContain("onAddService");
    expect(settings).toContain("<CustomersList");
    expect(settings).toContain("onEditService={openEditService}");
  });
});
