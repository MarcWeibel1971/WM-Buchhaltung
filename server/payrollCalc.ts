/**
 * Serverseitige Lohnabzüge (Audit P2-6, kein Client-Trust).
 *
 * Quellen: insurance_settings der jeweiligen Organisation
 * (AHV/IV/EO/ALV als Prozentsätze, BVG als fixe Monatsbeträge, KTG/UVG
 * als Prozentsätze). Ohne hinterlegten AHV-Satz wird der Fallback
 * 6.4 % verwendet und eine Warnung zurückgegeben.
 */
import { and, eq } from "drizzle-orm";
import { insuranceSettings } from "../drizzle/schema";

export interface PayrollDeductions {
  ahvEmployee: number;
  ahvEmployer: number;
  bvgEmployee: number;
  bvgEmployer: number;
  ktgUvgEmployee: number;
  ktgUvgEmployer: number;
  netSalary: number;
  totalEmployerCost: number;
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function computePayrollDeductions(
  db: any,
  organizationId: number,
  grossSalary: number,
): Promise<PayrollDeductions> {
  const settings = await db
    .select()
    .from(insuranceSettings)
    .where(
      and(
        eq(insuranceSettings.organizationId, organizationId),
        eq(insuranceSettings.isActive, true),
      ),
    );

  const ahv = settings.find((s: any) => s.insuranceType === "ahv");
  const bvg = settings.find((s: any) => s.insuranceType === "bvg");
  const ktg = settings.find((s: any) => s.insuranceType === "ktg" || s.insuranceType === "uvg");

  const warnings: string[] = [];
  // AHV/IV/EO/ALV: Sätze in Prozent hinterlegt (z. B. 6.4000 = 6.4 %)
  const ahvEmpRate = ahv ? parseFloat(ahv.employeeRate ?? "0") / 100 : 0.064;
  const ahvEmprRate = ahv ? parseFloat(ahv.employerRate ?? "0") / 100 : 0.064;
  if (!ahv) {
    warnings.push(
      "Kein AHV/IV/EO-Satz hinterlegt – Fallback 6.4 % verwendet. Bitte den aktuellen Satz unter Einstellungen → Versicherungen erfassen."
    );
  }
  // BVG: fixe Monatsbeträge (kein Prozentsatz)
  const bvgEmp = bvg?.bvgEmployeeMonthly ? parseFloat(bvg.bvgEmployeeMonthly) : 0;
  const bvgEmpr = bvg?.bvgEmployerMonthly ? parseFloat(bvg.bvgEmployerMonthly) : 0;
  // KTG/UVG: Prozentsätze
  const ktgEmpRate = ktg ? parseFloat(ktg.employeeRate ?? "0") / 100 : 0;
  const ktgEmprRate = ktg ? parseFloat(ktg.employerRate ?? "0") / 100 : 0;

  const ahvEmployee = round2(grossSalary * ahvEmpRate);
  const ahvEmployer = round2(grossSalary * ahvEmprRate);
  const ktgEmployee = round2(grossSalary * ktgEmpRate);
  const ktgEmployer = round2(grossSalary * ktgEmprRate);

  const netSalary = round2(grossSalary - ahvEmployee - bvgEmp - ktgEmployee);
  const totalEmployerCost = round2(grossSalary + ahvEmployer + bvgEmpr + ktgEmployer);

  return {
    ahvEmployee,
    ahvEmployer,
    bvgEmployee: bvgEmp,
    bvgEmployer: bvgEmpr,
    ktgUvgEmployee: ktgEmployee,
    ktgUvgEmployer: ktgEmployer,
    netSalary,
    totalEmployerCost,
    warnings,
  };
}
