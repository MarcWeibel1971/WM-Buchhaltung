import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Check, X, FileCheck, FileX, Banknote, Building2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type InvoiceRow = {
  id: number;
  filename: string;
  counterparty: string;
  counterpartyIban: string;
  referenceNumber: string;
  totalAmount: number;
  currency: string;
  documentDate: string;
  dueDate: string;
  description: string;
  isPaid: boolean;
  matchStatus: string | null;
  s3Url: string | null;
  // Editable fields for pain.001
  editCity?: string;
  editCountry?: string;
  editAddress?: string;
  editZip?: string;
};

export default function Kreditoren() {
  const { fiscalYear } = useFiscalYear();
  const { data: invoices, refetch: refetchInvoices } = trpc.qrBill.listUnpaidInvoices.useQuery({ fiscalYear });
  const { data: bankAccs } = trpc.bankImport.getBankAccounts.useQuery();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [execDate, setExecDate] = useState(new Date().toISOString().slice(0, 10));
  const [showPaid, setShowPaid] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Editable invoice data (city, country, address, zip per invoice)
  const [editData, setEditData] = useState<Record<number, { city: string; country: string; address: string; zip: string }>>({});

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
      refetchInvoices();
      setSelectedIds(new Set());
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter invoices
  const unpaidInvoices = useMemo(() => (invoices ?? []).filter(inv => !inv.isPaid), [invoices]);
  const paidInvoices = useMemo(() => (invoices ?? []).filter(inv => inv.isPaid), [invoices]);
  const displayedInvoices = showPaid ? (invoices ?? []) : unpaidInvoices;

  // Auto-select bank account (first with IBAN and owner=wm or mw)
  useEffect(() => {
    if (bankAccs && bankAccs.length > 0 && !selectedBankAccountId) {
      const wmAcc = bankAccs.find((b: any) => b.bankAccount.iban && (b.bankAccount.owner === "mw" || b.bankAccount.owner === "wm"));
      if (wmAcc) setSelectedBankAccountId(String(wmAcc.bankAccount.id));
      else {
        const first = bankAccs.find((b: any) => b.bankAccount.iban);
        if (first) setSelectedBankAccountId(String(first.bankAccount.id));
      }
    }
  }, [bankAccs, selectedBankAccountId]);

  // Auto-select all unpaid invoices with IBAN
  useEffect(() => {
    if (unpaidInvoices.length > 0 && selectedIds.size === 0) {
      const withIban = unpaidInvoices.filter(inv => inv.counterpartyIban);
      setSelectedIds(new Set(withIban.map(inv => inv.id)));
      // Set execution date to earliest due date
      const dueDates = withIban.filter(inv => inv.dueDate).map(inv => inv.dueDate);
      if (dueDates.length > 0) {
        dueDates.sort();
        setExecDate(dueDates[0]);
      }
    }
  }, [unpaidInvoices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize edit data from AI metadata (creditorCity, creditorCountry, etc. from server)
  useEffect(() => {
    if (invoices) {
      const newEditData: Record<number, { city: string; country: string; address: string; zip: string }> = {};
      for (const inv of invoices) {
        if (!editData[inv.id]) {
          newEditData[inv.id] = {
            city: (inv as any).creditorCity || "",
            country: (inv as any).creditorCountry || "CH",
            address: (inv as any).creditorAddress || "",
            zip: (inv as any).creditorZip || "",
          };
        }
      }
      if (Object.keys(newEditData).length > 0) {
        setEditData(prev => ({ ...prev, ...newEditData }));
      }
    }
  }, [invoices]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const getEditField = (id: number, field: "city" | "country" | "address" | "zip") => {
    return editData[id]?.[field] ?? "";
  };

  const setEditField = (id: number, field: "city" | "country" | "address" | "zip", value: string) => {
    setEditData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const selectedBankAcc = bankAccs?.find((b: any) => String(b.bankAccount.id) === selectedBankAccountId)?.bankAccount;

  const handleExport = () => {
    if (!selectedBankAcc?.iban) {
      toast.error("Bitte wählen Sie ein Bankkonto mit IBAN aus.");
      return;
    }

    // Validate that all selected invoices have city and country
    const missingFields = selectedInvoices.filter(inv => {
      const ed = editData[inv.id];
      return !ed?.city || !ed?.country;
    });
    if (missingFields.length > 0) {
      toast.error(`Bitte Ort und Land für alle ausgewählten Rechnungen ausfüllen: ${missingFields.map(i => i.counterparty).join(", ")}`);
      return;
    }

    generateMut.mutate({
      paymentType: "creditor",
      payments: selectedInvoices.map(inv => {
        const ed = editData[inv.id] || {};
        return {
          debtorIban: selectedBankAcc.iban || undefined,
          creditorName: inv.counterparty,
          creditorIban: inv.counterpartyIban,
          creditorAddress: ed.address || undefined,
          creditorZip: ed.zip || undefined,
          creditorCity: ed.city || undefined,
          creditorCountry: ed.country || "CH",
          amount: inv.totalAmount,
          currency: inv.currency,
          reference: inv.referenceNumber || undefined,
          remittanceInfo: inv.referenceNumber ? `Zahlung Ref. ${inv.referenceNumber}` : `Zahlung an ${inv.counterparty}`,
        };
      }),
      executionDate: execDate,
      documentIds: selectedInvoices.map(inv => inv.id),
    });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" />
            Kreditorenzahlungen
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ISO 20022 Zahlungsdatei (pain.001) aus offenen Eingangsrechnungen erstellen
          </p>
        </div>
      </div>

      {/* Settings bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Belastungskonto</Label>
              <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Bankkonto wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {(bankAccs ?? []).filter((b: any) => b.bankAccount.iban && b.bankAccount.isActive).map((b: any) => (
                    <SelectItem key={b.bankAccount.id} value={String(b.bankAccount.id)}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{b.bankAccount.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{b.bankAccount.iban}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ausführungsdatum</Label>
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
        </CardContent>
      </Card>

      {/* Invoice table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left w-8">
                    <Checkbox
                      checked={displayedInvoices.filter(inv => !inv.isPaid && inv.counterpartyIban).length > 0 && displayedInvoices.filter(inv => !inv.isPaid && inv.counterpartyIban).every(inv => selectedIds.has(inv.id))}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                    />
                  </th>
                  <th className="p-3 text-left">Kreditor</th>
                  <th className="p-3 text-left">IBAN</th>
                  <th className="p-3 text-left">Ort / Land</th>
                  <th className="p-3 text-left">Rechnungsdatum</th>
                  <th className="p-3 text-left">Fällig am</th>
                  <th className="p-3 text-right">Betrag</th>
                  <th className="p-3 text-left">Referenz</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.length === 0 ? (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Keine Eingangsrechnungen gefunden</td></tr>
                ) : displayedInvoices.map(inv => {
                  const isSelected = selectedIds.has(inv.id);
                  const noIban = !inv.counterpartyIban;
                  const isEditing = editingId === inv.id;
                  return (
                    <tr key={inv.id} className={`border-t ${inv.isPaid ? "bg-green-50/50 dark:bg-green-950/20" : ""} ${isSelected ? "bg-blue-50 dark:bg-blue-950" : ""} ${noIban && !inv.isPaid ? "opacity-60" : ""}`}>
                      <td className="p-3">
                        <Checkbox
                          checked={isSelected}
                          disabled={inv.isPaid || noIban}
                          onCheckedChange={() => toggleSelect(inv.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium truncate max-w-44" title={inv.counterparty}>{inv.counterparty}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-44" title={inv.filename}>{inv.filename}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {inv.counterpartyIban || <span className="text-red-500 italic">fehlt</span>}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="space-y-1">
                            <Input
                              placeholder="Strasse"
                              value={getEditField(inv.id, "address")}
                              onChange={e => setEditField(inv.id, "address", e.target.value)}
                              className="h-7 text-xs w-36"
                            />
                            <div className="flex gap-1">
                              <Input
                                placeholder="PLZ"
                                value={getEditField(inv.id, "zip")}
                                onChange={e => setEditField(inv.id, "zip", e.target.value)}
                                className="h-7 text-xs w-16"
                              />
                              <Input
                                placeholder="Ort *"
                                value={getEditField(inv.id, "city")}
                                onChange={e => setEditField(inv.id, "city", e.target.value)}
                                className="h-7 text-xs w-24"
                              />
                            </div>
                            <Select
                              value={getEditField(inv.id, "country") || "CH"}
                              onValueChange={v => setEditField(inv.id, "country", v)}
                            >
                              <SelectTrigger className="h-7 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CH">Schweiz (CH)</SelectItem>
                                <SelectItem value="DE">Deutschland (DE)</SelectItem>
                                <SelectItem value="AT">Österreich (AT)</SelectItem>
                                <SelectItem value="FR">Frankreich (FR)</SelectItem>
                                <SelectItem value="IT">Italien (IT)</SelectItem>
                                <SelectItem value="LI">Liechtenstein (LI)</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingId(null)}>
                              <Check className="h-3 w-3 mr-1" /> OK
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {getEditField(inv.id, "city") ? (
                                <>{getEditField(inv.id, "zip") && `${getEditField(inv.id, "zip")} `}{getEditField(inv.id, "city")}, {getEditField(inv.id, "country") || "CH"}</>
                              ) : (
                                <span className="text-amber-500 italic">ausfüllen</span>
                              )}
                            </span>
                            {!inv.isPaid && (
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEditingId(inv.id)}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        {inv.documentDate ? new Date(inv.documentDate).toLocaleDateString("de-CH") : "–"}
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        {inv.dueDate ? (() => {
                          const due = new Date(inv.dueDate);
                          const isOverdue = due < new Date() && !inv.isPaid;
                          return <span className={isOverdue ? "text-red-600 font-semibold" : ""}>{due.toLocaleDateString("de-CH")}{isOverdue && " (überfällig)"}</span>;
                        })() : "–"}
                      </td>
                      <td className="p-3 text-right font-mono whitespace-nowrap">
                        {inv.totalAmount > 0 ? formatCHF(inv.totalAmount) : "–"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground truncate max-w-28" title={inv.referenceNumber}>
                        {inv.referenceNumber || "–"}
                      </td>
                      <td className="p-3 text-center">
                        {inv.isPaid ? (
                          <div className="flex items-center justify-center gap-1">
                            <Badge variant="outline" className={`text-xs ${inv.matchStatus === "matched" ? "text-green-700 border-green-300" : "text-amber-700 border-amber-300"}`}>
                              <Check className="h-3 w-3 mr-0.5" />
                              {inv.matchStatus === "matched" ? "Verbucht" : inv.matchStatus === "pain001" ? "In Zahlung" : "Bezahlt"}
                            </Badge>
                            {(inv.matchStatus === "manual" || inv.matchStatus === "pain001") && (
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-red-600" title="Als unbezahlt markieren"
                                onClick={() => markPaidMut.mutate({ documentId: inv.id, isPaid: false })}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground hover:text-green-700" title="Manuell als bezahlt markieren"
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
        </CardContent>
      </Card>

      {/* Footer with totals and export button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {selectedInvoices.length} von {unpaidInvoices.length} offenen Rechnungen ausgewählt
        </div>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-lg">Total: CHF {formatCHF(totalAmount)}</span>
          <Button
            disabled={selectedInvoices.length === 0 || generateMut.isPending || !execDate || !selectedBankAccountId}
            onClick={handleExport}
            size="lg"
          >
            {generateMut.isPending ? "Erstelle..." : <><Download className="h-4 w-4 mr-2" /> pain.001 exportieren</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
