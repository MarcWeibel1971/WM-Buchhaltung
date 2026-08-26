import { useRef } from "react";
import { Check, RefreshCw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCHF } from "@/lib/formatters";

type CreditCardDialogState = {
  txId: number;
  counterparty: string;
  txAmount: string;
  statementDate: string;
  ccStatementId?: number;
  matchedDocUrl?: string;
};

type CreditCardItem = {
  date: string;
  description: string;
  amount: string;
  debitAccountId: string;
};

type CreditCardAccount = {
  id: number;
  number: string;
  name: string;
  accountType: string;
};

type BankImportCreditCardDialogProps = {
  dialog: CreditCardDialogState | null;
  items: CreditCardItem[];
  paidAmount: string;
  parsing: boolean;
  accounts: CreditCardAccount[] | undefined;
  isSubmitting: boolean;
  onClose: () => void;
  onPdfUpload: (file: File) => void;
  onPaidAmountChange: (value: string) => void;
  onItemAccountChange: (index: number, debitAccountId: string) => void;
  onSubmit: () => void;
};

export function BankImportCreditCardDialog({
  dialog,
  items,
  paidAmount,
  parsing,
  accounts,
  isSubmitting,
  onClose,
  onPdfUpload,
  onPaidAmountChange,
  onItemAccountChange,
  onSubmit,
}: BankImportCreditCardDialogProps) {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
  const parsedPaidAmount = parseFloat(paidAmount || "0");
  const parsedBankAmount = parseFloat(dialog?.txAmount || "0");
  const hasBankDifference = Boolean(paidAmount && dialog && parsedPaidAmount !== parsedBankAmount);
  const hasStatementDifference = Boolean(paidAmount && parsedPaidAmount !== totalAmount);

  return (
    <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(98vw,72rem)] max-w-none max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dialog?.matchedDocUrl ? "Verbuchungsvorschlag – Kreditkartenabrechnung" : "Kreditkartenabrechnung verbuchen"}
          </DialogTitle>
          <DialogDescription>
            {dialog?.matchedDocUrl
              ? "Die verknüpfte Kreditkartenabrechnung wird automatisch analysiert. Zwei Journal-Einträge werden erstellt: (1) 1082 Durchlaufkonto / 1032 LUKB mw – effektiv bezahlter Betrag; (2) Aufwandkonten / 1082 Durchlaufkonto – Abrechnungstotal (Sammelbuchung)."
              : "PDF hochladen → KI erkennt Positionen → zwei Journal-Einträge werden erstellt: (1) 1082 Durchlaufkonto / 1032 LUKB mw – effektiv bezahlter Betrag; (2) Aufwandkonten / 1082 Durchlaufkonto – Abrechnungstotal (Sammelbuchung)."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPdfUpload(file);
          }}
        />

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/40 rounded-lg">
            <div>
              <Label className="text-xs text-muted-foreground">Bankbelastung (aus Kontoauszug)</Label>
              <div className="font-mono font-semibold text-sm mt-1">
                CHF {dialog ? formatCHF(dialog.txAmount) : "–"}
              </div>
            </div>
            <div>
              <Label className="text-xs">Effektiv bezahlter Betrag</Label>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">CHF</span>
                <Input
                  className="h-8 text-sm font-mono"
                  value={paidAmount}
                  onChange={(event) => onPaidAmountChange(event.target.value)}
                  placeholder={dialog?.txAmount ?? "0.00"}
                />
              </div>
              {hasBankDifference && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Differenz: CHF {formatCHF(Math.abs(Number(totalAmount.toFixed(2)) - parsedPaidAmount))} (Vormonatsguthaben)
                </p>
              )}
            </div>
          </div>

          {dialog?.matchedDocUrl && items.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-700 dark:text-blue-400">Verknüpfte Abrechnung wird automatisch analysiert...</span>
            </div>
          )}

          {!dialog?.matchedDocUrl && (
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={parsing}
              onClick={() => pdfInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {parsing ? "Abrechnung wird analysiert..." : "Kreditkartenabrechnung (PDF) hochladen"}
            </Button>
          )}

          {items.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Erkannte Positionen ({items.length})</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2">Datum</th>
                      <th className="text-left px-3 py-2">Beschreibung</th>
                      <th className="text-right px-3 py-2">Betrag</th>
                      <th className="text-left px-3 py-2">Aufwandkonto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{item.date}</td>
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCHF(item.amount)}</td>
                        <td className="px-3 py-2">
                          <Select value={item.debitAccountId} onValueChange={(value) => onItemAccountChange(index, value)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Konto..." /></SelectTrigger>
                            <SelectContent>
                              {accounts?.filter((account) => account.accountType === "expense" || account.number.startsWith("1")).map((account) => (
                                <SelectItem key={account.id} value={String(account.id)}>{account.number} {account.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 font-medium">Abrechnungstotal</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">CHF {formatCHF(totalAmount)}</td>
                      <td></td>
                    </tr>
                    {hasStatementDifference && (
                      <tr className="text-amber-700 bg-amber-50 dark:bg-amber-950/20">
                        <td colSpan={2} className="px-3 py-1.5 text-xs">Vormonatsguthaben (Differenz)</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs">CHF {formatCHF(Math.abs(totalAmount - parsedPaidAmount))}</td>
                        <td></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          {items.length > 0 && (
            <Button className="bg-green-600 hover:bg-green-700" disabled={items.some((item) => !item.debitAccountId) || isSubmitting} onClick={onSubmit}>
              <Check className="h-4 w-4 mr-1" />
              {isSubmitting ? "Wird verbucht..." : "KK-Abrechnung verbuchen (2 Buchungen)"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
