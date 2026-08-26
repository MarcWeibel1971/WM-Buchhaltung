import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Upload, Check, X, Zap, FileText, Pencil, CreditCard, RefreshCw, BookOpen, Undo2, Eye, EyeOff, ArrowLeftRight, History, Clock, Search, Plus, Trash2, Split, Banknote, Download, FileCheck, FileX, CheckCircle, Loader2 } from "lucide-react";
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
import { parseStatement, extractCAMT053AccountIban } from "../../../shared/bankParser";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { BankImportStatusTiles } from "@/components/BankImportStatusTiles";
import { BankImportFiscalYearNotice, BankImportFiscalYearSelect } from "@/components/BankImportFiscalYearControls";
import { BankImportFilterBar } from "@/components/BankImportFilterBar";
import { BankImportSortIcon } from "@/components/BankImportSortIcon";
import { BankImportDocumentPreviewDialog } from "@/components/BankImportDocumentPreviewDialog";
import { BankImportDeleteConfirmDialog } from "@/components/BankImportDeleteConfirmDialog";
import { BankImportCreditCardDialog } from "@/components/BankImportCreditCardDialog";
import { BankImportTransactionEditDialog } from "@/components/BankImportTransactionEditDialog";
import { BankImportSingleBookingFields } from "@/components/BankImportSingleBookingFields";
import { BankImportCollectiveBookingLines } from "@/components/BankImportCollectiveBookingLines";
import { BankImportCollectiveBookingPreview } from "@/components/BankImportCollectiveBookingPreview";
import { BankImportMatchedDocumentInfo } from "@/components/BankImportMatchedDocumentInfo";
import { BankImportAiReasoning } from "@/components/BankImportAiReasoning";
import { BankImportTransactionBasics } from "@/components/BankImportTransactionBasics";
import { BankImportBookingModeToggle } from "@/components/BankImportBookingModeToggle";
import { BankImportCollectiveBankAccountLine } from "@/components/BankImportCollectiveBankAccountLine";
import { BankImportTransactionActionBar } from "@/components/BankImportTransactionActionBar";
import { formatCHF } from "@/lib/formatters";

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
  // Read tab/action from URL query params. `action=bank-import` is kept as a
  // backwards-compatible deep-link used by Dashboard and external shortcuts.
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get("tab");
  const urlAction = urlParams.get("action");
  const getInitialStatusFilter = (): "pending" | "matched" | "all" => {
    if (urlTab === "unmatched") return "pending";
    if (urlTab === "matched") return "matched";
    return "pending";
  };
  
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [pendingFilter, setPendingFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<"pending" | "matched" | "all">(getInitialStatusFilter);
  const [showImportSection, setShowImportSection] = useState(urlTab === "import" || urlAction === "bank-import");
  const [showAccountsSection, setShowAccountsSection] = useState(urlTab === "accounts");
  
  // Update filters when URL changes (sidebar navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newTab = params.get("tab");
    const newAction = params.get("action");
    if (newTab === "unmatched") setStatusFilter("pending");
    else if (newTab === "matched") setStatusFilter("matched");
    else if (newTab === "import" || newAction === "bank-import") setShowImportSection(true);
    else if (newTab === "accounts") setShowAccountsSection(true);
  }, [urlTab, urlAction]);
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
  const SortIcon = ({ col }: { col: string }) => <BankImportSortIcon column={col} activeColumn={sortCol} direction={sortDir} />;

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

  const { fiscalYear, setFiscalYear, fiscalYears, fiscalYearInfos, isCurrentYearOpen } = useFiscalYear();
  const { data: importAutomation } = trpc.importAutomation.get.useQuery();
  const { data: bankAccounts } = trpc.bankImport.getBankAccounts.useQuery();
  // Always filter by selected fiscal year (consistent across all views)
  const txFiscalYear = fiscalYear || undefined;
  const { data: transactions, refetch: refetchTxs } = trpc.bankImport.getTransactionsByStatus.useQuery(
    { status: statusFilter, bankAccountId: pendingFilter, fiscalYear: txFiscalYear }
  );
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: allDocs } = trpc.documents.list.useQuery({ limit: 500 });

  // Import history for selected bank account
  const { data: lastImport } = trpc.bankImport.getLastImport.useQuery(
    { bankAccountId: selectedBankAccountId! },
    { enabled: !!selectedBankAccountId }
  );
  const { data: importHistoryList, refetch: refetchHistory } = trpc.bankImport.getImportHistory.useQuery(
    { bankAccountId: selectedBankAccountId ?? undefined }
  );
  const [showHistory, setShowHistory] = useState(false);
  const [deleteImportConfirm, setDeleteImportConfirm] = useState<{ batchId: string; filename: string; count: number } | null>(null);

  const deleteImportMutation = trpc.bankImport.deleteImport.useMutation({
    onSuccess: (data) => {
      toast.success(`Import rükgängig gemacht: ${data.deleted} Transaktionen gelöscht`);
      refetchTxs();
      refetchHistory();
      setDeleteImportConfirm(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteImportConfirm(null);
    },
  });

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
      if (data.imported > 0) {
        // Run configured auto-actions sequentially after import
        const cfg = importAutomation ?? {
          autoRefreshLearned: true,
          autoKiCategorize: true,
          autoGenerateBookingTexts: true,
          autoDetectTransfers: true,
          autoMatchDocuments: false,
        };
        // 1. Refresh learned rules first (highest confidence)
        if (cfg.autoRefreshLearned) {
          refreshMutation.mutate({ bankAccountId: undefined });
        }
        // 2. KI categorization for remaining uncategorized
        if (cfg.autoKiCategorize) {
          setTimeout(() => categorizeMutation.mutate({ transactionIds: [] }), cfg.autoRefreshLearned ? 2000 : 0);
        }
        // 3. Generate booking texts
        if (cfg.autoGenerateBookingTexts) {
          setTimeout(() => bookingTextMutation.mutate({ transactionIds: [] }), (cfg.autoRefreshLearned ? 2000 : 0) + (cfg.autoKiCategorize ? 4000 : 0));
        }
        // 4. Detect transfers
        if (cfg.autoDetectTransfers) {
          setTimeout(() => detectTransfersMutation.mutate(), (cfg.autoRefreshLearned ? 2000 : 0) + (cfg.autoKiCategorize ? 4000 : 0) + (cfg.autoGenerateBookingTexts ? 2000 : 0));
        }
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
    // IBAN validation for CAMT.053 files
    if (ext === "xml") {
      const fileIban = extractCAMT053AccountIban(content);
      if (fileIban) {
        // Find the selected bank account's IBAN (bankAccounts has shape {bankAccount, account}[])
        const selectedAcct = bankAccounts?.find((a: any) => a.bankAccount?.id === selectedBankAccountId);
        if (selectedAcct?.bankAccount?.iban) {
          const normalize = (s: string) => s.replace(/\s/g, '').toUpperCase();
          if (normalize(fileIban) !== normalize(selectedAcct.bankAccount.iban)) {
            toast.error(
              `IBAN-Konflikt: Die Datei gehört zu Konto ${fileIban}, aber ausgewählt ist ${normalize(selectedAcct.bankAccount.iban)}. Bitte das richtige Bankkonto auswählen.`,
              { duration: 8000 }
            );
            setImporting(false);
            return;
          }
        }
      }
    }
    // Check fiscal year from first transaction date
    const firstDate = parsed[0]?.transactionDate;
    if (firstDate) {
      const txYear = parseInt(String(firstDate).substring(0, 4), 10);
      if (!isNaN(txYear)) {
        const yearInfo = fiscalYearInfos.find(fy => fy.year === txYear);
        if (!yearInfo) {
          toast.error(`Kein Geschäftsjahr ${txYear} vorhanden. Bitte zuerst unter Abschluss → Jahresabschluss das Geschäftsjahr ${txYear} eröffnen.`);
          setImporting(false);
          return;
        }
        if (yearInfo.isClosed) {
          toast.error(`Das Geschäftsjahr ${txYear} ist geschlossen. Import nicht möglich.`);
          setImporting(false);
          return;
        }
        // Switch to the correct fiscal year
        if (txYear !== fiscalYear) {
          setFiscalYear(txYear);
          toast.info(`Geschäftsjahr auf ${txYear} gewechselt`);
        }
      }
    }
    importMutation.mutate({ bankAccountId: selectedBankAccountId, transactions: parsed, filename: file.name, fileType });
  }, [selectedBankAccountId, importMutation, fiscalYear, fiscalYearInfos, setFiscalYear]);

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
      // Check fiscal year from first transaction date in PDF
      const firstPdfDate = result.transactions[0]?.transactionDate;
      if (firstPdfDate) {
        const txYear = parseInt(String(firstPdfDate).substring(0, 4), 10);
        if (!isNaN(txYear)) {
          const yearInfo = fiscalYearInfos.find(fy => fy.year === txYear);
          if (!yearInfo) {
            toast.error(`Kein Geschäftsjahr ${txYear} vorhanden. Bitte zuerst unter Abschluss → Jahresabschluss das Geschäftsjahr ${txYear} eröffnen.`);
            return;
          }
          if (yearInfo.isClosed) {
            toast.error(`Das Geschäftsjahr ${txYear} ist geschlossen. Import nicht möglich.`);
            return;
          }
          if (txYear !== fiscalYear) {
            setFiscalYear(txYear);
            toast.info(`Geschäftsjahr auf ${txYear} gewechselt`);
          }
        }
      }
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

      <BankImportFiscalYearNotice fiscalYear={fiscalYear} isCurrentYearOpen={isCurrentYearOpen} />

      <BankImportStatusTiles
        stats={txStats}
        activeStatus={statusFilter}
        onSelect={(status) => { setStatusFilter(status as typeof statusFilter); setSelectedTxIds(new Set()); }}
      />

      {/* Import section */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Kontoauszug importieren</h3>
          <BankImportFiscalYearSelect fiscalYear={fiscalYear} fiscalYearInfos={fiscalYearInfos ?? []} onSelect={setFiscalYear} />
        </div>
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
                      <th className="text-center py-1 font-medium">Aktion</th>
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
                        <td className="py-1.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Import rükgängig machen"
                            onClick={() => setDeleteImportConfirm({
                              batchId: h.importBatchId,
                              filename: h.filename,
                              count: h.transactionsImported,
                            })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
        <BankImportFilterBar
          statusFilter={statusFilter}
          transactionCount={transactions?.length ?? 0}
          bankAccountId={pendingFilter}
          bankAccounts={bankAccounts}
          pendingTransactionIds={pendingIds}
          allPendingTransactionIds={allPendingIds}
          selectedCount={selectedTxIds.size}
          readyToApproveCount={readyToApprove.length}
          snapshot={currentSnapshot}
          isCategorizing={categorizeMutation.isPending}
          isGeneratingBookingTexts={bookingTextMutation.isPending}
          isRefreshingSuggestions={refreshMutation.isPending}
          isDetectingTransfers={detectTransfersMutation.isPending}
          isRestoringSnapshot={restoreSnapshotMutation.isPending}
          isApprovingBulk={bulkApproveMutation.isPending}
          onStatusChange={(status) => { setStatusFilter(status); setSelectedTxIds(new Set()); }}
          onBankAccountChange={setPendingFilter}
          onCategorize={() => withSnapshot("KI kategorisieren", () => categorizeMutation.mutate({ transactionIds: pendingIds }))}
          onGenerateBookingTexts={() => withSnapshot("Buchungstexte generieren", () => bookingTextMutation.mutate({ transactionIds: allPendingIds }))}
          onRefreshSuggestions={() => withSnapshot("Refresh (gelernt)", () => refreshMutation.mutate({ bankAccountId: pendingFilter }))}
          onDetectTransfers={() => withSnapshot("Kontoüberträge erkennen", () => detectTransfersMutation.mutate())}
          onRestoreSnapshot={() => {
            if (currentSnapshot && confirm(`"${currentSnapshot.actionName}" rückgängig machen? (${currentSnapshot.transactionCount} Transaktionen werden wiederhergestellt)`)) {
              restoreSnapshotMutation.mutate();
            }
          }}
          onBulkApprove={handleBulkApprove}
          onOpenCreditorPayments={() => { window.location.href = "/zahlungen/kreditoren"; }}
        />

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
                            {!isTransfer && (
                              <Button size="sm" variant="default" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                                title={debitAcc && creditAcc ? "Verbuchen" : "Konten prüfen und verbuchen"}
                                onClick={() => openEditDialog(tx)}>
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
      <BankImportTransactionEditDialog open={!!editTx} editMode={editMode} onClose={() => { setEditTx(null); setEditMode("single"); }}>
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
              <BankImportBookingModeToggle mode={editMode} difference={collectiveDiff} balanced={collectiveBalanced} onModeChange={setEditMode} />

              <BankImportTransactionBasics transactionDate={editTx.transactionDate} amount={editTx.amount} description={editForm.description} onDescriptionChange={(description) => setEditForm((current) => ({ ...current, description }))} />

              {editMode === "single" ? (
                /* ─── Single booking mode ─── */
                <BankImportSingleBookingFields form={editForm} accounts={accounts} onChange={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))} />
              ) : (
                /* ─── Collective booking mode ─── */
                <>
                  <BankImportCollectiveBankAccountLine isIncoming={isIncoming} bankAccountLabel={bankAccountLabel} amount={txAmount} />

                  {/* Counter lines */}
                  <BankImportCollectiveBookingLines
                    lines={collectiveLines}
                    accounts={accounts}
                    isIncoming={isIncoming}
                    onChange={(index, patch) => setCollectiveLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))}
                    onAdd={() => setCollectiveLines((previous) => [...previous, { accountId: "", amount: "", description: "", vatRate: "" }])}
                    onRemove={(index) => setCollectiveLines((previous) => previous.filter((_, lineIndex) => lineIndex !== index))}
                  />

                  <BankImportCollectiveBookingPreview lines={collectiveLines} accounts={accounts} bankAccountLabel={bankAccountLabel} description={editForm.description} isIncoming={isIncoming} txAmount={txAmount} />
                </>
              )}

              {editMode === "single" && <BankImportAiReasoning reasoning={editTx.aiReasoning} />}
              <BankImportMatchedDocumentInfo transaction={editTx} documents={allDocs} isCreditCardTransaction={isCreditCardTx} onLaunchCreditCard={(documentUrl) => {
                const transactionAmount = Math.abs(parseFloat(editTx.amount)).toFixed(2);
                const statementDate = editTx.transactionDate ? new Date(editTx.transactionDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
                setCcDialog({ txId: editTx.id, counterparty: editTx.counterparty ?? "Kreditkarte", txAmount: transactionAmount, statementDate, matchedDocUrl: documentUrl });
                setCcItems([]);
                setCcPaidAmount(transactionAmount);
                setEditTx(null);
              }} />
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
          <BankImportTransactionActionBar>
            <Button variant="outline" onClick={() => { setEditTx(null); setEditMode("single"); }}>Abbrechen</Button>
            {editMode === "single" ? (
              <>
                <Button variant="outline" onClick={saveEdit} disabled={updateTxMutation.isPending}>
                  {updateTxMutation.isPending ? "Speichern..." : "Speichern"}
                </Button>
                {editTx && (() => {
                  const debitId = editForm.debitAccountId ? parseInt(editForm.debitAccountId) : null;
                  const creditId = editForm.creditAccountId ? parseInt(editForm.creditAccountId) : null;
                  const canApprove = !!(debitId && creditId);
                  return (
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={!canApprove || approveMutation.isPending || updateTxMutation.isPending}
                      title={canApprove ? "Speichern und verbuchen" : "Soll- und Haben-Konto müssen ausgefüllt sein"}
                      onClick={() => {
                        if (!editTx || !debitId || !creditId) return;
                        updateTxMutation.mutate({
                          transactionId: editTx.id,
                          description: editForm.description || undefined,
                          counterparty: editForm.counterparty || undefined,
                          counterpartyIban: editForm.counterpartyIban || undefined,
                          reference: editForm.reference || undefined,
                          suggestedDebitAccountId: debitId,
                          suggestedCreditAccountId: creditId,
                        }, {
                          onSuccess: () => {
                            approveMutation.mutate({
                              transactionId: editTx.id,
                              debitAccountId: debitId,
                              creditAccountId: creditId,
                              description: editForm.description || editTx.description || undefined,
                            });
                          },
                        });
                      }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      {approveMutation.isPending ? "Verbuchen..." : "Verbuchen"}
                    </Button>
                  );
                })()}
              </>
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
          </BankImportTransactionActionBar>
      </BankImportTransactionEditDialog>

      <BankImportCreditCardDialog
        dialog={ccDialog}
        items={ccItems}
        paidAmount={ccPaidAmount}
        parsing={ccParsing}
        accounts={accounts}
        isSubmitting={approveCcFromBankImportMutation.isPending}
        onClose={() => { setCcDialog(null); setCcItems([]); setCcPaidAmount(""); }}
        onPdfUpload={handleCcPdfUpload}
        onPaidAmountChange={setCcPaidAmount}
        onItemAccountChange={(index, debitAccountId) => {
          setCcItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, debitAccountId } : item));
        }}
        onSubmit={() => {
          if (!ccDialog) return;
          approveCcFromBankImportMutation.mutate({
            bankTransactionId: ccDialog.txId,
            statementId: ccDialog.ccStatementId,
            statementDate: ccDialog.statementDate,
            counterparty: ccDialog.counterparty,
            paidAmount: ccPaidAmount || ccDialog.txAmount,
            items: ccItems.map((item) => ({
              date: item.date,
              description: item.description,
              amount: item.amount,
              debitAccountId: parseInt(item.debitAccountId),
            })),
          });
        }}
      />

      {/* ─── Invoice Preview Dialog ─── */}
      {false && <Dialog open={!!previewDoc} onOpenChange={open => { if (!open) setPreviewDoc(null); }}>
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
      </Dialog>}
      <BankImportDocumentPreviewDialog document={previewDoc} onClose={() => setPreviewDoc(null)} />

      {/* Delete Import Confirmation Dialog */}
      {false && <Dialog open={!!deleteImportConfirm} onOpenChange={(open) => { if (!open) setDeleteImportConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Import rükgängig machen?</DialogTitle>
            <DialogDescription>
              Alle <strong>{deleteImportConfirm?.count ?? 0} Transaktionen</strong> aus dem Import
              <br /><span className="font-medium text-foreground">{deleteImportConfirm?.filename}</span><br />
              werden unwiderruflich gelöscht. Bereits verbuchte Transaktionen können nicht gelöscht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteImportConfirm(null)}>Abbrechen</Button>
            <Button
              variant="destructive"
              disabled={deleteImportMutation.isPending}
              onClick={() => {
                if (deleteImportConfirm) {
                  deleteImportMutation.mutate({ importBatchId: deleteImportConfirm.batchId });
                }
              }}
            >
              {deleteImportMutation.isPending ? "Lösche..." : "Import löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
      <BankImportDeleteConfirmDialog item={deleteImportConfirm} pending={deleteImportMutation.isPending} onClose={() => setDeleteImportConfirm(null)} onConfirm={(batchId) => deleteImportMutation.mutate({ importBatchId: batchId })} />

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
