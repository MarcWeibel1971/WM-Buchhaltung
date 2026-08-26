import { CreditCard, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCHF } from "@/lib/formatters";

export function BankImportMatchedDocumentInfo({ transaction, documents, isCreditCardTransaction, onLaunchCreditCard }: { transaction: any; documents: any[] | undefined; isCreditCardTransaction: (transaction: any) => boolean; onLaunchCreditCard: (documentUrl: string | undefined) => void }) {
  const matchedDocumentId = transaction?.matchedDocumentId;
  if (!matchedDocumentId) return null;
  const matchedDocument = documents?.find((document) => document.id === matchedDocumentId);
  if (!matchedDocument) return null;
  let metadata: any = null;
  try { if (matchedDocument.aiMetadata) metadata = JSON.parse(matchedDocument.aiMetadata); } catch { /* metadata is optional */ }
  return <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3"><div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-green-600" /><Label className="text-xs font-semibold text-green-700 dark:text-green-400">Gematchte Rechnung</Label><span className="text-xs text-green-600 ml-auto">{transaction.matchScore ?? ""}% Match</span></div><p className="text-sm font-medium truncate">{matchedDocument.filename}</p>{metadata && <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">{metadata.counterparty && <span>Gegenpartei: <span className="text-foreground font-medium">{metadata.counterparty}</span></span>}{metadata.totalAmount != null && <span>Betrag: <span className="text-foreground font-medium">CHF {formatCHF(Number(metadata.totalAmount))}</span></span>}{metadata.documentDate && <span>Datum: <span className="text-foreground font-medium">{metadata.documentDate}</span></span>}{metadata.vatRate != null && <span>MWST: <span className="text-foreground font-medium">{metadata.vatRate}%</span></span>}{metadata.description && <span className="truncate max-w-xs">{metadata.description}</span>}</div>}<div className="mt-2 flex gap-2 flex-wrap">{matchedDocument.s3Url && <a href={matchedDocument.s3Url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300"><Eye className="h-3 w-3" /> Rechnung öffnen</Button></a>}{isCreditCardTransaction(transaction) && <Button size="sm" className="h-7 text-xs gap-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => onLaunchCreditCard(matchedDocument.s3Url ?? undefined)}><CreditCard className="h-3 w-3" /> Verbuchungsvorschlag aufrufen</Button>}</div></div>;
}
