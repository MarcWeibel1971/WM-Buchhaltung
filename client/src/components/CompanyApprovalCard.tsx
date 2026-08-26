import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function CompanyApprovalCard({ requiresDualApproval, isPending, onChange }: { requiresDualApproval: boolean; isPending: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Freigabeprozess</CardTitle>
        <CardDescription>Steuert die Trennung zwischen Erfassung und Freigabe von manuellen Buchungsvorschlägen.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="requires-dual-approval">Vier-Augen-Freigabe verlangen</Label>
          <p className="text-xs text-muted-foreground">Der Ersteller einer Direktbuchung kann sie nicht selbst freigeben. Historische Einträge bleiben freigabefähig.</p>
        </div>
        <Switch id="requires-dual-approval" checked={requiresDualApproval} onCheckedChange={onChange} disabled={isPending} />
      </CardContent>
    </Card>
  );
}
