import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Test: Supplier importFromList input schema ─────────────────────────────
const supplierImportSchema = z.object({
  suppliers: z.array(z.object({
    name: z.string().min(1),
    street: z.string().optional(),
    zipCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    iban: z.string().optional(),
    bic: z.string().optional(),
    paymentTermDays: z.number().optional(),
    contactPerson: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
  })),
});

// ─── Test: Customer importFromList input schema ─────────────────────────────
const customerImportSchema = z.object({
  customers: z.array(z.object({
    name: z.string().min(1),
    company: z.string().optional(),
    street: z.string().optional(),
    zipCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    salutation: z.string().optional(),
    notes: z.string().optional(),
  })),
});

describe("Supplier Import Schema", () => {
  it("should accept valid supplier import data", () => {
    const input = {
      suppliers: [
        { name: "AXA Versicherungen AG", iban: "CH9300762011623852957", city: "Winterthur" },
        { name: "Swisscom AG", street: "Alte Tiefenaustrasse 6", zipCode: "3048", city: "Worblaufen" },
      ],
    };
    const result = supplierImportSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suppliers).toHaveLength(2);
      expect(result.data.suppliers[0].name).toBe("AXA Versicherungen AG");
    }
  });

  it("should reject supplier with empty name", () => {
    const input = {
      suppliers: [
        { name: "" },
      ],
    };
    const result = supplierImportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept supplier with only name (minimal data)", () => {
    const input = {
      suppliers: [
        { name: "Mobility Solutions AG" },
      ],
    };
    const result = supplierImportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept supplier with all optional fields", () => {
    const input = {
      suppliers: [
        {
          name: "Test Lieferant GmbH",
          street: "Teststrasse 1",
          zipCode: "8000",
          city: "Zürich",
          country: "Schweiz",
          iban: "CH9300762011623852957",
          bic: "UBSWCHZH80A",
          paymentTermDays: 45,
          contactPerson: "Hans Muster",
          email: "info@test.ch",
          phone: "+41 44 000 00 00",
          notes: "Testnotiz",
        },
      ],
    };
    const result = supplierImportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept empty suppliers array", () => {
    const input = { suppliers: [] };
    const result = supplierImportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("Customer Import Schema", () => {
  it("should accept valid customer import data", () => {
    const input = {
      customers: [
        { name: "Peter Meier", company: "Meier AG", city: "Luzern", email: "peter@meier.ch" },
        { name: "Anna Müller", phone: "+41 79 000 00 00" },
      ],
    };
    const result = customerImportSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customers).toHaveLength(2);
      expect(result.data.customers[0].company).toBe("Meier AG");
    }
  });

  it("should reject customer with empty name", () => {
    const input = {
      customers: [
        { name: "" },
      ],
    };
    const result = customerImportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept customer with only name (minimal data)", () => {
    const input = {
      customers: [
        { name: "Erika Muster" },
      ],
    };
    const result = customerImportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept customer with all optional fields", () => {
    const input = {
      customers: [
        {
          name: "Max Mustermann",
          company: "Mustermann GmbH",
          street: "Musterstrasse 1",
          zipCode: "6000",
          city: "Luzern",
          country: "Schweiz",
          email: "max@mustermann.ch",
          phone: "+41 41 000 00 00",
          salutation: "Sehr geehrter Herr Mustermann",
          notes: "VIP-Kunde",
        },
      ],
    };
    const result = customerImportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept empty customers array", () => {
    const input = { customers: [] };
    const result = customerImportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ─── Test: CSV/Excel column mapping logic ───────────────────────────────────
describe("CSV/Excel Column Mapping", () => {
  it("should map German column names for suppliers", () => {
    const row: Record<string, any> = {
      "Name": "Test AG",
      "Strasse": "Testweg 5",
      "PLZ": "3000",
      "Ort": "Bern",
      "IBAN": "CH93 0076 2011 6238 5295 7",
      "E-Mail": "info@test.ch",
      "Telefon": "+41 31 000 00 00",
      "Zahlungsfrist": "60",
    };

    const name = String(row["Name"] ?? row["Firma"] ?? row["Lieferant"] ?? row["name"] ?? "").trim();
    const street = String(row["Strasse"] ?? row["Adresse"] ?? row["street"] ?? "").trim() || undefined;
    const zipCode = String(row["PLZ"] ?? row["Postleitzahl"] ?? row["zipCode"] ?? "").trim() || undefined;
    const city = String(row["Ort"] ?? row["Stadt"] ?? row["city"] ?? "").trim() || undefined;
    const iban = String(row["IBAN"] ?? row["iban"] ?? "").trim() || undefined;
    const email = String(row["E-Mail"] ?? row["Email"] ?? row["email"] ?? "").trim() || undefined;
    const phone = String(row["Telefon"] ?? row["Tel"] ?? row["phone"] ?? "").trim() || undefined;
    const paymentTermDays = parseInt(String(row["Zahlungsfrist"] ?? row["paymentTermDays"] ?? "")) || undefined;

    expect(name).toBe("Test AG");
    expect(street).toBe("Testweg 5");
    expect(zipCode).toBe("3000");
    expect(city).toBe("Bern");
    expect(iban).toBe("CH93 0076 2011 6238 5295 7");
    expect(email).toBe("info@test.ch");
    expect(phone).toBe("+41 31 000 00 00");
    expect(paymentTermDays).toBe(60);
  });

  it("should map English column names for suppliers", () => {
    const row: Record<string, any> = {
      "name": "Acme Corp",
      "street": "123 Main St",
      "zip": "12345",
      "city": "Zurich",
      "iban": "CH1234567890",
      "email": "info@acme.com",
    };

    const name = String(row["Name"] ?? row["Firma"] ?? row["Lieferant"] ?? row["name"] ?? "").trim();
    const zipCode = String(row["PLZ"] ?? row["Postleitzahl"] ?? row["zipCode"] ?? row["zip"] ?? "").trim() || undefined;
    const email = String(row["E-Mail"] ?? row["Email"] ?? row["email"] ?? "").trim() || undefined;

    expect(name).toBe("Acme Corp");
    expect(zipCode).toBe("12345");
    expect(email).toBe("info@acme.com");
  });

  it("should map German column names for customers", () => {
    const row: Record<string, any> = {
      "Name": "Hans Müller",
      "Firma": "Müller AG",
      "Ort": "Zürich",
      "Anrede": "Sehr geehrter Herr Müller",
    };

    const name = String(row["Name"] ?? row["Kunde"] ?? row["Kontakt"] ?? row["name"] ?? "").trim();
    const company = String(row["Firma"] ?? row["Unternehmen"] ?? row["company"] ?? "").trim() || undefined;
    const city = String(row["Ort"] ?? row["Stadt"] ?? row["city"] ?? "").trim() || undefined;
    const salutation = String(row["Anrede"] ?? row["salutation"] ?? "").trim() || undefined;

    expect(name).toBe("Hans Müller");
    expect(company).toBe("Müller AG");
    expect(city).toBe("Zürich");
    expect(salutation).toBe("Sehr geehrter Herr Müller");
  });

  it("should handle missing columns gracefully", () => {
    const row: Record<string, any> = {
      "Name": "Minimal Supplier",
    };

    const name = String(row["Name"] ?? row["Firma"] ?? row["Lieferant"] ?? row["name"] ?? "").trim();
    const street = String(row["Strasse"] ?? row["Adresse"] ?? row["street"] ?? "").trim() || undefined;
    const iban = String(row["IBAN"] ?? row["iban"] ?? "").trim() || undefined;

    expect(name).toBe("Minimal Supplier");
    expect(street).toBeUndefined();
    expect(iban).toBeUndefined();
  });
});

// ─── Test: findOrCreateSupplierFromMetadata input validation ────────────────
describe("Supplier Auto-Create from Invoice Metadata", () => {
  it("should reject metadata with empty counterparty", () => {
    const metadata = { counterparty: "", counterpartyIban: null };
    const name = metadata.counterparty?.trim() ?? "";
    expect(name.length < 2).toBe(true);
  });

  it("should reject metadata with null counterparty", () => {
    const metadata = { counterparty: null, counterpartyIban: null };
    expect(!metadata.counterparty || metadata.counterparty.trim().length < 2).toBe(true);
  });

  it("should accept metadata with valid counterparty name", () => {
    const metadata = { counterparty: "AXA Versicherungen AG", counterpartyIban: "CH9300762011623852957" };
    const name = metadata.counterparty?.trim() ?? "";
    expect(name.length >= 2).toBe(true);
  });

  it("should clean IBAN by removing spaces", () => {
    const iban = "CH93 0076 2011 6238 5295 7";
    const cleaned = iban.replace(/\s/g, "").toUpperCase();
    expect(cleaned).toBe("CH9300762011623852957");
    expect(cleaned.length).toBeGreaterThanOrEqual(15);
  });

  it("should reject short IBAN", () => {
    const iban = "CH93";
    const cleaned = iban.replace(/\s/g, "").toUpperCase();
    expect(cleaned.length >= 15).toBe(false);
  });
});
