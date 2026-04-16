import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  FileText, Plus, Search, Eye, Send, CheckCircle2, XCircle,
  Clock, AlertTriangle, Trash2, Pencil, Loader2, Banknote, Ban, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import InvoiceEditor from "./InvoicesEditor";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCHF(value: number | string, currency = "CHF") {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
}

function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  sent: "Verschickt",
  partially_paid: "Teilbezahlt",
  paid: "Bezahlt",
  cancelled: "Storniert",
  written_off: "Abgeschrieben",
};

function StatusBadge({ status, isOverdue }: { status: string; isOverdue?: boolean }) {
  if (isOverdue && (status === "sent" || status === "partially_paid")) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Überfällig
      </Badge>
    );
  }
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="gap-1"><Pencil className="h-3 w-3" /> Entwurf</Badge>;
    case "sent":
      return <Badge variant="secondary" className="gap-1"><Send className="h-3 w-3" /> Verschickt</Badge>;
    case "partially_paid":
      return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900"><Banknote className="h-3 w-3" /> Teilbezahlt</Badge>;
    case "paid":
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Bezahlt</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> Storniert</Badge>;
    case "written_off":
      return <Badge variant="outline" className="gap-1 text-muted-foreground"><Ban className="h-3 w-3" /> Abgeschrieben</Badge>;
    default:
      return <Badge>{STATUS_LABEL[status] ?? status}</Badge>;
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type TabFilter = "all" | "draft" | "open" | "overdue" | "paid" | "cancelled";

