export type BankImportTransactionSnapshot = {
  id: number;
  description: string | null;
  suggestedDebitAccountId: number | null;
  suggestedCreditAccountId: number | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  suggestedBookingText: string | null;
  isTransfer: boolean | null;
  transferPartnerId: number | null;
  manuallyEdited: boolean | null;
  matchedDocumentId: number | null;
  matchScore: number | null;
  status: string;
};

export type BankImportUndoSnapshot = {
  id: string;
  actionName: string;
  timestamp: number;
  transactions: BankImportTransactionSnapshot[];
};
