import { Label } from "@/components/ui/label";

export function BankImportAiReasoning({ reasoning }: { reasoning: string | null | undefined }) {
  if (!reasoning) return null;
  return <div className="bg-muted/50 rounded-lg p-3"><Label className="text-xs text-muted-foreground">KI-Begründung</Label><p className="text-sm mt-1">{reasoning}</p></div>;
}
