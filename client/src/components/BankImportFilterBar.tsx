import { Banknote, Check, FileText, RefreshCw, Undo2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type BankImportStatusFilter = "pending" | "matched" | "all";

export function getBankImportFilterTitle(statusFilter: BankImportStatusFilter) {
  return statusFilter === "pending" ? "Ausstehende Transaktionen" : statusFilter === "matched" ? "Verbuchte Transaktionen" : "Alle Transaktionen";
}

export function isBulkApprovalAvailable(statusFilter: BankImportStatusFilter, selectedCount: number, readyToApproveCount: number) {
  return statusFilter === "pending" && selectedCount > 0 && readyToApproveCount > 0;
}

type BankAccountOption = {
  bankAccount: {
    id: number;
    name: string;
  };
};

type BankImportSnapshot = {
  actionName: string;
  transactionCount: number;
};

type BankImportFilterBarProps = {
  statusFilter: BankImportStatusFilter;
  transactionCount: number;
  bankAccountId?: number;
  bankAccounts?: BankAccountOption[];
  pendingTransactionIds: number[];
  allPendingTransactionIds: number[];
  selectedCount: number;
  readyToApproveCount: number;
  snapshot?: BankImportSnapshot | null;
  isCategorizing: boolean;
  isGeneratingBookingTexts: boolean;
  isRefreshingSuggestions: boolean;
  isDetectingTransfers: boolean;
  isRestoringSnapshot: boolean;
  isApprovingBulk: boolean;
  onStatusChange: (status: BankImportStatusFilter) => void;
  onBankAccountChange: (bankAccountId?: number) => void;
  onCategorize: () => void;
  onGenerateBookingTexts: () => void;
  onRefreshSuggestions: () => void;
  onDetectTransfers: () => void;
  onRestoreSnapshot: () => void;
  onBulkApprove: () => void;
  onOpenCreditorPayments: () => void;
};

export function BankImportFilterBar({
  statusFilter,
  transactionCount,
  bankAccountId,
  bankAccounts,
  pendingTransactionIds,
  allPendingTransactionIds,
  selectedCount,
  readyToApproveCount,
  snapshot,
  isCategorizing,
  isGeneratingBookingTexts,
  isRefreshingSuggestions,
  isDetectingTransfers,
  isRestoringSnapshot,
  isApprovingBulk,
  onStatusChange,
  onBankAccountChange,
  onCategorize,
  onGenerateBookingTexts,
  onRefreshSuggestions,
  onDetectTransfers,
  onRestoreSnapshot,
  onBulkApprove,
  onOpenCreditorPayments,
}: BankImportFilterBarProps) {
  const isPending = statusFilter === "pending";
  const title = getBankImportFilterTitle(statusFilter);

  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-2">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{transactionCount} Transaktionen</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={(value: BankImportStatusFilter) => onStatusChange(value)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="matched">Verbucht</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(bankAccountId ?? "all")} onValueChange={(value) => onBankAccountChange(value === "all" ? undefined : Number.parseInt(value, 10))}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Alle Konten" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Konten</SelectItem>
            {bankAccounts?.map((account) => <SelectItem key={account.bankAccount.id} value={String(account.bankAccount.id)}>{account.bankAccount.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isPending && pendingTransactionIds.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" disabled={isCategorizing} onClick={onCategorize}>
            <Zap className="h-3 w-3" />
            {isCategorizing ? "KI läuft..." : `KI kategorisieren (${pendingTransactionIds.length})`}
          </Button>
        )}
        {isPending && allPendingTransactionIds.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" disabled={isGeneratingBookingTexts} onClick={onGenerateBookingTexts}>
            <FileText className="h-3 w-3" />
            {isGeneratingBookingTexts ? "Texte werden generiert..." : "Buchungstexte generieren"}
          </Button>
        )}
        {isPending && allPendingTransactionIds.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50" disabled={isRefreshingSuggestions} onClick={onRefreshSuggestions}>
            <RefreshCw className={`h-3 w-3 ${isRefreshingSuggestions ? "animate-spin" : ""}`} />
            {isRefreshingSuggestions ? "Aktualisiere..." : "Refresh (gelernt)"}
          </Button>
        )}
        {isPending && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50" disabled={isDetectingTransfers} onClick={onDetectTransfers}>
            <RefreshCw className={`h-3 w-3 ${isDetectingTransfers ? "animate-spin" : ""}`} />
            {isDetectingTransfers ? "Erkenne..." : "Kontoüberträge erkennen"}
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-purple-300 text-purple-700 hover:bg-purple-50" onClick={onOpenCreditorPayments}>
          <Banknote className="h-3 w-3" /> Kreditorenzahlungen
        </Button>
        {snapshot && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-red-300 text-red-700 hover:bg-red-50" disabled={isRestoringSnapshot} onClick={onRestoreSnapshot}>
            <Undo2 className="h-3 w-3" />
            {isRestoringSnapshot ? "Stelle wieder her..." : `Rückgängig: ${snapshot.actionName}`}
          </Button>
        )}
        {isBulkApprovalAvailable(statusFilter, selectedCount, readyToApproveCount) && (
          <Button size="sm" className="gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700 text-white" disabled={isApprovingBulk} onClick={onBulkApprove}>
            <Check className="h-3 w-3" />
            {isApprovingBulk ? "Verbuche..." : `${readyToApproveCount} verbuchen`}
          </Button>
        )}
      </div>
    </div>
  );
}
