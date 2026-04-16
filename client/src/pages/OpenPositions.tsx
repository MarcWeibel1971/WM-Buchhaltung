import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle, Bell, CheckCircle2, Clock, FileText, Loader2, Send,
  Mail, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatCHF(value: number | string, currency = "CHF") {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-CH", {
    style: "currency", currency, minimumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
}

function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function LevelBadge({ level }: { level: number }) {
  const labels: Record<number, { text: string; cls: string }> = {
    1: { text: "Zahlungserinnerung", cls: "bg-amber-100 text-amber-900" },
    2: { text: "1. Mahnung",          cls: "bg-orange-200 text-orange-900" },
    3: { text: "2. Mahnung",          cls: "bg-red-200 text-red-900" },
  };
  const l = labels[level] ?? { text: `Stufe ${level}`, cls: "" };
  return <Badge className={`gap-1 ${l.cls}`}>{l.text}</Badge>;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type TabFilter = "all" | "overdue" | "reminders";

export default function OpenPositions() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [reminderDialog, setReminderDialog] = useState<{
    invoiceId: number;
    invoiceNumber: string | null;
    customerName: string;
    level: 1 | 2 | 3;
    suggestedFee: number;
    openAmount: number;
  } | null>(null);

  const utils = trpc.useUtils();

  const openQuery = trpc.reminders.openPositions.useQuery({
    onlyOverdue: tab === "overdue",
  });
  const historyQuery = trpc.reminders.listReminders.useQuery(undefined, {
    enabled: tab === "reminders",
  });
  const policyQuery = trpc.reminders.getPolicy.useQuery();

  const createReminder = trpc.reminders.create.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.label} angelegt (neues Fälligkeitsdatum: ${formatDate(r.newDueDate)})`);
      utils.reminders.invalidate();
      setReminderDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const markSent = trpc.reminders.markSent.useMutation({
    onSuccess: () => {
      toast.success("Als versandt markiert");
      utils.reminders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteReminder = trpc.reminders.delete.useMutation({
    onSuccess: () => {
      toast.success("Mahnung gelöscht");
      utils.reminders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const positions = openQuery.data ?? [];
  const history = historyQuery.data ?? [];

  // Kennzahlen
  const totalOpen = positions.reduce((s, p) => s + p.openAmount, 0);
  const overdueOnly = positions.filter(p => p.isOverdue);
  const totalOverdue = overdueOnly.reduce((s, p) => s + p.openAmount, 0);
  const suggestionCount = positions.filter(p => p.suggestedLevel).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6" /> Offene Posten &amp; Mahnwesen
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Überfällige Rechnungen mit automatischem Mahn-Vorschlag (3-stufig).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Offen total</div>
            <div className="text-2xl font-bold">{formatCHF(totalOpen)}</div>
            <div className="text-xs text-muted-foreground mt-1">{positions.length} Rechnungen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Überfällig</div>
            <div className="text-2xl font-bold text-red-600">{formatCHF(totalOverdue)}</div>
            <div className="text-xs text-muted-foreground mt-1">{overdueOnly.length} Rechnungen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Mahn-Vorschläge</div>
            <div className="text-2xl font-bold text-orange-600">{suggestionCount}</div>
            <div className="text-xs text-muted-foreground mt-1">bereit zum Auslösen</div>
          </CardContent>
        </Card>
      </div>

      {/* Policy-Hinweis */}
      {policyQuery.data && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4 text-sm">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <Bell className="h-4 w-4" /> Mahn-Policy
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <strong>Zahlungserinnerung</strong> ab {policyQuery.data.level1.minDaysOverdue} Tagen überfällig
                ({formatCHF(policyQuery.data.level1.feeAmount)} Gebühr,
                {" "}{policyQuery.data.level1.gracePeriodDays} Tage neue Frist)
              </li>
              <li>
                <strong>1. Mahnung</strong> ab {policyQuery.data.level2.minDaysOverdue} Tagen überfällig
                ({formatCHF(policyQuery.data.level2.feeAmount)} Gebühr,
                {" "}{policyQuery.data.level2.gracePeriodDays} Tage neue Frist)
              </li>
              <li>
                <strong>2. Mahnung</strong> ab {policyQuery.data.level3.minDaysOverdue} Tagen überfällig
                ({formatCHF(policyQuery.data.level3.feeAmount)} Gebühr,
                {" "}{policyQuery.data.level3.gracePeriodDays} Tage neue Frist)
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList>
          <TabsTrigger value="all">Alle offenen Posten</TabsTrigger>
          <TabsTrigger value="overdue">Nur überfällig</TabsTrigger>
          <TabsTrigger value="reminders">Mahnhistorie</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* OP-Liste oder Historie */}
      {tab !== "reminders" ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">
              {positions.length} {positions.length === 1 ? "offener Posten" : "offene Posten"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {openQuery.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Wird geladen…
              </div>
            ) : positions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
                Alle Rechnungen bezahlt – keine offenen Posten.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nummer</TableHead>
                    <TableHead>Fällig</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead className="text-right">Offen</TableHead>
                    <TableHead>Mahnungen</TableHead>
                    <TableHead>Vorschlag</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.invoiceNumber ?? "—"}</TableCell>
                      <TableCell className={`whitespace-nowrap ${p.isOverdue ? "text-red-600 font-semibold" : ""}`}>
                        {formatDate(p.dueDate)}
                        {p.isOverdue && <span className="ml-1 text-xs">(+{p.daysOverdue}T)</span>}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <div>{p.customerCompany ?? p.customerName}</div>
                        {p.customerEmail && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {p.customerEmail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {formatCHF(p.openAmount, p.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {p.remindersSent.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            p.remindersSent.map(r => (
                              <LevelBadge key={r.id} level={r.level} />
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.suggestedLevel ? (
                          <Badge variant="outline" className="gap-1 border-orange-400">
                            <AlertTriangle className="h-3 w-3" /> Stufe {p.suggestedLevel}
                          </Badge>
                        ) : p.isOverdue ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">im Zahlungsziel</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.suggestedLevel && (
                          <Button
                            size="sm"
                            variant={p.suggestedLevel === 3 ? "destructive" : "default"}
                            onClick={() => setReminderDialog({
                              invoiceId: p.id,
                              invoiceNumber: p.invoiceNumber,
                              customerName: p.customerCompany ?? p.customerName,
                              level: p.suggestedLevel as 1 | 2 | 3,
                              suggestedFee: p.suggestedFee,
                              openAmount: p.openAmount,
                            })}
                          >
                            <Bell className="h-3.5 w-3.5 mr-1" /> Mahnen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">
              {history.length} Mahnung{history.length === 1 ? "" : "en"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyQuery.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Wird geladen…
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                Noch keine Mahnungen angelegt.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Stufe</TableHead>
                    <TableHead>Rechnung</TableHead>
                    <TableHead>Neue Frist</TableHead>
                    <TableHead className="text-right">Gebühr</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(r.reminderDate)}</TableCell>
                      <TableCell><LevelBadge level={r.level} /></TableCell>
                      <TableCell className="font-mono text-xs">{r.invoiceNumber ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.newDueDate)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCHF(parseFloat(r.feeAmount))}</TableCell>
                      <TableCell>
                        {r.sentAt ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle2 className="h-3 w-3" /> Versandt {formatDate(r.sentAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" /> Entwurf
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!r.sentAt && (
                          <>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => markSent.mutate({ id: r.id })}
                              title="Als versandt markieren"
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
                                  <AlertDialogTitle>Mahnung löschen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Der Entwurf wird entfernt. Versandte Mahnungen können nicht gelöscht werden.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteReminder.mutate({ id: r.id })}>
                                    Löschen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reminder-Dialog */}
      {reminderDialog && (
        <ReminderDialog
          open={!!reminderDialog}
          onOpenChange={(o) => !o && setReminderDialog(null)}
          data={reminderDialog}
          onConfirm={(data) => createReminder.mutate({
            invoiceId: reminderDialog.invoiceId,
            level: reminderDialog.level,
            ...data,
          })}
          isPending={createReminder.isPending}
        />
      )}
    </div>
  );
}

// ─── Reminder-Dialog ────────────────────────────────────────────────────────

function ReminderDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: {
    invoiceId: number;
    invoiceNumber: string | null;
    customerName: string;
    level: 1 | 2 | 3;
    suggestedFee: number;
    openAmount: number;
  };
  onConfirm: (data: { feeAmount: number; gracePeriodDays: number; subject?: string; introText?: string }) => void;
  isPending: boolean;
}) {
  const levelLabels: Record<number, string> = {
    1: "Zahlungserinnerung",
    2: "1. Mahnung",
    3: "2. Mahnung (letzte)",
  };
  const [fee, setFee] = useState<string>(String(props.data.suggestedFee.toFixed(2)));
  const [grace, setGrace] = useState<string>(props.data.level === 3 ? "7" : "10");
  const [subject, setSubject] = useState<string>(
    `${levelLabels[props.data.level]} – Rechnung ${props.data.invoiceNumber ?? ""}`.trim(),
  );
  const [introText, setIntroText] = useState<string>(
    props.data.level === 1
      ? "Gemäss unseren Unterlagen ist die folgende Rechnung noch offen. Bitte überweisen Sie den Betrag in den nächsten Tagen."
      : props.data.level === 2
      ? "Leider mussten wir feststellen, dass die nachstehende Rechnung trotz Zahlungserinnerung noch nicht beglichen wurde. Wir bitten Sie, den Betrag inkl. Mahngebühren umgehend zu begleichen."
      : "Trotz mehrfacher Mahnung ist die nachstehende Rechnung noch offen. Sollte der Betrag nicht innert der gesetzten Frist eingehen, leiten wir das Inkassoverfahren ein.",
  );

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{levelLabels[props.data.level]} anlegen</AlertDialogTitle>
          <AlertDialogDescription>
            Rechnung <strong>{props.data.invoiceNumber}</strong> an{" "}
            <strong>{props.data.customerName}</strong> – offen {formatCHF(props.data.openAmount)}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mahngebühr (CHF)</Label>
              <Input
                type="number" step="0.05" min="0"
                value={fee} onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <div>
              <Label>Neue Frist (Tage)</Label>
              <Input
                type="number" min="0" max="90"
                value={grace} onChange={(e) => setGrace(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Betreff</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Einleitungstext</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={introText} onChange={(e) => setIntroText(e.target.value)}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            disabled={props.isPending}
            onClick={() => props.onConfirm({
              feeAmount: parseFloat(fee) || 0,
              gracePeriodDays: parseInt(grace) || 10,
              subject: subject || undefined,
              introText: introText || undefined,
            })}
          >
            {props.isPending ? "Anlegen…" : "Mahnung anlegen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
