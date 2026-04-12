import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { DocumentUpload, type UploadedDocument } from "@/components/DocumentUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  FileText, Image, Eye, Trash2, Search, Filter,
  Receipt, ArrowDownToLine, ArrowUpFromLine, StickyNote, Building2
} from "lucide-react";
import { toast } from "sonner";

const DOC_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  invoice_in:  { label: "Eingangsrechnung",  icon: <ArrowDownToLine className="w-3.5 h-3.5" />, color: "text-red-600 bg-red-50" },
  invoice_out: { label: "Ausgangsrechnung",  icon: <ArrowUpFromLine className="w-3.5 h-3.5" />, color: "text-green-600 bg-green-50" },
  receipt:     { label: "Quittung",           icon: <Receipt className="w-3.5 h-3.5" />,         color: "text-blue-600 bg-blue-50" },
  bank_statement: { label: "Kontoauszug",    icon: <Building2 className="w-3.5 h-3.5" />,        color: "text-purple-600 bg-purple-50" },
  other:       { label: "Sonstiges",          icon: <StickyNote className="w-3.5 h-3.5" />,      color: "text-gray-600 bg-gray-50" },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Documents() {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: docs, refetch } = trpc.documents.list.useQuery({
    documentType: filterType !== "all" ? filterType : undefined,
    limit: 200,
  });

  const handleUploaded = useCallback((_doc: UploadedDocument) => {
    setRefreshKey(k => k + 1);
    refetch();
  }, [refetch]);

  const handleDelete = useCallback(async (id: number, filename: string) => {
    if (!confirm(`Dokument "${filename}" wirklich löschen?`)) return;
    try {
      const resp = await fetch(`/api/upload/document/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Löschen fehlgeschlagen");
      toast.success(`"${filename}" gelöscht`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [refetch]);

  const filtered = (docs ?? []).filter(doc => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      doc.filename.toLowerCase().includes(q) ||
      (doc.notes ?? "").toLowerCase().includes(q) ||
      (doc.aiMetadata ? (() => {
        try {
          const m = JSON.parse(doc.aiMetadata!);
          return (m.counterparty ?? "").toLowerCase().includes(q) ||
                 (m.description ?? "").toLowerCase().includes(q);
        } catch { return false; }
      })() : false)
    );
  });

  // Stats
  const stats = {
    total: docs?.length ?? 0,
    invoice_in: docs?.filter(d => d.documentType === "invoice_in").length ?? 0,
    invoice_out: docs?.filter(d => d.documentType === "invoice_out").length ?? 0,
    receipt: docs?.filter(d => d.documentType === "receipt").length ?? 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Dokumente</h2>
        <p className="text-sm text-muted-foreground">Belege, Rechnungen und Quittungen zentral verwalten</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Gesamt", value: stats.total, color: "text-foreground" },
          { label: "Eingangsrechnungen", value: stats.invoice_in, color: "text-red-600" },
          { label: "Ausgangsrechnungen", value: stats.invoice_out, color: "text-green-600" },
          { label: "Quittungen", value: stats.receipt, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3">Neues Dokument hochladen</h3>
        <DocumentUpload onUploaded={handleUploaded} />
        <p className="text-xs text-muted-foreground mt-2">
          Die KI analysiert den Beleg automatisch und extrahiert Betrag, Gegenpartei und Datum.
          Das Dokument kann anschliessend mit einer Buchung oder Banktransaktion verknüpft werden.
        </p>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Dateiname, Gegenpartei, Beschreibung…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-52">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="invoice_in">Eingangsrechnungen</SelectItem>
            <SelectItem value="invoice_out">Ausgangsrechnungen</SelectItem>
            <SelectItem value="receipt">Quittungen</SelectItem>
            <SelectItem value="bank_statement">Kontoauszüge</SelectItem>
            <SelectItem value="other">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Document List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Keine Dokumente gefunden</p>
            <p className="text-sm mt-1">Laden Sie oben Ihren ersten Beleg hoch</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(doc => {
              const typeInfo = DOC_TYPE_LABELS[doc.documentType] ?? DOC_TYPE_LABELS.other;
              let meta: any = null;
              try { if (doc.aiMetadata) meta = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }

              return (
                <div key={doc.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                  {/* File icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {doc.mimeType.startsWith("image/")
                      ? <Image className="w-8 h-8 text-blue-400" />
                      : <FileText className="w-8 h-8 text-red-400" />
                    }
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{doc.filename}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                        {typeInfo.icon}
                        {typeInfo.label}
                      </span>
                      {doc.journalEntryId && (
                        <Badge variant="outline" className="text-xs">Buchung #{doc.journalEntryId}</Badge>
                      )}
                      {doc.bankTransactionId && (
                        <Badge variant="outline" className="text-xs">Transaktion #{doc.bankTransactionId}</Badge>
                      )}
                    </div>

                    {/* AI-extracted info */}
                    {meta && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {meta.counterparty && <span>Gegenpartei: <span className="text-foreground font-medium">{meta.counterparty}</span></span>}
                        {meta.totalAmount != null && <span>Betrag: <span className="text-foreground font-medium">CHF {Number(meta.totalAmount).toFixed(2)}</span></span>}
                        {meta.documentDate && <span>Datum: <span className="text-foreground font-medium">{meta.documentDate}</span></span>}
                        {meta.description && <span className="truncate max-w-xs">{meta.description}</span>}
                      </div>
                    )}

                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.s3Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Öffnen"
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Löschen"
                      onClick={() => handleDelete(doc.id, doc.filename)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
