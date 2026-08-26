import { ArrowLeftRight, CheckCircle, Clock, EyeOff } from "lucide-react";

export type BankImportStatusTile = "all" | "pending" | "matched" | "ignored";

type BankImportStatusTilesProps = {
  stats: { total: number; pending: number; matched: number; ignored: number };
  activeStatus: string;
  onSelect: (status: BankImportStatusTile) => void;
};

export function BankImportStatusTiles({ stats, activeStatus, onSelect }: BankImportStatusTilesProps) {
  const tiles = [
    { key: "all" as const, label: "Alle Transaktionen", count: stats.total, accent: "from-slate-500 to-slate-600", light: "bg-slate-50 border-slate-200 text-slate-700", icon: <ArrowLeftRight className="w-5 h-5" /> },
    { key: "pending" as const, label: "Ausstehend", count: stats.pending, accent: "from-amber-500 to-orange-500", light: "bg-amber-50 border-amber-200 text-amber-700", icon: <Clock className="w-5 h-5" /> },
    { key: "matched" as const, label: "Verbucht", count: stats.matched, accent: "from-green-500 to-emerald-600", light: "bg-green-50 border-green-200 text-green-700", icon: <CheckCircle className="w-5 h-5" /> },
    { key: "ignored" as const, label: "Ignoriert", count: stats.ignored, accent: "from-gray-400 to-gray-500", light: "bg-gray-50 border-gray-200 text-gray-600", icon: <EyeOff className="w-5 h-5" /> },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiles.map((tile) => {
        const isActive = activeStatus === tile.key;
        return (
          <button
            key={tile.key}
            onClick={() => onSelect(tile.key)}
            className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
              isActive
                ? `bg-gradient-to-br ${tile.accent} text-white border-transparent shadow-lg scale-[1.02]`
                : `${tile.light} border-transparent hover:border-current hover:shadow-md`
            }`}
          >
            <div className={`mb-2 p-2 rounded-lg ${isActive ? "bg-white/20" : "bg-white shadow-sm"}`}>
              <span className={isActive ? "text-white" : ""}>{tile.icon}</span>
            </div>
            <div className={`text-2xl font-bold leading-none mb-1 ${isActive ? "text-white" : ""}`}>{tile.count}</div>
            <div className={`text-xs font-medium leading-tight ${isActive ? "text-white/90" : ""}`}>{tile.label}</div>
          </button>
        );
      })}
    </div>
  );
}
