import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CompanyAddressCardProps = { editing: boolean; value: (key: string) => string; onValueChange: (key: string, value: string) => void };

export function CompanyAddressCard({ editing, value, onValueChange }: CompanyAddressCardProps) {
  const field = (key: string, label: string, className?: string) => <div className={className}><Label>{label}</Label>{editing ? <Input value={value(key)} onChange={(event) => onValueChange(key, event.target.value)} className="mt-1" /> : <p className="mt-1">{value(key) || "—"}</p>}</div>;
  return <Card><CardHeader><CardTitle className="text-base">Adresse</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4">{field("street", "Strasse", "col-span-2")}{field("zipCode", "PLZ")}{field("city", "Ort")}{field("canton", "Kanton")}{field("country", "Land")}</CardContent></Card>;
}
