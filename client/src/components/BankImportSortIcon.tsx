import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function BankImportSortIcon({ column, activeColumn, direction }: { column: string; activeColumn: string; direction: "asc" | "desc" }) {
  if (activeColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return direction === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
}
