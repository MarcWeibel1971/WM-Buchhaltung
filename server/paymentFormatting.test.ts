import { describe, expect, it } from "vitest";
import { formatCHF, formatQRRef } from "./paymentFormatting";

describe("payment formatting", () => {
  it("formats Swiss franc amounts with two decimals and apostrophe separators", () => {
    expect(formatCHF(1234.5)).toBe("1'234.50");
    expect(formatCHF(12)).toBe("12.00");
  });

  it("formats QR references into right-aligned groups of five", () => {
    expect(formatQRRef("210000000003139471430009017")).toBe("21 00000 00003 13947 14300 09017");
  });
});
