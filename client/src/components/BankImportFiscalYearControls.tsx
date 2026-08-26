import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FiscalYearInfo = { year: number; isClosed: boolean };

type BankImportFiscalYearNoticeProps = {
  fiscalYear: number;
  isCurrentYearOpen: boolean;
};

export function BankImportFiscalYearNotice({ fiscalYear, isCurrentYearOpen }: BankImportFiscalYearNoticeProps) {
  if (isCurrentYearOpen) return null;
  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
      <span className="text-amber-500 text-lg">⚠️</span>
      <span>Das Geschäftsjahr <strong>{fiscalYear}</strong> ist geschlossen. Ausstehende Transaktionen werden nicht angezeigt und neue Buchungen sind nicht möglich.</span>
    </div>
  );
}

type BankImportFiscalYearSelectProps = {
  fiscalYear: number;
  fiscalYearInfos: FiscalYearInfo[];
  onSelect: (year: number) => void;
};

export function BankImportFiscalYearSelect({ fiscalYear, fiscalYearInfos, onSelect }: BankImportFiscalYearSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium">Geschäftsjahr:</span>
      <Select value={String(fiscalYear)} onValueChange={(value) => onSelect(Number(value))}>
        <SelectTrigger className="w-32 h-9 text-sm font-semibold border-2 border-primary/50 bg-primary/8 hover:bg-primary/15 gap-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fiscalYearInfos.map((info) => (
            <SelectItem key={info.year} value={String(info.year)}>
              GJ {info.year}{info.isClosed ? " 🔒" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
