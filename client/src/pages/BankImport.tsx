import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { Upload, Check, X, Zap, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { parseStatement } from "../../../shared/bankParser";

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function BankImport() {
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [pendingFilter, setPendingFilter] = useState<number | undefined>(undefined);
  const [approveDialog, setApproveDialog] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const { data: bankAccounts } = trpc.bankImport.getBankAccounts.useQuery();
  const { data: pendingTxs, refetch: refetchPending } = trpc.bankImport.getPendingTransactions.useQuery({ bankAccountId: pendingFilter });
  const { data: accounts } = trpc.accounts.list.useQuery();

  const utils = trpc.useUtils();

  const importMutation = trpc.bankImport.importTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} Transaktionen importiert, ${data.duplicates} Duplikate übersprungen`);
      refetchPending();
      setImporting(false);
    },
    onError: (e) => { toast.error(e.message); setImporting(false); },
  });

  const categorizeMutation = trpc.bankImport.categorizeWithAI.useMutation({
    onSuccess: (data) => {
      const ok = data.results.filter(r => r.success).length;
      toast.success(`${ok} von ${data.results.length} Transaktionen kategorisiert`);
      refetchPending();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = trpc.bankImport.approveTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaktion verbucht");
      setApproveDialog(null);
      refetchPending();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const ignoreMutation = trpc.bankImport.ignoreTransaction.useMutation({
    onSuccess: () => { toast.success("Transaktion ignoriert"); refetchPending(); },
  });

  const handleFileUpload = useCallback(async (file: File) => {
    if (!selectedBankAccountId) { toast.error("Bitte zuerst ein Bankkonto auswählen"); return; }
    setImporting(true);
    const content = await file.text();
    const parsed = parseStatement(content, file.name);
    if (!parsed.length) { toast.error("Keine Transaktionen erkannt. Bitte CAMT.053, MT940 oder CSV hochladen."); setImporting(false); return; }
    importMutation.mutate({ bankAccountId: selectedBankAccountId, transactions: parsed });
  }, [selectedBankAccountId, importMutation]);

  const pendingIds = (pendingTxs ?? []).filter(tx => !tx.suggestedDebitAccountId).map(tx => tx.id);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Bankimport</h2>
        <p className="text-sm text-muted-foreground">CAMT.053, MT940 oder CSV importieren</p>
      </div>

      {/* Import section */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Kontoauszug importieren</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bankkonto</label>
            <Select value={String(selectedBankAccountId ?? "")} onValueChange={v => setSelectedBankAccountId(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Konto auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts?.map(ba => (
                  <SelectItem key={ba.bankAccount.id} value={String(ba.bankAccount.id)}>
                    {ba.bankAccount.name} ({ba.account.number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Datei</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.sta,.mt940,.csv,.txt"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={!selectedBankAccountId || importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importiere..." : "Datei hochladen"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Unterstützte Formate: CAMT.053 (XML), MT940 (.sta), CSV (Semikolon-getrennt)
        </p>
      </div>

      {/* Pending transactions */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Ausstehende Transaktionen</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{pendingTxs?.length ?? 0} zu verarbeiten</p>
          </div>
          <div className="flex gap-2">
            <Select value={String(pendingFilter ?? "all")} onValueChange={v => setPendingFilter(v === "all" ? undefined : parseInt(v))}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Alle Konten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Konten</SelectItem>
                {bankAccounts?.map(ba => (
                  <SelectItem key={ba.bankAccount.id} value={String(ba.bankAccount.id)}>
                    {ba.bankAccount.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                disabled={categorizeMutation.isPending}
                onClick={() => categorizeMutation.mutate({ transactionIds: pendingIds })}>
                <Zap className="h-3 w-3" />
                {categorizeMutation.isPending ? "KI läuft..." : `KI kategorisieren (${pendingIds.length})`}
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Beschreibung</th>
                <th>Gegenpartei</th>
                <th>Soll-Konto (Vorschlag)</th>
                <th>Haben-Konto (Vorschlag)</th>
                <th className="text-right">Betrag CHF</th>
                <th className="text-right">KI</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!pendingTxs?.length ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    Alle Transaktionen verarbeitet
                  </td>
                </tr>
              ) : pendingTxs.map(tx => {
                const amount = parseFloat(tx.amount as string);
                const debitAcc = accounts?.find(a => a.id === tx.suggestedDebitAccountId);
                const creditAcc = accounts?.find(a => a.id === tx.suggestedCreditAccountId);
                return (
                  <tr key={tx.id}>
                    <td className="text-sm whitespace-nowrap">
                      {new Date(tx.transactionDate as any).toLocaleDateString("de-CH")}
                    </td>
                    <td className="text-sm max-w-xs">
                      <div className="truncate">{tx.description}</div>
                    </td>
                    <td className="text-sm text-muted-foreground max-w-32 truncate">{tx.counterparty ?? "–"}</td>
                    <td className="text-sm">
                      {debitAcc ? (
                        <span className="font-mono text-xs">{debitAcc.number} {debitAcc.name}</span>
                      ) : <span className="text-muted-foreground text-xs">–</span>}
                    </td>
                    <td className="text-sm">
                      {creditAcc ? (
                        <span className="font-mono text-xs">{creditAcc.number} {creditAcc.name}</span>
                      ) : <span className="text-muted-foreground text-xs">–</span>}
                    </td>
                    <td className={`text-right font-mono text-sm ${amount >= 0 ? "amount-positive" : "amount-negative"}`}>
                      {formatCHF(amount)}
                    </td>
                    <td className="text-right text-xs text-muted-foreground">
                      {tx.aiConfidence != null ? `${tx.aiConfidence}%` : "–"}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm" variant="default"
                          className="h-7 text-xs px-2 gap-1"
                          onClick={() => setApproveDialog(tx)}
                        >
                          <Check className="h-3 w-3" /> Verbuchen
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground"
                          onClick={() => ignoreMutation.mutate({ transactionId: tx.id })}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve Dialog */}
      {approveDialog && (
        <ApproveTransactionDialog
          tx={approveDialog}
          accounts={accounts ?? []}
          onClose={() => setApproveDialog(null)}
          onApprove={(debitAccountId, creditAccountId, description) =>
            approveMutation.mutate({ transactionId: approveDialog.id, debitAccountId, creditAccountId, description })
          }
          isPending={approveMutation.isPending}
        />
      )}
    </div>
  );
}

function ApproveTransactionDialog({ tx, accounts, onClose, onApprove, isPending }: {
  tx: any; accounts: any[]; onClose: () => void;
  onApprove: (debitId: number, creditId: number, desc: string) => void;
  isPending: boolean;
}) {
  const [debitId, setDebitId] = useState<number>(tx.suggestedDebitAccountId ?? 0);
  const [creditId, setCreditId] = useState<number>(tx.suggestedCreditAccountId ?? 0);
  const [description, setDescription] = useState(tx.description ?? "");
  const amount = parseFloat(tx.amount as string);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaktion verbuchen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Datum</span>
              <span>{new Date(tx.transactionDate as any).toLocaleDateString("de-CH")}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Betrag</span>
              <span className={`font-mono font-semibold ${amount >= 0 ? "amount-positive" : "amount-negative"}`}>
                CHF {new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2 }).format(amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Beschreibung</span>
              <span className="text-right max-w-48 truncate">{tx.description}</span>
            </div>
          </div>

          {tx.aiReasoning && (
            <div className="flex gap-2 text-xs text-muted-foreground bg-blue-50 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>KI: {tx.aiReasoning}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Buchungstext</label>
            <input
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Soll-Konto</label>
              <Select value={String(debitId || "")} onValueChange={v => setDebitId(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Soll..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.number} – {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Haben-Konto</label>
              <Select value={String(creditId || "")} onValueChange={v => setCreditId(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Haben..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.number} – {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={!debitId || !creditId || isPending}
            onClick={() => onApprove(debitId, creditId, description)}
          >
            Verbuchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
