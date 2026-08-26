import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("coverage gate", () => {
  it("provides a local coverage command and executes it in CI", () => {
    expect(packageJson).toContain('"test:coverage": "vitest run --coverage"');
    expect(workflow).toContain("pnpm test:coverage");
    expect(workflow).toContain("coverage-${{ github.sha }}");
  });
});
