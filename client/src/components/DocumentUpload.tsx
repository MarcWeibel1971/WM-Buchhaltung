import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, Image, X, Loader2, Paperclip, Eye, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export type UploadedDocument = {
  id: number;
  filename: string;
  s3Url: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  aiMetadata?: string | null;
  createdAt: Date;
};

type Props = {
  journalEntryId?: number;
  bankTransactionId?: number;
  /** If true, shows a compact inline button instead of a full drop zone */
  compact?: boolean;
  /** Fiscal year to assign to uploaded documents */
  fiscalYear?: number;
  onUploaded?: (doc: UploadedDocument) => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
  return <FileText className="w-4 h-4 text-red-500" />;
}

export function DocumentUpload({ journalEntryId, bankTransactionId, compact = false, fiscalYear, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Datei zu gross (max. 20 MB)");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (journalEntryId) formData.append("journalEntryId", String(journalEntryId));
      if (bankTransactionId) formData.append("bankTransactionId", String(bankTransactionId));
      if (fiscalYear) formData.append("fiscalYear", String(fiscalYear));

      const resp = await fetch("/api/upload/document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload fehlgeschlagen" }));
        throw new Error(err.error ?? "Upload fehlgeschlagen");
      }
      const { document } = await resp.json();
      toast.success(`"${file.name}" erfolgreich hochgeladen`);
      onUploaded?.(document);
    } catch (err: any) {
      toast.error(err.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }, [journalEntryId, bankTransactionId, fiscalYear, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (compact) {
    return (
      <span className="inline-flex gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Paperclip className="w-3 h-3 mr-1" />}
          Beleg anhängen
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="w-3 h-3 mr-1" />
          Foto
        </Button>
      </span>
    );
  }

  return (
    <div className="space-y-3">
      {/* Drop zone for file upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleInputChange}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Wird hochgeladen und analysiert…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium">Beleg hier ablegen oder klicken</p>
            <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, WEBP – max. 20 MB</p>
          </div>
        )}
      </div>

      {/* Camera capture button – visible on all devices, activates camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto gap-2"
        onClick={(e) => {
          e.stopPropagation();
          cameraInputRef.current?.click();
        }}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
        Foto aufnehmen
      </Button>
    </div>
  );
}

// ─── DocumentList: zeigt angehängte Belege ────────────────────────────────────
type DocumentListProps = {
  journalEntryId?: number;
  bankTransactionId?: number;
  refreshKey?: number;
};

export function DocumentList({ journalEntryId, bankTransactionId, refreshKey }: DocumentListProps) {
  const { data: docs, refetch } = trpc.documents.list.useQuery(
    { journalEntryId, bankTransactionId, limit: 20 },
    { enabled: !!(journalEntryId || bankTransactionId) }
  );

  // Refetch when refreshKey changes
  if (refreshKey !== undefined) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
  }

  if (!docs?.length) return null;

  return (
    <div className="space-y-1 mt-2">
      {docs.map(doc => (
        <div key={doc.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
          <DocIcon mimeType={doc.mimeType} />
          <span className="flex-1 truncate font-medium">{doc.filename}</span>
          <span className="text-muted-foreground">{formatBytes(doc.fileSize)}</span>
          <a
            href={doc.s3Url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Eye className="w-3 h-3" />
          </a>
        </div>
      ))}
    </div>
  );
}

// ─── DocumentBadge: kleine Anzeige wie viele Belege vorhanden sind ────────────
export function DocumentBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
      <Paperclip className="w-2.5 h-2.5 mr-0.5" />
      {count}
    </Badge>
  );
}