export default function Invoices() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<{ id: number; open: number } | null>(null);

  const utils = trpc.useUtils();
  const statusFilter: any = tab === "all" ? undefined : tab;
  const listQuery = trpc.invoices.list.useQuery({
    status: statusFilter,
    search: search || undefined,
    limit: 200,
  });

  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => { toast.success("Entwurf gelöscht"); utils.invoices.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const issueMutation = trpc.invoices.issue.useMutation({
    onSuccess: (r) => { toast.success(`Rechnung ${r.invoiceNumber} verbucht`); utils.invoices.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const cancelMutation = trpc.invoices.cancel.useMutation({
    onSuccess: () => { toast.success("Rechnung storniert"); utils.invoices.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const paymentMutation = trpc.invoices.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Zahlungseingang verbucht");
      utils.invoices.list.invalidate();
      setPaymentDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const pdfMutation = trpc.invoices.generatePdf.useMutation({
    onSuccess: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
    onError: (e) => toast.error(e.message),
  });

  const rows = listQuery.data ?? [];

  // Kennzahlen über alle (ungefiltert) – für Headerkacheln
  const allQuery = trpc.invoices.list.useQuery({ limit: 500 });
  const stats = useMemo(() => {
    const all = allQuery.data ?? [];
    let openSum = 0;
    let overdueSum = 0;
    let openCount = 0;
    let overdueCount = 0;
    for (const r of all) {
      if (r.status === "sent" || r.status === "partially_paid") {
        openSum += r.openAmount;
        openCount++;
        if (r.isOverdue) {
          overdueSum += r.openAmount;
          overdueCount++;
        }
      }
    }
    return { openSum, overdueSum, openCount, overdueCount, total: all.length };
  }, [allQuery.data]);

  const handleNew = () => { setEditingId(null); setEditorOpen(true); };
  const handleEdit = (id: number) => { setEditingId(id); setEditorOpen(true); };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Rechnungen
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Ausgangsrechnungen mit QR-Einzahlungsschein, Positionen und Zahlungs­status.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" /> Neue Rechnung
        </Button>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Offene Rechnungen</div>
            <div className="text-2xl font-bold">{formatCHF(stats.openSum)}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.openCount} Rechnungen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Davon überfällig</div>
            <div className="text-2xl font-bold text-red-600">{formatCHF(stats.overdueSum)}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.overdueCount} Rechnungen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Alle Rechnungen</div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">im aktuellen Geschäftsjahr</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="draft">Entwürfe</TabsTrigger>
            <TabsTrigger value="open">Offen</TabsTrigger>
            <TabsTrigger value="overdue">Überfällig</TabsTrigger>
            <TabsTrigger value="paid">Bezahlt</TabsTrigger>
            <TabsTrigger value="cancelled">Storniert</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nummer oder Betreff suchen…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabelle */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">
            {rows.length} {rows.length === 1 ? "Rechnung" : "Rechnungen"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Wird geladen…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Keine Rechnungen in diesem Filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Fällig</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Offen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => handleEdit(inv.id)}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {inv.invoiceNumber ?? <span className="text-muted-foreground italic">Entwurf</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell className={`whitespace-nowrap ${inv.isOverdue ? "text-red-600 font-semibold" : ""}`}>
                      {formatDate(inv.dueDate)}
                      {inv.isOverdue && <span className="ml-1 text-xs">(+{inv.daysOverdue}T)</span>}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {inv.customerCompany ?? inv.customerName}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {inv.subject ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap">
                      {formatCHF(inv.total, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap">
                      {(inv.status === "sent" || inv.status === "partially_paid")
                        ? formatCHF(inv.openAmount, inv.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} isOverdue={inv.isOverdue} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(inv.id)} title="Anzeigen/Bearbeiten">
                          <Eye className="h-4 w-4" />
                        </Button>

                        {inv.status === "draft" && (
                          <>
                            <Button
                              size="sm" variant="ghost" title="Verbuchen"
                              onClick={() => issueMutation.mutate({ id: inv.id })}
                              disabled={issueMutation.isPending}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" title="Löschen">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Entwurf löschen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Der Entwurf wird unwiderruflich entfernt.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate({ id: inv.id })}>
                                    Löschen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}

                        {inv.status !== "draft" && (
                          <Button
                            size="sm" variant="ghost" title="PDF öffnen"
                            disabled={pdfMutation.isPending}
                            onClick={() => pdfMutation.mutate({ id: inv.id, regenerate: false })}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        )}

                        {(inv.status === "sent" || inv.status === "partially_paid") && (
                          <>
                            <Button
                              size="sm" variant="ghost" title="Zahlungseingang"
                              onClick={() => setPaymentDialog({ id: inv.id, open: inv.openAmount })}
                            >
                              <Banknote className="h-4 w-4 text-green-600" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" title="Stornieren">
                                  <Ban className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Rechnung stornieren?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Es wird eine Gegenbuchung im Journal erstellt. Die ursprüngliche
                                    Rechnung und deren Belegnummer bleiben bestehen (GeBüV).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => cancelMutation.mutate({ id: inv.id })}>
                                    Stornieren
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment-Dialog */}
      {paymentDialog && (
        <PaymentDialog
          open={!!paymentDialog}
          onOpenChange={(o) => !o && setPaymentDialog(null)}
          openAmount={paymentDialog.open}
          onConfirm={(amount, paidDate) =>
            paymentMutation.mutate({ id: paymentDialog.id, amount, paidDate })
          }
          isPending={paymentMutation.isPending}
        />
      )}

      {/* Editor-Dialog */}
      {editorOpen && (
        <InvoiceEditor
          invoiceId={editingId}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSaved={() => {
            utils.invoices.list.invalidate();
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Payment-Dialog ─────────────────────────────────────────────────────────

function PaymentDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  openAmount: number;
  onConfirm: (amount: number, paidDate: string) => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState<string>(String(props.openAmount.toFixed(2)));
  const [paidDate, setPaidDate] = useState<string>(new Date().toISOString().slice(0, 10));

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zahlungseingang erfassen</AlertDialogTitle>
          <AlertDialogDescription>
            Offener Betrag: <strong>{formatCHF(props.openAmount)}</strong>.
            Bei vollständiger Zahlung wird der Status automatisch auf «Bezahlt» gesetzt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium">Betrag (CHF)</label>
            <Input
              type="number" step="0.05" min="0"
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Zahlungsdatum</label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            disabled={props.isPending}
            onClick={() => {
              const n = parseFloat(amount);
              if (!isFinite(n) || n <= 0) { toast.error("Ungültiger Betrag"); return; }
              props.onConfirm(n, paidDate);
            }}
          >
            {props.isPending ? "Speichern…" : "Verbuchen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
