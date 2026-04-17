import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface FiscalYearContextType {
  fiscalYear: number;
  setFiscalYear: (year: number) => void;
  fiscalYears: number[];
  isLoading: boolean;
}

const FiscalYearContext = createContext<FiscalYearContextType>({
  fiscalYear: new Date().getFullYear(),
  setFiscalYear: () => {},
  fiscalYears: [],
  isLoading: true,
});

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [initialized, setInitialized] = useState(false);

  // Load fiscal years from DB via yearEnd.listFiscalYears
  const { data: dbFiscalYears, isLoading } = trpc.yearEnd.listFiscalYears.useQuery();

  // Derive sorted year list from DB data
  const fiscalYears = dbFiscalYears?.map((fy: any) => fy.year).sort((a: number, b: number) => b - a) ?? [];

  // Once data loads, set the default to the oldest (first created) fiscal year
  // i.e. the smallest year number = last in the descending-sorted array
  useEffect(() => {
    if (!initialized && fiscalYears.length > 0) {
      // Find the oldest open fiscal year, or fallback to the oldest year
      const openYears = dbFiscalYears
        ?.filter((fy: any) => fy.status === "open" || !fy.isClosed)
        .map((fy: any) => fy.year)
        .sort((a: number, b: number) => a - b);
      
      if (openYears && openYears.length > 0) {
        // Default to the oldest open fiscal year
        setFiscalYear(openYears[0]);
      } else {
        // Fallback: oldest year overall
        setFiscalYear(fiscalYears[fiscalYears.length - 1]);
      }
      setInitialized(true);
    }
  }, [fiscalYears, dbFiscalYears, initialized]);

  return (
    <FiscalYearContext.Provider value={{ fiscalYear, setFiscalYear, fiscalYears, isLoading }}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  return useContext(FiscalYearContext);
}
