import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Send, CheckCircle2, Loader2, FileDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCHF(value: number | string, currency = "CHF") {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-CH", {
    style: "currency", currency, minimumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
}

type ItemInput = {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  revenueAccountId?: number;
};

function emptyItem(position: number): ItemInput {
  return {
    position,
    description: "",
    quantity: 1,
    unit: "Stk",
    unitPrice: 0,
    vatRate: 8.1,
  };
}

function calc(items: ItemInput[]) {
  let subtotal = 0;
  let vat = 0;
  for (const it of items) {
    const net = Math.round(it.quantity * it.unitPrice * 100) / 100;
    const itVat = Math.round(net * it.vatRate) / 100;
    subtotal += net;
    vat += itVat;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  vat = Math.round(vat * 100) / 100;
  return { subtotal, vat, total: Math.round((subtotal + vat) * 100) / 100 };
}

// ─── Editor-Dialog ──────────────────────────────────────────────────────────

export default function InvoiceEditor(props: {
  invoiceId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = props.invoiceId != null;
  const utils = trpc.useUtils();

  // Bestehende Rechnung laden (wenn edit)
  const existing = trpc.invoices.getById.useQuery(
    { id: props.invoiceId ?? 0 },
    { enabled: isEdit },
  );

  // Formular-State
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentTermDays, setPaymentTermDays] = useState<number>(30);
  const [subject, setSubject] = useState<string>("");
  const [introText, setIntroText] = useState<string>("");
  const [footerText, setFooterText] = useState<string>("Vielen Dank für Ihren Auftrag.");
  const [currency, setCurrency] = useState<"CHF" | "EUR">("CHF");
  const [items, setItems] = useState<ItemInput[]>([emptyItem(1)]);
  const [notes, setNotes] = useState<string>("");

  // Daten beim Edit-Load übernehmen
  useEffect(() => {
    if (!isEdit) return;
    const d = existing.data;
    if (!d) return;
    setCustomerId(d.customerId);
    setInvoiceDate(d.invoiceDate as string);
    setPaymentTermDays(d.paymentTermDays);
    setSubject(d.subject ?? "");
    setIntroText(d.introText ?? "");
    setFooterText(d.footerText ?? "");
    setCurrency((d.currency as "CHF" | "EUR") ?? "CHF");
    setNotes(d.notes ?? "");
    setItems(
      (d.items ?? []).map((it: any, idx: number) => ({
        position: it.position ?? idx + 1,
        description: it.description,
        quantity: parseFloat(it.quantity),
        unit: it.unit ?? "Stk",
        unitPrice: parseFloat(it.unitPrice),
        vatRate: parseFloat(it.vatRate),
        revenueAccountId: it.revenueAccountId ?? undefined,
      })),
    );
  }, [existing.data, isEdit]);

  // Kunden + Konten für Dropdowns
  const customersQuery = trpc.customers.list.useQuery({ includeInactive: false });
  const accountsQuery = trpc.accounts.list.useQuery();

  // Mutations
  const createMut = trpc.invoices.create.useMutation({
    onSuccess: () => { toast.success("Entwurf gespeichert"); props.onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.invoices.update.useMutation({
    onSuccess: () => { toast.success("Entwurf aktualisiert"); props.onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const issueMut = trpc.invoices.issue.useMutation({
    onSuccess: (r) => {
      toast.success(`Rechnung ${r.invoiceNumber} verbucht`);
      utils.invoices.list.invalidate();
      utils.invoices.getById.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const pdfMut = trpc.invoices.generatePdf.useMutation({
    onSuccess: (r) => {
      toast.success(r.cached ? "PDF bereit" : "PDF generiert");
      window.open(r.url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => toast.error(e.message),
  });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const emailMut = trpc.invoices.sendEmail.useMutation({
    onSuccess: (r) => {
      toast.success(`Email an ${r.to} versandt`);
      setEmailDialogOpen(false);
      utils.invoices.list.invalidate();
      utils.invoices.getById.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = calc(items);
  const isReadOnly = isEdit && existing.data && existing.data.status !== "draft";
  const currentStatus = existing.data?.status;

  // Ertragskonten filtern (accountType = revenue)
  const revenueAccounts = (accountsQuery.data ?? []).filter(
    (a: any) => a.accountType === "revenue",
  );

  const handleSave = () => {
    if (!customerId) { toast.error("Bitte Kunde auswählen"); return; }
    if (items.some((it) => !it.description.trim())) {
      toast.error("Jede Position braucht eine Beschreibung");
      return;
    }
    const payload = {
      customerId,
      invoiceDate,
      paymentTermDays,
      subject: subject || undefined,
      introText: introText || undefined,
      footerText: footerText || undefined,
      currency,
      items: items.map((it, idx) => ({
        position: idx + 1,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        vatRate: it.vatRate,
        revenueAccountId: it.revenueAccountId,
      })),
      notes: notes || undefined,
    };
    if (isEdit && props.invoiceId != null) {
      updateMut.mutate({ id: props.invoiceId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleIssue = () => {
    if (!props.invoiceId) return;
    issueMut.mutate({ id: props.invoiceId });
  };

  const addItem = () => setItems([...items, emptyItem(items.length + 1)]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ItemInput>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>
                {existing.data?.invoiceNumber ?? "Entwurf"}
                {currentStatus && currentStatus !== "draft" && (
                  <Badge variant="secondary">{currentStatus}</Badge>
                )}
              </>
            ) : "Neue Rechnung"}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "Diese Rechnung ist verbucht und kann nicht mehr bearbeitet werden. Für Änderungen bitte stornieren und neu erstellen."
              : "Erstelle eine neue Rechnung mit Positionen. Beim «Verbuchen» wird die Rechnungsnummer vergeben und der Journal-Eintrag erstellt."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kopfdaten */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Kunde *</Label>
              <Select
                value={customerId ? String(customerId) : ""}
                onValueChange={(v) => setCustomerId(parseInt(v))}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kunde auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {(customersQuery.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.company || c.name}
                      {c.customerNumber ? ` (${c.customerNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rechnungsdatum</Label>
              <Input
                type="date" value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Zahlungsziel (Tage)</Label>
              <Input
                type="number" min="0" max="365"
                value={paymentTermDays}
                onChange={(e) => setPaymentTermDays(parseInt(e.target.value) || 30)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Währung</Label>
              <Select
                value={currency} onValueChange={(v) => setCurrency(v as "CHF" | "EUR")}
                disabled={isReadOnly}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Betreff</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="z.B. Beratung März 2026"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label>Einleitungstext (optional)</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              placeholder="z.B. Besten Dank für Ihren Auftrag. Wir erlauben uns, folgende Leistungen in Rechnung zu stellen:"
              disabled={isReadOnly}
            />
          </div>

          {/* Positionen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Positionen</Label>
              {!isReadOnly && (
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Position
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="w-[80px]">Menge</TableHead>
                  <TableHead className="w-[80px]">Einheit</TableHead>
                  <TableHead className="w-[110px] text-right">Einzelpreis</TableHead>
                  <TableHead className="w-[90px]">MWST %</TableHead>
                  <TableHead className="w-[160px]">Ertragskonto</TableHead>
                  <TableHead className="w-[110px] text-right">Total</TableHead>
                  {!isReadOnly && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => {
                  const lineTotal = Math.round(it.quantity * it.unitPrice * (1 + it.vatRate / 100) * 100) / 100;
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          value={it.description}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                          placeholder="Leistungsbeschreibung"
                          disabled={isReadOnly}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.01" min="0"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          disabled={isReadOnly}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={it.unit}
                          onChange={(e) => updateItem(idx, { unit: e.target.value })}
                          disabled={isReadOnly}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.05" min="0"
                          className="text-right"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                          disabled={isReadOnly}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(it.vatRate)}
                          onValueChange={(v) => updateItem(idx, { vatRate: parseFloat(v) })}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="2.6">2.6%</SelectItem>
                            <SelectItem value="3.8">3.8%</SelectItem>
                            <SelectItem value="8.1">8.1%</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={it.revenueAccountId ? String(it.revenueAccountId) : ""}
                          onValueChange={(v) => updateItem(idx, { revenueAccountId: v ? parseInt(v) : undefined })}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Default (3000)" />
                          </SelectTrigger>
                          <SelectContent>
                            {revenueAccounts.map((a: any) => (
                              <SelectItem key={a.id} value={String(a.id)}>
                                {a.number} {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCHF(lineTotal, currency)}
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          {items.length > 1 && (
                            <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totale */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nettobetrag</span>
                <span className="font-mono">{formatCHF(totals.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MWST</span>
                <span className="font-mono">{formatCHF(totals.vat, currency)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatCHF(totals.total, currency)}</span>
              </div>
            </div>
          </div>

          {/* Footer / Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Fusszeile</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={footerText} onChange={(e) => setFooterText(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Notizen (intern, nicht im PDF)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={notes} onChange={(e) => setNotes(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Schliessen
          </Button>
          {!isReadOnly && (
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Speichern…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> Entwurf speichern</>
              )}
            </Button>
          )}
          {isEdit && currentStatus === "draft" && (
            <Button
              onClick={handleIssue}
              disabled={issueMut.isPending}
            >
              {issueMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verbuchen…</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Verbuchen &amp; Nummer vergeben</>
              )}
            </Button>
          )}
          {isEdit && props.invoiceId != null && existing.data && existing.data.status !== "draft" && (
            <>
              <Button
                variant="outline"
                disabled={pdfMut.isPending}
                onClick={() => pdfMut.mutate({ id: props.invoiceId!, regenerate: false })}
              >
                {pdfMut.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> PDF…</>
                ) : (
                  <><FileDown className="h-4 w-4 mr-1" /> PDF öffnen</>
                )}
              </Button>
              <Button
                variant="outline"
                disabled={emailMut.isPending}
                onClick={() => setEmailDialogOpen(true)}
              >
                <Mail className="h-4 w-4 mr-1" /> Per E-Mail senden
              </Button>
            </>
          )}
        </DialogFooter>

        {/* Email-Dialog */}
        {emailDialogOpen && existing.data && (
          <SendEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            defaultTo={existing.data.customer?.email ?? ""}
            invoiceNumber={existing.data.invoiceNumber ?? ""}
            invoiceSubject={existing.data.subject ?? ""}
            isPending={emailMut.isPending}
            onSend={(data) => emailMut.mutate({ id: props.invoiceId!, ...data })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── SendEmailDialog ────────────────────────────────────────────────────────

function SendEmailDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultTo: string;
  invoiceNumber: string;
  invoiceSubject: string;
  isPending: boolean;
  onSend: (data: { to: string; cc?: string[]; subject?: string; bodyText?: string }) => void;
}) {
  const [to, setTo] = useState(props.defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(
    `Rechnung ${props.invoiceNumber}${props.invoiceSubject ? " – " + props.invoiceSubject : ""}`.trim(),
  );
  const [bodyText, setBodyText] = useState("");

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Rechnung per E-Mail senden</DialogTitle>
          <DialogDescription>
            Die Rechnung wird als PDF-Anhang an den Empfänger gesandt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>An *</Label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="kunde@example.ch" />
          </div>
          <div>
            <Label>CC (kommasepariert, optional)</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="buchhaltung@example.ch" />
          </div>
          <div>
            <Label>Betreff</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Nachricht (optional – Standard-Text wird verwendet wenn leer)</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px]"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Lieber Kunde, ..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Abbrechen</Button>
          <Button
            disabled={!to || props.isPending}
            onClick={() => {
              const ccList = cc.split(",").map(s => s.trim()).filter(s => s.length > 0);
              props.onSend({
                to,
                cc: ccList.length > 0 ? ccList : undefined,
                subject: subject || undefined,
                bodyText: bodyText || undefined,
              });
            }}
          >
            {props.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sende…</>
            ) : (
              <><Mail className="h-4 w-4 mr-1" /> Senden</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
