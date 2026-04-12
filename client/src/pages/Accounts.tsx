import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatCHF(val: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Aktiven",
  liability: "Passiven",
  equity: "Eigenkapital",
  revenue: "Ertrag",
  expense: "Aufwand",
};

export default function Accounts() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [year] = useState(new Date().getFullYear());

  const { data: accounts } = trpc.accounts.list.useQuery();
  // balances loaded per-account via getBalance

  const filtered = (accounts ?? []).filter(a => {
    const matchSearch = !search || a.number.includes(search) || a.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || a.accountType === typeFilter;
    return matchSearch && matchType;
  });

  const balanceMap = new Map<number, number>();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold">Kontenplan</h2>
        <p className="text-sm text-muted-foreground">{accounts?.length ?? 0} Konten</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Konto suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="accounting-table">
            <thead>
              <tr>
                <th className="w-24">Nr.</th>
                <th>Bezeichnung</th>
                <th>Typ</th>
                <th className="text-right">Saldo {year} CHF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Keine Konten gefunden
                  </td>
                </tr>
              ) : filtered.map(account => {
                const balance = 0; // loaded on demand via getBalance
                return (
                  <tr key={account.id}>
                    <td className="font-mono text-sm font-medium">{account.number}</td>
                    <td className="text-sm">{account.name}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType}
                      </span>
                    </td>
                    <td className={`text-right font-mono text-sm ${balance > 0 ? "amount-positive" : balance < 0 ? "amount-negative" : "text-muted-foreground"}`}>
                      {balance !== 0 ? formatCHF(Math.abs(balance)) : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
