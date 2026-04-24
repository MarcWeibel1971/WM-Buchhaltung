import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarCheck, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, Loader2, FileText, Calculator, RotateCcw, Lock,
  ChevronDown, ChevronUp, Info, Building2, TrendingDown, Receipt, ArrowLeftRight, Sparkles
} from "lucide-react";

const BOOKING_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  transitorische_passiven: { label: "Transitorische Passiven", icon: <Receipt className="h-4 w-4" />, color: "text-orange-600" },
  transitorische_aktiven: { label: "Transitorische Aktiven", icon: <ArrowLeftRight className="h-4 w-4" />, color: "text-blue-600" },
  kreditoren: { label: "Kreditoren", icon: <FileText className="h-4 w-4" />, color: "text-red-600" },
  debitoren: { label: "Debitoren", icon: <FileText className="h-4 w-4" />, color: "text-green-600" },
  abschreibung: { label: "Abschreibungen", icon: <TrendingDown className="h-4 w-4" />, color: "text-purple-600" },
  rueckbuchung: { label: "Rückbuchungen", icon: <RotateCcw className="h-4 w-4" />, color: "text-gray-600" },
};

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function YearEnd() {

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const fiscalYearsQuery = trpc.yearEnd.listFiscalYears.useQuery();
  const summaryQuery = trpc.yearEnd.getSummary.useQuery(
    { year: selectedYear! },
    { enabled: !!selectedYear }
  );
  const bookingsQuery = trpc.yearEnd.listBookings.useQuery(
    { year: selectedYear! },
    { enabled: !!selectedYear }
  );

  const createFiscalYear = trpc.yearEnd.createFiscalYear.useMutation({
    onSuccess: () => {
      toast.success("Geschäftsjahr erstellt");
      fiscalYearsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const startClosing = trpc.yearEnd.startClosing.useMutation({
    onSuccess: () => {
      toast.success("Abschluss gestartet");
      summaryQuery.refetch();
      fiscalYearsQuery.refetch();
    },
  });

  const generateSuggestions = trpc.yearEnd.generateSuggestions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} Buchungsvorschläge generiert`);
      bookingsQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveBooking = trpc.yearEnd.approveBooking.useMutation({
    onSuccess: () => {
      bookingsQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const rejectBooking = trpc.yearEnd.rejectBooking.useMutation({
    onSuccess: () => {
      bookingsQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const approveAll = trpc.yearEnd.approveAll.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} Buchungen genehmigt`);
      bookingsQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const generateReversals = trpc.yearEnd.generateReversals.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.reversed} Rückbuchungen erstellt`);
      bookingsQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const carryForward = trpc.yearEnd.carryForwardBalances.useMutation({
    onSuccess: (data) => {
      toast.success(`Saldovortrag: ${data.accountsCarriedForward} Konten vorgetragen. Ergebnis: CHF ${formatCHF(data.netResult)}`);
      summaryQuery.refetch();
      fiscalYearsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const closeFiscalYear = trpc.yearEnd.closeFiscalYear.useMutation({
    onSuccess: () => {
      toast.success("Geschäftsjahr abgeschlossen");
      summaryQuery.refetch();
      fiscalYearsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const fiscalYears = fiscalYearsQuery.data || [];
  const summary = summaryQuery.data;
  const bookings = bookingsQuery.data || [];
  const currentFY = summary?.fiscalYear;

  // Group bookings by type
  const bookingsByType = useMemo(() => {
    const groups: Record<string, typeof bookings> = {};
    for (const b of bookings) {
      if (!groups[b.bookingType]) groups[b.bookingType] = [];
      groups[b.bookingType].push(b);
    }
    return groups;
  }, [bookings]);

  const suggestedCount = bookings.filter(b => b.status === "suggested").length;
  const approvedCount = bookings.filter(b => b.status === "approved").length;
  const rejectedCount = bookings.filter(b => b.status === "rejected").length;

  // Determine current step
  const getStep = () => {
    if (!currentFY) return 0;
    if (currentFY.status === "closed") return 5;
    if (currentFY.balanceCarriedForward) return 4;
    if (approvedCount > 0 && suggestedCount === 0) return 3;
    if (bookings.length > 0) return 2;
    if (currentFY.status === "closing") return 1;
    return 0;
  };
  const step = getStep();

  const steps = [
    { label: "Abschluss starten", icon: <CalendarCheck className="h-5 w-5" /> },
    { label: "Vorschläge generieren", icon: <Calculator className="h-5 w-5" /> },
    { label: "Buchungen prüfen", icon: <FileText className="h-5 w-5" /> },
    { label: "Rückbuchungen & Saldovortrag", icon: <RotateCcw className="h-5 w-5" /> },
    { label: "Abschluss finalisieren", icon: <Lock className="h-5 w-5" /> },
  ];

  // Find next year to create
  const existingYears = fiscalYears.map(fy => fy.year);
  const currentYear = new Date().getFullYear();
  const nextNewYear = existingYears.includes(currentYear + 1) ? currentYear + 2 : currentYear + 1;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-[22px] font-medium" style={{ color: "var(--ink)" }}>Jahresabschluss</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Geschäftsjahr abschliessen, Saldovortrag und Jahresendbuchungen
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => createFiscalYear.mutate({ year: nextNewYear })}
          disabled={createFiscalYear.isPending}
        >
          {createFiscalYear.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
          GJ {nextNewYear} eröffnen
        </Button>
      </div>

      {/* GJ-Tabs (KLAX underline style) */}
      <div
        className="flex items-center gap-5 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        {fiscalYears.map(fy => {
          const isActive = selectedYear === fy.year;
          const statusLabel =
            fy.status === "closed" ? "Abgeschlossen" :
            fy.status === "closing" ? "Im Abschluss" : "Offen";
          const pillClass =
            fy.status === "closed" ? "pill--pos" :
            fy.status === "closing" ? "pill--warn" : "pill--info";
          return (
            <button
              key={fy.year}
              onClick={() => setSelectedYear(fy.year)}
              className="relative py-2.5 flex items-center gap-2 text-[13px] whitespace-nowrap"
              style={{
                color: isActive ? "var(--ink)" : "var(--ink-3)",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              <span>GJ {fy.year}</span>
              <span className={`pill ${pillClass}`}>{statusLabel}</span>
              {isActive && (
                <span
                  className="absolute left-0 right-0 -bottom-px h-[2px]"
                  style={{ background: "var(--klax-accent)" }}
                />
              )}
            </button>
          );
        })}
        {fiscalYears.length === 0 && (
          <p className="text-[13px] py-2" style={{ color: "var(--ink-3)" }}>
            Noch keine Geschäftsjahre vorhanden.
          </p>
        )}
      </div>

      {selectedYear && (
        <>
          {/* 5-Step Stepper */}
          <div className="klax-card p-5">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => {
                const isDone = i < step;
                const isActive = i === step;
                return (
                  <div key={i} className="flex items-center flex-1">
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
                      style={{
                        background: isDone ? "var(--pos-soft)" : isActive ? "var(--klax-accent-soft)" : "transparent",
                        color: isDone ? "var(--pos)" : isActive ? "var(--klax-accent)" : "var(--ink-3)",
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium"
                        style={{
                          background: isDone ? "var(--pos)" : isActive ? "var(--klax-accent)" : "var(--surface-2)",
                          color: isDone || isActive ? "#fff" : "var(--ink-3)",
                        }}
                      >
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className="text-[12.5px] hidden lg:inline">{s.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                      <ChevronRight className="h-4 w-4 mx-1" style={{ color: "var(--ink-4)" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* KI-Callout */}
          <div
            className="klax-card p-4 flex items-start gap-3"
            style={{ background: "var(--ai-soft)", borderColor: "var(--ai-line)" }}
          >
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--ai)", color: "#fff" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1 text-[12.5px]" style={{ color: "var(--ink)" }}>
              <div className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: "var(--ai)" }}>KLAX Abschluss-Assistent</span>
                <span className="pill pill--ai">Haiku 4.5</span>
              </div>
              <p className="mt-1" style={{ color: "var(--ink-2)" }}>
                KLAX prüft transitorische Buchungen, Abschreibungen und offene Kreditoren
                und schlägt Jahresendbuchungen vor.
              </p>
            </div>
          </div>

          {/* 4 KPI Tiles */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="klax-card p-4">
                <div className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>Status</div>
                <div className="text-[14px] font-semibold mt-1.5" style={{ color: "var(--ink)" }}>
                  {currentFY?.status === "closed" ? "Abgeschlossen" :
                   currentFY?.status === "closing" ? "Im Abschluss" : "Offen"}
                </div>
              </div>
              <div className="klax-card p-4">
                <div className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>Vorschläge</div>
                <div className="display mono text-[22px] font-medium mt-1.5" style={{ color: "var(--warn)" }}>
                  {suggestedCount}
                </div>
                <div className="text-[11px]" style={{ color: "var(--ink-4)" }}>offen</div>
              </div>
              <div className="klax-card p-4">
                <div className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>Genehmigt</div>
                <div className="display mono text-[22px] font-medium mt-1.5" style={{ color: "var(--pos)" }}>
                  {approvedCount}
                </div>
              </div>
              <div className="klax-card p-4">
                <div className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>Saldovortrag</div>
                <div className="text-[14px] font-semibold mt-1.5" style={{ color: currentFY?.balanceCarriedForward ? "var(--pos)" : "var(--ink-3)" }}>
                  {currentFY?.balanceCarriedForward ? "Erledigt" : "Ausstehend"}
                </div>
              </div>
            </div>
          )}

          {/* Action Area */}
          {currentFY?.status !== "closed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {step === 0 && "Schritt 1: Jahresabschluss starten"}
                  {step === 1 && "Schritt 2: Buchungsvorschläge generieren"}
                  {step === 2 && "Schritt 3: Buchungsvorschläge prüfen und genehmigen"}
                  {step === 3 && "Schritt 4: Rückbuchungen erstellen und Saldovortrag"}
                  {step === 4 && "Schritt 5: Geschäftsjahr abschliessen"}
                </CardTitle>
                <CardDescription>
                  {step === 0 && "Starten Sie den Abschlussprozess für das Geschäftsjahr " + selectedYear + ". Stellen Sie sicher, dass alle Buchungen erfasst sind."}
                  {step === 1 && "Das System analysiert Banktransaktionen, Rechnungen und Anlagevermögen und erstellt automatische Buchungsvorschläge."}
                  {step === 2 && `${suggestedCount} Vorschläge warten auf Ihre Prüfung. Genehmigen oder lehnen Sie die Vorschläge ab.`}
                  {step === 3 && "Erstellen Sie automatische Rückbuchungen für transitorische Buchungen und führen Sie den Saldovortrag durch."}
                  {step === 4 && "Alle Buchungen sind verarbeitet und der Saldovortrag ist abgeschlossen. Schliessen Sie das Geschäftsjahr ab."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 flex-wrap">
                  {step === 0 && (
                    <Button onClick={() => startClosing.mutate({ year: selectedYear })} disabled={startClosing.isPending}>
                      {startClosing.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
                      Abschluss starten
                    </Button>
                  )}
                  {step === 1 && (
                    <Button onClick={() => generateSuggestions.mutate({ year: selectedYear })} disabled={generateSuggestions.isPending}>
                      {generateSuggestions.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                      Vorschläge generieren
                    </Button>
                  )}
                  {step === 2 && suggestedCount > 0 && (
                    <>
                      <Button onClick={() => approveAll.mutate({ year: selectedYear })} disabled={approveAll.isPending}>
                        {approveAll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Alle genehmigen ({suggestedCount})
                      </Button>
                      <Button variant="outline" onClick={() => generateSuggestions.mutate({ year: selectedYear })} disabled={generateSuggestions.isPending}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <Button onClick={() => generateReversals.mutate({ year: selectedYear })} disabled={generateReversals.isPending}>
                        {generateReversals.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                        Rückbuchungen erstellen
                      </Button>
                      <Button
                        variant={currentFY?.balanceCarriedForward ? "outline" : "default"}
                        onClick={() => carryForward.mutate({ year: selectedYear })}
                        disabled={carryForward.isPending}
                      >
                        {carryForward.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                        Saldovortrag durchführen
                      </Button>
                    </>
                  )}
                  {step === 4 && (
                    <Button variant="destructive" onClick={() => closeFiscalYear.mutate({ year: selectedYear })} disabled={closeFiscalYear.isPending}>
                      {closeFiscalYear.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                      Geschäftsjahr {selectedYear} abschliessen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Closed Year Info */}
          {currentFY?.status === "closed" && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800">
              <CardContent className="pt-6 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">Geschäftsjahr {selectedYear} ist abgeschlossen</p>
                  <p className="text-sm text-muted-foreground">
                    Abgeschlossen am {currentFY.closedAt ? new Date(currentFY.closedAt).toLocaleDateString("de-CH") : "–"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Booking Suggestions by Type */}
          {bookings.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Jahresendbuchungen</h2>

              {Object.entries(bookingsByType).map(([type, items]) => {
                const typeInfo = BOOKING_TYPE_LABELS[type] || { label: type, icon: <FileText className="h-4 w-4" />, color: "text-gray-600" };
                const isExpanded = expandedType === type;
                const totalAmount = items.reduce((sum, b) => sum + parseFloat(b.amount), 0);
                const pendingCount = items.filter(b => b.status === "suggested").length;

                return (
                  <Card key={type}>
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedType(isExpanded ? null : type)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={typeInfo.color}>{typeInfo.icon}</span>
                        <div>
                          <p className="font-medium">{typeInfo.label}</p>
                          <p className="text-sm text-muted-foreground">{items.length} Buchungen · CHF {formatCHF(totalAmount)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {pendingCount > 0 && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                            {pendingCount} offen
                          </Badge>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-3 font-medium">Beschreibung</th>
                              <th className="text-left p-3 font-medium">Soll</th>
                              <th className="text-left p-3 font-medium">Haben</th>
                              <th className="text-right p-3 font-medium">Betrag CHF</th>
                              <th className="text-center p-3 font-medium">Status</th>
                              <th className="text-right p-3 font-medium">Aktionen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(booking => (
                              <tr key={booking.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="p-3">
                                  <p className="font-medium">{booking.description}</p>
                                  {booking.aiReasoning && (
                                    <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                      {booking.aiReasoning}
                                    </p>
                                  )}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="text-xs">{booking.debitAccountNumber}</span>{" "}
                                  <span className="text-muted-foreground text-xs">{booking.debitAccountName}</span>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="text-xs">{booking.creditAccountNumber}</span>{" "}
                                  <span className="text-muted-foreground text-xs">{booking.creditAccountName}</span>
                                </td>
                                <td className="p-3 text-right font-mono whitespace-nowrap">
                                  {formatCHF(booking.amount)}
                                </td>
                                <td className="p-3 text-center">
                                  {booking.status === "suggested" && (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Vorschlag</Badge>
                                  )}
                                  {booking.status === "approved" && (
                                    <Badge variant="default" className="bg-green-100 text-green-700">Genehmigt</Badge>
                                  )}
                                  {booking.status === "rejected" && (
                                    <Badge variant="destructive">Abgelehnt</Badge>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  {booking.status === "suggested" && (
                                    <div className="flex gap-1 justify-end">
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={(e) => { e.stopPropagation(); approveBooking.mutate({ bookingId: booking.id }); }}
                                        disabled={approveBooking.isPending}
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => { e.stopPropagation(); rejectBooking.mutate({ bookingId: booking.id }); }}
                                        disabled={rejectBooking.isPending}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/30 font-medium">
                              <td className="p-3">Total {typeInfo.label}</td>
                              <td className="p-3"></td>
                              <td className="p-3"></td>
                              <td className="p-3 text-right font-mono">{formatCHF(totalAmount)}</td>
                              <td className="p-3"></td>
                              <td className="p-3"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {bookings.length === 0 && currentFY?.status === "closing" && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Noch keine Buchungsvorschläge generiert.</p>
                <p className="text-sm text-muted-foreground mt-1">Klicken Sie auf "Vorschläge generieren", um automatische Jahresendbuchungen zu erstellen.</p>
              </CardContent>
            </Card>
          )}

          {/* Info Box */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-blue-700 dark:text-blue-400">Hinweise zum Jahresabschluss</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>Transitorische Passiven (2300):</strong> Rechnungen mit Datum {selectedYear ? selectedYear + 1 : "nächstes Jahr"}, aber Leistung im {selectedYear}</li>
                    <li><strong>Transitorische Aktiven (1300):</strong> Vorauszahlungen {selectedYear} für Leistungen im {selectedYear ? selectedYear + 1 : "nächsten Jahr"}</li>
                    <li><strong>Kreditoren (2000):</strong> Unbezahlte Rechnungen aus dem {selectedYear}</li>
                    <li><strong>Abschreibungen:</strong> Gemäss den Abschreibungssätzen in den Einstellungen</li>
                    <li><strong>Rückbuchungen:</strong> Automatisch am 01.01.{selectedYear ? selectedYear + 1 : "nächstes Jahr"} für transitorische Buchungen</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
