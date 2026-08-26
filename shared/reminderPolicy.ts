export type ReminderLevel = 1 | 2 | 3;

export type ReminderPolicy = Record<"level1" | "level2" | "level3", {
  minDaysOverdue: number;
  feeAmount: number;
  gracePeriodDays: number;
  label: string;
}>;

export const DEFAULT_REMINDER_POLICY: ReminderPolicy = {
  level1: { minDaysOverdue: 15, feeAmount: 0, gracePeriodDays: 10, label: "Zahlungserinnerung" },
  level2: { minDaysOverdue: 30, feeAmount: 20, gracePeriodDays: 10, label: "1. Mahnung" },
  level3: { minDaysOverdue: 60, feeAmount: 40, gracePeriodDays: 7, label: "2. Mahnung" },
};

export function parseReminderPolicy(value: string | null | undefined): ReminderPolicy {
  if (!value) return DEFAULT_REMINDER_POLICY;
  try {
    const parsed = JSON.parse(value) as Partial<ReminderPolicy>;
    return {
      level1: { ...DEFAULT_REMINDER_POLICY.level1, ...parsed.level1 },
      level2: { ...DEFAULT_REMINDER_POLICY.level2, ...parsed.level2 },
      level3: { ...DEFAULT_REMINDER_POLICY.level3, ...parsed.level3 },
    };
  } catch {
    return DEFAULT_REMINDER_POLICY;
  }
}

export function suggestReminderLevel(daysOverdue: number, maxExistingLevel: number, policy: ReminderPolicy): ReminderLevel | null {
  const suggested: ReminderLevel | null = daysOverdue >= policy.level3.minDaysOverdue
    ? 3
    : daysOverdue >= policy.level2.minDaysOverdue
      ? 2
      : daysOverdue >= policy.level1.minDaysOverdue ? 1 : null;
  return suggested != null && suggested > maxExistingLevel ? suggested : null;
}

export function policyForReminderLevel(level: ReminderLevel, policy: ReminderPolicy) {
  return policy[`level${level}`];
}
