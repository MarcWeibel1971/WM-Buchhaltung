import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type SupplierFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
  children: ReactNode;
};

export function SupplierFormDialog({ open, onOpenChange, isEditing, onCancel, onSave, isPending, children }: SupplierFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? "Lieferant bearbeiten" : "Neuer Lieferant"}</DialogTitle></DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button onClick={onSave} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEditing ? "Speichern" : "Erstellen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
