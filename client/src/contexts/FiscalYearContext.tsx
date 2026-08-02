import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface FiscalYearInfo {
  year: number;
  isClosed: boolean;
  status: string;
}

interface FiscalYearContextType {
  fiscalYear: number;
  setFiscalYear: (year: number) => void;
  fiscalYears: number[];
  fiscalYearInfos: FiscalYearInfo[];
  isLoading: boolean;
  /** Whether the currently selected fiscal year is open (not closed) */
  isCurrentYearOpen: boolean;
}

const FiscalYearContext = createContext<FiscalYearContextType>({
  fiscalYear: new Date().getFullYear(),
  setFiscalYear: () => {},
  fiscalYears: [],
  fiscalYearInfos: [],
  isLoading: true,
  isCurrentYearOpen: true,
});

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [initialized, setInitialized] = useState(false);

  // Load fiscal years from DB via yearEnd.listFiscalYears
  const { data: dbFiscalYears, isLoading } = trpc.yearEnd.listFiscalYears.useQuery();

  // Derive sorted year list from DB data
  const fiscalYears = dbFiscalYears?.map((fy: any) => fy.year).sort((a: number, b: number) => b - a) ?? [];
  const fiscalYearInfos: FiscalYearInfo[] = dbFiscalYears?.map((fy: any) => ({
    year: fy.year,
    isClosed: !!fy.isClosed,
    status: fy.status ?? (fy.isClosed ? "closed" : "open"),
  })) ?? [];

  // Whether the currently selected fiscal year is open
  const currentInfo = fiscalYearInfos.find(fy => fy.year === fiscalYear);
  const isCurrentYearOpen = currentInfo ? !currentInfo.isClosed : true;

  // Once data loads, set the default to the most recent open fiscal year
  useEffect(() => {
    if (!initialized && fiscalYears.length > 0) {
      // Find open fiscal years, sorted descending (newest first)
      const openYears = dbFiscalYears
        ?.filter((fy: any) => !fy.isClosed && (fy.status === "open" || !fy.status))
        .map((fy: any) => fy.year)
        .sort((a: number, b: number) => b - a); // newest first

      if (openYears && openYears.length > 0) {
        // Default to the newest open fiscal year
        setFiscalYear(openYears[0]);
      } else {
        // Fallback: newest year overall
        setFiscalYear(fiscalYears[0]);
      }
      setInitialized(true);
    }
  }, [fiscalYears, dbFiscalYears, initialized]);

  return (
    <FiscalYearContext.Provider value={{ fiscalYear, setFiscalYear, fiscalYears, fiscalYearInfos, isLoading, isCurrentYearOpen }}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  return useContext(FiscalYearContext);
}
