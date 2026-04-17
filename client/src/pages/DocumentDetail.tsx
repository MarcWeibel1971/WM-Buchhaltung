import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Save, RefreshCw, Loader2, FileText, Building2,
  CreditCard, Receipt, BookOpen, Banknote, CheckCircle2, AlertCircle,
  Sparkles, GraduationCap, ExternalLink, CheckSquare, ArrowRight,
  CircleDot, Clock, XCircle
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────
interface DocumentMetadata {
  documentDate?: string | null;
  dueDate?: string | null;
  invoiceNumber?: string | null;
  totalAmount?: number | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  vatRate?: number | null;
  currency?: string | null;
  counterparty?: string | null;
  counterpartyUid?: string | null;
  counterpartyVatNumber?: string | null;
  counterpartyStreet?: string | null;
  counterpartyZipCode?: string | null;
  counterpartyCity?: string | null;
  counterpartyCountry?: string | null;
  counterpartyIban?: string | null;
  qrReference?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  documentType?: string | null;
  suggestedAccount?: string | null;
  rawText?: string | null;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice_in: "Eingangsrechnung",
  invoice_out: "Ausgangsrechnung",
  receipt: "Quittung",
  bank_statement: "Kontoauszug",
  credit_card_statement: "KK-Abrechnung",
  other: "Sonstiges",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  qr_bill: "QR-Rechnung",
  bank_transfer: "Banküberweisung",
  cash: "Barzahlung",
  credit_card: "Kreditkarte",
  direct_debit: "Lastschrift",
};

