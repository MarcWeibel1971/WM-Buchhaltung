import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CompanyDetailsCard({ editing, value, onValueChange }: { editing: boolean; value: (key: string) => string; onValueChange: (key: string, value: string) => void }) {
  const input = (key: string, label: string, placeholder?: string, className?: string) => <div className={className}><Label>{label}</Label>{editing ? <Input value={value(key)} onChange={(event) => onValueChange(key, event.target.value)} className="mt-1" placeholder={placeholder} /> : <p className={`mt-1 ${key === "companyName" ? "font-medium" : ""}`}>{value(key) || "—"}</p>}</div>;
  return <Card><CardHeader><CardTitle className="text-base">Firmenangaben</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4">{input("companyName", "Firmenname", undefined, "col-span-2")}<div><Label>Rechtsform</Label>{editing ? <Select value={value("legalForm")} onValueChange={(next) => onValueChange("legalForm", next)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AG">AG</SelectItem><SelectItem value="GmbH">GmbH</SelectItem><SelectItem value="Einzelfirma">Einzelfirma</SelectItem><SelectItem value="Kollektivgesellschaft">Kollektivgesellschaft</SelectItem></SelectContent></Select> : <p className="mt-1">{value("legalForm") || "—"}</p>}</div>{input("hrNumber", "Handelsregisternummer", "CHE-xxx.xxx.xxx")}{input("uid", "UID", "CHE-xxx.xxx.xxx")}{input("vatNumber", "MWST-Nummer", "CHE-xxx.xxx.xxx MWST")}</CardContent></Card>;
}
