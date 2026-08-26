import { formatCHF } from "@/lib/formatters";

export function BankImportCollectiveBankAccountLine({ isIncoming, bankAccountLabel, amount }: { isIncoming: boolean; bankAccountLabel: string; amount: number }) {
  const tone = isIncoming ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700" : "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700";
  const heading = isIncoming ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400";
  return <div className={`rounded-lg border-2 p-3 ${tone}`}><div className="flex items-center gap-2 mb-1"><span className={`text-xs font-bold uppercase ${heading}`}>{isIncoming ? "SOLL (Belastung)" : "HABEN (Belastung)"}</span><span className="text-xs text-muted-foreground">– Bankkonto</span></div><div className="flex items-center gap-3"><span className="text-sm font-medium flex-1">{bankAccountLabel}</span><span className="text-sm font-mono font-bold">CHF {formatCHF(amount)}</span></div></div>;
}
