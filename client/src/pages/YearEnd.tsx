import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarCheck, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, Loader2, FileText, Calculator, RotateCcw, Lock,
  ChevronDown, ChevronUp, Info, Building2, TrendingDown, Receipt, ArrowLeftRight
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jahresabschluss</h1>
          <p className="text-muted-foreground">Geschäftsjahr abschliessen, Saldovortrag und Jahresendbuchungen</p>
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

      {/* Fiscal Year Selector */}
      <div className="flex gap-3 flex-wrap">
        {fiscalYears.map(fy => (
          <Button
            key={fy.year}
            variant={selectedYear === fy.year ? "default" : "outline"}
            onClick={() => setSelectedYear(fy.year)}
            className="relative"
          >
            GJ {fy.year}
            <Badge
              variant={fy.status === "closed" ? "default" : fy.status === "closing" ? "secondary" : "outline"}
              className="ml-2 text-xs"
            >
              {fy.status === "closed" ? "Abgeschlossen" : fy.status === "closing" ? "Im Abschluss" : "Offen"}
            </Badge>
          </Button>
        ))}
        {fiscalYears.length === 0 && (
          <p className="text-muted-foreground text-sm py-2">Noch keine Geschäftsjahre vorhanden. Erstellen Sie ein neues Geschäftsjahr.</p>
        )}
      </div>

      {selectedYear && (
        <>
          {/* Progress Steps */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      i < step ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                      i === step ? "bg-primary/10 text-primary font-medium" :
                      "text-muted-foreground"
                    }`}>
                      {i < step ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : s.icon}
                      <span className="text-sm hidden lg:inline">{s.label}</span>
                    </div>
                    {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground uppercase">Status</p>
                  <p className="text-lg font-semibold mt-1">
                    {currentFY?.status === "closed" ? "Abgeschlossen" :
                     currentFY?.status === "closing" ? "Im Abschluss" : "Offen"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground uppercase">Vorschläge</p>
                  <p className="text-lg font-semibold mt-1">{suggestedCount} offen</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground uppercase">Genehmigt</p>
                  <p className="text-lg font-semibold mt-1 text-green-600">{approvedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground uppercase">Saldovortrag</p>
                  <p className="text-lg font-semibold mt-1">
                    {currentFY?.balanceCarriedForward ?
                      <span className="text-green-600">Erledigt</span> :
                      <span className="text-muted-foreground">Ausstehend</span>
                    }
                  </p>
                </CardContent>
              </Card>
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
