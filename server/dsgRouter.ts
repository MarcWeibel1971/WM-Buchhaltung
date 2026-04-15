/**
 * DSG Router – Datenschutzgesetz-Konformität
 * - Audit-Log: Protokollierung aller datenschutzrelevanten Aktionen
 * - Datenexport: Auskunftsrecht (Art. 25 DSG)
 * - Datenlöschung: Anonymisierung personenbezogener Daten
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { auditLog, employees, payrollEntries, users } from "../drizzle/schema";
import { eq, desc, and, gte, lte, like, sql } from "drizzle-orm";

// ─── Audit Log Helper ─────────────────────────────────────────────────────────

export async function logAudit(params: {
  organizationId?: number | null;
  userId: string;
  userName?: string;
  action: "create" | "read" | "update" | "delete" | "export" | "login" | "logout";
  entityType: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLog).values({
      organizationId: params.organizationId ?? null,
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
      ipAddress: params.ipAddress,
    });
  } catch (e) {
    // Audit logging should never break the main operation
    console.error("[AuditLog] Failed to write:", e);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const dsgRouter = router({

  // ─── Audit Log: List entries ────────────────────────────────────────────────
  auditLog: orgProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(10).max(100).default(50),
      action: z.enum(["create", "read", "update", "delete", "export", "login", "logout"]).optional(),
      entityType: z.string().optional(),
      userId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const params = input ?? { page: 1, pageSize: 50 };
      const conditions: any[] = [eq(auditLog.organizationId, ctx.organizationId)];

      if (params.action) conditions.push(eq(auditLog.action, params.action));
      if (params.entityType) conditions.push(like(auditLog.entityType, `%${params.entityType}%`));
      if (params.userId) conditions.push(eq(auditLog.userId, params.userId));
      if (params.dateFrom) conditions.push(gte(auditLog.createdAt, new Date(params.dateFrom)));
      if (params.dateTo) conditions.push(lte(auditLog.createdAt, new Date(params.dateTo + "T23:59:59")));

      const where = and(...conditions);

      const [rows, countResult] = await Promise.all([
        db.select().from(auditLog)
          .where(where)
          .orderBy(desc(auditLog.createdAt))
          .limit(params.pageSize)
          .offset((params.page - 1) * params.pageSize),
        db.select({ count: sql<number>`count(*)` }).from(auditLog).where(where),
      ]);

      // Log this read action
      await logAudit({
        organizationId: ctx.organizationId,
        userId: String(ctx.user.id ?? "unknown"),
        userName: ctx.user.name ?? undefined,
        action: "read",
        entityType: "audit_log",
        details: JSON.stringify({ filters: params }),
      });

      return {
        entries: rows,
        total: Number(countResult[0]?.count ?? 0),
        page: params.page,
        pageSize: params.pageSize,
      };
    }),

  // ─── Data Export (Auskunftsrecht Art. 25 DSG) ──────────────────────────────
  exportPersonalData: orgProcedure
    .input(z.object({
      employeeId: z.number().int(),
      format: z.enum(["json", "csv"]).default("json"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get employee data (scoped to org)
      const emp = await db.select().from(employees)
        .where(and(
          eq(employees.organizationId, ctx.organizationId),
          eq(employees.id, input.employeeId),
        ));
      if (!emp.length) throw new TRPCError({ code: "NOT_FOUND", message: "Mitarbeiter nicht gefunden." });

      // Get payroll data (scoped to org)
      const payrolls = await db.select().from(payrollEntries)
        .where(and(
          eq(payrollEntries.organizationId, ctx.organizationId),
          eq(payrollEntries.employeeId, input.employeeId),
        ))
        .orderBy(desc(payrollEntries.year), desc(payrollEntries.month));

      // Get audit log entries for this employee (scoped to org)
      const auditEntries = await db.select().from(auditLog)
        .where(and(
          eq(auditLog.organizationId, ctx.organizationId),
          eq(auditLog.entityType, "employee"),
          eq(auditLog.entityId, String(input.employeeId)),
        ))
        .orderBy(desc(auditLog.createdAt))
        .limit(500);

      // Log this export
      await logAudit({
        organizationId: ctx.organizationId,
        userId: String(ctx.user.id ?? "unknown"),
        userName: ctx.user.name ?? undefined,
        action: "export",
        entityType: "employee",
        entityId: String(input.employeeId),
        details: `Datenexport (Art. 25 DSG) für ${emp[0].firstName} ${emp[0].lastName}`,
      });

      const exportData = {
        exportDate: new Date().toISOString(),
        exportReason: "Auskunftsrecht gemäss Art. 25 DSG",
        employee: {
          id: emp[0].id,
          code: emp[0].code,
          firstName: emp[0].firstName,
          lastName: emp[0].lastName,
          ahvNumber: emp[0].ahvNumber,
          address: emp[0].address,
          street: emp[0].street,
          zipCode: emp[0].zipCode,
          city: emp[0].city,
          dateOfBirth: emp[0].dateOfBirth,
          employmentStart: emp[0].employmentStart,
          employmentEnd: emp[0].employmentEnd,
          isActive: emp[0].isActive,
          createdAt: emp[0].createdAt,
        },
        payrollEntries: payrolls.map(p => ({
          year: p.year,
          month: p.month,
          grossSalary: p.grossSalary,
          netSalary: p.netSalary,
          ahvEmployee: p.ahvEmployee,
          bvgEmployee: p.bvgEmployee,
          ktgUvgEmployee: p.ktgUvgEmployee,
          status: p.status,
        })),
        auditTrail: auditEntries.map(a => ({
          action: a.action,
          details: a.details,
          timestamp: a.createdAt,
          performedBy: a.userName ?? a.userId,
        })),
      };

      if (input.format === "csv") {
        // Convert to CSV
        const lines: string[] = [];
        lines.push("Abschnitt,Feld,Wert");
        lines.push(`Mitarbeiter,Name,${emp[0].firstName} ${emp[0].lastName}`);
        lines.push(`Mitarbeiter,AHV-Nr,${emp[0].ahvNumber ?? ""}`);
        lines.push(`Mitarbeiter,Adresse,${emp[0].street ?? ""}`);
        lines.push(`Mitarbeiter,PLZ/Ort,${emp[0].zipCode ?? ""} ${emp[0].city ?? ""}`);
        lines.push(`Mitarbeiter,Geburtsdatum,${emp[0].dateOfBirth ?? ""}`);
        lines.push(`Mitarbeiter,Eintritt,${emp[0].employmentStart ?? ""}`);
        lines.push(`Mitarbeiter,Austritt,${emp[0].employmentEnd ?? ""}`);
        lines.push("");
        for (const p of payrolls) {
          lines.push(`Lohn,${p.year}/${p.month},Brutto: ${p.grossSalary} / Netto: ${p.netSalary}`);
        }
        return {
          data: lines.join("\n"),
          filename: `Datenexport_${emp[0].lastName}_${emp[0].firstName}.csv`,
          contentType: "text/csv",
        };
      }

      return {
        data: JSON.stringify(exportData, null, 2),
        filename: `Datenexport_${emp[0].lastName}_${emp[0].firstName}.json`,
        contentType: "application/json",
      };
    }),

  // ─── Data Anonymization (Löschungsrecht) ───────────────────────────────────
  anonymizeEmployee: orgProcedure
    .input(z.object({
      employeeId: z.number().int(),
      confirmName: z.string(), // Must match employee name for safety
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const emp = await db.select().from(employees)
        .where(and(
          eq(employees.organizationId, ctx.organizationId),
          eq(employees.id, input.employeeId),
        ));
      if (!emp.length) throw new TRPCError({ code: "NOT_FOUND", message: "Mitarbeiter nicht gefunden." });

      const fullName = `${emp[0].firstName} ${emp[0].lastName}`;
      if (input.confirmName !== fullName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Zur Bestätigung bitte den vollen Namen eingeben: "${fullName}"`,
        });
      }

      // Check if employee has active payroll entries in current year (scoped to org)
      const currentYear = new Date().getFullYear();
      const activePayroll = await db.select().from(payrollEntries)
        .where(and(
          eq(payrollEntries.organizationId, ctx.organizationId),
          eq(payrollEntries.employeeId, input.employeeId),
          eq(payrollEntries.year, currentYear),
        ));
      if (activePayroll.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mitarbeiter mit Lohnabrechnungen im aktuellen Jahr können nicht anonymisiert werden. Bitte warten Sie bis zum Jahresende.",
        });
      }

      // Log before anonymization
      await logAudit({
        organizationId: ctx.organizationId,
        userId: String(ctx.user.id ?? "unknown"),
        userName: ctx.user.name ?? undefined,
        action: "delete",
        entityType: "employee",
        entityId: String(input.employeeId),
        details: `Anonymisierung (DSG Löschungsrecht) von ${fullName}`,
      });

      // Anonymize: replace personal data with placeholders
      const anonymizedCode = `ANON-${input.employeeId}`;
      await db.update(employees).set({
        firstName: "Anonymisiert",
        lastName: `#${input.employeeId}`,
        code: anonymizedCode,
        ahvNumber: null,
        address: null,
        street: null,
        zipCode: null,
        city: null,
        dateOfBirth: null,
        lohnausweisRemarks: null,
        isActive: false,
      }).where(and(
        eq(employees.organizationId, ctx.organizationId),
        eq(employees.id, input.employeeId),
      ));

      return {
        success: true,
        message: `Personenbezogene Daten von ${fullName} wurden anonymisiert (DSG-konform).`,
      };
    }),
});
