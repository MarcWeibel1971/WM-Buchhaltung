import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function BankImportTransactionEditDialog({ open, editMode, onClose, children }: { open: boolean; editMode: "single" | "collective"; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className={editMode === "collective" ? "w-[min(98vw,60rem)] max-w-none max-h-[90vh] overflow-y-auto" : "w-[min(95vw,38rem)] max-w-none"}>
        <DialogHeader>
          <DialogTitle>Transaktion bearbeiten</DialogTitle>
          <DialogDescription>Alle Felder der Transaktion anpassen</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
