-- AP4.6: Phantom-Organisation "Standardmandant" entfernen, sofern sie keinerlei
-- Daten enthält. Migration 0019 legte bei Frischinstallationen ohne companySettings
-- eine leere Default-Organisation an (slug 'default'), die in der Org-Auswahl
-- verwirrte. Gelöscht wird NUR, wenn die Org existiert UND keine org-scoped
-- Tabelle (inkl. user_organizations) eine Zeile auf sie verweist – bestehende
-- Installationen mit realen Daten in der Default-Org bleiben unberührt.
SET @phantom_org := (SELECT `id` FROM `organizations` WHERE `name` = 'Standardmandant' AND `slug` = 'default' ORDER BY `id` LIMIT 1);
--> statement-breakpoint
SET @phantom_refs := 0;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `accounts` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `audit_log` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `avatar_settings` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `bank_accounts` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `bank_transactions` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `booking_rules` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `company_settings` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `credit_card_statements` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `customers` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `customer_services` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `depreciation_settings` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `documents` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `ebics_config` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `employees` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `fiscal_years` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `import_automation_settings` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `import_history` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `insurance_settings` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `invitations` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `invoices` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `invoice_reminders` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `invoice_sequences` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `journal_entries` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `journal_entry_sequences` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `opening_balances` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `pain001_exports` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `pain001_payments` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `payroll_entries` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `pos_config` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `pos_transactions` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `qr_settings` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `services` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `subscriptions` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `suppliers` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `templates` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `time_entries` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `user_organizations` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `vat_periods` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SELECT COUNT(*) INTO @phantom_c FROM `year_end_bookings` WHERE `organizationId` = @phantom_org;
--> statement-breakpoint
SET @phantom_refs := @phantom_refs + @phantom_c;
--> statement-breakpoint
SET @phantom_sql := IF(@phantom_org IS NOT NULL AND @phantom_refs = 0, 'DELETE FROM `organizations` WHERE `id` = @phantom_org', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @phantom_sql;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
