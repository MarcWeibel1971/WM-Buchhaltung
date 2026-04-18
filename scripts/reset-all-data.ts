/**
 * FULL DATA RESET SCRIPT
 * Deletes ALL data from ALL tables except the admin user (marc.weibel@weibel-mueller.ch).
 * The admin user is kept but reset (currentOrganizationId = null).
 */
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();

  console.log("=== FULL DATA RESET ===\n");

  // First, find the admin user ID
  const [adminUsers] = await db.execute(
    sql`SELECT id, email, name FROM users WHERE email = 'marc.weibel@weibel-mueller.ch'`
  );
  const adminUser = (adminUsers as any[])[0];
  if (!adminUser) {
    console.log("WARNING: Admin user marc.weibel@weibel-mueller.ch not found!");
  } else {
    console.log(`Admin user found: ID=${adminUser.id}, email=${adminUser.email}, name=${adminUser.name}`);
  }
  const adminId = adminUser?.id;

  // Delete order matters due to foreign key constraints
  // Start with the most dependent tables first

  // 1. Invoice-related
  console.log("Deleting invoice_reminders...");
  await db.execute(sql`DELETE FROM invoice_reminders`);
  
  console.log("Deleting invoice_items...");
  await db.execute(sql`DELETE FROM invoice_items`);
  
  console.log("Deleting invoices...");
  await db.execute(sql`DELETE FROM invoices`);
  
  console.log("Deleting invoice_sequences...");
  await db.execute(sql`DELETE FROM invoice_sequences`);

  // 2. Pain.001 exports
  console.log("Deleting pain001_payments...");
  await db.execute(sql`DELETE FROM pain001_payments`);
  
  console.log("Deleting pain001_exports...");
  await db.execute(sql`DELETE FROM pain001_exports`);

  // 3. Time tracking
  console.log("Deleting time_entries...");
  await db.execute(sql`DELETE FROM time_entries`);
  
  console.log("Deleting services...");
  await db.execute(sql`DELETE FROM services`);

  // 4. Customer-related
  console.log("Deleting customer_services...");
  await db.execute(sql`DELETE FROM customer_services`);
  
  console.log("Deleting customers...");
  await db.execute(sql`DELETE FROM customers`);

  // 5. Suppliers
  console.log("Deleting suppliers...");
  await db.execute(sql`DELETE FROM suppliers`);

  // 6. Templates
  console.log("Deleting templates...");
  await db.execute(sql`DELETE FROM templates`);

  // 7. Audit log
  console.log("Deleting audit_log...");
  await db.execute(sql`DELETE FROM audit_log`);

  // 8. Documents
  console.log("Deleting documents...");
  await db.execute(sql`DELETE FROM documents`);

  // 9. Journal-related
  console.log("Deleting journal_lines...");
  await db.execute(sql`DELETE FROM journal_lines`);
  
  console.log("Deleting journal_entries...");
  await db.execute(sql`DELETE FROM journal_entries`);
  
  console.log("Deleting journal_entry_sequences...");
  await db.execute(sql`DELETE FROM journal_entry_sequences`);

  // 10. Bank-related
  console.log("Deleting credit_card_statements...");
  await db.execute(sql`DELETE FROM credit_card_statements`);
  
  console.log("Deleting bank_transactions...");
  await db.execute(sql`DELETE FROM bank_transactions`);
  
  console.log("Deleting import_history...");
  await db.execute(sql`DELETE FROM import_history`);
  
  console.log("Deleting bank_accounts...");
  await db.execute(sql`DELETE FROM bank_accounts`);

  // 11. Payroll
  console.log("Deleting payroll_entries...");
  await db.execute(sql`DELETE FROM payroll_entries`);
  
  console.log("Deleting employees...");
  await db.execute(sql`DELETE FROM employees`);
  
  console.log("Deleting insurance_settings...");
  await db.execute(sql`DELETE FROM insurance_settings`);

  // 12. VAT
  console.log("Deleting vat_periods...");
  await db.execute(sql`DELETE FROM vat_periods`);

  // 13. Accounts & Opening balances
  console.log("Deleting opening_balances...");
  await db.execute(sql`DELETE FROM opening_balances`);
  
  console.log("Deleting accounts...");
  await db.execute(sql`DELETE FROM accounts`);

  // 14. Fiscal years & Year-end
  console.log("Deleting year_end_bookings...");
  await db.execute(sql`DELETE FROM year_end_bookings`);
  
  console.log("Deleting depreciation_settings...");
  await db.execute(sql`DELETE FROM depreciation_settings`);
  
  console.log("Deleting fiscal_years...");
  await db.execute(sql`DELETE FROM fiscal_years`);

  // 15. Booking rules
  console.log("Deleting booking_rules...");
  await db.execute(sql`DELETE FROM booking_rules`);

  // 16. Company settings & QR settings
  console.log("Deleting company_settings...");
  await db.execute(sql`DELETE FROM company_settings`);
  
  console.log("Deleting qr_settings...");
  await db.execute(sql`DELETE FROM qr_settings`);

  // 17. Subscriptions
  console.log("Deleting subscriptions...");
  await db.execute(sql`DELETE FROM subscriptions`);

  // 18. User-Organization memberships
  console.log("Deleting user_organizations...");
  await db.execute(sql`DELETE FROM user_organizations`);

  // 19. Organizations
  console.log("Deleting organizations...");
  await db.execute(sql`DELETE FROM organizations`);

  // 20. Users (except admin)
  if (adminId) {
    console.log(`Deleting all users except admin (ID=${adminId})...`);
    await db.execute(sql`DELETE FROM users WHERE id != ${adminId}`);
    // Reset admin's currentOrganizationId
    console.log("Resetting admin user's currentOrganizationId to NULL...");
    await db.execute(sql`UPDATE users SET currentOrganizationId = NULL WHERE id = ${adminId}`);
  } else {
    console.log("Deleting ALL users (no admin found)...");
    await db.execute(sql`DELETE FROM users`);
  }

  // Verify
  console.log("\n=== VERIFICATION ===");
  const tables = [
    'users', 'organizations', 'user_organizations', 'subscriptions',
    'accounts', 'journal_entries', 'journal_lines', 'bank_accounts',
    'bank_transactions', 'documents', 'booking_rules', 'employees',
    'payroll_entries', 'vat_periods', 'customers', 'suppliers',
    'time_entries', 'invoices', 'credit_card_statements'
  ];
  
  for (const table of tables) {
    const [rows] = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${table}`));
    console.log(`  ${table}: ${(rows as any[])[0].cnt} rows`);
  }

  console.log("\n=== RESET COMPLETE ===");
  process.exit(0);
}

main().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
