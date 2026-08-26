import type { ReactNode } from "react";
import { DialogFooter } from "@/components/ui/dialog";

export function BankImportTransactionActionBar({ children }: { children: ReactNode }) {
  return <DialogFooter>{children}</DialogFooter>;
}
