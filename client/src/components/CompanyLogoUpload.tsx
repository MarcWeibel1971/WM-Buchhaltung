import type { ChangeEvent } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function CompanyLogoUpload({ logoUrl, onUploaded }: { logoUrl: string | null; onUploaded: () => void }) {
  const uploadMut = trpc.settings.uploadCompanyLogo.useMutation({
    onSuccess: () => { toast.success("Logo hochgeladen"); onUploaded(); },
    onError: (error) => toast.error(`Logo-Upload fehlgeschlagen: ${error.message}`),
  });
  const deleteMut = trpc.settings.deleteCompanyLogo.useMutation({
    onSuccess: () => { toast.success("Logo entfernt"); onUploaded(); },
    onError: (error) => toast.error(error.message),
  });

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte ein Bild auswählen (PNG, JPG, SVG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Datei zu gross (max. 5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMut.mutate({ base64, filename: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="flex items-center gap-6">
      <div className="w-40 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
        {logoUrl ? <img src={logoUrl} alt="Firmenlogo" className="max-w-full max-h-full object-contain p-2" /> : <span className="text-muted-foreground text-xs text-center px-2">Kein Logo</span>}
      </div>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploadMut.isPending} />
          <Button variant="outline" size="sm" asChild disabled={uploadMut.isPending}>
            <span>{uploadMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}{logoUrl ? "Logo ändern" : "Logo hochladen"}</span>
          </Button>
        </label>
        {logoUrl && <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Entfernen</Button>}
      </div>
    </div>
  );
}