function formatCHF(n: number | null | undefined) {
  if (n == null) return "–";
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function DocumentDetail() {
  const [, params] = useRoute("/documents/:id");
  const [, navigate] = useLocation();
  const docId = params?.id ? parseInt(params.id) : null;

  // Local editable state
  const [editedMeta, setEditedMeta] = useState<DocumentMetadata>({});
  const [editedNotes, setEditedNotes] = useState("");
  const [editedDocType, setEditedDocType] = useState("other");
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("kontakt");
  const [bookingDebitId, setBookingDebitId] = useState<number | null>(null);
  const [bookingCreditId, setBookingCreditId] = useState<number | null>(null);
  const [bookingText, setBookingText] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  // Queries
  const { data, isLoading, isError, refetch } = trpc.documents.getById.useQuery(
    { documentId: docId! },
    { enabled: !!docId, retry: false }
  );

  const accountsQuery = trpc.accounts.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Mutations
  const updateMutation = trpc.documents.updateMetadata.useMutation({
    onSuccess: () => {
      toast.success("Änderungen gespeichert");
      setIsDirty(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Approve transaction mutation (for Verbuchen tab)
  const approveMutation = trpc.bankImport.approveTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaktion erfolgreich verbucht");
      setIsBooking(false);
      refetch();
    },
    onError: (err: any) => {
      toast.error("Verbuchung fehlgeschlagen: " + err.message);
      setIsBooking(false);
    },
  });

  const reanalyzeMutation = trpc.documents.reanalyze.useMutation({
    onSuccess: (result) => {
      toast.success("Beleg wurde neu analysiert");
      if (result.metadata) {
        setEditedMeta(result.metadata);
      }
      refetch();
    },
    onError: (err) => toast.error("Analyse fehlgeschlagen: " + err.message),
  });

  // Initialize local state from server data
  useEffect(() => {
    if (data) {
      const meta = { ...(data.metadata || {}) };
      // If bookingSuggestion has an account but metadata doesn't, pre-fill it
      if (data.bookingSuggestion?.accountNumber && !meta.suggestedAccount) {
        meta.suggestedAccount = data.bookingSuggestion.accountNumber;
      }
      if (data.bookingSuggestion?.vatRate != null && meta.vatRate == null) {
        meta.vatRate = data.bookingSuggestion.vatRate;
      }
      // Fallback: If referenceNumber is empty but qrReference exists, use qrReference
      if (!meta.referenceNumber && meta.qrReference) {
        meta.referenceNumber = meta.qrReference;
      }
      setEditedMeta(meta);
      setEditedNotes(data.document.notes || "");
      setEditedDocType(data.document.documentType || "other");
      setIsDirty(false);
      
      // Pre-fill booking fields from linked transaction
      // IMPORTANT: Use the SAME account as shown in the Kontierung tab (bookingSuggestion)
      // to ensure consistency across Kontierung-Tab, Verbuchen-Tab, and Bankimport
      if (data.linkedTransaction) {
        const tx = data.linkedTransaction;
        const amt = parseFloat(tx.amount);
        const bankAccountId = data.linkedBankAccount?.accountId || null;
        
        // Determine the expense/income account: prefer bookingSuggestion (Kontierung-Tab),
        // then fall back to editedMeta.suggestedAccount lookup, then tx suggested accounts
        let expenseAccountId: number | null = null;
        
        // 1. bookingSuggestion from Kontierung-Tab (highest priority - same as what user sees)
        if (data.bookingSuggestion?.accountId) {
          expenseAccountId = data.bookingSuggestion.accountId;
        }
        
        // 2. Fall back to transaction's suggested accounts (but NOT the bank account)
        if (!expenseAccountId) {
          const txDebit = tx.suggestedDebitAccountId;
          const txCredit = tx.suggestedCreditAccountId;
          // Pick the one that is NOT the bank account
          if (txDebit && txDebit !== bankAccountId) {
            expenseAccountId = txDebit;
          } else if (txCredit && txCredit !== bankAccountId) {
            expenseAccountId = txCredit;
          }
        }
        
        // Set Soll/Haben based on transaction direction
        if (amt < 0) {
          // Expense (Ausgabe): Soll = Aufwandkonto, Haben = Bankkonto
          setBookingDebitId(expenseAccountId);
          setBookingCreditId(bankAccountId);
        } else {
          // Income (Einnahme): Soll = Bankkonto, Haben = Ertragskonto
          setBookingDebitId(bankAccountId);
          setBookingCreditId(expenseAccountId);
        }
        
        // Booking text: prefer bookingSuggestion, then tx description
        setBookingText(data.bookingSuggestion?.bookingText || tx.suggestedBookingText || tx.description || "");
      }
    }
  }, [data]);

  // Accounts for dropdown
  const accountOptions = useMemo(() => {
    if (!accountsQuery.data) return [];
    return accountsQuery.data
      .filter((a: any) => a.isActive)
      .sort((a: any, b: any) => a.number.localeCompare(b.number))
      .map((a: any) => ({
        id: a.id,
        number: a.number,
        name: a.name,
        label: `${a.number} ${a.name}`,
      }));
  }, [accountsQuery.data]);

  // Handlers
  const updateField = (field: keyof DocumentMetadata, value: any) => {
    setEditedMeta((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!docId) return;
    updateMutation.mutate({
      documentId: docId,
      metadata: editedMeta,
      notes: editedNotes,
      documentType: editedDocType,
    });
  };

  const handleReanalyze = () => {
    if (!docId) return;
    reanalyzeMutation.mutate({ documentId: docId });
  };

  if (!docId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Ungültige Dokument-ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || (!isLoading && !data)) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <FileText className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Dokument nicht gefunden</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/documents")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { document: doc, metadata, supplier, bookingSuggestion, linkedTransaction, linkedBankAccount } = data;
  const isPdf = doc.mimeType === "application/pdf";
  const isImage = doc.mimeType.startsWith("image/");
  const hasLinkedTx = !!linkedTransaction;
  const txIsBooked = linkedTransaction?.status === "approved" || linkedTransaction?.status === "booked";
  const txAmount = linkedTransaction ? Math.abs(parseFloat(linkedTransaction.amount)) : 0;

  const handleBookTransaction = () => {
    if (!linkedTransaction || !bookingDebitId || !bookingCreditId) {
      toast.error("Bitte Soll- und Haben-Konto auswählen");
      return;
    }
    setIsBooking(true);
    approveMutation.mutate({
      transactionId: linkedTransaction.id,
      debitAccountId: bookingDebitId,
      creditAccountId: bookingCreditId,
      description: bookingText || undefined,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{doc.filename}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs">
              {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
            </Badge>
            {doc.matchStatus === "matched" || doc.matchStatus === "manual" ? (
              <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Verknüpft
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                <AlertCircle className="w-3 h-3 mr-1" />
                Offen
              </Badge>
            )}
            {bookingSuggestion && (
              <Badge className={`text-xs ${bookingSuggestion.source === 'auto_learn' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                {bookingSuggestion.source === 'auto_learn' ? (
                  <><GraduationCap className="w-3 h-3 mr-1" />Gelernt</>
                ) : (
                  <><Sparkles className="w-3 h-3 mr-1" />KI-Vorschlag</>
                )}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReanalyze}
            disabled={reanalyzeMutation.isPending}
            className="gap-1.5"
          >
            {reanalyzeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Neu analysieren
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || updateMutation.isPending}
            className="gap-1.5"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Speichern
          </Button>
        </div>
      </div>

      {/* Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Document Preview */}
        <div className="w-1/2 border-r border-border bg-muted/30 flex flex-col">
          <div className="flex-1 overflow-auto p-2">
            {isPdf ? (
              <iframe
                src={doc.s3Url}
                className="w-full h-full min-h-[70vh] rounded-lg border border-border"
                title="PDF Vorschau"
              />
            ) : isImage ? (
              <div className="flex items-center justify-center h-full">
                <img
                  src={doc.s3Url}
                  alt={doc.filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="w-16 h-16 mb-3 opacity-30" />
                <p>Vorschau nicht verfügbar</p>
                <a
                  href={doc.s3Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary mt-2 text-sm flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Datei öffnen
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right: Editable Fields */}
        <div className="w-1/2 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="w-full rounded-none border-b border-border bg-card px-4 pt-2 justify-start gap-1">
              <TabsTrigger value="kontakt" className="gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5" />
                Kontakt
              </TabsTrigger>
              <TabsTrigger value="beleg" className="gap-1.5 text-xs">
                <Receipt className="w-3.5 h-3.5" />
                Belegdetails
              </TabsTrigger>
              <TabsTrigger value="kontierung" className="gap-1.5 text-xs">
                <BookOpen className="w-3.5 h-3.5" />
                Kontierung
              </TabsTrigger>
              <TabsTrigger value="zahlung" className="gap-1.5 text-xs">
                <Banknote className="w-3.5 h-3.5" />
                Zahlung
              </TabsTrigger>
              {hasLinkedTx && (
                <TabsTrigger value="verbuchen" className="gap-1.5 text-xs">
                  <CheckSquare className="w-3.5 h-3.5" />
                  Verbuchen
                  {txIsBooked && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block" />
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* ─── Tab: Kontakt ─────────────────────────────────────── */}
            <TabsContent value="kontakt" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Kontaktdaten
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Firmenname</Label>
                    <Input
                      value={editedMeta.counterparty || ""}
                      onChange={(e) => updateField("counterparty", e.target.value)}
                      placeholder="Firmenname"
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">UID-Nummer</Label>
                      <Input
                        value={editedMeta.counterpartyUid || ""}
                        onChange={(e) => updateField("counterpartyUid", e.target.value)}
                        placeholder="CHE-123.456.789"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">MWST-Nr.</Label>
                      <Input
                        value={editedMeta.counterpartyVatNumber || ""}
                        onChange={(e) => updateField("counterpartyVatNumber", e.target.value)}
                        placeholder="MWST-Nummer"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Strasse</Label>
                    <Input
                      value={editedMeta.counterpartyStreet || ""}
                      onChange={(e) => updateField("counterpartyStreet", e.target.value)}
                      placeholder="Strasse und Hausnummer"
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">PLZ</Label>
                      <Input
                        value={editedMeta.counterpartyZipCode || ""}
                        onChange={(e) => updateField("counterpartyZipCode", e.target.value)}
                        placeholder="PLZ"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ort</Label>
                      <Input
                        value={editedMeta.counterpartyCity || ""}
                        onChange={(e) => updateField("counterpartyCity", e.target.value)}
                        placeholder="Ort"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Land</Label>
                      <Input
                        value={editedMeta.counterpartyCountry || ""}
                        onChange={(e) => updateField("counterpartyCountry", e.target.value)}
                        placeholder="Schweiz"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Linked Supplier Info */}
                {supplier && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-1">Verknüpfter Lieferant</p>
                    <p className="text-sm font-medium">{supplier.name}</p>
                    {supplier.street && (
                      <p className="text-xs text-muted-foreground">
                        {supplier.street}, {supplier.zipCode} {supplier.city}
                      </p>
                    )}
                    {supplier.iban && (
                      <p className="text-xs text-muted-foreground mt-0.5">IBAN: {supplier.iban}</p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── Tab: Belegdetails ────────────────────────────────── */}
            <TabsContent value="beleg" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  Belegdetails
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Dokumenttyp</Label>
                    <Select
                      value={editedDocType}
                      onValueChange={(val) => {
                        setEditedDocType(val);
                        setIsDirty(true);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Belegnummer</Label>
                      <Input
                        value={editedMeta.invoiceNumber || ""}
                        onChange={(e) => updateField("invoiceNumber", e.target.value)}
                        placeholder="Rechnungs-/Belegnummer"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Referenznummer</Label>
                      <Input
                        value={editedMeta.referenceNumber || ""}
                        onChange={(e) => updateField("referenceNumber", e.target.value)}
                        placeholder="Referenznummer"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Belegdatum</Label>
                      <Input
                        type="date"
                        value={editedMeta.documentDate || ""}
                        onChange={(e) => updateField("documentDate", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fälligkeitsdatum</Label>
                      <Input
                        type="date"
                        value={editedMeta.dueDate || ""}
                        onChange={(e) => updateField("dueDate", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                    <Input
                      value={editedMeta.description || ""}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="Kurzbeschreibung"
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nettobetrag</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedMeta.netAmount ?? ""}
                        onChange={(e) => updateField("netAmount", e.target.value ? Number(e.target.value) : null)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">MWST</Label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={editedMeta.vatAmount ?? ""}
                          onChange={(e) => updateField("vatAmount", e.target.value ? Number(e.target.value) : null)}
                          placeholder="0.00"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          step="0.1"
                          value={editedMeta.vatRate ?? ""}
                          onChange={(e) => updateField("vatRate", e.target.value ? Number(e.target.value) : null)}
                          placeholder="%"
                          className="w-16"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bruttobetrag</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedMeta.totalAmount ?? ""}
                        onChange={(e) => updateField("totalAmount", e.target.value ? Number(e.target.value) : null)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Währung</Label>
                    <Input
                      value={editedMeta.currency || "CHF"}
                      onChange={(e) => updateField("currency", e.target.value)}
                      placeholder="CHF"
                      className="mt-1 w-24"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Notizen</Label>
                    <Textarea
                      value={editedNotes}
                      onChange={(e) => {
                        setEditedNotes(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Zusätzliche Notizen zum Beleg..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ─── Tab: Kontierung ──────────────────────────────────── */}
            <TabsContent value="kontierung" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  Kontierung
                </h3>

                {/* Booking Suggestion */}
                {bookingSuggestion && (
                  <div className={`p-3 rounded-lg border ${
                    bookingSuggestion.source === 'auto_learn'
                      ? 'bg-blue-50 border-blue-200'
                      : bookingSuggestion.source === 'bank_import'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-purple-50 border-purple-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {bookingSuggestion.source === 'auto_learn' ? (
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                      ) : bookingSuggestion.source === 'bank_import' ? (
                        <Banknote className="w-4 h-4 text-green-600" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      )}
                      <span className={`text-xs font-semibold ${
                        bookingSuggestion.source === 'auto_learn' ? 'text-blue-700'
                        : bookingSuggestion.source === 'bank_import' ? 'text-green-700'
                        : 'text-purple-700'
                      }`}>
                        {bookingSuggestion.source === 'auto_learn'
                          ? 'Gelernte Buchungsregel (Priorität)'
                          : bookingSuggestion.source === 'bank_import'
                          ? 'Aus Bankimport übernommen'
                          : 'KI-Vorschlag'}
                      </span>
                    </div>
                    <div className="text-sm space-y-0.5">
                      {bookingSuggestion.accountNumber && (
                        <p>
                          <span className="text-muted-foreground">Konto:</span>{" "}
                          <span className="font-medium">{bookingSuggestion.accountNumber} {bookingSuggestion.accountName}</span>
                        </p>
                      )}
                      {bookingSuggestion.vatRate != null && (
                        <p>
                          <span className="text-muted-foreground">MWST:</span>{" "}
                          <span className="font-medium">{bookingSuggestion.vatRate}%</span>
                        </p>
                      )}
                      {bookingSuggestion.bookingText && (
                        <p>
                          <span className="text-muted-foreground">Buchungstext:</span>{" "}
                          <span className="font-medium">{bookingSuggestion.bookingText}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Aufwandkonto / Ertragskonto</Label>
                    <Select
                      value={editedMeta.suggestedAccount || "none"}
                      onValueChange={(val) => updateField("suggestedAccount", val === "none" ? null : val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Konto wählen..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="none">Kein Konto</SelectItem>
                        {accountOptions.map((a: any) => (
                          <SelectItem key={a.id} value={a.number}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Steuersatz</Label>
                      <Select
                        value={editedMeta.vatRate != null ? String(editedMeta.vatRate) : "none"}
                        onValueChange={(val) => updateField("vatRate", val === "none" ? null : Number(val))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="MWST-Satz" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Keine MWST</SelectItem>
                          <SelectItem value="8.1">8.1% (Normalsatz)</SelectItem>
                          <SelectItem value="2.6">2.6% (Reduziert)</SelectItem>
                          <SelectItem value="3.8">3.8% (Beherbergung)</SelectItem>
                          <SelectItem value="6.2">6.2% (Saldosteuersatz)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bruttobetrag</Label>
                      <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm font-medium">
                        {editedMeta.currency || "CHF"} {formatCHF(editedMeta.totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ─── Tab: Zahlung ─────────────────────────────────────── */}
            <TabsContent value="zahlung" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-muted-foreground" />
                  Zahlungsinformationen
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">IBAN</Label>
                    <Input
                      value={editedMeta.counterpartyIban || ""}
                      onChange={(e) => updateField("counterpartyIban", e.target.value)}
                      placeholder="CH00 0000 0000 0000 0000 0"
                      className="mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">QR-Referenz / Referenznummer</Label>
                    <Input
                      value={editedMeta.qrReference || ""}
                      onChange={(e) => updateField("qrReference", e.target.value)}
                      placeholder="QR-Referenz oder SCOR-Referenz"
                      className="mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
                    <Select
                      value={editedMeta.paymentMethod || "none"}
                      onValueChange={(val) => updateField("paymentMethod", val === "none" ? null : val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Zahlungsart wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unbekannt</SelectItem>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Betrag</Label>
                      <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm font-medium font-mono">
                        {editedMeta.currency || "CHF"} {formatCHF(editedMeta.totalAmount)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Währung</Label>
                      <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm font-medium">
                        {editedMeta.currency || "CHF"}
                      </div>
                    </div>
                  </div>

                  {/* Empfänger-Details */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Empfänger</p>
                    <div className="space-y-1 text-sm">
                      {editedMeta.counterparty && <p className="font-medium">{editedMeta.counterparty}</p>}
                      {editedMeta.counterpartyStreet && <p className="text-muted-foreground">{editedMeta.counterpartyStreet}</p>}
                      {(editedMeta.counterpartyZipCode || editedMeta.counterpartyCity) && (
                        <p className="text-muted-foreground">
                          {editedMeta.counterpartyZipCode} {editedMeta.counterpartyCity}
                        </p>
                      )}
                      {editedMeta.counterpartyCountry && editedMeta.counterpartyCountry !== "Schweiz" && (
                        <p className="text-muted-foreground">{editedMeta.counterpartyCountry}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-2">Zahlungsstatus</h3>
                {doc.matchStatus === "matched" || doc.matchStatus === "manual" ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Mit Banktransaktion verknüpft</span>
                    {doc.bankTransactionId && (
                      <Badge variant="outline" className="text-xs ml-1">
                        Txn #{doc.bankTransactionId}
                      </Badge>
                    )}
                  </div>
                ) : doc.matchStatus === "pain001" ? (
                  <div className="flex items-center gap-2 text-blue-700">
                    <CreditCard className="w-5 h-5" />
                    <span className="text-sm font-medium">In Zahlungsdatei (pain.001) enthalten</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Noch nicht bezahlt / nicht verknüpft</span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── Tab: Verbuchen ──────────────────────────────────── */}
            {hasLinkedTx && (
              <TabsContent value="verbuchen" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
                {/* Transaction Info */}
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <CircleDot className="w-4 h-4 text-muted-foreground" />
                    Verknüpfte Transaktion
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Datum</span>
                      <p className="font-medium">{formatDate(linkedTransaction!.transactionDate)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Betrag</span>
                      <p className={`font-bold ${parseFloat(linkedTransaction!.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        CHF {formatCHF(parseFloat(linkedTransaction!.amount))}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Buchungstext</span>
                      <p className="font-medium">{linkedTransaction!.description || '–'}</p>
                    </div>
                    {linkedTransaction!.counterparty && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Gegenpartei</span>
                        <p className="font-medium">{linkedTransaction!.counterparty}</p>
                      </div>
                    )}
                    {linkedBankAccount && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Bankkonto</span>
                        <p className="font-medium">{linkedBankAccount.name}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">Status</span>
                      <div className="mt-0.5">
                        {txIsBooked ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verbucht
                          </Badge>
                        ) : linkedTransaction!.status === 'pending' ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Ausstehend
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            {linkedTransaction!.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Txn-ID</span>
                      <p className="font-mono text-xs">#{linkedTransaction!.id}</p>
                    </div>
                  </div>
                </div>

                {/* Booking Form - only if not yet booked */}
                {!txIsBooked ? (
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-muted-foreground" />
                      Buchung erstellen
                    </h3>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Buchungstext</Label>
                        <Input
                          value={bookingText}
                          onChange={(e) => setBookingText(e.target.value)}
                          placeholder="Buchungstext"
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Soll-Konto</Label>
                          <Select
                            value={bookingDebitId ? String(bookingDebitId) : "none"}
                            onValueChange={(val) => setBookingDebitId(val === "none" ? null : Number(val))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Soll-Konto wählen..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="none">Kein Konto</SelectItem>
                              {accountOptions.map((a: any) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Haben-Konto</Label>
                          <Select
                            value={bookingCreditId ? String(bookingCreditId) : "none"}
                            onValueChange={(val) => setBookingCreditId(val === "none" ? null : Number(val))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Haben-Konto wählen..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="none">Kein Konto</SelectItem>
                              {accountOptions.map((a: any) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Betrag</span>
                          <span className="text-lg font-bold">CHF {formatCHF(txAmount)}</span>
                        </div>
                      </div>

                      <Button
                        onClick={handleBookTransaction}
                        disabled={isBooking || !bookingDebitId || !bookingCreditId}
                        className="w-full gap-2"
                        size="lg"
                      >
                        {isBooking ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckSquare className="w-4 h-4" />
                        )}
                        Transaktion verbuchen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-800">Erfolgreich verbucht</p>
                        <p className="text-sm text-green-600">
                          Journal-Eintrag #{linkedTransaction!.journalEntryId}
                        </p>
                        <p className="text-sm text-green-600 mt-0.5">
                          Betrag: CHF {formatCHF(txAmount)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1.5"
                      onClick={() => navigate("/journal")}
                    >
                      <ArrowRight className="w-4 h-4" />
                      Im Journal anzeigen
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
