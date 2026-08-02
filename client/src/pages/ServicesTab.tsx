import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ServiceFormData {
  name: string;
  description: string;
  defaultHourlyRate: string;
  revenueAccountId: string;
}

const emptyForm: ServiceFormData = {
  name: "",
  description: "",
  defaultHourlyRate: "",
  revenueAccountId: "",
};

export default function ServicesTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceFormData>(emptyForm);

  const { data: services = [], refetch } = trpc.timeTracking.listServices.useQuery();
  const { data: accounts = [] } = trpc.settings.getAllAccounts.useQuery();

  const revenueAccounts = accounts.filter((a: any) =>
    a.number?.startsWith("3") || a.number?.startsWith("4") || a.number?.startsWith("6")
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.timeTracking.createService.useMutation({
    onSuccess: () => {
      toast.success("Dienstleistung erstellt");
      utils.timeTracking.listServices.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.timeTracking.updateService.useMutation({
    onSuccess: () => {
      toast.success("Dienstleistung aktualisiert");
      utils.timeTracking.listServices.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.timeTracking.deleteService.useMutation({
    onSuccess: () => {
      toast.success("Dienstleistung gelöscht");
      utils.timeTracking.listServices.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (svc: any) => {
    setEditingId(svc.id);
    setForm({
      name: svc.name,
      description: svc.description || "",
      defaultHourlyRate: svc.defaultHourlyRate ? String(Number(svc.defaultHourlyRate)) : "",
      revenueAccountId: svc.revenueAccountId ? String(svc.revenueAccountId) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Bitte einen Namen eingeben");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      defaultHourlyRate: form.defaultHourlyRate ? Number(form.defaultHourlyRate) : undefined,
      revenueAccountId: form.revenueAccountId ? Number(form.revenueAccountId) : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Dienstleistung "${name}" wirklich löschen?`)) return;
    deleteMutation.mutate({ id });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dienstleistungen</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Dienstleistungskatalog für Zeiterfassung und Ausgangsrechnungen
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Neue Dienstleistung
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/20">
          <Briefcase className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Keine Dienstleistungen erfasst</p>
          <p className="text-sm text-muted-foreground mt-1">
            Erstellen Sie Ihren Dienstleistungskatalog für die Zeiterfassung.
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Erste Dienstleistung erstellen
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="text-right">Stundenansatz (CHF)</TableHead>
                <TableHead>Ertragskonto</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((svc: any) => (
                <TableRow key={svc.id}>
                  <TableCell className="font-medium">{svc.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {svc.description || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {svc.defaultHourlyRate && Number(svc.defaultHourlyRate) > 0
                      ? Number(svc.defaultHourlyRate).toLocaleString("de-CH", { minimumFractionDigits: 2 })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {svc.revenueAccount ? (
                      <Badge variant="outline" className="text-xs font-mono">
                        {svc.revenueAccount.number} {svc.revenueAccount.name}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(svc)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(svc.id, svc.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Dienstleistung bearbeiten" : "Neue Dienstleistung"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="z.B. Beratung, Buchhaltung, Reinigung"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                placeholder="Optionale Beschreibung der Dienstleistung"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Standard-Stundenansatz (CHF)</Label>
              <Input
                type="number"
                placeholder="z.B. 150.00"
                value={form.defaultHourlyRate}
                onChange={e => setForm(f => ({ ...f, defaultHourlyRate: e.target.value }))}
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ertragskonto</Label>
              <Select
                value={form.revenueAccountId || "none"}
                onValueChange={v => setForm(f => ({ ...f, revenueAccountId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Konto auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Konto</SelectItem>
                  {revenueAccounts.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.number} – {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
