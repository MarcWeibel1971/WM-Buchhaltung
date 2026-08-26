import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../client/src/components/Layout.tsx", import.meta.url), "utf8");

describe("settings route canonicalization", () => {
  it("redirects legacy settings URLs to the canonical settings route", () => {
    expect(app).toContain('path="/einstellungen/:tab"');
    expect(app).toContain('to={`/settings?tab=${encodeURIComponent(tab)}`}');
    expect(app).toContain('path="/einstellungen">{() => <Redirect to="/settings" />}</Route>');
  });

  it("uses canonical navigation paths for settings and year-end access", () => {
    expect(layout).toContain('{ href: "/settings", icon: Settings, label: "Einstellungen" }');
    expect(app).toContain('path="/abschluss">{() => <Redirect to="/year-end" />}</Route>');
  });
});
