import { createContext, useContext, useState, type ReactNode } from "react";

const FISCAL_YEARS = [2026, 2025, 2024, 2023];

interface FiscalYearContextType {
  fiscalYear: number;
  setFiscalYear: (year: number) => void;
  fiscalYears: number[];
}

const FiscalYearContext = createContext<FiscalYearContextType>({
  fiscalYear: new Date().getFullYear(),
  setFiscalYear: () => {},
  fiscalYears: FISCAL_YEARS,
});

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());

  return (
    <FiscalYearContext.Provider value={{ fiscalYear, setFiscalYear, fiscalYears: FISCAL_YEARS }}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  return useContext(FiscalYearContext);
}
