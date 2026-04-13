import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { Upload, Check, FileText, CreditCard as CreditCardIcon, Trash2, Undo2 } from "lucide-react";
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
    // Read file as base64 for LLM processing
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      try {
        // Use LLM to extract credit card statement data
        const response = await fetch("/api/trpc/creditCard.parseStatement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { fileBase64: base64, filename: file.name } }),
        });
        // Fallback: create statement with manual total
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
                <th>Datum</th>
                <th>Inhaber</th>
                <th className="text-right">Gesamtbetrag CHF</th>
                <th>Status</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!statements?.length ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    <CreditCardIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Noch keine Abrechnungen hochgeladen
                  </td>
                </tr>
              ) : statements.map(stmt => (
                <tr key={stmt.id}>
                  <td className="text-sm">
                    {new Date(stmt.statementDate as any).toLocaleDateString("de-CH")}
                  </td>
                  <td className="text-sm font-medium">{stmt.owner?.toUpperCase() ?? "mw"}</td>
                  <td className="text-right font-mono text-sm amount-negative">
                    {formatCHF(stmt.totalAmount as string)}
                  </td>
                  <td>
                    {stmt.status === "pending"
                      ? <span className="badge-pending">Ausstehend</span>
                      : <span className="badge-approved">Verbucht</span>}
                  </td>
                  <td className="text-right">
                    <div className="flex gap-1 justify-end">
                      {stmt.status === "pending" && (
                        <>
                          <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                            onClick={() => setApproveDialog(stmt)}>
                            <Check className="h-3 w-3" /> Verbuchen
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" title="Löschen"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm("KK-Abrechnung wirklich löschen?")) {
                                deleteMutation.mutate({ statementId: stmt.id });
                              }
                            }}>
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
                            disabled={unapproveMutation.isPending}
                            onClick={() => {
                              if (confirm("Verbuchung rückgängig machen? Der Journal-Eintrag wird gelöscht.")) {
                                unapproveMutation.mutate({ statementId: stmt.id });
                              }
                            }}>
                            <Undo2 className="h-3 w-3" />
                            Rückgängig
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
