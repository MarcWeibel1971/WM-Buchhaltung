-- Phase 3c: Konto-Mappings pro Organisation
-- Ersetzt hardcodierte Konto-Nummern (1032/1081/1082/4000) in payrollRouter
-- und Credit-Card-Flows. Alle Spalten sind nullable – Router fallen auf die
-- bisherigen Nummern zurück, solange die Zuordnung nicht gesetzt ist.

ALTER TABLE `organizations`
  ADD COLUMN `defaultBankAccountId` int NULL,
  ADD COLUMN `creditCardClearingAccountId` int NULL,
  ADD COLUMN `defaultSalaryExpenseAccountId` int NULL;

-- Entfernt den hardcodierten Default 'mw' in credit_card_statements.owner.
-- Die Spalte bleibt (bestehende Daten), neue Zeilen dürfen leer sein.
ALTER TABLE `credit_card_statements`
  ALTER COLUMN `owner` DROP DEFAULT;
