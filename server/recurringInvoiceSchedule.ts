export type RecurringInterval = "monthly" | "quarterly" | "yearly";

export function nextRecurringRunDate(currentRunDate: string, interval: RecurringInterval): string {
  const [year, month, day] = currentRunDate.split("-").map(Number);
  const monthsToAdd = interval === "monthly" ? 1 : interval === "quarterly" ? 3 : 12;
  const target = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
