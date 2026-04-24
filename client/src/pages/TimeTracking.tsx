import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Clock, FileText, Loader2, Filter, Download,
  ChevronDown, ChevronRight, Users, Briefcase
} from "lucide-react";

function fmt(n: number | string) {
  return Number(n).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default function TimeTracking() {
  const { fiscalYear } = useFiscalYear();
  const [activeTab, setActiveTab] = useState("entries");
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editService, setEditService] = useState<any>(null);

  // Filters
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [filterService, setFilterService] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Entry form
  const [eCustomerId, setECustomerId] = useState("");
  const [eServiceId, setEServiceId] = useState("");
  const [eDate, setEDate] = useState(new Date().toISOString().slice(0, 10));
  const [eHours, setEHours] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eHourlyRate, setEHourlyRate] = useState("");

  // Service form
  const [sName, setSName] = useState("");
  const [sDescription, setSDescription] = useState("");
  const [sHourlyRate, setSHourlyRate] = useState("");
  const [sRevenueAccountId, setSRevenueAccountId] = useState("");

  // Data
  const { data: entries, refetch: refetchEntries } = trpc.timeTracking.listEntries.useQuery({
    fiscalYear,
    customerId: filterCustomer !== "all" ? Number(filterCustomer) : undefined,
    serviceId: filterService !== "all" ? Number(filterService) : undefined,
    status: filterStatus !== "all" ? (filterStatus as "open" | "invoiced") : undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
  });
  const { data: servicesList, refetch: refetchServices } = trpc.timeTracking.listServices.useQuery();
  const { data: customersWithServices } = trpc.timeTracking.getCustomersWithServices.useQuery();
  const { data: revenueAccounts } = trpc.settings.getAllAccounts.useQuery();

  const revenueAccountsList = useMemo(() =>
    (revenueAccounts || []).filter((a: any) => a.type === "Ertrag" && a.isActive),
    [revenueAccounts]
  );

  // Mutations
  const createEntry = trpc.timeTracking.createEntry.useMutation({
    onSuccess: () => { toast.success("Zeiteintrag erstellt"); refetchEntries(); setShowEntryDialog(false); resetEntryForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateEntry = trpc.timeTracking.updateEntry.useMutation({
    onSuccess: () => { toast.success("Zeiteintrag aktualisiert"); refetchEntries(); setShowEntryDialog(false); resetEntryForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteEntry = trpc.timeTracking.deleteEntry.useMutation({
    onSuccess: () => { toast.success("Zeiteintrag gelöscht"); refetchEntries(); },
    onError: (e) => toast.error(e.message),
  });

  const createService = trpc.timeTracking.createService.useMutation({
    onSuccess: () => { toast.success("Dienstleistung erstellt"); refetchServices(); setShowServiceDialog(false); resetServiceForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateService = trpc.timeTracking.updateService.useMutation({
    onSuccess: () => { toast.success("Dienstleistung aktualisiert"); refetchServices(); setShowServiceDialog(false); resetServiceForm(); },
    onError: (e) => toast.error(e.message),
  });

  function resetEntryForm() {
    setEditEntry(null);
    setECustomerId("");
    setEServiceId("");
    setEDate(new Date().toISOString().slice(0, 10));
    setEHours("");
    setEDescription("");
    setEHourlyRate("");
  }

  function resetServiceForm() {
    setEditService(null);
    setSName("");
    setSDescription("");
    setSHourlyRate("");
    setSRevenueAccountId("");
  }

  function openEditEntry(entry: any) {
    setEditEntry(entry);
    setECustomerId(String(entry.customerId));
    setEServiceId(String(entry.serviceId || ""));
    setEDate(entry.date);
    setEHours(String(Number(entry.hours)));
    setEDescription(entry.description || "");
    setEHourlyRate(String(Number(entry.hourlyRate)));
    setShowEntryDialog(true);
  }

  function openEditService(svc: any) {
    setEditService(svc);
    setSName(svc.name);
    setSDescription(svc.description || "");
    setSHourlyRate(String(Number(svc.defaultHourlyRate)));
    setSRevenueAccountId(String(svc.revenueAccountId || ""));
    setShowServiceDialog(true);
  }

  function handleSaveEntry() {
    if (!eCustomerId || !eDate || !eHours || !eHourlyRate) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    if (editEntry) {
      updateEntry.mutate({
        id: editEntry.id,
        customerId: Number(eCustomerId),
        serviceId: eServiceId ? Number(eServiceId) : undefined,
        date: eDate,
        hours: Number(eHours),
        description: eDescription || undefined,
        hourlyRate: Number(eHourlyRate),
      });
    } else {
      createEntry.mutate({
        customerId: Number(eCustomerId),
        serviceId: eServiceId ? Number(eServiceId) : undefined,
        date: eDate,
        hours: Number(eHours),
        description: eDescription || undefined,
        hourlyRate: Number(eHourlyRate),
        fiscalYear,
      });
    }
  }

  function handleSaveService() {
    if (!sName.trim()) { toast.error("Name ist erforderlich"); return; }
    if (editService) {
      updateService.mutate({
        id: editService.id,
        name: sName.trim(),
        description: sDescription || undefined,
        defaultHourlyRate: sHourlyRate ? Number(sHourlyRate) : undefined,
        revenueAccountId: sRevenueAccountId ? Number(sRevenueAccountId) : undefined,
      });
    } else {
      createService.mutate({
        name: sName.trim(),
        description: sDescription || undefined,
        defaultHourlyRate: sHourlyRate ? Number(sHourlyRate) : undefined,
        revenueAccountId: sRevenueAccountId ? Number(sRevenueAccountId) : undefined,
      });
    }
  }

  // When customer or service changes, auto-fill hourly rate
  function handleCustomerChange(custId: string) {
    setECustomerId(custId);
    if (eServiceId && custId) {
      const cust = customersWithServices?.find((c: any) => c.id === Number(custId));
      const svc = cust?.services?.find((s: any) => s.id === Number(eServiceId));
      if (svc?.hourlyRate) setEHourlyRate(String(Number(svc.hourlyRate)));
    }
  }

  function handleServiceChange(svcId: string) {
    setEServiceId(svcId);
    // Auto-fill hourly rate from customer service or global service
    if (eCustomerId && svcId) {
      const cust = customersWithServices?.find((c: any) => c.id === Number(eCustomerId));
      const custSvc = cust?.services?.find((s: any) => s.id === Number(svcId));
      if (custSvc?.hourlyRate) {
        setEHourlyRate(String(Number(custSvc.hourlyRate)));
        return;
      }
    }
    if (svcId) {
      const globalSvc = servicesList?.find((s: any) => s.id === Number(svcId));
      if (globalSvc?.defaultHourlyRate) {
        setEHourlyRate(String(Number(globalSvc.defaultHourlyRate)));
      }
    }
  }

  // Summary calculations
  const totalHours = useMemo(() =>
    (entries || []).reduce((sum: number, e: any) => sum + Number(e.hours), 0),
    [entries]
  );
  const totalAmount = useMemo(() =>
    (entries || []).reduce((sum: number, e: any) => sum + Number(e.hours) * Number(e.hourlyRate), 0),
    [entries]
  );
  const openEntries = useMemo(() =>
    (entries || []).filter((e: any) => e.status === "open"),
    [entries]
  );

  // Group entries by customer for invoice view
  const entriesByCustomer = useMemo(() => {
    const grouped: Record<string, { customerName: string; customerId: number; entries: any[]; totalHours: number; totalAmount: number }> = {};
    for (const e of (openEntries || [])) {
      const key = String(e.customerId);
      if (!grouped[key]) {
        grouped[key] = { customerName: e.customerName || "Unbekannt", customerId: e.customerId, entries: [], totalHours: 0, totalAmount: 0 };
      }
      grouped[key].entries.push(e);
      grouped[key].totalHours += Number(e.hours);
      grouped[key].totalAmount += Number(e.hours) * Number(e.hourlyRate);
    }
    return Object.values(grouped);
  }, [openEntries]);

  // Export CSV
  function exportCSV() {
    if (!entries || entries.length === 0) { toast.error("Keine Einträge zum Exportieren"); return; }
    const header = "Datum;Kunde;Dienstleistung;Beschreibung;Stunden;Stundenansatz;Betrag;Status\n";
    const rows = entries.map((e: any) =>
      `${fmtDate(e.date)};${e.customerName || ""};${e.serviceName || ""};${(e.description || "").replace(/;/g, ",")};${fmt(e.hours)};${fmt(e.hourlyRate)};${fmt(Number(e.hours) * Number(e.hourlyRate))};${e.status === "open" ? "Offen" : "Verrechnet"}`
    ).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Zeiterfassung_${fiscalYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportiert");
  }

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5 max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-[22px] font-medium" style={{ color: "var(--ink)" }}>Zeiterfassung</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Arbeitszeiten erfassen, Dienstleistungen verwalten und Rechnungen erstellen
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button size="sm" onClick={() => { resetEntryForm(); setShowEntryDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Neuer Eintrag
          </Button>
        </div>
      </div>

      {/* 4 KLAX KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="klax-card p-4">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider font-medium" style={{ color: "var(--ink-3)" }}>
            <Clock className="h-3.5 w-3.5" /> Total Stunden
          </div>
          <div className="display mono text-[24px] font-medium mt-1.5" style={{ color: "var(--ink)" }}>{fmt(totalHours)}</div>
          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--hair)" }}>
            <div style={{ width: `${Math.min(100, (totalHours / 168) * 100)}%`, height: "100%", background: "var(--klax-accent)" }} />
          </div>
        </div>
        <div className="klax-card p-4">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider font-medium" style={{ color: "var(--ink-3)" }}>
            <FileText className="h-3.5 w-3.5" /> Verrechenbar
          </div>
          <div className="display mono text-[24px] font-medium mt-1.5" style={{ color: "var(--pos)" }}>CHF {fmt(totalAmount)}</div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>im aktuellen Filter</div>
        </div>
        <div className="klax-card p-4">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider font-medium" style={{ color: "var(--ink-3)" }}>
            <Users className="h-3.5 w-3.5" /> Offene Einträge
          </div>
          <div className="display mono text-[24px] font-medium mt-1.5" style={{ color: "var(--warn)" }}>{openEntries.length}</div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>noch nicht verrechnet</div>
        </div>
        <div className="klax-card p-4">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider font-medium" style={{ color: "var(--ink-3)" }}>
            <Briefcase className="h-3.5 w-3.5" /> Dienstleistungen
          </div>
          <div className="display mono text-[24px] font-medium mt-1.5" style={{ color: "var(--ink)" }}>{servicesList?.length || 0}</div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>aktiv</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="entries">Zeiteinträge</TabsTrigger>
          <TabsTrigger value="invoice">Zur Verrechnung</TabsTrigger>
          <TabsTrigger value="services">Dienstleistungen</TabsTrigger>
        </TabsList>

        {/* ─── Zeiteinträge Tab ──────────────────────────────────────────── */}
        <TabsContent value="entries" className="space-y-4">
          {/* Filters */}
          <div className="klax-card p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-40">
                  <Label className="text-xs">Kunde</Label>
                  <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kunden</SelectItem>
                      {(customersWithServices || []).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label className="text-xs">Dienstleistung</Label>
                  <Select value={filterService} onValueChange={setFilterService}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      {(servicesList || []).map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label className="text-xs">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="open">Offen</SelectItem>
                      <SelectItem value="invoiced">Verrechnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Label className="text-xs">Von</Label>
                  <Input type="date" className="h-8 text-xs" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </div>
                <div className="w-36">
                  <Label className="text-xs">Bis</Label>
                  <Input type="date" className="h-8 text-xs" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </div>
                {(filterCustomer !== "all" || filterService !== "all" || filterStatus !== "all" || filterDateFrom || filterDateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                    setFilterCustomer("all"); setFilterService("all"); setFilterStatus("all");
                    setFilterDateFrom(""); setFilterDateTo("");
                  }}>
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
          </div>

          {/* Entries Table */}
          <div className="klax-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Datum</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Dienstleistung</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right w-20">Stunden</TableHead>
                    <TableHead className="text-right w-24">Ansatz</TableHead>
                    <TableHead className="text-right w-28">Betrag</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!entries || entries.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Keine Zeiteinträge vorhanden
                      </TableCell>
                    </TableRow>
                  ) : entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{fmtDate(e.date)}</TableCell>
                      <TableCell className="text-sm font-medium">{e.customerName || "–"}</TableCell>
                      <TableCell className="text-sm">{e.serviceName || "–"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.description || "–"}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{fmt(e.hours)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{fmt(e.hourlyRate)}</TableCell>
                      <TableCell className="text-right text-sm font-mono font-medium">
                        {fmt(Number(e.hours) * Number(e.hourlyRate))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === "open" ? "outline" : "secondary"} className="text-xs">
                          {e.status === "open" ? "Offen" : "Verrechnet"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {e.status === "open" && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditEntry(e)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => { if (confirm("Eintrag löschen?")) deleteEntry.mutate({ id: e.id }); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
        </TabsContent>

        {/* ─── Zur Verrechnung Tab ───────────────────────────────────────── */}
        <TabsContent value="invoice" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Offene Zeiteinträge nach Kunde</CardTitle>
              <p className="text-sm text-muted-foreground">
                Übersicht der noch nicht verrechneten Zeiteinträge, gruppiert nach Kunde.
                Verwenden Sie die Debitoren-Seite, um Rechnungen zu erstellen.
              </p>
            </CardHeader>
            <CardContent>
              {entriesByCustomer.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Keine offenen Zeiteinträge vorhanden</p>
              ) : (
                <div className="space-y-4">
                  {entriesByCustomer.map(group => (
                    <CustomerInvoiceGroup key={group.customerId} group={group} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Dienstleistungen Tab ──────────────────────────────────────── */}
        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Definieren Sie Dienstleistungskategorien mit Stundenansätzen und Ertragskonten
            </p>
            <Button size="sm" onClick={() => { resetServiceForm(); setShowServiceDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Neue Dienstleistung
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right">Stundenansatz</TableHead>
                    <TableHead>Ertragskonto</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!servicesList || servicesList.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Keine Dienstleistungen definiert
                      </TableCell>
                    </TableRow>
                  ) : servicesList.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.description || "–"}</TableCell>
                      <TableCell className="text-right font-mono">CHF {fmt(s.defaultHourlyRate)}</TableCell>
                      <TableCell className="text-sm">
                        {s.revenueAccount ? `${s.revenueAccount.number} ${s.revenueAccount.name}` : "–"}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditService(s)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Entry Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showEntryDialog} onOpenChange={(open) => { if (!open) { setShowEntryDialog(false); resetEntryForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEntry ? "Zeiteintrag bearbeiten" : "Neuer Zeiteintrag"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Kunde *</Label>
              <Select value={eCustomerId} onValueChange={handleCustomerChange}>
                <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                <SelectContent>
                  {(customersWithServices || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dienstleistung</Label>
              <Select value={eServiceId} onValueChange={handleServiceChange}>
                <SelectTrigger><SelectValue placeholder="Dienstleistung wählen" /></SelectTrigger>
                <SelectContent>
                  {(servicesList || []).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Datum *</Label>
                <Input type="date" value={eDate} onChange={e => setEDate(e.target.value)} />
              </div>
              <div>
                <Label>Stunden *</Label>
                <Input type="number" step="0.25" min="0.01" value={eHours} onChange={e => setEHours(e.target.value)} placeholder="2.50" />
              </div>
              <div>
                <Label>Ansatz CHF *</Label>
                <Input type="number" step="0.50" value={eHourlyRate} onChange={e => setEHourlyRate(e.target.value)} placeholder="250.00" />
              </div>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea value={eDescription} onChange={e => setEDescription(e.target.value)} rows={3} placeholder="Beschreibung der Tätigkeit" />
            </div>
            {eHours && eHourlyRate && (
              <div className="text-right text-sm font-medium">
                Betrag: <span className="text-lg font-bold">CHF {fmt(Number(eHours) * Number(eHourlyRate))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEntryDialog(false); resetEntryForm(); }}>Abbrechen</Button>
            <Button onClick={handleSaveEntry} disabled={createEntry.isPending || updateEntry.isPending}>
              {(createEntry.isPending || updateEntry.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editEntry ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Service Dialog ────────────────────────────────────────────── */}
      <Dialog open={showServiceDialog} onOpenChange={(open) => { if (!open) { setShowServiceDialog(false); resetServiceForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editService ? "Dienstleistung bearbeiten" : "Neue Dienstleistung"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={sName} onChange={e => setSName(e.target.value)} placeholder="z.B. Finanzberatung" />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Input value={sDescription} onChange={e => setSDescription(e.target.value)} placeholder="Optionale Beschreibung" />
            </div>
            <div>
              <Label>Standard-Stundenansatz (CHF)</Label>
              <Input type="number" step="0.50" value={sHourlyRate} onChange={e => setSHourlyRate(e.target.value)} placeholder="250.00" />
            </div>
            <div>
              <Label>Ertragskonto</Label>
              <Select value={sRevenueAccountId} onValueChange={setSRevenueAccountId}>
                <SelectTrigger><SelectValue placeholder="Ertragskonto wählen" /></SelectTrigger>
                <SelectContent>
                  {revenueAccountsList.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.number} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowServiceDialog(false); resetServiceForm(); }}>Abbrechen</Button>
            <Button onClick={handleSaveService} disabled={createService.isPending || updateService.isPending}>
              {editService ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Customer Invoice Group (expandable) ──────────────────────────────────────

function CustomerInvoiceGroup({ group }: { group: { customerName: string; customerId: number; entries: any[]; totalHours: number; totalAmount: number } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{group.customerName}</span>
          <Badge variant="outline" className="text-xs">{group.entries.length} Einträge</Badge>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span>{fmt(group.totalHours)} Std.</span>
          <span className="font-bold">CHF {fmt(group.totalAmount)}</span>
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Datum</TableHead>
                <TableHead className="text-xs">Dienstleistung</TableHead>
                <TableHead className="text-xs">Beschreibung</TableHead>
                <TableHead className="text-xs text-right">Stunden</TableHead>
                <TableHead className="text-xs text-right">Ansatz</TableHead>
                <TableHead className="text-xs text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.entries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{fmtDate(e.date)}</TableCell>
                  <TableCell className="text-xs">{e.serviceName || "–"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.description || "–"}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmt(e.hours)}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmt(e.hourlyRate)}</TableCell>
                  <TableCell className="text-xs text-right font-mono font-medium">{fmt(Number(e.hours) * Number(e.hourlyRate))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell colSpan={3} className="text-xs text-right">Total</TableCell>
                <TableCell className="text-xs text-right font-mono">{fmt(group.totalHours)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-xs text-right font-mono">CHF {fmt(group.totalAmount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
