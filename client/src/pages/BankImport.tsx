import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback, useMemo } from "react";
import { Upload, Check, X, Zap, FileText, Pencil, CheckSquare, Square, CreditCard, RefreshCw, BookOpen } from "lucide-react";
import { DocumentUpload, DocumentList } from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { parseStatement } from "../../../shared/bankParser";

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type EditableTx = {
  id: number;
  transactionDate: string;
  valueDate: string | null;
  amount: string;
  currency: string;
  description: string | null;
  counterparty: string | null;
  counterpartyIban: string | null;
  reference: string | null;
  suggestedDebitAccountId: number | null;
  suggestedCreditAccountId: number | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  bankAccountId: number;
};

export default function BankImport() {
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [pendingFilter, setPendingFilter] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const ccPdfInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);

  // Selection state for bulk operations
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());

  // Edit dialog state
  const [editTx, setEditTx] = useState<EditableTx | null>(null);
  const [editForm, setEditForm] = useState<{
    description: string;
    counterparty: string;
    counterpartyIban: string;
    reference: string;
    debitAccountId: string;
    creditAccountId: string;
  }>({ description: "", counterparty: "", counterpartyIban: "", reference: "", debitAccountId: "", creditAccountId: "" });

  // Credit card dialog state
  const [ccDialog, setCcDialog] = useState<{ txId: number; counterparty: string } | null>(null);
  const [ccParsing, setCcParsing] = useState(false);
  const [ccItems, setCcItems] = useState<Array<{ date: string; description: string; amount: string; debitAccountId: string }>>([]);

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

  const bookingTextMutation = trpc.bankImport.generateBookingText.useMutation({
    onSuccess: (data) => {
      const ok = data.results.filter(r => r.success).length;
      toast.success(`${ok} Buchungstexte generiert`);
      refetchPending();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = trpc.bankImport.approveTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaktion verbucht");
      refetchPending();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkApproveMutation = trpc.bankImport.bulkApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} Transaktionen verbucht, ${data.failed} fehlgeschlagen`);
      setSelectedTxIds(new Set());
      refetchPending();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTxMutation = trpc.bankImport.updateTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaktion aktualisiert");
      setEditTx(null);
      refetchPending();
    },
    onError: (e) => toast.error(e.message),
  });

  const ignoreMutation = trpc.bankImport.ignoreTransaction.useMutation({
    onSuccess: () => { toast.success("Transaktion ignoriert"); refetchPending(); },
  });

  const refreshMutation = trpc.bankImport.refreshSuggestions.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchPending();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFileUpload = useCallback(async (file: File) => {
    if (!selectedBankAccountId) { toast.error("Bitte zuerst ein Bankkonto auswählen"); return; }
    setImporting(true);
    const content = await file.text();
    const parsed = parseStatement(content, file.name);
    if (!parsed.length) { toast.error("Keine Transaktionen erkannt. Bitte CAMT.053, MT940 oder CSV hochladen."); setImporting(false); return; }
    importMutation.mutate({ bankAccountId: selectedBankAccountId, transactions: parsed });
  }, [selectedBankAccountId, importMutation]);

  const handlePdfUpload = useCallback(async (file: File) => {
    if (!selectedBankAccountId) { toast.error("Bitte zuerst ein Bankkonto auswählen"); return; }
    setImportingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload/bank-statement-pdf", { method: "POST", body: formData, credentials: "include" });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error ?? "PDF-Verarbeitung fehlgeschlagen");
      if (!result.transactions?.length) { toast.error("Keine Transaktionen im PDF erkannt"); return; }
      toast.info(`${result.totalExtracted} Transaktionen aus PDF extrahiert. Importiere...`);
      importMutation.mutate({ bankAccountId: selectedBankAccountId, transactions: result.transactions, importBatchId: `pdf-${Date.now()}` });
    } catch (e: any) { toast.error(e.message); } finally { setImportingPdf(false); }
  }, [selectedBankAccountId, importMutation]);

  // Determine which pending transactions need categorization
  const pendingIds = useMemo(() => (pendingTxs ?? []).filter(tx => !tx.suggestedDebitAccountId).map(tx => tx.id), [pendingTxs]);
  const allPendingIds = useMemo(() => (pendingTxs ?? []).map(tx => tx.id), [pendingTxs]);

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedTxIds.size === (pendingTxs?.length ?? 0)) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(pendingTxs?.map(tx => tx.id) ?? []));
    }
  };

  // Open edit dialog
  const openEditDialog = (tx: any) => {
    setEditTx(tx);
    setEditForm({
      description: tx.description ?? "",
      counterparty: tx.counterparty ?? "",
      counterpartyIban: tx.counterpartyIban ?? "",
      reference: tx.reference ?? "",
      debitAccountId: tx.suggestedDebitAccountId ? String(tx.suggestedDebitAccountId) : "",
      creditAccountId: tx.suggestedCreditAccountId ? String(tx.suggestedCreditAccountId) : "",
    });
  };

  const saveEdit = () => {
    if (!editTx) return;
    updateTxMutation.mutate({
      transactionId: editTx.id,
      description: editForm.description || undefined,
      counterparty: editForm.counterparty || undefined,
      counterpartyIban: editForm.counterpartyIban || undefined,
      reference: editForm.reference || undefined,
      suggestedDebitAccountId: editForm.debitAccountId ? parseInt(editForm.debitAccountId) : null,
      suggestedCreditAccountId: editForm.creditAccountId ? parseInt(editForm.creditAccountId) : null,
    });
  };

  // Bulk approve selected transactions
  const handleBulkApprove = () => {
    const txsToApprove = (pendingTxs ?? []).filter(tx =>
      selectedTxIds.has(tx.id) && tx.suggestedDebitAccountId && tx.suggestedCreditAccountId
    );
    if (!txsToApprove.length) { toast.error("Keine ausgewählten Transaktionen mit vollständigen Kontovorschlägen"); return; }
    bulkApproveMutation.mutate({
      transactions: txsToApprove.map(tx => ({
        transactionId: tx.id,
        debitAccountId: tx.suggestedDebitAccountId!,
        creditAccountId: tx.suggestedCreditAccountId!,
        description: tx.description ?? undefined,
      })),
    });
  };

  const parsePdfMutation = trpc.creditCard.parsePdf.useMutation({
    onSuccess: (data) => {
      if (!data.items?.length) { toast.error("Keine Positionen in der Abrechnung erkannt"); return; }
      // Match suggested accounts to actual account IDs
      const mappedItems = data.items.map((item: any) => {
        let debitAccountId = "";
        if (item.suggestedAccount) {
          const accNum = item.suggestedAccount.match(/^(\d{4})/);
          if (accNum) {
            const found = accounts?.find(a => a.number === accNum[1]);
            if (found) debitAccountId = String(found.id);
          }
        }
        return { date: item.date, description: item.description, amount: item.amount, debitAccountId };
      });
      setCcItems(mappedItems);
      toast.success(`${data.items.length} Positionen erkannt`);
    },
    onError: (e) => toast.error(e.message),
  });

  const approveWithItemsMutation = trpc.creditCard.approveWithItems.useMutation({
    onSuccess: (data) => {
      toast.success(`Sammelbuchung erstellt: ${data.itemCount} Positionen, CHF ${formatCHF(data.totalAmount)}`);
      setCcDialog(null);
      setCcItems([]);
      refetchPending();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Credit card PDF upload and parse via dedicated LLM endpoint
  const handleCcPdfUpload = async (file: File) => {
    setCcParsing(true);
    try {
      // First upload the PDF to S3
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload/document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error ?? "Upload fehlgeschlagen");

      // Then parse via dedicated credit card LLM endpoint
      toast.info("Kreditkartenabrechnung wird von KI analysiert...");
      const docUrl = result.document?.s3Url ?? result.url;
      if (!docUrl) throw new Error("Keine URL vom Upload erhalten");
      parsePdfMutation.mutate({ documentUrl: docUrl });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCcParsing(false);
    }
  };

  // Detect if a transaction is a credit card charge (Corner Banca)
  const isCreditCardTx = (tx: any) => {
    const cp = (tx.counterparty ?? "").toLowerCase();
    return cp.includes("corner") || cp.includes("banca") || cp.includes("visa") || cp.includes("mastercard") || cp.includes("kreditkarte");
  };

  // Selected transactions that are ready to approve (have both accounts)
  const readyToApprove = useMemo(() =>
    (pendingTxs ?? []).filter(tx => selectedTxIds.has(tx.id) && tx.suggestedDebitAccountId && tx.suggestedCreditAccountId),
    [pendingTxs, selectedTxIds]
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Bankimport</h2>
        <p className="text-sm text-muted-foreground">CAMT.053, MT940, CSV oder PDF importieren</p>
      </div>

      {/* Import section */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Kontoauszug importieren</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bankkonto</label>
            <Select value={String(selectedBankAccountId ?? "")} onValueChange={v => setSelectedBankAccountId(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="Konto auswählen..." /></SelectTrigger>
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
            <input ref={fileInputRef} type="file" accept=".xml,.sta,.mt940,.csv,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); }} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" disabled={!selectedBankAccountId || importing || importingPdf}
                onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {importing ? "Importiere..." : "CAMT/MT940/CSV"}
              </Button>
              <Button variant="outline" className="flex-1 gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                disabled={!selectedBankAccountId || importing || importingPdf}
                onClick={() => pdfInputRef.current?.click()}>
                <FileText className="h-4 w-4" />
                {importingPdf ? "KI liest PDF..." : "PDF (KI)"}
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Unterstützte Formate: CAMT.053 (XML), MT940 (.sta), CSV (Semikolon-getrennt), PDF (KI-Extraktion)
        </p>
      </div>

      {/* Pending transactions */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Ausstehende Transaktionen</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{pendingTxs?.length ?? 0} zu verarbeiten</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={String(pendingFilter ?? "all")} onValueChange={v => setPendingFilter(v === "all" ? undefined : parseInt(v))}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Alle Konten" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Konten</SelectItem>
                {bankAccounts?.map(ba => (
                  <SelectItem key={ba.bankAccount.id} value={String(ba.bankAccount.id)}>{ba.bankAccount.name}</SelectItem>
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
            {allPendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                disabled={bookingTextMutation.isPending}
                onClick={() => bookingTextMutation.mutate({ transactionIds: allPendingIds })}>
                <FileText className="h-3 w-3" />
                {bookingTextMutation.isPending ? "Texte werden generiert..." : "Buchungstexte generieren"}
              </Button>
            )}
            {allPendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                disabled={refreshMutation.isPending}
                onClick={() => refreshMutation.mutate({ bankAccountId: pendingFilter })}>
                <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                {refreshMutation.isPending ? "Aktualisiere..." : "Refresh (gelernt)"}
              </Button>
            )}
            {selectedTxIds.size > 0 && readyToApprove.length > 0 && (
              <Button size="sm" className="gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                disabled={bulkApproveMutation.isPending}
                onClick={handleBulkApprove}>
                <Check className="h-3 w-3" />
                {bulkApproveMutation.isPending ? "Verbuche..." : `${readyToApprove.length} verbuchen`}
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox
                    checked={pendingTxs?.length ? selectedTxIds.size === pendingTxs.length : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th>Datum</th>
                <th>Buchungstext</th>
                <th>Lieferant / Kunde</th>
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
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    Alle Transaktionen verarbeitet
                  </td>
                </tr>
              ) : pendingTxs.map(tx => {
                const amount = parseFloat(tx.amount as string);
                const debitAcc = accounts?.find(a => a.id === tx.suggestedDebitAccountId);
                const creditAcc = accounts?.find(a => a.id === tx.suggestedCreditAccountId);
                const isCC = isCreditCardTx(tx);
                const isSelected = selectedTxIds.has(tx.id);
                const partnerLabel = amount < 0 ? "Kreditor" : "Debitor";

                return (
                  <tr key={tx.id} className={isSelected ? "bg-blue-50 dark:bg-blue-950" : ""}>
                    <td>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(tx.id)} />
                    </td>
                    <td className="text-sm whitespace-nowrap">
                      {tx.transactionDate ? new Date(tx.transactionDate as string).toLocaleDateString("de-CH") : "–"}
                    </td>
                    <td className="text-sm max-w-xs">
                      <div className="truncate font-medium" title={tx.description ?? ""}>{tx.description ?? "–"}</div>
                    </td>
                    <td className="text-sm max-w-40">
                      <div className="truncate" title={tx.counterparty ?? ""}>
                        {tx.counterparty ?? "–"}
                        {isCC && <span className="ml-1 text-xs text-orange-600 font-medium">(KK)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{partnerLabel}</div>
                    </td>
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
                    <td className={`text-sm text-right font-mono tabular-nums whitespace-nowrap ${amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {amount >= 0 ? "" : "-"}{formatCHF(Math.abs(amount))}
                    </td>
                    <td className="text-right text-xs">
                      {tx.aiConfidence ? (
                        <span className="inline-flex items-center gap-1">
                          {tx.aiConfidence}%
                          {tx.aiReasoning?.startsWith("Gelernte Regel") && (
                            <span title="Gelernte Regel"><BookOpen className="h-3 w-3 text-amber-600" /></span>
                          )}
                        </span>
                      ) : "–"}
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end flex-nowrap">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Bearbeiten"
                          onClick={() => openEditDialog(tx)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isCC && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-orange-600" title="Kreditkartenbeleg verbuchen"
                            onClick={() => {
                              setCcDialog({ txId: tx.id, counterparty: tx.counterparty ?? "Kreditkarte" });
                              setCcItems([]);
                            }}>
                            <CreditCard className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {debitAcc && creditAcc && (
                          <Button size="sm" variant="default" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => approveMutation.mutate({
                              transactionId: tx.id,
                              debitAccountId: debitAcc.id,
                              creditAccountId: creditAcc.id,
                              description: tx.description ?? undefined,
                            })}>
                            <Check className="h-3 w-3 mr-1" />Verbuchen
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" title="Ignorieren"
                          onClick={() => ignoreMutation.mutate({ transactionId: tx.id })}>
                          <X className="h-3.5 w-3.5" />
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

      {/* ─── Edit Transaction Dialog ─── */}
      <Dialog open={!!editTx} onOpenChange={open => { if (!open) setEditTx(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaktion bearbeiten</DialogTitle>
            <DialogDescription>Alle Felder der Transaktion anpassen</DialogDescription>
          </DialogHeader>
          {editTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Datum</Label>
                  <Input value={editTx.transactionDate ? new Date(editTx.transactionDate).toLocaleDateString("de-CH") : "–"} disabled className="bg-muted" />
                </div>
                <div>
                  <Label className="text-xs">Betrag CHF</Label>
                  <Input value={formatCHF(editTx.amount)} disabled className="bg-muted" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Buchungstext</Label>
                <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="z.B. Sunrise 1. Quartal 2026" />
              </div>
              <div>
                <Label className="text-xs">Lieferant (Kreditor) / Kunde (Debitor)</Label>
                <Input value={editForm.counterparty} onChange={e => setEditForm(f => ({ ...f, counterparty: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">IBAN Gegenpartei</Label>
                <Input value={editForm.counterpartyIban} onChange={e => setEditForm(f => ({ ...f, counterpartyIban: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Referenz</Label>
                <Input value={editForm.reference} onChange={e => setEditForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Soll-Konto</Label>
                  <Select value={editForm.debitAccountId} onValueChange={v => setEditForm(f => ({ ...f, debitAccountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Haben-Konto</Label>
                  <Select value={editForm.creditAccountId} onValueChange={v => setEditForm(f => ({ ...f, creditAccountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editTx.aiReasoning && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">KI-Begründung</Label>
                  <p className="text-sm mt-1">{editTx.aiReasoning}</p>
                </div>
              )}
              <div>
                <Label className="text-xs">Belege</Label>
                <div className="mt-1">
                  <DocumentUpload bankTransactionId={editTx.id} compact />
                  <DocumentList bankTransactionId={editTx.id} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTx(null)}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={updateTxMutation.isPending}>
              {updateTxMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Credit Card Statement Dialog ─── */}
      <Dialog open={!!ccDialog} onOpenChange={open => { if (!open) setCcDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kreditkartenbeleg verbuchen</DialogTitle>
            <DialogDescription>
              Laden Sie die Kreditkartenabrechnung als PDF hoch. Die einzelnen Positionen werden als Sammelbuchung über Konto 1082 (Durchlaufkonto VISA mw) verbucht.
            </DialogDescription>
          </DialogHeader>

          <input ref={ccPdfInputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCcPdfUpload(f); }} />

          <div className="space-y-4">
            <Button variant="outline" className="w-full gap-2" disabled={ccParsing}
              onClick={() => ccPdfInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {ccParsing ? "Abrechnung wird analysiert..." : "Kreditkartenabrechnung (PDF) hochladen"}
            </Button>

            {ccItems.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Erkannte Positionen ({ccItems.length})</h4>
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
                      {ccItems.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{item.date}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCHF(item.amount)}</td>
                          <td className="px-3 py-2">
                            <Select value={item.debitAccountId} onValueChange={v => {
                              setCcItems(prev => prev.map((it, i) => i === idx ? { ...it, debitAccountId: v } : it));
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Konto..." /></SelectTrigger>
                              <SelectContent>
                                {accounts?.filter(a => a.accountType === "expense").map(a => (
                                  <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 font-medium">Total</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">
                          {formatCHF(ccItems.reduce((s, i) => s + parseFloat(i.amount || "0"), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCcDialog(null)}>Abbrechen</Button>
            {ccItems.length > 0 && (
              <Button className="bg-green-600 hover:bg-green-700"
                disabled={ccItems.some(i => !i.debitAccountId) || approveWithItemsMutation.isPending}
                onClick={() => {
                  approveWithItemsMutation.mutate({
                    bankTransactionId: ccDialog?.txId,
                    statementDate: new Date().toISOString().split("T")[0],
                    counterparty: ccDialog?.counterparty ?? "Kreditkarte",
                    items: ccItems.map(i => ({
                      date: i.date,
                      description: i.description,
                      amount: i.amount,
                      debitAccountId: parseInt(i.debitAccountId),
                    })),
                  });
                }}>
                <Check className="h-4 w-4 mr-1" />
                {approveWithItemsMutation.isPending ? "Wird verbucht..." : "Sammelbuchung erstellen"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
