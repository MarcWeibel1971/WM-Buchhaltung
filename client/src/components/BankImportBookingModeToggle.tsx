import { Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCHF } from "@/lib/formatters";

export function BankImportBookingModeToggle({ mode, difference, balanced, onModeChange }: { mode: "single" | "collective"; difference: number; balanced: boolean; onModeChange: (mode: "single" | "collective") => void }) {
  return <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"><Button size="sm" variant={mode === "single" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => onModeChange("single")}>Einzelbuchung</Button><Button size="sm" variant={mode === "collective" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => onModeChange("collective")}><Split className="h-3 w-3" /> Sammelbuchung</Button>{mode === "collective" && <span className={`ml-auto text-xs font-mono font-bold ${balanced ? "text-green-600" : "text-red-600"}`}>Diff. {formatCHF(difference)}</span>}</div>;
}
