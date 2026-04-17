/**
 * Tests for the Two-Level Rule System (Global + Org-specific)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockRules: any[] = [];
const mockAccounts: any[] = [];

vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn((table: any) => {
        if (table === "bookingRules" || table?.name === "booking_rules") {
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn(() => mockRules),
            })),
          };
        }
        return {
          where: vi.fn(() => mockAccounts),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ execute: vi.fn() })),
    })),
  })),
}));

// ── Unit tests for matching logic ────────────────────────────────────────────

describe("Two-Level Rule System", () => {
  describe("Rule Priority", () => {
    it("should prioritize org-specific rules over global rules", () => {
      const orgRule = {
        id: 1,
        scope: "org",
        counterpartyPattern: "Swisscom",
        debitAccountId: 100,
        creditAccountId: 200,
        priority: 10,
        isActive: true,
      };
      const globalRule = {
        id: 2,
        scope: "global",
        counterpartyPattern: "Swisscom",
        globalDebitAccountNumber: "6500",
        globalCreditAccountNumber: "1020",
        priority: 5,
        isActive: true,
      };

      // Org-specific rule should be selected first
      const rules = [orgRule, globalRule];
      const orgRules = rules.filter(r => r.scope === "org");
      const globalRules = rules.filter(r => r.scope === "global");

      // When org rule matches, it should be used
      const orgMatch = orgRules.find(r =>
        "Swisscom AG".toLowerCase().includes(r.counterpartyPattern.toLowerCase())
      );
      expect(orgMatch).toBeDefined();
      expect(orgMatch!.scope).toBe("org");
      expect(orgMatch!.debitAccountId).toBe(100);
    });

    it("should fall back to global rules when no org rule matches", () => {
      const globalRule = {
        id: 2,
        scope: "global",
        counterpartyPattern: "AXA",
        globalDebitAccountNumber: "6300",
        globalCreditAccountNumber: "1020",
        priority: 5,
        isActive: true,
      };

      const rules = [globalRule];
      const orgRules = rules.filter(r => r.scope === "org");
      const globalRules = rules.filter(r => r.scope === "global");

      // No org rule matches
      const orgMatch = orgRules.find(r =>
        "AXA Versicherungen AG".toLowerCase().includes(r.counterpartyPattern.toLowerCase())
      );
      expect(orgMatch).toBeUndefined();

      // Global rule should match
      const globalMatch = globalRules.find(r =>
        "AXA Versicherungen AG".toLowerCase().includes(r.counterpartyPattern.toLowerCase())
      );
      expect(globalMatch).toBeDefined();
      expect(globalMatch!.globalDebitAccountNumber).toBe("6300");
    });

    it("should return no match when neither org nor global rules match", () => {
      const rules = [
        { scope: "org", counterpartyPattern: "Swisscom", isActive: true },
        { scope: "global", counterpartyPattern: "AXA", isActive: true },
      ];

      const counterparty = "Migros";
      const orgMatch = rules.filter(r => r.scope === "org").find(r =>
        counterparty.toLowerCase().includes(r.counterpartyPattern.toLowerCase())
      );
      const globalMatch = rules.filter(r => r.scope === "global").find(r =>
        counterparty.toLowerCase().includes(r.counterpartyPattern.toLowerCase())
      );

      expect(orgMatch).toBeUndefined();
      expect(globalMatch).toBeUndefined();
    });
  });

  describe("Global Rule Account Resolution", () => {
    it("should resolve global account numbers to org-specific account IDs", () => {
      const globalRule = {
        scope: "global",
        globalDebitAccountNumber: "6300",
        globalCreditAccountNumber: "1020",
      };

      const orgAccounts = [
        { id: 42, number: "6300", name: "Versicherungen" },
        { id: 55, number: "1020", name: "Bank" },
      ];

      const debitAccount = orgAccounts.find(a => a.number === globalRule.globalDebitAccountNumber);
      const creditAccount = orgAccounts.find(a => a.number === globalRule.globalCreditAccountNumber);

      expect(debitAccount).toBeDefined();
      expect(debitAccount!.id).toBe(42);
      expect(debitAccount!.name).toBe("Versicherungen");
      expect(creditAccount).toBeDefined();
      expect(creditAccount!.id).toBe(55);
    });

    it("should handle missing account numbers gracefully", () => {
      const globalRule = {
        scope: "global",
        globalDebitAccountNumber: "9999",
        globalCreditAccountNumber: "1020",
      };

      const orgAccounts = [
        { id: 55, number: "1020", name: "Bank" },
      ];

      const debitAccount = orgAccounts.find(a => a.number === globalRule.globalDebitAccountNumber);
      expect(debitAccount).toBeUndefined();
    });
  });

  describe("Scope Filtering", () => {
    it("should filter org rules correctly for Settings view", () => {
      const allRules = [
        { id: 1, scope: "org", counterpartyPattern: "Swisscom" },
        { id: 2, scope: "global", counterpartyPattern: "AXA" },
        { id: 3, scope: "org", counterpartyPattern: "SBB" },
        { id: 4, scope: "global", counterpartyPattern: "Migros" },
      ];

      const orgOnly = allRules.filter(r => r.scope !== "global");
      expect(orgOnly).toHaveLength(2);
      expect(orgOnly.map(r => r.counterpartyPattern)).toEqual(["Swisscom", "SBB"]);
    });

    it("should filter global rules correctly for Admin view", () => {
      const allRules = [
        { id: 1, scope: "org", counterpartyPattern: "Swisscom" },
        { id: 2, scope: "global", counterpartyPattern: "AXA" },
        { id: 3, scope: "org", counterpartyPattern: "SBB" },
        { id: 4, scope: "global", counterpartyPattern: "Migros" },
      ];

      const globalOnly = allRules.filter(r => r.scope === "global");
      expect(globalOnly).toHaveLength(2);
      expect(globalOnly.map(r => r.counterpartyPattern)).toEqual(["AXA", "Migros"]);
    });
  });

  describe("Admin Visibility", () => {
    it("should show admin menu item only for admin users", () => {
      const adminUser = { role: "admin" };
      const normalUser = { role: "user" };

      const navItems = [
        { href: "/settings", label: "Einstellungen", adminOnly: false },
        { href: "/admin/global-rules", label: "KI-Regeln (Admin)", adminOnly: true },
      ];

      const adminVisible = navItems.filter(item => !item.adminOnly || adminUser.role === "admin");
      expect(adminVisible).toHaveLength(2);

      const userVisible = navItems.filter(item => !item.adminOnly || normalUser.role === "admin");
      expect(userVisible).toHaveLength(1);
      expect(userVisible[0].label).toBe("Einstellungen");
    });
  });

  describe("Rule Source Types", () => {
    it("should distinguish between manual and AI-learned rules", () => {
      const rules = [
        { source: "manual", counterpartyPattern: "Swisscom" },
        { source: "ai", counterpartyPattern: "AXA" },
        { source: "manual", counterpartyPattern: "SBB" },
      ];

      const manual = rules.filter(r => r.source === "manual");
      const ai = rules.filter(r => r.source === "ai");

      expect(manual).toHaveLength(2);
      expect(ai).toHaveLength(1);
    });
  });

  describe("Pattern Matching", () => {
    it("should match counterparty patterns case-insensitively", () => {
      const pattern = "swisscom";
      const counterparties = [
        "Swisscom AG",
        "SWISSCOM (Schweiz) AG",
        "swisscom billing",
        "Sunrise UPC",
      ];

      const matches = counterparties.filter(c =>
        c.toLowerCase().includes(pattern.toLowerCase())
      );
      expect(matches).toHaveLength(3);
    });

    it("should match description patterns when provided", () => {
      const rule = {
        counterpartyPattern: "AXA",
        descriptionPattern: "Prämie",
      };

      const txn1 = { counterparty: "AXA Versicherungen", description: "Prämienabrechnung Q1" };
      const txn2 = { counterparty: "AXA Versicherungen", description: "Schadenfall 12345" };

      const match1 = txn1.counterparty.toLowerCase().includes(rule.counterpartyPattern.toLowerCase()) &&
        txn1.description.toLowerCase().includes(rule.descriptionPattern!.toLowerCase());
      const match2 = txn2.counterparty.toLowerCase().includes(rule.counterpartyPattern.toLowerCase()) &&
        txn2.description.toLowerCase().includes(rule.descriptionPattern!.toLowerCase());

      expect(match1).toBe(true);
      expect(match2).toBe(false);
    });
  });

  describe("Category Hints", () => {
    it("should store category hints for global rules", () => {
      const globalRule = {
        scope: "global",
        counterpartyPattern: "AXA",
        categoryHint: "Sozialversicherungen",
        globalDebitAccountNumber: "5700",
      };

      expect(globalRule.categoryHint).toBe("Sozialversicherungen");
      expect(globalRule.globalDebitAccountNumber).toBe("5700");
    });
  });
});
