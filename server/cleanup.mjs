import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

// Remove duplicate bank accounts (keep lowest id per accountId)
await db.execute(sql`DELETE ba1 FROM bank_accounts ba1 INNER JOIN bank_accounts ba2 WHERE ba1.id > ba2.id AND ba1.accountId = ba2.accountId`);
console.log("Duplikate entfernt");

// Remove duplicate employees (keep lowest id per code)
await db.execute(sql`DELETE e1 FROM employees e1 INNER JOIN employees e2 WHERE e1.id > e2.id AND e1.code = e2.code`);
console.log("Mitarbeiter-Duplikate entfernt");

process.exit(0);
