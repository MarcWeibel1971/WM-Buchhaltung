export function getInfoniqaTaxId(
  account: { defaultVatRate?: string | null } | undefined,
  line: { vatRate?: string | null } | undefined,
): string {
  if (!account) return '""';
  const vatRate = line?.vatRate ? Number.parseFloat(line.vatRate) : (account.defaultVatRate ? Number.parseFloat(account.defaultVatRate) : null);
  if (!vatRate || vatRate === 0) return '""';
  if (vatRate >= 7.5 && vatRate <= 8.5) return "USt81";
  if (vatRate >= 2.0 && vatRate <= 3.0) return "USt26";
  if (vatRate >= 3.5 && vatRate <= 4.0) return "USt38";
  return '""';
}
