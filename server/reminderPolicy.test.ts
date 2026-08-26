import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_POLICY, suggestReminderLevel } from "../shared/reminderPolicy";

describe("Organisations-Mahnpolicy", () => {
  it("liefert die bisherigen Schweizer Standardwerte", () => {
    expect(DEFAULT_REMINDER_POLICY).toMatchObject({
      level1: { minDaysOverdue: 15, feeAmount: 0, gracePeriodDays: 10 },
      level2: { minDaysOverdue: 30, feeAmount: 20, gracePeriodDays: 10 },
      level3: { minDaysOverdue: 60, feeAmount: 40, gracePeriodDays: 7 },
    });
  });

  it("eskaliert nicht erneut auf eine bereits gesendete Mahnstufe", () => {
    expect(suggestReminderLevel(80, 2, DEFAULT_REMINDER_POLICY)).toBe(3);
    expect(suggestReminderLevel(80, 3, DEFAULT_REMINDER_POLICY)).toBeNull();
  });
});
