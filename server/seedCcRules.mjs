/**
 * Seed credit card booking rules based on user's example VISA statement.
 * Maps CC vendors to the correct expense accounts.
 * Run with: node server/seedCcRules.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import { sql, eq } from "drizzle-orm";
import { mysqlTable, int, varchar, decimal, boolean, mysqlEnum } from "drizzle-orm/mysql-core";

// Inline schema definition for standalone script
const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 10 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
});

const bookingRules = mysqlTable("booking_rules", {
  id: int("id").autoincrement().primaryKey(),
  counterpartyPattern: varchar("counterpartyPattern", { length: 300 }).notNull(),
  descriptionPattern: varchar("descriptionPattern", { length: 500 }),
  bookingTextTemplate: varchar("bookingTextTemplate", { length: 500 }),
  debitAccountId: int("debitAccountId"),
  creditAccountId: int("creditAccountId"),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }),
  usageCount: int("usageCount").default(0).notNull(),
  priority: int("priority").default(10).notNull(),
  source: mysqlEnum("source", ["manual", "ai"]).default("manual").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

async function main() {
  const db = drizzle(process.env.DATABASE_URL);

  // Get account number → ID mapping
  const allAccounts = await db.select({ id: accounts.id, number: accounts.number }).from(accounts);
  const accountMap = new Map(allAccounts.map(a => [a.number, a.id]));

  // Credit card vendor rules from user's example (VISA 04.25 statement)
  // Format: [counterpartyPattern, descriptionPattern, bookingTextTemplate, debitAccountNumber, creditAccountNumber]
  const ccRules = [
    // Reisespesen mw (4821)
    ["SBB", "SBB", "VISA {mm}.{yy}, SBB", "4821", "1082"],
    ["Uber", "Uber", "VISA {mm}.{yy}, Uber", "4821", "1082"],
    ["Parkhaus", "Parkhaus", "VISA {mm}.{yy}, Parkhaus", "4821", "1082"],
    ["Mobility", "Mobility", "VISA {mm}.{yy}, Mobility", "4821", "1082"],
    
    // Software & IT mw (4305)
    ["I/O Fund", "I/O Fund", "VISA {mm}.{yy}, I/O Fund", "4305", "1082"],
    ["bexio", "bexio", "VISA {mm}.{yy}, bexio", "4305", "1082"],
    ["Perplexity", "Perplexity", "VISA {mm}.{yy}, Perplexity", "4305", "1082"],
    ["Envato", "Envato", "VISA {mm}.{yy}, Envato", "4305", "1082"],
    ["Adobe", "Adobe", "VISA {mm}.{yy}, Adobe", "4305", "1082"],
    
    // Kontokorrent mw (1081) – Restaurants / Bewirtung
    ["Rest.", "Rest.", "VISA {mm}.{yy}, {vendor}", "1081", "1082"],
    ["Brasserie", "Brasserie", "VISA {mm}.{yy}, {vendor}", "1081", "1082"],
    ["Musik Hug", "Musik Hug", "VISA {mm}.{yy}, Musik Hug", "1081", "1082"],
    ["Stadtkeller", "Stadtkeller", "VISA {mm}.{yy}, Rest. Stadtkeller", "1081", "1082"],
    
    // Repräsentationsspesen mw (4891)
    ["Hotel", "Hotel", "VISA {mm}.{yy}, {vendor}", "4891", "1082"],
    ["Jazz Kantine", "Jazz Kantine", "VISA {mm}.{yy}, Jazz Kantine", "4891", "1082"],
    
    // Bankspesen mw (4222) – Kartengebühren
    ["Jahresbeitrag", "Jahresbeitrag", "VISA {mm}.{yy}, Jahresbeitrag Karte", "4222", "1082"],
    
    // Zinsen (4220)
    ["Sollzinsen", "Sollzinsen", "VISA {mm}.{yy}, Sollzinsen", "4220", "1082"],
    
    // Kommunikation (4720)
    ["Klara", "Klara", "VISA {mm}.{yy}, Klara", "4720", "1082"],
    
    // Übriger Betriebs- und Verwaltungsaufwand jm (4792)
    ["Kost + Brechbühl", "Kost", "VISA {mm}.{yy}, Kost + Brechbühl", "4792", "1082"],
  ];

  let seeded = 0;
  let skipped = 0;

  for (const [counterpartyPattern, descriptionPattern, bookingTextTemplate, debitAccNum, creditAccNum] of ccRules) {
    const debitAccountId = accountMap.get(debitAccNum);
    const creditAccountId = accountMap.get(creditAccNum);

    if (!debitAccountId || !creditAccountId) {
      console.warn(`⚠️  Konto nicht gefunden: ${debitAccNum} oder ${creditAccNum} – Regel "${counterpartyPattern}" übersprungen`);
      skipped++;
      continue;
    }

    // Check if rule already exists
    const existing = await db.select().from(bookingRules)
      .where(eq(bookingRules.counterpartyPattern, counterpartyPattern))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ℹ️  Regel "${counterpartyPattern}" existiert bereits (ID ${existing[0].id})`);
      skipped++;
      continue;
    }

    await db.insert(bookingRules).values({
      counterpartyPattern,
      descriptionPattern,
      bookingTextTemplate,
      debitAccountId,
      creditAccountId,
      usageCount: 1,
      priority: 30, // CC rules get highest priority
      source: "manual",
      isActive: true,
    });

    console.log(`  ✅ Regel "${counterpartyPattern}" → Soll ${debitAccNum}, Haben ${creditAccNum}`);
    seeded++;
  }

  console.log(`\n✅ ${seeded} KK-Regeln geseeded, ${skipped} übersprungen.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
