import { describe, it, expect } from "vitest";

// ─── Booking Rule Matching Logic (unit tests, no DB) ─────────────────────────

/**
 * Simulates the rule-matching logic from refreshSuggestions.
 * Given a counterparty name and a list of rules (sorted by priority desc),
 * returns the first matching rule or null.
 */
function findMatchingRule(
  counterpartyName: string,
  rules: Array<{ id: number; counterpartyPattern: string; priority: number; usageCount: number }>
) {
  const cpLower = counterpartyName.toLowerCase();
  for (const rule of rules) {
    if (cpLower.includes(rule.counterpartyPattern.toLowerCase())) {
      return rule;
    }
  }
  return null;
}

/**
 * Simulates the booking text template substitution from refreshSuggestions.
 * Replaces month/year and quarter/year patterns in the template with
 * the transaction date's actual month/year and quarter.
 */
function applyBookingTextTemplate(template: string, transactionDate: string): string {
  const d = new Date(transactionDate);
  const monthNames = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const month = monthNames[d.getMonth()] ?? "";
  const year = d.getFullYear();
  const quarter = `${Math.ceil((d.getMonth() + 1) / 3)}. Quartal`;

  let text = template;
  // Replace month + year patterns
  text = text.replace(/(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/g, `${month} ${year}`);
  // Replace quarter + year patterns
  text = text.replace(/\d+\.\s*Quartal\s+\d{4}/g, `${quarter} ${year}`);
  return text;
}

describe("Booking Rule Matching", () => {
  const rules = [
    { id: 1, counterpartyPattern: "SCHWEIZERISCHE BUNDESBAHNEN", priority: 20, usageCount: 5 },
    { id: 2, counterpartyPattern: "Sunrise", priority: 20, usageCount: 3 },
    { id: 3, counterpartyPattern: "Cornèr Banca", priority: 20, usageCount: 2 },
    { id: 4, counterpartyPattern: "Miete", priority: 10, usageCount: 1 },
  ];

  it("matches SBB counterparty (case-insensitive)", () => {
    const result = findMatchingRule("SCHWEIZERISCHE BUNDESBAHNEN DIVISION PERSONENVERKEHR", rules);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
  });

  it("matches Sunrise counterparty (partial match)", () => {
    const result = findMatchingRule("Sunrise Communications AG", rules);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(2);
  });

  it("matches Cornèr Banca with accented characters", () => {
    const result = findMatchingRule("Cornèr Banca SA", rules);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(3);
  });

  it("returns null for unknown counterparty", () => {
    const result = findMatchingRule("Unbekannte Firma GmbH", rules);
    expect(result).toBeNull();
  });

  it("matches case-insensitively", () => {
    const result = findMatchingRule("schweizerische bundesbahnen sbb", rules);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
  });

  it("returns first match by priority order", () => {
    // If rules are sorted by priority desc, first match wins
    const result = findMatchingRule("Sunrise Miete Büro", rules);
    // Sunrise (priority 20) should match before Miete (priority 10)
    expect(result!.id).toBe(2);
  });
});

describe("Booking Text Template Substitution", () => {
  it("replaces month and year for SBB GA", () => {
    const result = applyBookingTextTemplate("SBB GA Februar 2026", "2026-03-15");
    expect(result).toBe("SBB GA März 2026");
  });

  it("replaces month and year for different month", () => {
    // Note: new Date("2026-06-01") may parse as May 31 in UTC-negative timezones
    const result = applyBookingTextTemplate("SBB GA Januar 2026", "2026-06-15");
    expect(result).toBe("SBB GA Juni 2026");
  });

  it("replaces quarter and year for Sunrise", () => {
    const result = applyBookingTextTemplate("Sunrise 1. Quartal 2026", "2026-07-15");
    expect(result).toBe("Sunrise 3. Quartal 2026");
  });

  it("handles Q1 correctly (Jan-Mar)", () => {
    const result = applyBookingTextTemplate("Abo 2. Quartal 2025", "2026-02-15");
    expect(result).toBe("Abo 1. Quartal 2026");
  });

  it("handles Q4 correctly (Oct-Dec)", () => {
    const result = applyBookingTextTemplate("Abo 1. Quartal 2025", "2026-11-01");
    expect(result).toBe("Abo 4. Quartal 2026");
  });

  it("keeps text without date patterns unchanged", () => {
    const result = applyBookingTextTemplate("Miete Büro", "2026-05-01");
    expect(result).toBe("Miete Büro");
  });

  it("replaces year correctly across year boundary", () => {
    const result = applyBookingTextTemplate("SBB GA Dezember 2025", "2026-01-15");
    expect(result).toBe("SBB GA Januar 2026");
  });

  it("handles multiple date patterns in one template", () => {
    const result = applyBookingTextTemplate("Abo Januar 2025 bis März 2025", "2026-04-15");
    // Both month+year patterns get replaced
    expect(result).toBe("Abo April 2026 bis April 2026");
  });
});

/**
 * Simulates the refreshSuggestions logic including the manuallyEdited skip.
 * Returns { updated, skippedManual } counts.
 */
function simulateRefreshSuggestions(
  transactions: Array<{ id: number; counterparty: string | null; manuallyEdited: boolean; description: string | null }>,
  rules: Array<{ id: number; counterpartyPattern: string; priority: number; usageCount: number; debitAccountId?: number; creditAccountId?: number; bookingTextTemplate?: string }>
) {
  let updated = 0;
  let skippedManual = 0;

  for (const tx of transactions) {
    // Skip manually edited transactions
    if (tx.manuallyEdited) {
      skippedManual++;
      continue;
    }

    const cpName = (tx.counterparty ?? "").toLowerCase();
    if (!cpName) continue;

    let matchedRule = null;
    for (const rule of rules) {
      if (cpName.includes(rule.counterpartyPattern.toLowerCase())) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      updated++;
    }
  }

  return { updated, skippedManual };
}

describe("Refresh Suggestions - ManuallyEdited Skip", () => {
  const rules = [
    { id: 1, counterpartyPattern: "Sunrise", priority: 20, usageCount: 3, debitAccountId: 4720, creditAccountId: 1032, bookingTextTemplate: "Sunrise 1. Quartal 2026" },
    { id: 2, counterpartyPattern: "SBB", priority: 20, usageCount: 5, debitAccountId: 4820, creditAccountId: 1032, bookingTextTemplate: "SBB GA Januar 2026" },
  ];

  it("skips manually edited transactions", () => {
    const txs = [
      { id: 1, counterparty: "Sunrise Communications AG", manuallyEdited: true, description: "Sunrise custom text" },
      { id: 2, counterparty: "Sunrise Communications AG", manuallyEdited: false, description: null },
      { id: 3, counterparty: "SCHWEIZERISCHE BUNDESBAHNEN SBB", manuallyEdited: false, description: null },
    ];
    const result = simulateRefreshSuggestions(txs, rules);
    expect(result.updated).toBe(2); // Only tx 2 and 3
    expect(result.skippedManual).toBe(1); // tx 1 skipped
  });

  it("does not skip non-edited transactions", () => {
    const txs = [
      { id: 1, counterparty: "Sunrise Communications AG", manuallyEdited: false, description: null },
      { id: 2, counterparty: "SCHWEIZERISCHE BUNDESBAHNEN SBB", manuallyEdited: false, description: null },
    ];
    const result = simulateRefreshSuggestions(txs, rules);
    expect(result.updated).toBe(2);
    expect(result.skippedManual).toBe(0);
  });

  it("skips all manually edited transactions even if they match rules", () => {
    const txs = [
      { id: 1, counterparty: "Sunrise Communications AG", manuallyEdited: true, description: "Custom" },
      { id: 2, counterparty: "SCHWEIZERISCHE BUNDESBAHNEN SBB", manuallyEdited: true, description: "Custom SBB" },
    ];
    const result = simulateRefreshSuggestions(txs, rules);
    expect(result.updated).toBe(0);
    expect(result.skippedManual).toBe(2);
  });

  it("handles mix of edited, unedited, and no-match transactions", () => {
    const txs = [
      { id: 1, counterparty: "Sunrise Communications AG", manuallyEdited: true, description: "Custom" },
      { id: 2, counterparty: "Unknown Company", manuallyEdited: false, description: null },
      { id: 3, counterparty: "SCHWEIZERISCHE BUNDESBAHNEN SBB", manuallyEdited: false, description: null },
      { id: 4, counterparty: null, manuallyEdited: false, description: null },
    ];
    const result = simulateRefreshSuggestions(txs, rules);
    expect(result.updated).toBe(1); // Only tx 3 (SBB)
    expect(result.skippedManual).toBe(1); // tx 1
  });
});

describe("Rule Learning Flow", () => {
  it("extracts counterparty pattern from transaction", () => {
    // When approving a transaction, the counterparty name is used as the pattern
    const counterparty = "SCHWEIZERISCHE BUNDESBAHNEN DIVISION PERSONENVERKEHR";
    const pattern = counterparty.trim();
    expect(pattern).toBe("SCHWEIZERISCHE BUNDESBAHNEN DIVISION PERSONENVERKEHR");
  });

  it("learned rule can be applied to similar transaction", () => {
    // Simulate: user approved SBB with "SBB GA Februar 2026" → rule learned
    // New transaction from same counterparty in March → template applied
    const learnedTemplate = "SBB GA Februar 2026";
    const newTxDate = "2026-03-05";
    const result = applyBookingTextTemplate(learnedTemplate, newTxDate);
    expect(result).toBe("SBB GA März 2026");
  });

  it("learned rule matches partial counterparty name", () => {
    const rules = [
      { id: 1, counterpartyPattern: "SCHWEIZERISCHE BUNDESBAHNEN DIVISION PERSONENVERKEHR", priority: 20, usageCount: 1 },
    ];
    // A slightly different SBB transaction description should still match
    const match = findMatchingRule("SCHWEIZERISCHE BUNDESBAHNEN DIVISION PERSONENVERKEHR SBB", rules);
    expect(match).not.toBeNull();
  });
});
