import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, Image, X, Loader2, Paperclip, Eye, Camera, CheckCircle2, AlertCircle, Files } from "lucide-react";
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
  /** Allow multiple file selection (batch upload) */
  multiple?: boolean;
};

type FileUploadState = {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  thumbnailUrl?: string;
  error?: string;
  document?: UploadedDocument;
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

function generateThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf") {
      // For PDFs, we just show a PDF icon
      resolve(undefined);
    } else {
      resolve(undefined);
    }
  });
}

export function DocumentUpload({ journalEntryId, bankTransactionId, compact = false, fiscalYear, onUploaded, multiple = true }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileQueue, setFileQueue] = useState<FileUploadState[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadSingleFile = useCallback(async (fileState: FileUploadState): Promise<UploadedDocument | null> => {
    const formData = new FormData();
    formData.append("file", fileState.file);
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
    return document;
  }, [journalEntryId, bankTransactionId, fiscalYear]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Validate file sizes
    const oversized = files.filter(f => f.size > 20 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} Datei(en) zu gross (max. 20 MB): ${oversized.map(f => f.name).join(", ")}`);
      files = files.filter(f => f.size <= 20 * 1024 * 1024);
      if (files.length === 0) return;
    }

    // Create file states with thumbnails
    const newStates: FileUploadState[] = await Promise.all(
      files.map(async (file) => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: "pending" as const,
        progress: 0,
        thumbnailUrl: await generateThumbnail(file),
      }))
    );

    setFileQueue(prev => [...prev, ...newStates]);
    setUploading(true);

    let successCount = 0;
    let errorCount = 0;

    // Upload files sequentially to avoid overwhelming the server
    for (const fileState of newStates) {
      // Update status to uploading
      setFileQueue(prev => prev.map(f => f.id === fileState.id ? { ...f, status: "uploading", progress: 50 } : f));

      try {
        const doc = await uploadSingleFile(fileState);
        setFileQueue(prev => prev.map(f => f.id === fileState.id ? { ...f, status: "success", progress: 100, document: doc ?? undefined } : f));
        if (doc) {
          onUploaded?.(doc);
          successCount++;
        }
      } catch (err: any) {
        setFileQueue(prev => prev.map(f => f.id === fileState.id ? { ...f, status: "error", progress: 0, error: err.message } : f));
        errorCount++;
      }
    }

    setUploading(false);

    // Show summary toast
    if (files.length === 1) {
      if (successCount === 1) toast.success(`"${files[0].name}" erfolgreich hochgeladen`);
      else if (errorCount === 1) toast.error(`Upload von "${files[0].name}" fehlgeschlagen`);
    } else {
      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} Dateien erfolgreich hochgeladen`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} hochgeladen, ${errorCount} fehlgeschlagen`);
      } else {
        toast.error(`Upload fehlgeschlagen (${errorCount} Dateien)`);
      }
    }

    // Auto-clear successful uploads after 5 seconds
    setTimeout(() => {
      setFileQueue(prev => prev.filter(f => f.status !== "success"));
    }, 5000);
  }, [uploadSingleFile, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (multiple) {
      handleFiles(files);
    } else {
      if (files[0]) handleFiles([files[0]]);
    }
  }, [handleFiles, multiple]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (multiple) {
      handleFiles(files);
    } else {
      if (files[0]) handleFiles([files[0]]);
    }
    e.target.value = "";
  };

  const removeFromQueue = (id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  };

  if (compact) {
    return (
      <span className="inline-flex gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple={multiple}
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
          {multiple ? "Belege anhängen" : "Beleg anhängen"}
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
          multiple={multiple}
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
            <p className="text-sm font-medium">
              {multiple ? "Belege hier ablegen oder klicken (mehrere möglich)" : "Beleg hier ablegen oder klicken"}
            </p>
            <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, WEBP – max. 20 MB pro Datei</p>
          </div>
        )}
      </div>

      {/* Camera capture button */}
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

      {/* Upload queue with thumbnails */}
      {fileQueue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Files className="w-3.5 h-3.5" />
            <span>{fileQueue.length} Datei(en) in der Warteschlange</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {fileQueue.map((fs) => (
              <div
                key={fs.id}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors
                  ${fs.status === "success" ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : ""}
                  ${fs.status === "error" ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" : ""}
                  ${fs.status === "uploading" ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" : ""}
                  ${fs.status === "pending" ? "bg-muted/30 border-border" : ""}
                `}
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {fs.thumbnailUrl ? (
                    <img src={fs.thumbnailUrl} alt={fs.file.name} className="w-full h-full object-cover" />
                  ) : fs.file.type === "application/pdf" ? (
                    <FileText className="w-5 h-5 text-red-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" title={fs.file.name}>{fs.file.name}</div>
                  <div className="text-muted-foreground flex items-center gap-1">
                    {formatBytes(fs.file.size)}
                    {fs.status === "uploading" && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                    {fs.status === "success" && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                    {fs.status === "error" && (
                      <span className="text-red-500 truncate" title={fs.error}>
                        <AlertCircle className="w-3 h-3 inline mr-0.5" />
                        {fs.error || "Fehler"}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {fs.status === "uploading" && (
                    <div className="w-full bg-muted rounded-full h-1 mt-1">
                      <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${fs.progress}%` }} />
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {(fs.status === "error" || fs.status === "success") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={() => removeFromQueue(fs.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
