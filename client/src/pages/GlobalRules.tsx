/**
 * GlobalRules – Admin-Bereich für globale KI-/Verbuchungsregeln
 * Nur sichtbar für Admin-User. Hier werden allgemeine Regeln trainiert,
 * die als Basis für alle Kunden dienen.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Brain, Plus, Search, Trash2, Edit2, Upload, ToggleLeft, ToggleRight,
  ArrowUpFromLine, BarChart3, Sparkles, BookOpen, ShieldCheck, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
type GlobalRule = {
  id: number;
  counterpartyPattern: string;
  descriptionPattern?: string | null;
  bookingTextTemplate?: string | null;
  globalDebitAccountNumber?: string | null;
  globalCreditAccountNumber?: string | null;
  categoryHint?: string | null;
  vatRate?: string | null;
  priority: number;
  source: string;
  usageCount: number;
  isActive: boolean;
};

type RuleFormData = {
  counterpartyPattern: string;
  descriptionPattern: string;
  bookingTextTemplate: string;
  globalDebitAccountNumber: string;
  globalCreditAccountNumber: string;
  categoryHint: string;
  vatRate: string;
  priority: string;
  source: "manual" | "ai";
};

const EMPTY_FORM: RuleFormData = {
  counterpartyPattern: "",
  descriptionPattern: "",
  bookingTextTemplate: "",
  globalDebitAccountNumber: "",
  globalCreditAccountNumber: "",
  categoryHint: "",
  vatRate: "",
  priority: "5",
  source: "manual",
};

// ── Category hints for common Swiss bookkeeping patterns ─────────────────────
const CATEGORY_HINTS = [
  "Versicherungen (Sach)", "Sozialversicherungen", "Telekommunikation",
  "Miete / Leasing", "Büromaterial", "Reisekosten", "Fahrzeugkosten",
  "Bankgebühren", "Löhne", "Steuern", "Abschreibungen",
  "Warenaufwand", "Dienstleistungsertrag", "Zinsen",
  "Energie / Strom", "IT / Software", "Beratung / Honorare",
  "Werbung / Marketing", "Unterhalt / Reparaturen", "Porto / Versand",
];

export default function GlobalRules() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // ── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<GlobalRule | null>(null);
  const [form, setForm] = useState<RuleFormData>(EMPTY_FORM);
  const [filterSource, setFilterSource] = useState<"all" | "manual" | "ai">("all");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: rulesData, isLoading } = trpc.globalRules.list.useQuery({
    search: search || undefined,
    page,
    pageSize: 50,
  });
  const { data: stats } = trpc.globalRules.stats.useQuery();

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = trpc.globalRules.create.useMutation({
    onSuccess: () => {
      toast.success("Globale Regel erstellt");
      utils.globalRules.list.invalidate();
      utils.globalRules.stats.invalidate();
      closeForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.globalRules.update.useMutation({
    onSuccess: () => {
      toast.success("Regel aktualisiert");
      utils.globalRules.list.invalidate();
      closeForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.globalRules.delete.useMutation({
    onSuccess: () => {
      toast.success("Regel gelöscht");
      utils.globalRules.list.invalidate();
      utils.globalRules.stats.invalidate();
    },
  });

  const toggleMut = trpc.globalRules.toggle.useMutation({
    onSuccess: () => {
      utils.globalRules.list.invalidate();
      utils.globalRules.stats.invalidate();
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false);
    setEditingRule(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (rule: GlobalRule) => {
    setEditingRule(rule);
    setForm({
      counterpartyPattern: rule.counterpartyPattern,
      descriptionPattern: rule.descriptionPattern ?? "",
      bookingTextTemplate: rule.bookingTextTemplate ?? "",
      globalDebitAccountNumber: rule.globalDebitAccountNumber ?? "",
      globalCreditAccountNumber: rule.globalCreditAccountNumber ?? "",
      categoryHint: rule.categoryHint ?? "",
      vatRate: rule.vatRate ?? "",
      priority: String(rule.priority),
      source: (rule.source as "manual" | "ai") ?? "manual",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      counterpartyPattern: form.counterpartyPattern.trim(),
      descriptionPattern: form.descriptionPattern.trim() || undefined,
      bookingTextTemplate: form.bookingTextTemplate.trim() || undefined,
      globalDebitAccountNumber: form.globalDebitAccountNumber.trim() || undefined,
      globalCreditAccountNumber: form.globalCreditAccountNumber.trim() || undefined,
      categoryHint: form.categoryHint.trim() || undefined,
      vatRate: form.vatRate ? parseFloat(form.vatRate) : undefined,
      priority: parseInt(form.priority) || 5,
      source: form.source,
    };

    if (!payload.counterpartyPattern) {
      toast.error("Gegenpartei-Muster ist erforderlich");
      return;
    }

    if (editingRule) {
      updateMut.mutate({ ...payload, id: editingRule.id });
    } else {
      createMut.mutate(payload);
    }
  };

  // ── Filtered rules ─────────────────────────────────────────────────────────
  const filteredRules = useMemo(() => {
    const rules = rulesData?.rules ?? [];
    if (filterSource === "all") return rules;
    return rules.filter(r => r.source === filterSource);
  }, [rulesData?.rules, filterSource]);

  // ── Access check ───────────────────────────────────────────────────────────
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Kein Zugriff</h2>
            <p className="text-sm text-muted-foreground">
              Dieser Bereich ist nur für Administratoren zugänglich.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Globale KI-Regeln
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Allgemeine Verbuchungsregeln, die als Basis für alle Kunden dienen.
          Kundenspezifische Regeln haben immer Priorität.
        </p>
      </div>

      {/* ── Stats Cards ───────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Regeln gesamt</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Aktiv</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-gray-400">{stats.inactive}</div>
              <div className="text-xs text-muted-foreground">Inaktiv</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-blue-600">{stats.manual}</div>
              <div className="text-xs text-muted-foreground">Manuell</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-purple-600">{stats.ai}</div>
              <div className="text-xs text-muted-foreground">KI-gelernt</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-amber-600">{stats.totalUsage}</div>
              <div className="text-xs text-muted-foreground">Anwendungen</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Gegenpartei oder Buchungstext suchen..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <Select value={filterSource} onValueChange={(v) => setFilterSource(v as any)}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Quellen</SelectItem>
            <SelectItem value="manual">Manuell</SelectItem>
            <SelectItem value="ai">KI-gelernt</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={() => { setForm(EMPTY_FORM); setEditingRule(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Neue Regel
        </Button>
      </div>

      {/* ── Rules Table ───────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Aktiv</TableHead>
                <TableHead>Gegenpartei-Muster</TableHead>
                <TableHead>Buchungstext</TableHead>
                <TableHead>Soll-Konto</TableHead>
                <TableHead>Haben-Konto</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="w-[70px]">MWST</TableHead>
                <TableHead className="w-[60px]">Prio</TableHead>
                <TableHead className="w-[80px]">Quelle</TableHead>
                <TableHead className="w-[80px]">Nutzung</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Wird geladen...
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Brain className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {search ? "Keine Regeln gefunden" : "Noch keine globalen Regeln vorhanden"}
                      </p>
                      {!search && (
                        <p className="text-xs text-muted-foreground">
                          Erstellen Sie Regeln manuell oder trainieren Sie die KI mit Belegen.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className={cn(!rule.isActive && "opacity-50")}
                  >
                    <TableCell>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) =>
                          toggleMut.mutate({ id: rule.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {rule.counterpartyPattern}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {rule.bookingTextTemplate || "–"}
                    </TableCell>
                    <TableCell>
                      {rule.globalDebitAccountNumber ? (
                        <Badge variant="outline">{rule.globalDebitAccountNumber}</Badge>
                      ) : "–"}
                    </TableCell>
                    <TableCell>
                      {rule.globalCreditAccountNumber ? (
                        <Badge variant="outline">{rule.globalCreditAccountNumber}</Badge>
                      ) : "–"}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">
                      {rule.categoryHint || "–"}
                    </TableCell>
                    <TableCell>
                      {rule.vatRate ? `${rule.vatRate}%` : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={rule.source === "ai" ? "default" : "outline"}
                        className={cn(
                          "text-xs",
                          rule.source === "ai" && "bg-purple-100 text-purple-700 border-purple-200",
                          rule.source === "manual" && "bg-blue-50 text-blue-700 border-blue-200",
                        )}
                      >
                        {rule.source === "ai" ? (
                          <><Sparkles className="h-3 w-3 mr-1" />KI</>
                        ) : (
                          <><BookOpen className="h-3 w-3 mr-1" />Manuell</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{rule.usageCount}×</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(rule)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Regel "${rule.counterpartyPattern}" wirklich löschen?`)) {
                              deleteMut.mutate({ id: rule.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {rulesData && rulesData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {rulesData.total} Regeln, Seite {page} von {rulesData.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= rulesData.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* ── Info Card ─────────────────────────────────────────────────────── */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Wie funktioniert das Zwei-Ebenen-System?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>Priorität 1 – Kundenspezifische Regeln:</strong> Wenn ein Kunde eine Buchung manuell korrigiert,
            wird eine org-spezifische Regel gelernt. Diese hat immer Vorrang.
          </p>
          <p>
            <strong>Priorität 2 – Globale KI-Regeln:</strong> Falls keine kundenspezifische Regel passt,
            werden die hier definierten globalen Regeln als Fallback verwendet. Globale Regeln speichern
            Kontonummern (z.B. "6300") statt IDs, damit sie mandantenübergreifend funktionieren.
          </p>
          <p>
            <strong>Priorität 3 – LLM-Vorschlag:</strong> Wenn weder eine kundenspezifische noch eine globale Regel
            passt, wird die KI (LLM) um einen Vorschlag gebeten.
          </p>
        </CardContent>
      </Card>

      {/* ── Create/Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Globale Regel bearbeiten" : "Neue globale Regel"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Ändern Sie die Zuordnung für dieses Gegenpartei-Muster."
                : "Definieren Sie ein neues Muster und die zugehörige Kontierung."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Counterparty Pattern */}
            <div className="space-y-1.5">
              <Label>Gegenpartei-Muster *</Label>
              <Input
                placeholder="z.B. Swisscom, AXA Versicherungen, SBB"
                value={form.counterpartyPattern}
                onChange={(e) => setForm(f => ({ ...f, counterpartyPattern: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Wird als Teiltext-Suche verwendet (case-insensitive)
              </p>
            </div>

            {/* Description Pattern */}
            <div className="space-y-1.5">
              <Label>Beschreibungs-Muster (optional)</Label>
              <Input
                placeholder="z.B. Mobilabo, Prämie, Fahrkarte"
                value={form.descriptionPattern}
                onChange={(e) => setForm(f => ({ ...f, descriptionPattern: e.target.value }))}
              />
            </div>

            {/* Booking Text Template */}
            <div className="space-y-1.5">
              <Label>Buchungstext-Vorlage</Label>
              <Input
                placeholder="z.B. Telefonkosten Swisscom"
                value={form.bookingTextTemplate}
                onChange={(e) => setForm(f => ({ ...f, bookingTextTemplate: e.target.value }))}
              />
            </div>

            {/* Account Numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Soll-Konto (Nummer)</Label>
                <Input
                  placeholder="z.B. 6500"
                  value={form.globalDebitAccountNumber}
                  onChange={(e) => setForm(f => ({ ...f, globalDebitAccountNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Haben-Konto (Nummer)</Label>
                <Input
                  placeholder="z.B. 1020"
                  value={form.globalCreditAccountNumber}
                  onChange={(e) => setForm(f => ({ ...f, globalCreditAccountNumber: e.target.value }))}
                />
              </div>
            </div>

            {/* Category Hint */}
            <div className="space-y-1.5">
              <Label>Kategorie-Hinweis</Label>
              <Select
                value={form.categoryHint || "__custom__"}
                onValueChange={(v) => setForm(f => ({ ...f, categoryHint: v === "__custom__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">Eigene Eingabe</SelectItem>
                  {CATEGORY_HINTS.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!form.categoryHint || !CATEGORY_HINTS.includes(form.categoryHint)) && (
                <Input
                  placeholder="Eigene Kategorie eingeben..."
                  value={form.categoryHint}
                  onChange={(e) => setForm(f => ({ ...f, categoryHint: e.target.value }))}
                  className="mt-1"
                />
              )}
            </div>

            {/* VAT + Priority + Source */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>MWST-Satz (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="z.B. 8.1"
                  value={form.vatRate}
                  onChange={(e) => setForm(f => ({ ...f, vatRate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Priorität (1-100)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={form.priority}
                  onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quelle</Label>
                <Select value={form.source} onValueChange={(v) => setForm(f => ({ ...f, source: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manuell</SelectItem>
                    <SelectItem value="ai">KI-gelernt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editingRule ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
