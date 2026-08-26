import { describe, expect, it } from "vitest";
import { ech0217SchemaSources } from "./ech0217SchemaSources";

describe("eCH-0217 schema source catalog", () => {
  it("contains the official root and all currently verified imports", () => {
    expect(ech0217SchemaSources).toContain("http://www.ech.ch/xmlns/eCH-0217/2/eCH-0217-2-0-0.xsd");
    expect(ech0217SchemaSources).toContain("http://www.ech.ch/xmlns/eCH-0108/7/eCH-0108-7-0.xsd");
    expect(ech0217SchemaSources).toContain("http://www.ech.ch/xmlns/eCH-0058/5/eCH-0058-5-0.xsd");
    expect(ech0217SchemaSources).toContain("http://www.ech.ch/xmlns/eCH-0097/2/eCH-0097-2-0.xsd");
  });
});
