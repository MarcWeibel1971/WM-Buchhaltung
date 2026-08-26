import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/components/Layout.tsx"),
  "utf8",
);

describe("Audit P0 Navigation", () => {
  it("macht alle im Audit genannten Module aus der Seitenleiste erreichbar", () => {
    for (const href of [
      'href: "/payroll"',
      'href: "/time-tracking"',
      'href: "/mahnwesen"',
      'href: "/zahlungen/kreditoren"',
      'href: "/year-end"',
      'href: "/berichte?view=journal"',
    ]) {
      expect(layoutSource).toContain(href);
    }
  });
});
