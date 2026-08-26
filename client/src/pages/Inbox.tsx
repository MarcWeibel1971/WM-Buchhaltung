import { trpc } from "@/lib/trpc";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Link } from "wouter";
import {
  FileText, Building2, CheckSquare, Receipt, Clock,
  ArrowRight, Upload, Sparkles, AlertTriangle, CheckCircle,
  Link2, Eye
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Inbox() {
  const { fiscalYear } = useFiscalYear();

  const { data: pendingJournal } = trpc.journal.list.useQuery({ status: "pending", limit: 50 });
  const { data: pendingBank } = trpc.bankImport.getPendingTransactions.useQuery({});
  const { data: allDocs } = trpc.documents.list.useQuery({ fiscalYear });
  const { data: company } = trpc.settings.getCompanySettings.useQuery();

  // Compute task counts
  const pendingEntries = pendingJournal?.entries?.length ?? 0;
  const pendingBankTx = pendingBank?.length ?? 0;
  const unmatchedBankTx = pendingBank?.filter(tx => !tx.matchedDocumentId)?.length ?? 0;
  const matchedBankTx = pendingBankTx - unmatchedBankTx;
  const newDocs = allDocs?.filter(d => !d.matchStatus || d.matchStatus === "unmatched")?.length ?? 0;
  const aiProcessedDocs = allDocs?.filter(d => d.aiMetadata)?.length ?? 0;
  const matchedDocs = allDocs?.filter(d => d.matchStatus === "matched")?.length ?? 0;

  const tasks = [
    {
      icon: FileText,
      label: "Neue Belege",
      count: newDocs,
      color: "oklch(0.65 0.20 250)",
      bgColor: "oklch(0.65 0.20 250 / 0.1)",
      href: "/belege?filter=new",
      description: "Belege warten auf KI-Analyse",
      emptyText: "Alle Belege wurden verarbeitet",
    },
    {
      icon: CheckSquare,
      label: "Zur Freigabe",
      count: pendingEntries,
      color: "oklch(0.65 0.18 145)",
      bgColor: "oklch(0.65 0.18 145 / 0.1)",
      href: "/freigaben",
      description: "Buchungsvorschläge bereit zur Genehmigung",
      emptyText: "Keine offenen Freigaben",
    },
    {
      icon: Building2,
      label: "Ungematchte Banktransaktionen",
      count: unmatchedBankTx,
      color: "oklch(0.70 0.15 60)",
      bgColor: "oklch(0.70 0.15 60 / 0.1)",
      href: "/bank?tab=unmatched",
      description: "Banktransaktionen ohne zugeordneten Beleg",
      emptyText: "Alle Bankbewegungen zugeordnet",
    },
    {
      icon: Receipt,
      label: "Offene Rechnungen",
      count: 0, // Will be populated when invoices query is available
      color: "oklch(0.60 0.20 25)",
      bgColor: "oklch(0.60 0.20 25 / 0.1)",
      href: "/rechnungen?tab=open",
      description: "Offene Forderungen und fällige Zahlungen",
      emptyText: "Keine offenen Rechnungen",
    },
  ];

  const activeTasks = tasks.filter(t => t.count > 0);
  const completedTasks = tasks.filter(t => t.count === 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Inbox</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTasks.length > 0
              ? `${activeTasks.reduce((s, t) => s + t.count, 0)} offene Aufgaben`
              : "Alles erledigt – keine offenen Aufgaben"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/belege">
            <Button size="sm" className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Beleg hochladen
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zu erledigen</h3>
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <Link key={task.href} href={task.href}>
                <Card className="border-border hover:border-primary/30 transition-all cursor-pointer group shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: task.bgColor }}>
                        <task.icon className="h-5 w-5" style={{ color: task.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{task.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: task.bgColor, color: task.color }}>
                            {task.count}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KI Status */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">KI-Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-2xl font-bold text-foreground">{aiProcessedDocs}</span>
              </div>
              <p className="text-xs text-muted-foreground">Automatisch erkannt</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Link2 className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold text-foreground">{matchedDocs}</span>
              </div>
              <p className="text-xs text-muted-foreground">Gematcht</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-amber-500" />
                <span className="text-2xl font-bold text-foreground">{pendingEntries}</span>
              </div>
              <p className="text-xs text-muted-foreground">Zur Prüfung</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Completed / Empty States */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Erledigt</h3>
          <div className="space-y-1">
            {completedTasks.map((task) => (
              <div key={task.href} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/30">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{task.emptyText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All done state */}
      {activeTasks.length === 0 && (
        <Card className="border-border shadow-sm">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Alles erledigt!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Alle Vorschläge wurden verbucht und alle Transaktionen zugeordnet.
              Neue Belege oder Banktransaktionen erscheinen hier automatisch.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Link href="/belege">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Beleg hochladen
                </Button>
              </Link>
              <Link href="/bank?tab=import">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Bank importieren
                </Button>
              </Link>
              <Link href="/rechnungen">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />
                  Rechnung erstellen
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
