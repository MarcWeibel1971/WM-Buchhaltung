import { trpc } from "@/lib/trpc";
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Download, Loader2, AlertTriangle, Plus, Trash2, FileText, Users, ListChecks, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface LineItem {
  id: string;
  description: string;
  amount: string;
}

export default function QrBillGenerator() {
  const [, navigate] = useLocation();
  const [savedInvoiceId, setSavedInvoiceId] = useState<number | null>(null);
  const { data: qrSettings, isLoading: qrLoading } = trpc.qrBill.getQrSettings.useQuery();
  const { data: companySettings } = trpc.settings.getCompanySettings.useQuery();
  const { data: customersList } = trpc.customers.list.useQuery();

  // Tab state
  const [activeTab, setActiveTab] = useState("invoice");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const handleSelectCustomer = useCallback((customerId: number) => {
    const c = (customersList ?? []).find((x: any) => x.id === customerId);
    if (!c) return;
    setSelectedCustomerId(customerId);
    setCustomerPopoverOpen(false);
    // Fill recipient fields
    setRecipientTitle(c.salutation?.split(",")[0] || "");
    const displayName = c.lastName && c.firstName
      ? `${c.firstName} ${c.lastName}`
      : c.company || c.name;
    setRecipientName(displayName);
    setRecipientStreet(c.street || "");
    setRecipientZip(c.zipCode || "");
    setRecipientCity(c.city || "");
    // Also set salutation if available
    if (c.salutation) setSalutation(c.salutation);
  }, [customersList]);

  // ─── Invoice Template Form ─────────────────────────────────────────────────
  const [recipientTitle, setRecipientTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientStreet, setRecipientStreet] = useState("");
  const [recipientZip, setRecipientZip] = useState("");
  const [recipientCity, setRecipientCity] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceSubject, setInvoiceSubject] = useState("Beratung: Rechnung");
  const [salutation, setSalutation] = useState("");
  const [introText, setIntroText] = useState(
    "Ich erlaube mir, Dir den Aufwand für meine Beratungsleistungen gemäss beiliegendem Leistungsblatt in Rechnung zu stellen:"
  );
  const [closingText, setClosingText] = useState(
    "Ich danke Dir für das mir entgegengebrachte Vertrauen und freue mich, Dir auch in Zukunft zur Verfügung zu stehen."
  );
  const [greeting, setGreeting] = useState("Herzliche Grüsse");
  const [signerName, setSignerName] = useState("Marc Weibel");
  const [signerTitle, setSignerTitle] = useState("lic.oec. HSG");

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "Honorar nach Stundenaufwand", amount: "" },
  ]);

  // MWST
  const [vatRate, setVatRate] = useState("8.1");
  const [currency, setCurrency] = useState<"CHF" | "EUR">("CHF");

  // Payment terms
  const [paymentDays, setPaymentDays] = useState("30");

  // ─── Simple QR-Bill Form ──────────────────────────────────────────────────
  const [simpleCustomerPopoverOpen, setSimpleCustomerPopoverOpen] = useState(false);
  const [simpleSelectedCustomerId, setSimpleSelectedCustomerId] = useState<number | null>(null);

  const handleSelectSimpleCustomer = useCallback((customerId: number) => {
    const c = (customersList ?? []).find((x: any) => x.id === customerId);
    if (!c) return;
    setSimpleSelectedCustomerId(customerId);
    setSimpleCustomerPopoverOpen(false);
    const displayName = c.lastName && c.firstName
      ? `${c.firstName} ${c.lastName}`
      : c.company || c.name;
    setSimpleDebtorName(displayName);
    setSimpleDebtorAddress(c.street || "");
    setSimpleDebtorZip(c.zipCode || "");
    setSimpleDebtorCity(c.city || "");
  }, [customersList]);

  const [simpleDebtorName, setSimpleDebtorName] = useState("");
  const [simpleDebtorAddress, setSimpleDebtorAddress] = useState("");
  const [simpleDebtorZip, setSimpleDebtorZip] = useState("");
  const [simpleDebtorCity, setSimpleDebtorCity] = useState("");
  const [simpleAmount, setSimpleAmount] = useState("");
  const [simpleCurrency, setSimpleCurrency] = useState<"CHF" | "EUR">("CHF");
  const [simpleAdditionalInfo, setSimpleAdditionalInfo] = useState("");

  // ─── Leistungsdetails Toggle ───────────────────────────────────────────────
  const [includeServiceDetails, setIncludeServiceDetails] = useState(false);
  const { data: timeEntries } = trpc.timeTracking.listEntries.useQuery(
    { customerId: selectedCustomerId ?? undefined },
    { enabled: includeServiceDetails && selectedCustomerId !== null }
  );

  // ─── Computed Values ───────────────────────────────────────────────────────
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  }, [lineItems]);

  const vatAmount = useMemo(() => {
    return subtotal * (parseFloat(vatRate) / 100);
  }, [subtotal, vatRate]);

  const total = useMemo(() => subtotal + vatAmount, [subtotal, vatAmount]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const generateInvoiceMut = trpc.qrBill.generateInvoiceAcroform.useMutation({
    onSuccess: (result) => {
      const byteChars = atob(result.base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Rechnung mit QR-Zahlungsteil erstellt");
    },
    onError: (e: any) => toast.error(`Fehler: ${e.message}`),
  });

  const generateSimpleMut = trpc.qrBill.generateQrBill.useMutation({
    onSuccess: (result) => {
      const byteChars = atob(result.base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("QR-Rechnung erstellt");
    },
    onError: (e: any) => toast.error(`Fehler: ${e.message}`),
  });
  const saveDraftMut = trpc.invoices.saveFromQrGenerator.useMutation({
    onSuccess: (result) => {
      setSavedInvoiceId(result.id);
      toast.success("Entwurf gespeichert", {
        description: "Die Rechnung wurde in den Entw\u00fcrfen gespeichert.",
        action: {
          label: "Zu Entw\u00fcrfen",
          onClick: () => navigate("/rechnungen"),
        },
      });
    },
    onError: (e: any) => toast.error(`Fehler beim Speichern: ${e.message}`),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const addLineItem = () => {
    setLineItems([...lineItems, { id: String(Date.now()), description: "", amount: "" }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: "description" | "amount", value: string) => {
    setLineItems(lineItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const buildSaveDraftInput = () => ({
    invoiceId: savedInvoiceId ?? undefined,
    customerId: selectedCustomerId ?? undefined,
    recipientName: recipientName.trim(),
    recipientStreet: recipientStreet.trim(),
    recipientZip: recipientZip.trim(),
    recipientCity: recipientCity.trim(),
    invoiceDate,
    paymentTermDays: parseInt(paymentDays) || 30,
    subject: invoiceSubject || undefined,
    introText: introText || undefined,
    currency,
    items: lineItems
      .filter(i => i.description && parseFloat(i.amount) > 0)
      .map(i => ({ description: i.description, amount: parseFloat(i.amount) })),
    vatRate: parseFloat(vatRate),
  });

  const handleSaveDraft = () => {
    if (!recipientName.trim()) { toast.error("Empfängername ist erforderlich"); return; }
    if (total <= 0) { toast.error("Gesamtbetrag muss grösser als 0 sein"); return; }
    saveDraftMut.mutate(buildSaveDraftInput());
  };

  const handleGenerateInvoice = () => {
    if (!recipientName.trim()) { toast.error("Empfängername ist erforderlich"); return; }
    if (!recipientStreet.trim()) { toast.error("Strasse ist erforderlich"); return; }
    if (!recipientZip.trim()) { toast.error("PLZ ist erforderlich"); return; }
    if (!recipientCity.trim()) { toast.error("Ort ist erforderlich"); return; }
    if (total <= 0) { toast.error("Gesamtbetrag muss grösser als 0 sein"); return; }

    // Automatisch als Entwurf speichern beim PDF-Generieren
    saveDraftMut.mutate(buildSaveDraftInput());
    generateInvoiceMut.mutate({
      recipientTitle: recipientTitle || undefined,
      recipientName: recipientName.trim(),
      recipientStreet: recipientStreet.trim(),
      recipientZip: recipientZip.trim(),
      recipientCity: recipientCity.trim(),
      invoiceDate,
      invoiceSubject,
      salutation: salutation || undefined,
      introText,
      lineItems: lineItems.filter(i => i.description && parseFloat(i.amount) > 0).map(i => ({
        description: i.description,
        amount: parseFloat(i.amount),
      })),
      vatRate: parseFloat(vatRate),
      currency,
      closingText,
      greeting,
      signerName,
      signerTitle: signerTitle || undefined,
      paymentDays: parseInt(paymentDays) || 30,
      includeServiceDetails,
      customerId: selectedCustomerId ?? undefined,
    });
  };

  const handleGenerateSimple = () => {
    if (!simpleDebtorName.trim()) { toast.error("Empfängername ist erforderlich"); return; }
    if (!simpleDebtorAddress.trim()) { toast.error("Adresse ist erforderlich"); return; }
    if (!simpleDebtorZip.trim()) { toast.error("PLZ ist erforderlich"); return; }
    if (!simpleDebtorCity.trim()) { toast.error("Ort ist erforderlich"); return; }
    if (!simpleAmount || parseFloat(simpleAmount) <= 0) { toast.error("Betrag muss grösser als 0 sein"); return; }

    generateSimpleMut.mutate({
      debtorName: simpleDebtorName.trim(),
      debtorAddress: simpleDebtorAddress.trim(),
      debtorZip: simpleDebtorZip.trim(),
      debtorCity: simpleDebtorCity.trim(),
      amount: parseFloat(simpleAmount),
      currency: simpleCurrency,
      additionalInfo: simpleAdditionalInfo || undefined,
    });
  };

  if (qrLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!qrSettings) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">QR-Rechnung nicht konfiguriert</h2>
            <p className="text-muted-foreground mb-4">
              Bitte konfigurieren Sie zuerst die IBAN und Referenzart unter Einstellungen &gt; QR-Rechnung.
            </p>
            <Button variant="outline" onClick={() => window.location.href = "/settings"}>
              Zu den Einstellungen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCHF = (n: number) => {
    const [int, dec] = n.toFixed(2).split(".");
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, "'") + "." + dec;
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <QrCode className="h-7 w-7 text-primary" />
          QR-Rechnung erstellen
        </h1>
        <p className="text-muted-foreground mt-1">
          Erstellen Sie eine professionelle Rechnung mit QR-Zahlungsteil oder einen einfachen QR-Einzahlungsschein.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invoice" className="gap-2">
            <FileText className="h-4 w-4" />
            Rechnung mit QR-Zahlungsteil
          </TabsTrigger>
          <TabsTrigger value="simple" className="gap-2">
            <QrCode className="h-4 w-4" />
            Einfacher QR-Einzahlungsschein
          </TabsTrigger>
        </TabsList>

        {/* ─── Invoice Template Tab ─────────────────────────────────────────── */}
        <TabsContent value="invoice" className="space-y-6 mt-6">
          {/* Creditor info (read-only from settings) */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Absender (aus Firmeneinstellungen)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-semibold">{companySettings?.companyName}</p>
              {companySettings?.street && <p>{companySettings.street}</p>}
              <p>{companySettings?.zipCode} {companySettings?.city}</p>
              {companySettings?.phone && <p>Tel: {companySettings.phone}</p>}
              {companySettings?.email && <p>{companySettings.email}</p>}
              {companySettings?.uid && <p className="text-xs mt-1">MWST-Nr. {companySettings.uid}</p>}
              <p className="text-xs mt-1 font-mono">IBAN: {qrSettings.iban}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recipient */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Empfänger</CardTitle>
                <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Users className="h-3.5 w-3.5" />
                      {selectedCustomerId ? "Kunde ändern" : "Kunde wählen"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Kunde suchen..." />
                      <CommandList>
                        <CommandEmpty>Kein Kunde gefunden.</CommandEmpty>
                        <CommandGroup>
                          {(customersList ?? []).map((c: any) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.customerNumber || ""} ${c.name} ${c.company || ""} ${c.city || ""}`}
                              onSelect={() => handleSelectCustomer(c.id)}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {c.customerNumber && <span className="font-mono text-muted-foreground mr-1">{c.customerNumber}</span>}
                                  {c.lastName && c.firstName ? `${c.lastName} ${c.firstName}` : c.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {[c.company, c.city].filter(Boolean).join(" · ")}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Anrede / Titel</Label>
                  <Input value={recipientTitle} onChange={e => setRecipientTitle(e.target.value)} placeholder="Herr med. dent." />
                </div>
                <div>
                  <Label>Name / Firma *</Label>
                  <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Peter Meier" />
                </div>
                <div>
                  <Label>Strasse *</Label>
                  <Input value={recipientStreet} onChange={e => setRecipientStreet(e.target.value)} placeholder="Schönbühlring 6" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>PLZ *</Label>
                    <Input value={recipientZip} onChange={e => setRecipientZip(e.target.value)} placeholder="6005" />
                  </div>
                  <div className="col-span-2">
                    <Label>Ort *</Label>
                    <Input value={recipientCity} onChange={e => setRecipientCity(e.target.value)} placeholder="Luzern" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rechnungsdetails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Rechnungsdatum</Label>
                  <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                </div>
                <div>
                  <Label>Betreff</Label>
                  <Input value={invoiceSubject} onChange={e => setInvoiceSubject(e.target.value)} placeholder="Beratung: Rechnung" />
                </div>
                <div>
                  <Label>Persönliche Anrede</Label>
                  <Input value={salutation} onChange={e => setSalutation(e.target.value)} placeholder="Lieber Peter" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Zahlungsfrist (Tage)</Label>
                    <Input type="number" value={paymentDays} onChange={e => setPaymentDays(e.target.value)} min="0" />
                  </div>
                  <div>
                    <Label>Währung</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHF">CHF</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Intro Text */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Einleitungstext</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Leistungspositionen</CardTitle>
                  <CardDescription>Fügen Sie die einzelnen Positionen der Rechnung hinzu.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="include-service-details" className="text-sm cursor-pointer">
                    Mit Leistungsdetails
                  </Label>
                  <Switch
                    id="include-service-details"
                    checked={includeServiceDetails}
                    onCheckedChange={setIncludeServiceDetails}
                    disabled={!selectedCustomerId}
                  />
                </div>
              </div>
              {includeServiceDetails && selectedCustomerId && (
                <div className="mt-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-medium">{(timeEntries ?? []).length} Zeiteinträge</span> werden als Leistungsblatt nach dem QR-Einzahlungsschein angehängt.
                  {!selectedCustomerId && " Bitte zuerst einen Kunden wählen."}
                </div>
              )}
              {includeServiceDetails && !selectedCustomerId && (
                <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Bitte zuerst einen Kunden wählen, um Leistungsdetails anzuhängen.
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="flex gap-3 items-start">
                  <span className="text-sm text-muted-foreground mt-2.5 w-6 text-right">{idx + 1}.</span>
                  <div className="flex-1">
                    <Input
                      value={item.description}
                      onChange={e => updateLineItem(item.id, "description", e.target.value)}
                      placeholder="Beschreibung der Leistung"
                    />
                  </div>
                  <div className="w-36">
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      value={item.amount}
                      onChange={e => updateLineItem(item.id, "amount", e.target.value)}
                      placeholder="0.00"
                      className="text-right font-mono"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length <= 1}
                    className="mt-0.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                <Plus className="h-4 w-4" />
                Position hinzufügen
              </Button>

              {/* Totals */}
              <div className="border-t pt-4 mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Zwischensumme</span>
                  <span className="font-mono">{currency} {formatCHF(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span>MWST</span>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={vatRate}
                      onChange={e => setVatRate(e.target.value)}
                      className="w-20 h-7 text-right font-mono text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <span className="font-mono">{currency} {formatCHF(vatAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono">{currency} {formatCHF(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Closing & Signature */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Abschluss & Unterschrift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Schlusstext</Label>
                <Textarea
                  value={closingText}
                  onChange={e => setClosingText(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Grussformel</Label>
                  <Input value={greeting} onChange={e => setGreeting(e.target.value)} />
                </div>
                <div>
                  <Label>Unterzeichner</Label>
                  <Input value={signerName} onChange={e => setSignerName(e.target.value)} />
                </div>
                <div>
                  <Label>Titel</Label>
                  <Input value={signerTitle} onChange={e => setSignerTitle(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saveDraftMut.isPending || generateInvoiceMut.isPending}
              className="gap-2"
            >
              {saveDraftMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {savedInvoiceId ? "Entwurf aktualisieren" : "Als Entwurf speichern"}
            </Button>
            <Button
              size="lg"
              onClick={handleGenerateInvoice}
              disabled={generateInvoiceMut.isPending || saveDraftMut.isPending}
              className="gap-2"
            >
              {generateInvoiceMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              Rechnung als PDF generieren
            </Button>
          </div>
        </TabsContent>

        {/* ─── Simple QR-Bill Tab ───────────────────────────────────────────── */}
        <TabsContent value="simple" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Zahlungsempfänger (Creditor)</CardTitle>
                <CardDescription>Aus den QR-Rechnungs-Einstellungen</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1 text-muted-foreground">
                <p className="font-semibold text-foreground">{companySettings?.companyName}</p>
                {companySettings?.street && <p>{companySettings.street}</p>}
                <p>{companySettings?.zipCode} {companySettings?.city}</p>
                <p className="font-mono mt-2">{qrSettings.iban}</p>
                <p>Referenztyp: {qrSettings.referenceType}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Zahlungspflichtiger (Debtor)</CardTitle>
                <Popover open={simpleCustomerPopoverOpen} onOpenChange={setSimpleCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Users className="h-3.5 w-3.5" />
                      {simpleSelectedCustomerId ? "Kunde ändern" : "Kunde wählen"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Kunde suchen..." />
                      <CommandList>
                        <CommandEmpty>Kein Kunde gefunden.</CommandEmpty>
                        <CommandGroup>
                          {(customersList ?? []).map((c: any) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.customerNumber || ""} ${c.name} ${c.company || ""} ${c.city || ""}`}
                              onSelect={() => handleSelectSimpleCustomer(c.id)}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {c.customerNumber && <span className="font-mono text-muted-foreground mr-1">{c.customerNumber}</span>}
                                  {c.lastName && c.firstName ? `${c.lastName} ${c.firstName}` : c.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {[c.company, c.city].filter(Boolean).join(" · ")}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Name / Firma *</Label>
                  <Input value={simpleDebtorName} onChange={e => setSimpleDebtorName(e.target.value)} placeholder="Max Muster AG" />
                </div>
                <div>
                  <Label>Strasse *</Label>
                  <Input value={simpleDebtorAddress} onChange={e => setSimpleDebtorAddress(e.target.value)} placeholder="Musterstrasse 1" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>PLZ *</Label>
                    <Input value={simpleDebtorZip} onChange={e => setSimpleDebtorZip(e.target.value)} placeholder="8000" />
                  </div>
                  <div className="col-span-2">
                    <Label>Ort *</Label>
                    <Input value={simpleDebtorCity} onChange={e => setSimpleDebtorCity(e.target.value)} placeholder="Zürich" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zahlungsdetails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Betrag *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={simpleAmount}
                    onChange={e => setSimpleAmount(e.target.value)}
                    placeholder="1'500.00"
                  />
                </div>
                <div>
                  <Label>Währung</Label>
                  <Select value={simpleCurrency} onValueChange={(v) => setSimpleCurrency(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CHF">CHF</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Zusätzliche Informationen (optional)</Label>
                <Textarea
                  value={simpleAdditionalInfo}
                  onChange={e => setSimpleAdditionalInfo(e.target.value)}
                  placeholder="Rechnungsnummer, Mitteilung..."
                  maxLength={140}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleGenerateSimple}
              disabled={generateSimpleMut.isPending}
              className="gap-2"
            >
              {generateSimpleMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              QR-Rechnung als PDF generieren
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
