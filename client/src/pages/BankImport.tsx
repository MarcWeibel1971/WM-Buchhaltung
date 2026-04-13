import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback, useMemo } from "react";
import { Upload, Check, X, Zap, FileText, Pencil, CreditCard, RefreshCw, BookOpen, Undo2, Eye } from "lucide-react";
import { DocumentUpload, DocumentList } from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [statusFilter, setStatusFilter] = useState<"pending" | "matched" | "all">("pending");
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

  // Invoice preview dialog state
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  // Credit card dialog state
  const [ccDialog, setCcDialog] = useState<{ txId: number; counterparty: string; txAmount: string; statementDate: string; ccStatementId?: number } | null>(null);
  const [ccParsing, setCcParsing] = useState(false);
  const [ccItems, setCcItems] = useState<Array<{ date: string; description: string; amount: string; debitAccountId: string }>>([])
  const [ccPaidAmount, setCcPaidAmount] = useState<string>("");

  const { data: bankAccounts } = trpc.bankImport.getBankAccounts.useQuery();
  const { data: transactions, refetch: refetchTxs } = trpc.bankImport.getTransactionsByStatus.useQuery(
    { status: statusFilter, bankAccountId: pendingFilter }
  );
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: allDocs } = trpc.documents.list.useQuery({ limit: 500 });

  const utils = trpc.useUtils();

  const importMutation = trpc.bankImport.importTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} Transaktionen importiert, ${data.duplicates} Duplikate übersprungen`);
      refetchTxs();
      setImporting(false);
    },
    onError: (e) => { toast.error(e.message); setImporting(false); },
  });

  const categorizeMutation = trpc.bankImport.categorizeWithAI.useMutation({
    onSuccess: (data) => {
      const ok = data.results.filter(r => r.success).length;
      toast.success(`${ok} von ${data.results.length} Transaktionen kategorisiert`);
      refetchTxs();
    },
    onError: (e) => toast.error(e.message),
  });

  const bookingTextMutation = trpc.bankImport.generateBookingText.useMutation({
    onSuccess: (data) => {
      const ok = data.results.filter(r => r.success).length;
      toast.success(`${ok} Buchungstexte generiert`);
      refetchTxs();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = trpc.bankImport.approveTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaktion verbucht");
      refetchTxs();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkApproveMutation = trpc.bankImport.bulkApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} Transaktionen verbucht, ${data.failed} fehlgeschlagen`);
      setSelectedTxIds(new Set());
      refetchTxs();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTxMutation = trpc.bankImport.updateTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaktion aktualisiert");
      setEditTx(null);
      refetchTxs();
    },
    onError: (e) => toast.error(e.message),
  });

  const ignoreMutation = trpc.bankImport.ignoreTransaction.useMutation({
    onSuccess: () => { toast.success("Transaktion ignoriert"); refetchTxs(); },
  });

  const unapproveMutation = trpc.bankImport.unapproveTransaction.useMutation({
    onSuccess: () => {
      toast.success("Verbuchung rückgängig gemacht – Transaktion ist wieder ausstehend");
      refetchTxs();
      utils.reports.dashboard.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const refreshMutation = trpc.bankImport.refreshSuggestions.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchTxs();
    },
    onError: (e) => toast.error(e.message),
  });

  const parsePdfMutation = trpc.creditCard.parsePdf.useMutation({
    onSuccess: (data) => {
      if (!data.items?.length) { toast.error("Keine Positionen in der Abrechnung erkannt"); return; }
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
      refetchTxs();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // New: approve CC from bank import (creates two journal entries: 1082/1032 + Aufwand/1082)
  const approveCcFromBankImportMutation = trpc.creditCard.approveCcFromBankImport.useMutation({
    onSuccess: (data) => {
      toast.success(`KK-Abrechnung verbucht: ${data.itemCount} Positionen, Total CHF ${formatCHF(data.totalAmount)}, bezahlt CHF ${formatCHF(data.paidAmount)}`);
      setCcDialog(null);
      setCcItems([]);
      setCcPaidAmount("");
      refetchTxs();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveTransferMutation = trpc.bankImport.approveTransfer.useMutation({
    onSuccess: (data) => {
      toast.success(`Kontoübertrag verbucht: ${data.entryNumber}`);
      refetchTxs();
      utils.reports.dashboard.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const detectTransfersMutation = trpc.bankImport.detectTransfers.useMutation({
    onSuccess: (data) => {
      if (data.found === 0) toast.info("Keine neuen Kontoüberträge erkannt");
      else toast.success(`${data.found} Kontoüberträge erkannt und markiert`);
      refetchTxs();
    },
    onError: (e: any) => toast.error(e.message),
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

  // Credit card PDF upload and parse via dedicated LLM endpoint
  const handleCcPdfUpload = async (file: File) => {
    setCcParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload/document", { method: "POST", body: formData, credentials: "include" });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error ?? "Upload fehlgeschlagen");
      toast.info("Kreditkartenabrechnung wird von KI analysiert...");
      const docUrl = result.document?.s3Url ?? result.url;
      if (!docUrl) throw new Error("Keine URL vom Upload erhalten");
      parsePdfMutation.mutate({ documentUrl: docUrl });
    } catch (e: any) { toast.error(e.message); } finally { setCcParsing(false); }
  };

  // Detect if a transaction is a credit card charge (Corner Banca)
  const isCreditCardTx = (tx: any) => {
    const cp = (tx.counterparty ?? "").toLowerCase();
    return cp.includes("corner") || cp.includes("banca") || cp.includes("visa") || cp.includes("mastercard") || cp.includes("kreditkarte");
  };

  // Pending-only helpers
  const pendingTxs = useMemo(() => (transactions ?? []).filter(tx => tx.status === "pending"), [transactions]);
  const pendingIds = useMemo(() => pendingTxs.filter(tx => !tx.suggestedDebitAccountId).map(tx => tx.id), [pendingTxs]);
  const allPendingIds = useMemo(() => pendingTxs.map(tx => tx.id), [pendingTxs]);

  // Selected transactions that are ready to approve (have both accounts, pending only)
  const readyToApprove = useMemo(() =>
    pendingTxs.filter(tx => selectedTxIds.has(tx.id) && tx.suggestedDebitAccountId && tx.suggestedCreditAccountId),
    [pendingTxs, selectedTxIds]
  );

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedTxIds.size === pendingTxs.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(pendingTxs.map(tx => tx.id)));
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
    const txsToApprove = pendingTxs.filter(tx =>
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

  const isPending = statusFilter === "pending";
  const isMatched = statusFilter === "matched";

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
                    {ba.bankAccount.name} ({ba.account.number}){ba.bankAccount.iban ? ` – ${ba.bankAccount.iban}` : ""}
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

      {/* Transactions list */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">
              {statusFilter === "pending" ? "Ausstehende Transaktionen" :
               statusFilter === "matched" ? "Verbuchte Transaktionen" : "Alle Transaktionen"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{transactions?.length ?? 0} Transaktionen</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as any); setSelectedTxIds(new Set()); }}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="matched">Verbucht</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
            {/* Bank account filter */}
            <Select value={String(pendingFilter ?? "all")} onValueChange={v => setPendingFilter(v === "all" ? undefined : parseInt(v))}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Alle Konten" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Konten</SelectItem>
                {bankAccounts?.map(ba => (
                  <SelectItem key={ba.bankAccount.id} value={String(ba.bankAccount.id)}>{ba.bankAccount.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Pending-only actions */}
            {isPending && pendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                disabled={categorizeMutation.isPending}
                onClick={() => categorizeMutation.mutate({ transactionIds: pendingIds })}>
                <Zap className="h-3 w-3" />
                {categorizeMutation.isPending ? "KI läuft..." : `KI kategorisieren (${pendingIds.length})`}
              </Button>
            )}
            {isPending && allPendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                disabled={bookingTextMutation.isPending}
                onClick={() => bookingTextMutation.mutate({ transactionIds: allPendingIds })}>
                <FileText className="h-3 w-3" />
                {bookingTextMutation.isPending ? "Texte werden generiert..." : "Buchungstexte generieren"}
              </Button>
            )}
            {isPending && allPendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                disabled={refreshMutation.isPending}
                onClick={() => refreshMutation.mutate({ bankAccountId: pendingFilter })}>
                <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                {refreshMutation.isPending ? "Aktualisiere..." : "Refresh (gelernt)"}
              </Button>
            )}
            {isPending && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                disabled={detectTransfersMutation.isPending}
                onClick={() => detectTransfersMutation.mutate()}>
                <RefreshCw className={`h-3 w-3 ${detectTransfersMutation.isPending ? "animate-spin" : ""}`} />
                {detectTransfersMutation.isPending ? "Erkenne..." : "Kontoüberträge erkennen"}
              </Button>
            )}
            {isPending && selectedTxIds.size > 0 && readyToApprove.length > 0 && (
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
                {isPending && (
                  <th className="w-10">
                    <Checkbox
                      checked={pendingTxs.length > 0 && selectedTxIds.size === pendingTxs.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th>Datum</th>
                <th>Buchungstext</th>
                <th>Lieferant / Kunde</th>
                <th>Soll-Konto</th>
                <th>Haben-Konto</th>
                <th className="text-right">Betrag CHF</th>
                <th className="text-right">Status</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!transactions?.length ? (
                <tr>
                  <td colSpan={isPending ? 9 : 8} className="text-center py-12 text-muted-foreground">
                    {isPending ? (
                      <>
                        <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        Alle Transaktionen verarbeitet
                      </>
                    ) : (
                      "Keine Transaktionen gefunden"
                    )}
                  </td>
                </tr>
              ) : transactions.map(tx => {
                const amount = parseFloat(tx.amount as string);
                const debitAcc = accounts?.find(a => a.id === tx.suggestedDebitAccountId);
                const creditAcc = accounts?.find(a => a.id === tx.suggestedCreditAccountId);
                const isCC = isCreditCardTx(tx);
                const isTransfer = (tx as any).isTransfer === true || (tx as any).isTransfer === 1;
                const isSelected = selectedTxIds.has(tx.id);
                const partnerLabel = amount < 0 ? "Kreditor" : "Debitor";
                const txIsPending = tx.status === "pending";
                const txIsMatched = tx.status === "matched";

                return (
                  <tr key={tx.id} className={isSelected ? "bg-blue-50 dark:bg-blue-950" : ""}>
                    {isPending && (
                      <td>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(tx.id)} />
                      </td>
                    )}
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
                        {isTransfer && (
                          <span className="ml-1 text-xs text-blue-600 font-medium">
                            (Übertrag{(tx as any).transferPartnerBankName ? `: ${(tx as any).transferPartnerBankName}` : ""})
                          </span>
                        )}
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
                      {txIsPending && (
                        <span className="inline-flex items-center gap-1">
                          {tx.aiConfidence ? (
                            <>
                              {tx.aiConfidence}%
                              {tx.aiReasoning?.startsWith("Gelernte Regel") && (
                                <span title="Gelernte Regel"><BookOpen className="h-3 w-3 text-amber-600" /></span>
                              )}
                            </>
                          ) : "–"}
                          {(tx as any).matchedDocumentId && (() => {
                            const doc = allDocs?.find((d: any) => d.id === (tx as any).matchedDocumentId);
                            return (
                              <button
                                title={doc ? `Rechnung: ${doc.filename}` : "Rechnung gematched"}
                                className="inline-flex items-center text-green-600 hover:text-green-800 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); if (doc) setPreviewDoc(doc); }}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            );
                          })()}
                        </span>
                      )}
                      {txIsMatched && (
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                          <Check className="h-3 w-3" /> Verbucht
                          {(tx as any).matchedDocumentId && (() => {
                            const doc = allDocs?.find((d: any) => d.id === (tx as any).matchedDocumentId);
                            return doc ? (
                              <button
                                title={`Rechnung: ${doc.filename}`}
                                className="ml-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            ) : null;
                          })()}
                        </span>
                      )}
                      {tx.status === "ignored" && (
                        <span className="text-muted-foreground">Ignoriert</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end flex-nowrap">
                        {txIsPending && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Bearbeiten"
                              onClick={() => openEditDialog(tx)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {isCC && !isTransfer && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-orange-600" title="Kreditkartenbeleg verbuchen"
                                onClick={() => {
                                  const txAmt = Math.abs(parseFloat(tx.amount as string)).toFixed(2);
                                  setCcDialog({
                                    txId: tx.id,
                                    counterparty: tx.counterparty ?? "Kreditkarte",
                                    txAmount: txAmt,
                                    statementDate: tx.transactionDate ? new Date(tx.transactionDate as string).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                                  });
                                  setCcItems([]);
                                  setCcPaidAmount(txAmt);
                                }}>
                                <CreditCard className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isTransfer && (
                              <Button size="sm" variant="default" className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                                disabled={approveTransferMutation.isPending}
                                onClick={() => approveTransferMutation.mutate({
                                  txId: tx.id,
                                  bookingText: tx.description ?? undefined,
                                })}>
                                <Check className="h-3 w-3 mr-1" />Übertrag verbuchen
                              </Button>
                            )}
                            {!isTransfer && debitAcc && creditAcc && (
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
                          </>
                        )}
                        {txIsMatched && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                            disabled={unapproveMutation.isPending}
                            onClick={() => {
                              if (confirm("Verbuchung rückgängig machen? Der Journal-Eintrag wird gelöscht und die Transaktion wird wieder ausstehend.")) {
                                unapproveMutation.mutate({ transactionId: tx.id });
                              }
                            }}>
                            <Undo2 className="h-3 w-3" />
                            Rückgängig
                          </Button>
                        )}
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
              {/* Matched document info */}
              {(() => {
                const matchedDocId = (editTx as any).matchedDocumentId;
                if (!matchedDocId) return null;
                const matchedDoc = allDocs?.find((d: any) => d.id === matchedDocId);
                if (!matchedDoc) return null;
                let docMeta: any = null;
                try { if (matchedDoc.aiMetadata) docMeta = JSON.parse(matchedDoc.aiMetadata); } catch {}
                return (
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-green-600" />
                      <Label className="text-xs font-semibold text-green-700 dark:text-green-400">Gematchte Rechnung</Label>
                      <span className="text-xs text-green-600 ml-auto">{(editTx as any).matchScore ?? ''}% Match</span>
                    </div>
                    <p className="text-sm font-medium truncate">{matchedDoc.filename}</p>
                    {docMeta && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {docMeta.counterparty && <span>Gegenpartei: <span className="text-foreground font-medium">{docMeta.counterparty}</span></span>}
                        {docMeta.totalAmount != null && <span>Betrag: <span className="text-foreground font-medium">CHF {formatCHF(Number(docMeta.totalAmount))}</span></span>}
                        {docMeta.documentDate && <span>Datum: <span className="text-foreground font-medium">{docMeta.documentDate}</span></span>}
                        {docMeta.vatRate != null && <span>MWST: <span className="text-foreground font-medium">{docMeta.vatRate}%</span></span>}
                        {docMeta.description && <span className="truncate max-w-xs">{docMeta.description}</span>}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {matchedDoc.s3Url && (
                        <a href={matchedDoc.s3Url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300">
                            <Eye className="h-3 w-3" /> Rechnung öffnen
                          </Button>
                        </a>
                      )}
                      {/* If this is a CC transaction, offer to launch the booking proposal */}
                      {editTx && isCreditCardTx(editTx) && (
                        <Button size="sm" className="h-7 text-xs gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => {
                            const txAmt = Math.abs(parseFloat(editTx.amount)).toFixed(2);
                            const stmtDate = editTx.transactionDate
                              ? new Date(editTx.transactionDate).toISOString().split("T")[0]
                              : new Date().toISOString().split("T")[0];
                            setCcDialog({
                              txId: editTx.id,
                              counterparty: editTx.counterparty ?? "Kreditkarte",
                              txAmount: txAmt,
                              statementDate: stmtDate,
                            });
                            setCcItems([]);
                            setCcPaidAmount(txAmt);
                            setEditTx(null);
                          }}>
                          <CreditCard className="h-3 w-3" /> Verbuchungsvorschlag aufrufen
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}
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
      <Dialog open={!!ccDialog} onOpenChange={open => { if (!open) { setCcDialog(null); setCcItems([]); setCcPaidAmount(""); } }}>
        <DialogContent className="sm:max-w-[95vw] w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kreditkartenabrechnung verbuchen</DialogTitle>
            <DialogDescription>
              PDF hochladen → KI erkennt Positionen → zwei Journal-Einträge werden erstellt:
              (1) 1082 Durchlaufkonto / 1032 LUKB mw – effektiv bezahlter Betrag;
              (2) Aufwandkonten / 1082 Durchlaufkonto – Abrechnungstotal (Sammelbuchung).
            </DialogDescription>
          </DialogHeader>

          <input ref={ccPdfInputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCcPdfUpload(f); }} />

          <div className="space-y-4">
            {/* Betrag-Info und Feld für effektiv bezahlten Betrag */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/40 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Bankbelastung (aus Kontoauszug)</Label>
                <div className="font-mono font-semibold text-sm mt-1">
                  CHF {ccDialog ? formatCHF(ccDialog.txAmount) : "–"}
                </div>
              </div>
              <div>
                <Label className="text-xs">Effektiv bezahlter Betrag</Label>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">CHF</span>
                  <Input
                    className="h-8 text-sm font-mono"
                    value={ccPaidAmount}
                    onChange={e => setCcPaidAmount(e.target.value)}
                    placeholder={ccDialog?.txAmount ?? "0.00"}
                  />
                </div>
                {ccPaidAmount && ccDialog && parseFloat(ccPaidAmount) !== parseFloat(ccDialog.txAmount) && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Differenz: CHF {formatCHF(Math.abs(parseFloat(ccItems.reduce((s, i) => s + parseFloat(i.amount || "0"), 0).toFixed(2)) - parseFloat(ccPaidAmount)))} (Vormonatsguthaben)
                  </p>
                )}
              </div>
            </div>

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
                          <td className="px-3 py-2 whitespace-nowrap">{item.date}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCHF(item.amount)}</td>
                          <td className="px-3 py-2">
                            <Select value={item.debitAccountId} onValueChange={v => {
                              setCcItems(prev => prev.map((it, i) => i === idx ? { ...it, debitAccountId: v } : it));
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Konto..." /></SelectTrigger>
                              <SelectContent>
                                {accounts?.filter(a => a.accountType === "expense" || a.number.startsWith("1")).map(a => (
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
                        <td colSpan={2} className="px-3 py-2 font-medium">Abrechnungstotal</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          CHF {formatCHF(ccItems.reduce((s, i) => s + parseFloat(i.amount || "0"), 0))}
                        </td>
                        <td></td>
                      </tr>
                      {ccPaidAmount && parseFloat(ccPaidAmount) !== ccItems.reduce((s, i) => s + parseFloat(i.amount || "0"), 0) && (
                        <tr className="text-amber-700 bg-amber-50 dark:bg-amber-950/20">
                          <td colSpan={2} className="px-3 py-1.5 text-xs">Vormonatsguthaben (Differenz)</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">
                            CHF {formatCHF(Math.abs(ccItems.reduce((s, i) => s + parseFloat(i.amount || "0"), 0) - parseFloat(ccPaidAmount || "0")))}
                          </td>
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
            <Button variant="outline" onClick={() => { setCcDialog(null); setCcItems([]); setCcPaidAmount(""); }}>Abbrechen</Button>
            {ccItems.length > 0 && (
              <Button className="bg-green-600 hover:bg-green-700"
                disabled={ccItems.some(i => !i.debitAccountId) || approveCcFromBankImportMutation.isPending}
                onClick={() => {
                  if (!ccDialog) return;
                  approveCcFromBankImportMutation.mutate({
                    bankTransactionId: ccDialog.txId,
                    statementId: ccDialog.ccStatementId,
                    statementDate: ccDialog.statementDate,
                    counterparty: ccDialog.counterparty,
                    paidAmount: ccPaidAmount || ccDialog.txAmount,
                    items: ccItems.map(i => ({
                      date: i.date,
                      description: i.description,
                      amount: i.amount,
                      debitAccountId: parseInt(i.debitAccountId),
                    })),
                  });
                }}>
                <Check className="h-4 w-4 mr-1" />
                {approveCcFromBankImportMutation.isPending ? "Wird verbucht..." : "KK-Abrechnung verbuchen (2 Buchungen)"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Invoice Preview Dialog ─── */}
      <Dialog open={!!previewDoc} onOpenChange={open => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Rechnungsvorschau
            </DialogTitle>
            <DialogDescription>
              {previewDoc?.filename}
            </DialogDescription>
          </DialogHeader>
          {previewDoc && (() => {
            let meta: any = null;
            try { if (previewDoc.aiMetadata) meta = JSON.parse(previewDoc.aiMetadata); } catch {}
            return (
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                {/* AI-extracted metadata */}
                {meta && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {meta.counterparty && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Gegenpartei</span>
                          <span className="font-medium">{meta.counterparty}</span>
                        </div>
                      )}
                      {meta.totalAmount != null && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Betrag</span>
                          <span className="font-medium font-mono">CHF {formatCHF(Number(meta.totalAmount))}</span>
                        </div>
                      )}
                      {meta.documentDate && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Rechnungsdatum</span>
                          <span className="font-medium">{meta.documentDate}</span>
                        </div>
                      )}
                      {meta.vatRate != null && (
                        <div>
                          <span className="text-xs text-muted-foreground block">MWST</span>
                          <span className="font-medium">{meta.vatRate}%</span>
                        </div>
                      )}
                    </div>
                    {meta.description && (
                      <p className="text-xs text-muted-foreground mt-2">{meta.description}</p>
                    )}
                  </div>
                )}
                {/* Document preview */}
                <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden bg-white">
                  {previewDoc.mimeType === "application/pdf" ? (
                    <iframe
                      src={previewDoc.s3Url}
                      className="w-full h-full min-h-[500px]"
                      title="Rechnungsvorschau"
                    />
                  ) : previewDoc.mimeType?.startsWith("image/") ? (
                    <img
                      src={previewDoc.s3Url}
                      alt={previewDoc.filename}
                      className="max-w-full max-h-[500px] object-contain mx-auto p-4"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-3 opacity-30" />
                      <p>Vorschau nicht verfügbar</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            {previewDoc?.s3Url && (
              <a href={previewDoc.s3Url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <Eye className="h-4 w-4" /> In neuem Tab öffnen
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
