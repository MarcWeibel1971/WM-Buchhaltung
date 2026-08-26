import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const corePath = resolve(import.meta.dirname, "_core");
const entrypoint = readFileSync(resolve(corePath, "index.ts"), "utf8");

describe("Production runtime dependency boundary", () => {
  it("loads the Vite development server only in development", () => {
    expect(entrypoint).not.toContain('from "./vite"');
    expect(entrypoint).toContain('const developmentServerModule = "./vite"');
    expect(entrypoint).toContain('await import(developmentServerModule)');
  });
});
