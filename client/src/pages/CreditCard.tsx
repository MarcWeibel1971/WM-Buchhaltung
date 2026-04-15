import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { Upload, Check, FileText, CreditCard as CreditCardIcon, Trash2, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

function formatCHF(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function CreditCard() {
  const [approveDialog, setApproveDialog] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: statements, refetch } = trpc.creditCard.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const utils = trpc.useUtils();

  const uploadMutation = trpc.creditCard.uploadStatement.useMutation({
    onSuccess: () => { toast.success("Kreditkartenabrechnung hochgeladen"); refetch(); setUploading(false); },
    onError: (e) => { toast.error(e.message); setUploading(false); },
  });

  const approveMutation = trpc.creditCard.approveStatement.useMutation({
    onSuccess: () => {
      toast.success("Sammelbelastung verbucht");
      setApproveDialog(null);
      refetch();
      utils.reports.dashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.creditCard.deleteStatement.useMutation({
    onSuccess: () => {
      toast.success("KK-Abrechnung gelöscht");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unapproveMutation = trpc.creditCard.unapproveStatement.useMutation({
    onSuccess: () => {
      toast.success("Verbuchung rückgängig gemacht – Abrechnung ist wieder ausstehend");
      refetch();
      utils.reports.dashboard.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Bitte eine PDF-Datei hochladen");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      try {
        const response = await fetch("/api/trpc/creditCard.parseStatement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { fileBase64: base64, filename: file.name } }),
        });
        const totalStr = prompt("Gesamtbetrag der Kreditkartenabrechnung (CHF):", "0.00");
        if (!totalStr) { setUploading(false); return; }
        uploadMutation.mutate({
          statementDate: new Date().toISOString().split("T")[0],
          totalAmount: totalStr,
          rawText: file.name,
          parsedItems: [],
        });
      } catch {
        setUploading(false);
        toast.error("Fehler beim Verarbeiten der PDF");
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Kreditkarte</h2>
        <p className="text-sm text-muted-foreground">VISA mw – Sammelbelastung über Konto 1082</p>
      </div>

      {/* Upload */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-semibold mb-3">Kreditkartenabrechnung hochladen</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Laden Sie die monatliche VISA-Abrechnung als PDF hoch. Die Belastungen werden als
          Sammelbelastung über das Durchlaufkonto 1082 verbucht.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
        />
        <Button
          variant="outline"
          className="gap-2"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Wird verarbeitet..." : "PDF hochladen"}
        </Button>
      </div>

      {/* Statements list */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Kreditkartenabrechnungen</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Datum</th>
                <th>Inhaber</th>
                <th className="text-right">Gesamtbetrag CHF</th>
                <th className="text-center">Positionen</th>
                <th>Status</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!statements?.length ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <CreditCardIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Noch keine Abrechnungen hochgeladen
                  </td>
                </tr>
              ) : statements.map(stmt => {
                const items = (stmt.parsedItems as any[] | null) ?? [];
                const isExpanded = expandedId === stmt.id;
                const hasItems = items.length > 0;

                return (
                  <StatementRow
                    key={stmt.id}
                    stmt={stmt}
                    items={items}
                    isExpanded={isExpanded}
                    hasItems={hasItems}
                    accounts={accounts ?? []}
                    onToggle={() => toggleExpand(stmt.id)}
                    onApprove={() => setApproveDialog(stmt)}
                    onDelete={() => {
                      if (confirm("KK-Abrechnung wirklich löschen?")) {
                        deleteMutation.mutate({ statementId: stmt.id });
                      }
                    }}
                    onUnapprove={() => {
                      if (confirm("Verbuchung rückgängig machen? Der Journal-Eintrag wird gelöscht.")) {
                        unapproveMutation.mutate({ statementId: stmt.id });
                      }
                    }}
                    deleteIsPending={deleteMutation.isPending}
                    unapproveIsPending={unapproveMutation.isPending}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve Dialog */}
      {approveDialog && (
        <Dialog open onOpenChange={() => setApproveDialog(null)}>
          <DialogContent className="w-[min(95vw,32rem)] max-w-none">
            <DialogHeader>
              <DialogTitle>Sammelbelastung verbuchen</DialogTitle>
            </DialogHeader>
            <ApproveStatementForm
              stmt={approveDialog}
              accounts={accounts ?? []}
              onApprove={(debitAccountId, description) =>
                approveMutation.mutate({ statementId: approveDialog.id, debitAccountId, description })
              }
              isPending={approveMutation.isPending}
              onClose={() => setApproveDialog(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ── Statement Row with expandable detail ──────────────────────────── */
function StatementRow({ stmt, items, isExpanded, hasItems, accounts, onToggle, onApprove, onDelete, onUnapprove, deleteIsPending, unapproveIsPending }: {
  stmt: any;
  items: any[];
  isExpanded: boolean;
  hasItems: boolean;
  accounts: any[];
  onToggle: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onUnapprove: () => void;
  deleteIsPending: boolean;
  unapproveIsPending: boolean;
}) {
  return (
    <>
      <tr
        className={`${hasItems ? "cursor-pointer hover:bg-muted/50" : ""} ${isExpanded ? "bg-muted/30" : ""}`}
        onClick={hasItems ? onToggle : undefined}
      >
        <td className="text-center w-8 px-2">
          {hasItems ? (
            isExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </td>
        <td className="text-sm">
          {new Date(stmt.statementDate as any).toLocaleDateString("de-CH")}
        </td>
        <td className="text-sm font-medium">{stmt.owner?.toUpperCase() ?? "MW"}</td>
        <td className="text-right font-mono text-sm amount-negative">
          {formatCHF(stmt.totalAmount as string)}
        </td>
        <td className="text-center text-sm text-muted-foreground">
          {hasItems ? (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {items.length}
            </span>
          ) : (
            <span className="text-xs">–</span>
          )}
        </td>
        <td>
          {stmt.status === "pending"
            ? <span className="badge-pending">Ausstehend</span>
            : <span className="badge-approved">Verbucht</span>}
        </td>
        <td className="text-right" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1 justify-end">
            {stmt.status === "pending" && (
              <>
                <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                  onClick={onApprove}>
                  <Check className="h-3 w-3" /> Verbuchen
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" title="Löschen"
                  disabled={deleteIsPending}
                  onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {stmt.status === "approved" && (
              <>
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" /> Verbucht
                </span>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                  disabled={unapproveIsPending}
                  onClick={onUnapprove}>
                  <Undo2 className="h-3 w-3" />
                  Rückgängig
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail rows */}
      {isExpanded && hasItems && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-muted/20 border-t border-b border-border">
              <div className="px-6 py-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Einzelpositionen ({items.length})
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/50">
                      <th className="text-left py-1.5 pr-4 font-medium">Datum</th>
                      <th className="text-left py-1.5 pr-4 font-medium">Beschreibung</th>
                      <th className="text-left py-1.5 pr-4 font-medium">Konto</th>
                      <th className="text-right py-1.5 font-medium">Betrag CHF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, idx: number) => {
                      // Try to find the account from the item's category or suggestedAccountId
                      const accountId = item.suggestedAccountId || item.accountId;
                      const account = accountId ? accounts.find((a: any) => a.id === accountId) : null;
                      const accountLabel = account
                        ? `${account.number} ${account.name}`
                        : (item.category || "–");
                      const amount = parseFloat(item.amount || "0");

                      return (
                        <tr key={idx} className="border-b border-border/30 last:border-0">
                          <td className="py-1.5 pr-4 text-xs whitespace-nowrap">
                            {item.date || "–"}
                          </td>
                          <td className="py-1.5 pr-4 text-xs max-w-xs">
                            <span className="truncate block" title={item.description}>
                              {item.description || "–"}
                            </span>
                          </td>
                          <td className="py-1.5 pr-4 text-xs">
                            <span className="font-mono text-muted-foreground">{accountLabel}</span>
                          </td>
                          <td className={`py-1.5 text-right font-mono text-xs tabular-nums ${amount < 0 ? "text-red-600" : ""}`}>
                            {amount < 0 ? "-" : ""}{formatCHF(Math.abs(amount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-medium">
                      <td colSpan={3} className="py-2 text-xs text-right pr-4">Total</td>
                      <td className="py-2 text-right font-mono text-xs tabular-nums text-red-600">
                        {formatCHF(items.reduce((sum: number, item: any) => sum + Math.abs(parseFloat(item.amount || "0")), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ApproveStatementForm({ stmt, accounts, onApprove, isPending, onClose }: {
  stmt: any; accounts: any[];
  onApprove: (debitId: number, desc: string) => void;
  isPending: boolean; onClose: () => void;
}) {
  const [debitId, setDebitId] = useState<number>(0);
  const [description, setDescription] = useState(`VISA Sammelbelastung ${new Date(stmt.statementDate as any).toLocaleDateString("de-CH")}`);

  return (
    <>
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Datum</span>
            <span>{new Date(stmt.statementDate as any).toLocaleDateString("de-CH")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gesamtbetrag</span>
            <span className="font-mono font-semibold amount-negative">
              CHF {new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2 }).format(parseFloat(stmt.totalAmount as string))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Haben-Konto</span>
            <span className="font-mono text-xs">1082 – Durchlaufkonto VISA mw</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Soll-Konto (Aufwand)</label>
          <Select value={String(debitId || "")} onValueChange={v => setDebitId(parseInt(v))}>
            <SelectTrigger><SelectValue placeholder="Aufwandskonto wählen..." /></SelectTrigger>
            <SelectContent className="max-h-64">
              {accounts.filter(a => a.accountType === "expense").map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.number} – {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Buchungstext</label>
          <input
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button disabled={!debitId || isPending} onClick={() => onApprove(debitId, description)}>
          Sammelbelastung verbuchen
        </Button>
      </DialogFooter>
    </>
  );
}
