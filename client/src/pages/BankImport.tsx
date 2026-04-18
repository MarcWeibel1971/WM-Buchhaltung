import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Upload, Check, X, Zap, FileText, Pencil, CreditCard, RefreshCw, BookOpen, Undo2, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight, History, Clock, Search, Plus, Trash2, Split, Banknote, Download, FileCheck, FileX, CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DocumentUpload, DocumentList } from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { parseStatement } from "../../../shared/bankParser";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

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
  // Read tab from URL query params (sidebar sub-items use ?tab=...)
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  const getInitialStatusFilter = (): "pending" | "matched" | "all" => {
    if (urlTab === "unmatched") return "pending";
    if (urlTab === "matched") return "matched";
    return "pending";
  };
  
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [pendingFilter, setPendingFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<"pending" | "matched" | "all">(getInitialStatusFilter);
  const [showImportSection, setShowImportSection] = useState(urlTab === "import");
  const [showAccountsSection, setShowAccountsSection] = useState(urlTab === "accounts");
  
  // Update filters when URL changes (sidebar navigation)
  useEffect(() => {
    const newTab = new URLSearchParams(window.location.search).get("tab");
    if (newTab === "unmatched") setStatusFilter("pending");
    else if (newTab === "matched") setStatusFilter("matched");
    else if (newTab === "import") setShowImportSection(true);
    else if (newTab === "accounts") setShowAccountsSection(true);
  }, [urlTab]);
  // showCreditorExport removed – now at /zahlungen/kreditoren
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const ccPdfInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);

  // Selection state for bulk operations
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());

  // Edit dialog state
  const [editTx, setEditTx] = useState<EditableTx | null>(null);
  const [editMode, setEditMode] = useState<"single" | "collective">("single");
  const [editForm, setEditForm] = useState<{
    description: string;
    counterparty: string;
    counterpartyIban: string;
    reference: string;
    debitAccountId: string;
    creditAccountId: string;
  }>({ description: "", counterparty: "", counterpartyIban: "", reference: "", debitAccountId: "", creditAccountId: "" });

  // Sammelbuchung lines for collective mode
  const [collectiveLines, setCollectiveLines] = useState<Array<{
    accountId: string;
    amount: string;
    description: string;
    vatRate: string;
  }>>([{ accountId: "", amount: "", description: "", vatRate: "" }, { accountId: "", amount: "", description: "", vatRate: "" }]);

  // Invoice preview dialog state
  const [previewDoc, setPreviewDoc] = useState<any>(null);



  // Sort state for bank transactions table
  const [sortCol, setSortCol] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (col: string) => {
    if (sortCol === col) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setSortCol(col); setSortDir(col === "amount" ? "desc" : "asc"); }
  };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Credit card dialog state
  const [ccDialog, setCcDialog] = useState<{ txId: number; counterparty: string; txAmount: string; statementDate: string; ccStatementId?: number; matchedDocUrl?: string } | null>(null);
  const [ccParsing, setCcParsing] = useState(false);
  const [ccItems, setCcItems] = useState<Array<{ date: string; description: string; amount: string; debitAccountId: string }>>([])
  const [ccPaidAmount, setCcPaidAmount] = useState<string>("");

  // Auto-parse matched document when CC dialog opens with a pre-linked document
  useEffect(() => {
    if (ccDialog?.matchedDocUrl && ccItems.length === 0 && !parsePdfMutation.isPending) {
      toast.info("Kreditkartenabrechnung wird von KI analysiert...");
      parsePdfMutation.mutate({ documentUrl: ccDialog.matchedDocUrl });
    }
  }, [ccDialog?.matchedDocUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const { fiscalYear } = useFiscalYear();
  const { data: bankAccounts } = trpc.bankImport.getBankAccounts.useQuery();
  const { data: transactions, refetch: refetchTxs } = trpc.bankImport.getTransactionsByStatus.useQuery(
    { status: statusFilter, bankAccountId: pendingFilter, fiscalYear: fiscalYear || undefined }
  );
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: allDocs } = trpc.documents.list.useQuery({ limit: 500 });

  // Import history for selected bank account
  const { data: lastImport } = trpc.bankImport.getLastImport.useQuery(
    { bankAccountId: selectedBankAccountId! },
    { enabled: !!selectedBankAccountId }
  );
  const { data: importHistoryList } = trpc.bankImport.getImportHistory.useQuery(
    { bankAccountId: selectedBankAccountId ?? undefined }
  );
  const [showHistory, setShowHistory] = useState(false);

  const utils = trpc.useUtils();

  const detectTransfersMutation = trpc.bankImport.detectTransfers.useMutation({
    onSuccess: (data) => {
      if (data.found === 0) toast.info("Keine neuen Kontoüberträge erkannt");
      else toast.success(`${data.found} Kontoüberträge erkannt und markiert`);
      refetchTxs();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const importMutation = trpc.bankImport.importTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} Transaktionen importiert, ${data.duplicates} Duplikate übersprungen`);
      refetchTxs();
      setImporting(false);
      // Auto-detect transfers after import
      if (data.imported > 0) {
        detectTransfersMutation.mutate();
      }
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

  const collectiveApproveMutation = trpc.bankImport.approveCollectiveTransaction.useMutation({
    onSuccess: () => {
      toast.success("Sammelbuchung verbucht");
      setEditTx(null);
      setEditMode("single");
      refetchTxs();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const refreshMutation = trpc.bankImport.refreshSuggestions.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchTxs();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Undo/Snapshot mutations ──
  const { data: currentSnapshot, refetch: refetchSnapshot } = trpc.bankImport.getSnapshot.useQuery();
  const createSnapshotMutation = trpc.bankImport.createSnapshot.useMutation();
  const restoreSnapshotMutation = trpc.bankImport.restoreSnapshot.useMutation({
    onSuccess: (data) => {
      toast.success(`"${data.actionName}" rückgängig gemacht (${data.restored} Transaktionen wiederhergestellt)`);
      refetchTxs();
      refetchSnapshot();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const clearSnapshotMutation = trpc.bankImport.clearSnapshot.useMutation({
    onSuccess: () => refetchSnapshot(),
  });

  // Helper: wrap a bulk action with snapshot creation
  const withSnapshot = async (actionName: string, action: () => void) => {
    try {
      await createSnapshotMutation.mutateAsync({ actionName });
      await refetchSnapshot();
    } catch (e) {
      console.error("Snapshot failed", e);
    }
    action();
  };

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

  const handleFileUpload = useCallback(async (file: File) => {
    if (!selectedBankAccountId) { toast.error("Bitte zuerst ein Bankkonto auswählen"); return; }
    setImporting(true);
    const content = await file.text();
    const parsed = parseStatement(content, file.name);
    if (!parsed.length) { toast.error("Keine Transaktionen erkannt. Bitte CAMT.053, MT940 oder CSV hochladen."); setImporting(false); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "unknown";
    const fileType = ext === "xml" ? "CAMT.053" : ext === "sta" || ext === "mt940" ? "MT940" : ext === "csv" || ext === "txt" ? "CSV" : ext;
    importMutation.mutate({ bankAccountId: selectedBankAccountId, transactions: parsed, filename: file.name, fileType });
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
      importMutation.mutate({
        bankAccountId: selectedBankAccountId,
        transactions: result.transactions,
        importBatchId: `pdf-${Date.now()}`,
        filename: file.name,
        fileType: "PDF",
        s3Key: result.fileKey ?? undefined,
        s3Url: result.fileUrl ?? undefined,
      });
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

  // Sorted transactions
  const sortedTransactions = useMemo(() => {
    if (!transactions?.length) return transactions ?? [];
    const arr = [...transactions];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortCol) {
        case "date": {
          const da = a.transactionDate ? new Date(a.transactionDate as string).getTime() : 0;
          const db = b.transactionDate ? new Date(b.transactionDate as string).getTime() : 0;
          return (da - db) * dir;
        }
        case "description":
          return ((a.description ?? "").localeCompare(b.description ?? "", "de")) * dir;
        case "counterparty":
          return ((a.counterparty ?? "").localeCompare(b.counterparty ?? "", "de")) * dir;
        case "debit": {
          const accA = accounts?.find(ac => ac.id === a.suggestedDebitAccountId);
          const accB = accounts?.find(ac => ac.id === b.suggestedDebitAccountId);
          return ((accA?.number ?? "9999").localeCompare(accB?.number ?? "9999")) * dir;
        }
        case "credit": {
          const accA = accounts?.find(ac => ac.id === a.suggestedCreditAccountId);
          const accB = accounts?.find(ac => ac.id === b.suggestedCreditAccountId);
          return ((accA?.number ?? "9999").localeCompare(accB?.number ?? "9999")) * dir;
        }
        case "amount":
          return (parseFloat(a.amount as string) - parseFloat(b.amount as string)) * dir;
        case "status": {
          const order: Record<string, number> = { pending: 0, matched: 1, ignored: 2 };
          return ((order[a.status ?? ""] ?? 3) - (order[b.status ?? ""] ?? 3)) * dir;
        }
        default: return 0;
      }
    });
    // Combine transfer pairs: hide the partner transaction, show as one combined row
    const seenPartnerIds = new Set<number>();
    const combined = arr.filter(tx => {
      const isTransfer = (tx as any).isTransfer === true || (tx as any).isTransfer === 1;
      if (!isTransfer || !(tx as any).transferPartnerId) return true;
      // If this tx's partner was already shown, hide this one
      if (seenPartnerIds.has(tx.id)) return false;
      // Mark the partner as seen so it gets hidden
      seenPartnerIds.add((tx as any).transferPartnerId);
      return true;
    });
    return combined;
  }, [transactions, sortCol, sortDir, accounts]);

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
    setEditMode("single");
    setEditForm({
      description: tx.description ?? "",
      counterparty: tx.counterparty ?? "",
      counterpartyIban: tx.counterpartyIban ?? "",
      reference: tx.reference ?? "",
      debitAccountId: tx.suggestedDebitAccountId ? String(tx.suggestedDebitAccountId) : "",
      creditAccountId: tx.suggestedCreditAccountId ? String(tx.suggestedCreditAccountId) : "",
    });
    setCollectiveLines([{ accountId: "", amount: "", description: "", vatRate: "" }, { accountId: "", amount: "", description: "", vatRate: "" }]);
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

  // Stats for filter tiles
  const { data: allTransactions } = trpc.bankImport.getTransactionsByStatus.useQuery(
    { status: "all", bankAccountId: undefined, fiscalYear: fiscalYear || undefined }
  );
  const txStats = {
    total: (allTransactions ?? []).length,
    pending: (allTransactions ?? []).filter(tx => tx.status === "pending").length,
    matched: (allTransactions ?? []).filter(tx => tx.status === "matched").length,
    ignored: (allTransactions ?? []).filter(tx => tx.status === "ignored").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Bankimport</h2>
        <p className="text-sm text-muted-foreground">CAMT.053, MT940, CSV oder PDF importieren</p>
      </div>

      {/* Filter-Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "all",     label: "Alle Transaktionen", count: txStats.total,   accent: "from-slate-500 to-slate-600",  light: "bg-slate-50 border-slate-200 text-slate-700",  icon: <ArrowLeftRight className="w-5 h-5" /> },
          { key: "pending", label: "Ausstehend",          count: txStats.pending, accent: "from-amber-500 to-orange-500", light: "bg-amber-50 border-amber-200 text-amber-700",  icon: <Clock className="w-5 h-5" /> },
          { key: "matched", label: "Verbucht",             count: txStats.matched, accent: "from-green-500 to-emerald-600",light: "bg-green-50 border-green-200 text-green-700",  icon: <CheckCircle className="w-5 h-5" /> },
          { key: "ignored", label: "Ignoriert",            count: txStats.ignored, accent: "from-gray-400 to-gray-500",   light: "bg-gray-50 border-gray-200 text-gray-600",    icon: <EyeOff className="w-5 h-5" /> },
        ].map(tile => {
          const isActive = statusFilter === tile.key;
          return (
            <button
              key={tile.key}
              onClick={() => { setStatusFilter(tile.key as any); setSelectedTxIds(new Set()); }}
              className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                isActive
                  ? `bg-gradient-to-br ${tile.accent} text-white border-transparent shadow-lg scale-[1.02]`
                  : `${tile.light} border-transparent hover:border-current hover:shadow-md`
              }`}
            >
              <div className={`mb-2 p-2 rounded-lg ${ isActive ? "bg-white/20" : "bg-white shadow-sm" }`}>
                <span className={isActive ? "text-white" : ""}>{tile.icon}</span>
              </div>
              <div className={`text-2xl font-bold leading-none mb-1 ${ isActive ? "text-white" : "" }`}>{tile.count}</div>
              <div className={`text-xs font-medium leading-tight ${ isActive ? "text-white/90" : "" }`}>{tile.label}</div>
            </button>
          );
        })}
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
                {bankAccounts?.length === 0 && (
                  <div className="px-3 py-4 text-sm text-center">
                    <p className="text-muted-foreground mb-2">Noch keine Bankkonten erfasst.</p>
                    <Link href="/einstellungen/bankkonten" className="text-blue-600 underline font-medium">
                      → Einstellungen → Bankkonten
                    </Link>
                  </div>
                )}
                {bankAccounts?.map(ba => (
                  <SelectItem key={ba.bankAccount.id} value={String(ba.bankAccount.id)}>
                    {ba.bankAccount.name}{ba.account ? ` (${ba.account.number})` : ""}{ba.bankAccount.iban ? ` – ${ba.bankAccount.iban}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bankAccounts?.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                Bitte zuerst ein Bankkonto unter{" "}
                <Link href="/einstellungen/bankkonten" className="underline font-medium">Einstellungen → Bankkonten</Link>{" "}
                erfassen.
              </p>
            )}
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

        {/* Import progress indicators */}
        {(importing || importingPdf || categorizeMutation.isPending || bookingTextMutation.isPending || refreshMutation.isPending || bulkApproveMutation.isPending) && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">
                {importing && "Datei wird importiert..."}
                {importingPdf && "KI liest PDF-Kontoauszug..."}
                {categorizeMutation.isPending && "KI kategorisiert Transaktionen..."}
                {bookingTextMutation.isPending && "Buchungstexte werden generiert..."}
                {refreshMutation.isPending && "Buchungsregeln werden angewendet..."}
                {bulkApproveMutation.isPending && "Transaktionen werden verbucht..."}
              </p>
              <p className="text-xs text-muted-foreground">Bitte warten, dies kann einige Sekunden dauern.</p>
            </div>
          </div>
        )}

        {/* Last import info */}
        {selectedBankAccountId && lastImport && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Letzter Import:</span>
                <span className="text-sm text-muted-foreground">
                  {lastImport.filename} ({lastImport.fileType})
                </span>
                <span className="text-xs text-muted-foreground">
                  – {new Date(lastImport.createdAt).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                  {lastImport.transactionsImported} importiert
                </span>
                {(lastImport.transactionsDuplicate ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                    {lastImport.transactionsDuplicate} Duplikate
                  </span>
                )}
                {lastImport.dateRangeFrom && lastImport.dateRangeTo && (
                  <span className="text-xs text-muted-foreground">
                    Zeitraum: {new Date(lastImport.dateRangeFrom as string).toLocaleDateString("de-CH")} – {new Date(lastImport.dateRangeTo as string).toLocaleDateString("de-CH")}
                  </span>
                )}
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setShowHistory(!showHistory)}>
                  <History className="h-3.5 w-3.5" />
                  Import-Historie
                </Button>
              </div>
            </div>

            {/* Import history table */}
            {showHistory && importHistoryList && importHistoryList.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1 font-medium">Datum</th>
                      <th className="text-left py-1 font-medium">Datei</th>
                      <th className="text-left py-1 font-medium">Typ</th>
                      <th className="text-left py-1 font-medium">Konto</th>
                      <th className="text-right py-1 font-medium">Importiert</th>
                      <th className="text-right py-1 font-medium">Duplikate</th>
                      <th className="text-left py-1 font-medium">Zeitraum</th>
                      <th className="text-center py-1 font-medium">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importHistoryList.map((h: any) => (
                      <tr key={h.id} className="border-t border-border/50">
                        <td className="py-1.5">{new Date(h.createdAt).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-1.5 font-medium">{h.filename}</td>
                        <td className="py-1.5">{h.fileType}</td>
                        <td className="py-1.5">{h.bankAccountName}</td>
                        <td className="py-1.5 text-right text-green-600">{h.transactionsImported}</td>
                        <td className="py-1.5 text-right text-yellow-600">{h.transactionsDuplicate ?? 0}</td>
                        <td className="py-1.5">
                          {h.dateRangeFrom && h.dateRangeTo
                            ? `${new Date(h.dateRangeFrom as string).toLocaleDateString("de-CH")} – ${new Date(h.dateRangeTo as string).toLocaleDateString("de-CH")}`
                            : "–"}
                        </td>
                        <td className="py-1.5 text-center">
                          {h.s3Url ? (
                            <a href={h.s3Url} target="_blank" rel="noopener noreferrer" title="PDF öffnen">
                              <Eye className="w-3.5 h-3.5 inline text-blue-500 hover:text-blue-700" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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
                onClick={() => withSnapshot("KI kategorisieren", () => categorizeMutation.mutate({ transactionIds: pendingIds }))}>
                <Zap className="h-3 w-3" />
                {categorizeMutation.isPending ? "KI läuft..." : `KI kategorisieren (${pendingIds.length})`}
              </Button>
            )}
            {isPending && allPendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                disabled={bookingTextMutation.isPending}
                onClick={() => withSnapshot("Buchungstexte generieren", () => bookingTextMutation.mutate({ transactionIds: allPendingIds }))}>
                <FileText className="h-3 w-3" />
                {bookingTextMutation.isPending ? "Texte werden generiert..." : "Buchungstexte generieren"}
              </Button>
            )}
            {isPending && allPendingIds.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                disabled={refreshMutation.isPending}
                onClick={() => withSnapshot("Refresh (gelernt)", () => refreshMutation.mutate({ bankAccountId: pendingFilter }))}>
                <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                {refreshMutation.isPending ? "Aktualisiere..." : "Refresh (gelernt)"}
              </Button>
            )}
            {isPending && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                disabled={detectTransfersMutation.isPending}
                onClick={() => withSnapshot("Kontoüberträge erkennen", () => detectTransfersMutation.mutate())}>
                <RefreshCw className={`h-3 w-3 ${detectTransfersMutation.isPending ? "animate-spin" : ""}`} />
                {detectTransfersMutation.isPending ? "Erkenne..." : "Kontoüberträge erkennen"}
              </Button>
            )}
            {/* Link to Kreditoren page */}
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => window.location.href = "/zahlungen/kreditoren"}>
              <Banknote className="h-3 w-3" />
              Kreditorenzahlungen
            </Button>
            {/* Rückgängig-Button */}
            {currentSnapshot && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
                disabled={restoreSnapshotMutation.isPending}
                onClick={() => {
                  if (confirm(`"${currentSnapshot.actionName}" rückgängig machen? (${currentSnapshot.transactionCount} Transaktionen werden wiederhergestellt)`)) {
                    restoreSnapshotMutation.mutate();
                  }
                }}>
                <Undo2 className="h-3 w-3" />
                {restoreSnapshotMutation.isPending ? "Stelle wieder her..." : `Rückgängig: ${currentSnapshot.actionName}`}
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
                <th className="cursor-pointer select-none" onClick={() => toggleSort("date")}>
                  <span className="inline-flex items-center">Datum<SortIcon col="date" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort("description")}>
                  <span className="inline-flex items-center">Buchungstext<SortIcon col="description" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort("counterparty")}>
                  <span className="inline-flex items-center">Lieferant / Kunde<SortIcon col="counterparty" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort("debit")}>
                  <span className="inline-flex items-center">Soll-Konto<SortIcon col="debit" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort("credit")}>
                  <span className="inline-flex items-center">Haben-Konto<SortIcon col="credit" /></span>
                </th>
                <th className="text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                  <span className="inline-flex items-center justify-end">Betrag CHF<SortIcon col="amount" /></span>
                </th>
                <th className="text-right cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  <span className="inline-flex items-center justify-end">Status<SortIcon col="status" /></span>
                </th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!sortedTransactions?.length ? (
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
              ) : sortedTransactions.map(tx => {
                const amount = parseFloat(tx.amount as string);
                const debitAcc = accounts?.find(a => a.id === tx.suggestedDebitAccountId);
                const creditAcc = accounts?.find(a => a.id === tx.suggestedCreditAccountId);
                const isCC = isCreditCardTx(tx);
                const isTransfer = (tx as any).isTransfer === true || (tx as any).isTransfer === 1;
                const transferPartnerBankName = (tx as any).transferPartnerBankName;
                const isSelected = selectedTxIds.has(tx.id);
                const partnerLabel = isTransfer ? "Übertrag" : (amount < 0 ? "Kreditor" : "Debitor");
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
                            (⇄ {transferPartnerBankName ?? "Kontoübertrag"})
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
                              {(tx as any).manuallyEdited && (
                                <span title="Manuell bearbeitet (wird beim Refresh übersprungen)"><Pencil className="h-3 w-3 text-blue-600" /></span>
                              )}
                            </>
                          ) : (
                            <>
                              –
                              {(tx as any).manuallyEdited && (
                                <span title="Manuell bearbeitet (wird beim Refresh übersprungen)"><Pencil className="h-3 w-3 text-blue-600" /></span>
                              )}
                            </>
                          )}
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
      <Dialog open={!!editTx} onOpenChange={open => { if (!open) { setEditTx(null); setEditMode("single"); } }}>
        <DialogContent className={editMode === "collective" ? "w-[min(98vw,60rem)] max-w-none max-h-[90vh] overflow-y-auto" : "w-[min(95vw,38rem)] max-w-none"}>
          <DialogHeader>
            <DialogTitle>Transaktion bearbeiten</DialogTitle>
            <DialogDescription>Alle Felder der Transaktion anpassen</DialogDescription>
          </DialogHeader>
          {editTx && (() => {
            const txAmount = Math.abs(parseFloat(editTx.amount));
            const isIncoming = parseFloat(editTx.amount) > 0;
            // In collective mode: compute diff
            const collectiveSum = collectiveLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
            const collectiveDiff = Math.abs(txAmount - collectiveSum);
            const collectiveBalanced = collectiveDiff < 0.005;
            // Find the bank account for this transaction
            const txBankAccount = bankAccounts?.find(ba => ba.bankAccount.id === editTx.bankAccountId);
            const bankAccountLabel = txBankAccount ? `${txBankAccount.account?.number ?? ''} ${txBankAccount.account?.name ?? txBankAccount.bankAccount.name}`.trim() : "Bankkonto";
            const bankAccountId = txBankAccount?.account?.id ?? txBankAccount?.bankAccount.accountId;

            const handleCollectiveApprove = () => {
              if (!editTx || !bankAccountId) return;
              const bankSide = isIncoming ? "debit" : "credit";
              const counterSide = isIncoming ? "credit" : "debit";
              const lines: Array<{ accountId: number; side: "debit" | "credit"; amount: string; description?: string; vatRate?: string }> = [
                { accountId: bankAccountId, side: bankSide, amount: txAmount.toFixed(2) },
              ];
              for (const cl of collectiveLines) {
                if (!cl.accountId || !cl.amount) continue;
                lines.push({
                  accountId: parseInt(cl.accountId),
                  side: counterSide,
                  amount: parseFloat(cl.amount).toFixed(2),
                  description: cl.description || undefined,
                  vatRate: cl.vatRate || undefined,
                });
              }
              collectiveApproveMutation.mutate({
                transactionId: editTx.id,
                description: editForm.description || editTx.description || "Sammelbuchung",
                lines,
              });
            };

            return (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                <Button
                  size="sm"
                  variant={editMode === "single" ? "default" : "outline"}
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditMode("single")}
                >
                  Einzelbuchung
                </Button>
                <Button
                  size="sm"
                  variant={editMode === "collective" ? "default" : "outline"}
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditMode("collective")}
                >
                  <Split className="h-3 w-3" /> Sammelbuchung
                </Button>
                {editMode === "collective" && (
                  <span className={`ml-auto text-xs font-mono font-bold ${collectiveBalanced ? "text-green-600" : "text-red-600"}`}>
                    Diff. {formatCHF(collectiveDiff)}
                  </span>
                )}
              </div>

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

              {editMode === "single" ? (
                /* ─── Single booking mode ─── */
                <>
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
                </>
              ) : (
                /* ─── Collective booking mode ─── */
                <>
                  {/* Bank account line (fixed) */}
                  <div className={`rounded-lg border-2 p-3 ${isIncoming ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700" : "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase ${isIncoming ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {isIncoming ? "SOLL (Belastung)" : "HABEN (Belastung)"}
                      </span>
                      <span className="text-xs text-muted-foreground">– Bankkonto</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium flex-1">{bankAccountLabel}</span>
                      <span className="text-sm font-mono font-bold">CHF {formatCHF(txAmount)}</span>
                    </div>
                  </div>

                  {/* Counter lines */}
                  <div className={`rounded-lg border-2 p-3 ${isIncoming ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" : "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold uppercase ${isIncoming ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`}>
                        {isIncoming ? "HABEN (Ertrag)" : "SOLL (Aufwand)"}
                      </span>
                      <span className="text-xs text-muted-foreground">– Gegenpositionen</span>
                    </div>
                    <div className="space-y-2">
                      {collectiveLines.map((line, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                          <Select value={line.accountId} onValueChange={v => {
                            const next = [...collectiveLines];
                            next[idx] = { ...next[idx], accountId: v };
                            setCollectiveLines(next);
                          }}>
                            <SelectTrigger className="h-8 text-xs flex-1 min-w-[180px]"><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                            <SelectContent>
                              {accounts?.map(a => (
                                <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8 text-xs w-[120px]"
                            placeholder="Text"
                            value={line.description}
                            onChange={e => {
                              const next = [...collectiveLines];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setCollectiveLines(next);
                            }}
                          />
                          <Input
                            className="h-8 text-xs w-[100px] font-mono text-right"
                            placeholder="Betrag"
                            value={line.amount}
                            onChange={e => {
                              const next = [...collectiveLines];
                              next[idx] = { ...next[idx], amount: e.target.value };
                              setCollectiveLines(next);
                            }}
                          />
                          <Select value={line.vatRate} onValueChange={v => {
                            const next = [...collectiveLines];
                            next[idx] = { ...next[idx], vatRate: v === "none" ? "" : v };
                            setCollectiveLines(next);
                          }}>
                            <SelectTrigger className="h-8 text-xs w-[80px]"><SelectValue placeholder="MWST" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">–</SelectItem>
                              <SelectItem value="8.1">8.1%</SelectItem>
                              <SelectItem value="2.6">2.6%</SelectItem>
                              <SelectItem value="3.8">3.8%</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                            disabled={collectiveLines.length <= 1}
                            onClick={() => setCollectiveLines(ls => ls.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs gap-1"
                      onClick={() => setCollectiveLines(ls => [...ls, { accountId: "", amount: "", description: "", vatRate: "" }])}
                    >
                      <Plus className="h-3 w-3" /> Zeile hinzufügen
                    </Button>
                  </div>

                  {/* Preview table */}
                  {collectiveLines.some(l => l.accountId && l.amount) && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium">Konto</th>
                            <th className="text-left p-2 font-medium">Text</th>
                            <th className="text-right p-2 font-medium">Soll</th>
                            <th className="text-right p-2 font-medium">Haben</th>
                            <th className="text-right p-2 font-medium">Steuer</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t">
                            <td className="p-2 font-medium">{bankAccountLabel}</td>
                            <td className="p-2 text-muted-foreground">{editForm.description || "–"}</td>
                            <td className="p-2 text-right font-mono">{isIncoming ? formatCHF(txAmount) : ""}</td>
                            <td className="p-2 text-right font-mono">{!isIncoming ? formatCHF(txAmount) : ""}</td>
                            <td className="p-2 text-right"></td>
                          </tr>
                          {collectiveLines.filter(l => l.accountId && l.amount).map((l, i) => {
                            const acc = accounts?.find(a => a.id === parseInt(l.accountId));
                            const vatAmt = l.vatRate ? (parseFloat(l.amount) * parseFloat(l.vatRate) / 100) : 0;
                            return (
                              <tr key={i} className="border-t">
                                <td className="p-2">{acc ? `${acc.number} ${acc.name}` : l.accountId}</td>
                                <td className="p-2 text-muted-foreground">{l.description || "–"}</td>
                                <td className="p-2 text-right font-mono">{!isIncoming ? formatCHF(parseFloat(l.amount)) : ""}</td>
                                <td className="p-2 text-right font-mono">{isIncoming ? formatCHF(parseFloat(l.amount)) : ""}</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{vatAmt > 0 ? formatCHF(vatAmt) : ""}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {editTx.aiReasoning && editMode === "single" && (
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
                              matchedDocUrl: matchedDoc.s3Url ?? undefined,
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
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTx(null); setEditMode("single"); }}>Abbrechen</Button>
            {editMode === "single" ? (
              <Button onClick={saveEdit} disabled={updateTxMutation.isPending}>
                {updateTxMutation.isPending ? "Speichern..." : "Speichern"}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  // First save the edit form (metadata), then approve as collective
                  if (!editTx) return;
                  const txAmount = Math.abs(parseFloat(editTx.amount));
                  const isIncoming = parseFloat(editTx.amount) > 0;
                  const txBankAccount = bankAccounts?.find(ba => ba.bankAccount.id === editTx.bankAccountId);
                  const bankAccountId = txBankAccount?.account?.id ?? txBankAccount?.bankAccount.accountId;
                  if (!bankAccountId) { toast.error("Bankkonto nicht gefunden"); return; }
                  const collectiveSum = collectiveLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
                  if (Math.abs(txAmount - collectiveSum) >= 0.005) { toast.error("Differenz muss 0 sein"); return; }
                  const bankSide: "debit" | "credit" = isIncoming ? "debit" : "credit";
                  const counterSide: "debit" | "credit" = isIncoming ? "credit" : "debit";
                  const lines: Array<{ accountId: number; side: "debit" | "credit"; amount: string; description?: string; vatRate?: string }> = [
                    { accountId: bankAccountId, side: bankSide, amount: txAmount.toFixed(2) },
                  ];
                  for (const cl of collectiveLines) {
                    if (!cl.accountId || !cl.amount) continue;
                    lines.push({
                      accountId: parseInt(cl.accountId),
                      side: counterSide,
                      amount: parseFloat(cl.amount).toFixed(2),
                      description: cl.description || undefined,
                      vatRate: cl.vatRate || undefined,
                    });
                  }
                  collectiveApproveMutation.mutate({
                    transactionId: editTx.id,
                    description: editForm.description || editTx.description || "Sammelbuchung",
                    lines,
                  });
                }}
                disabled={collectiveApproveMutation.isPending || (() => {
                  if (!editTx) return true;
                  const txAmount = Math.abs(parseFloat(editTx.amount));
                  const collectiveSum = collectiveLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
                  return Math.abs(txAmount - collectiveSum) >= 0.005 || !collectiveLines.some(l => l.accountId && l.amount);
                })()}
              >
                {collectiveApproveMutation.isPending ? "Verbuchen..." : "Sammelbuchung verbuchen"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Credit Card Statement Dialog ─── */}
      <Dialog open={!!ccDialog} onOpenChange={open => { if (!open) { setCcDialog(null); setCcItems([]); setCcPaidAmount(""); } }}>
        <DialogContent className="w-[min(98vw,72rem)] max-w-none max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ccDialog?.matchedDocUrl ? "Verbuchungsvorschlag – Kreditkartenabrechnung" : "Kreditkartenabrechnung verbuchen"}</DialogTitle>
            <DialogDescription>
              {ccDialog?.matchedDocUrl
                ? "Die verknüpfte Kreditkartenabrechnung wird automatisch analysiert. Zwei Journal-Einträge werden erstellt: (1) 1082 Durchlaufkonto / 1032 LUKB mw – effektiv bezahlter Betrag; (2) Aufwandkonten / 1082 Durchlaufkonto – Abrechnungstotal (Sammelbuchung)."
                : "PDF hochladen → KI erkennt Positionen → zwei Journal-Einträge werden erstellt: (1) 1082 Durchlaufkonto / 1032 LUKB mw – effektiv bezahlter Betrag; (2) Aufwandkonten / 1082 Durchlaufkonto – Abrechnungstotal (Sammelbuchung)."}
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

            {ccDialog?.matchedDocUrl && ccItems.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700 dark:text-blue-400">Verknüpfte Abrechnung wird automatisch analysiert...</span>
              </div>
            )}
            {!ccDialog?.matchedDocUrl && (
              <Button variant="outline" className="w-full gap-2" disabled={ccParsing}
                onClick={() => ccPdfInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {ccParsing ? "Abrechnung wird analysiert..." : "Kreditkartenabrechnung (PDF) hochladen"}
              </Button>
            )}

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
        <DialogContent className="w-[min(95vw,56rem)] max-w-none max-h-[90vh] flex flex-col">
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

// CreditorExportDialog removed – now at /zahlungen/kreditoren
// Keeping this comment for reference
function _REMOVED_CreditorExportDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: invoices, refetch: refetchInvoices } = trpc.qrBill.listUnpaidInvoices.useQuery(
    {},
    { enabled: open }
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [execDate, setExecDate] = useState("");
  const [showPaid, setShowPaid] = useState(false);

  const markPaidMut = trpc.qrBill.markInvoicePaid.useMutation({
    onSuccess: () => refetchInvoices(),
  });

  const generateMut = trpc.qrBill.generatePain001.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`pain.001 Zahlungsdatei erstellt (${data.summary.nbOfTxs} Zahlungen, CHF ${data.summary.ctrlSum})`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter invoices
  const unpaidInvoices = useMemo(() => (invoices ?? []).filter(inv => !inv.isPaid), [invoices]);
  const paidInvoices = useMemo(() => (invoices ?? []).filter(inv => inv.isPaid), [invoices]);
  const displayedInvoices = showPaid ? (invoices ?? []) : unpaidInvoices;

  // Auto-select all unpaid invoices with IBAN when dialog opens
  useEffect(() => {
    if (open && unpaidInvoices.length > 0 && selectedIds.size === 0) {
      const withIban = unpaidInvoices.filter(inv => inv.counterpartyIban);
      setSelectedIds(new Set(withIban.map(inv => inv.id)));
      // Set execution date to earliest due date
      const dueDates = withIban.filter(inv => inv.dueDate).map(inv => inv.dueDate);
      if (dueDates.length > 0) {
        dueDates.sort();
        setExecDate(dueDates[0]);
      } else {
        setExecDate(new Date().toISOString().slice(0, 10));
      }
    }
  }, [open, unpaidInvoices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setShowPaid(false);
    }
  }, [open]);

  const selectedInvoices = displayedInvoices.filter(inv => selectedIds.has(inv.id));
  const totalAmount = selectedInvoices.reduce((s, inv) => s + inv.totalAmount, 0);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(displayedInvoices.filter(inv => !inv.isPaid && inv.counterpartyIban).map(inv => inv.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>ISO 20022 Zahlungsdatei (pain.001) – Rechnungszahlungen</DialogTitle>
          <DialogDescription>
            Offene Eingangsrechnungen aus den Dokumenten. Rechnungen die bereits im Bankimport erscheinen sind als "bezahlt" markiert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex gap-2 items-center">
              <Label className="text-sm shrink-0">Ausführungsdatum:</Label>
              <Input type="date" value={execDate} onChange={e => setExecDate(e.target.value)} className="w-44" />
            </div>
            <div className="flex gap-2 items-center ml-auto">
              <Badge variant="outline" className="text-green-700 border-green-300">
                <FileCheck className="h-3 w-3 mr-1" /> {paidInvoices.length} bezahlt
              </Badge>
              <Badge variant="outline" className="text-red-700 border-red-300">
                <FileX className="h-3 w-3 mr-1" /> {unpaidInvoices.length} offen
              </Badge>
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setShowPaid(!showPaid)}>
                {showPaid ? "Nur offene" : "Alle anzeigen"}
              </Button>
            </div>
          </div>
          <div className="border rounded-lg flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left w-8">
                    <Checkbox
                      checked={displayedInvoices.filter(inv => !inv.isPaid && inv.counterpartyIban).length > 0 && displayedInvoices.filter(inv => !inv.isPaid && inv.counterpartyIban).every(inv => selectedIds.has(inv.id))}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                    />
                  </th>
                  <th className="p-2 text-left">Kreditor</th>
                  <th className="p-2 text-left">IBAN</th>
                  <th className="p-2 text-left">Rechnungsdatum</th>
                  <th className="p-2 text-left">Fällig am</th>
                  <th className="p-2 text-right">Betrag</th>
                  <th className="p-2 text-left">Referenz</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.length === 0 ? (
                  <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Keine Eingangsrechnungen gefunden</td></tr>
                ) : displayedInvoices.map(inv => {
                  const isSelected = selectedIds.has(inv.id);
                  const noIban = !inv.counterpartyIban;
                  return (
                    <tr key={inv.id} className={`border-t ${inv.isPaid ? "bg-green-50/50 dark:bg-green-950/20" : ""} ${isSelected ? "bg-blue-50 dark:bg-blue-950" : ""} ${noIban && !inv.isPaid ? "opacity-60" : ""}`}>
                      <td className="p-2">
                        <Checkbox
                          checked={isSelected}
                          disabled={inv.isPaid || noIban}
                          onCheckedChange={() => toggleSelect(inv.id)}
                        />
                      </td>
                      <td className="p-2">
                        <div className="font-medium truncate max-w-40" title={inv.counterparty}>{inv.counterparty}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-40" title={inv.filename}>{inv.filename}</div>
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {inv.counterpartyIban || <span className="text-red-500 italic">fehlt</span>}
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap">
                        {inv.documentDate ? new Date(inv.documentDate).toLocaleDateString("de-CH") : "–"}
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap">
                        {inv.dueDate ? (() => {
                          const due = new Date(inv.dueDate);
                          const isOverdue = due < new Date() && !inv.isPaid;
                          return <span className={isOverdue ? "text-red-600 font-semibold" : ""}>{due.toLocaleDateString("de-CH")}{isOverdue && " (überfällig)"}</span>;
                        })() : "–"}
                      </td>
                      <td className="p-2 text-right font-mono whitespace-nowrap">
                        {inv.totalAmount > 0 ? formatCHF(inv.totalAmount) : "–"}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground truncate max-w-28" title={inv.referenceNumber}>
                        {inv.referenceNumber || "–"}
                      </td>
                      <td className="p-2 text-center">
                        {inv.isPaid ? (
                          <div className="flex items-center justify-center gap-1">
                            <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                              <Check className="h-3 w-3 mr-0.5" /> Bezahlt
                            </Badge>
                            {inv.matchStatus === "manual" && (
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-red-600" title="Als unbezahlt markieren"
                                onClick={() => markPaidMut.mutate({ documentId: inv.id, isPaid: false })}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground hover:text-green-700" title="Als bezahlt markieren"
                            disabled={markPaidMut.isPending}
                            onClick={() => markPaidMut.mutate({ documentId: inv.id, isPaid: true })}>
                            <Check className="h-3 w-3 mr-0.5" /> Bezahlt
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{selectedInvoices.length} von {unpaidInvoices.length} offenen Rechnungen ausgewählt</span>
            <span className="font-semibold">Total: CHF {formatCHF(totalAmount)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            disabled={selectedInvoices.length === 0 || generateMut.isPending || !execDate}
            onClick={() => {
              generateMut.mutate({
                paymentType: "creditor",
                payments: selectedInvoices.map(inv => ({
                  creditorName: inv.counterparty,
                  creditorIban: inv.counterpartyIban,
                  amount: inv.totalAmount,
                  currency: inv.currency,
                  reference: inv.referenceNumber || undefined,
                  remittanceInfo: inv.referenceNumber ? `Zahlung Ref. ${inv.referenceNumber}` : `Zahlung an ${inv.counterparty}`,
                })),
                executionDate: execDate,
              });
            }}
          >
            {generateMut.isPending ? "Erstelle..." : <><Download className="h-4 w-4 mr-1" /> pain.001 exportieren</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
