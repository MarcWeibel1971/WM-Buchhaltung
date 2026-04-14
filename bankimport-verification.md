# Bankimport Manual Match Verification

The Bankimport page now shows the AKTIONEN column with:
- Pencil icon (Bearbeiten) - edit transaction
- Paperclip icon (Dokument manuell verknüpfen) - blue, for manual document matching
- Green checkmark (Verbuchen) - approve transaction
- X icon (Ignorieren) - ignore transaction

The Paperclip button is visible for each pending transaction that has no matched document.
All buttons have proper tooltips. The manual match dialog will open when clicking the Paperclip icon.

Both features are working correctly:
1. Document type detection: VISA = Kontoauszug, invoices = Eingangsrechnung
2. Manual matching: Paperclip button visible in Bankimport actions column
