-- Audit 2026-09 (Bilanz doppelt gezählt): Die Eröffnungsbilanz wurde bisher
-- sowohl in `opening_balances` als auch als freigegebener System-Journal-Eintrag
-- direkt auf den Bilanzkonten gespeichert. Saldo-Berechnungen addieren beides,
-- daher erschien jeder Eröffnungssaldo doppelt. `opening_balances` ist die
-- einzige Quelle; die redundanten Journal-Einträge (ohne Belegnummer, Quelle
-- 'system', Beschreibung 'Eröffnungsbilanz per …') werden entfernt – aber nur,
-- wenn für Organisation und Geschäftsjahr opening_balances-Zeilen existieren.
DELETE jl FROM `journal_lines` jl
INNER JOIN `journal_entries` je ON je.`id` = jl.`entryId`
WHERE je.`source` = 'system'
  AND je.`description` LIKE 'Eröffnungsbilanz per %'
  AND je.`entryNumber` IS NULL
  AND EXISTS (
    SELECT 1 FROM `opening_balances` ob
    WHERE ob.`organizationId` = je.`organizationId` AND ob.`fiscalYear` = je.`fiscalYear`
  );
--> statement-breakpoint
DELETE je FROM `journal_entries` je
WHERE je.`source` = 'system'
  AND je.`description` LIKE 'Eröffnungsbilanz per %'
  AND je.`entryNumber` IS NULL
  AND EXISTS (
    SELECT 1 FROM `opening_balances` ob
    WHERE ob.`organizationId` = je.`organizationId` AND ob.`fiscalYear` = je.`fiscalYear`
  );
