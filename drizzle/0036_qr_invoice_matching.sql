-- Phase 2.1: Debitoren-Zahlungsabgleich via QR-Referenz
-- Verknüpft eine Banktransaktion direkt mit einer Debitoren-Rechnung
-- (Match über die strukturierte QR-Referenz aus dem CAMT-Import).
ALTER TABLE `bank_transactions` ADD `matchedInvoiceId` int;
