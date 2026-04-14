# Document Fiscal Year Test Notes

## Current state (GJ 2026 selected):
- Page shows "Dokumente" header with stats: Gesamt 0, Matched 0, Offen 0, Eingangsrechnungen 0
- Upload zone shows: "Dokumente werden automatisch dem Geschäftsjahr GJ 2026 zugewiesen"
- No documents found for GJ 2026 (correct - all existing docs have no fiscal year assigned)
- Filter bar shows: Search, Alle Typen, Alle Status
- GJ selector in top right shows "GJ 2026"

## Need to verify:
- Switch to GJ 2025 to see if existing docs (which have fiscalYear=null) appear there
- The existing docs have no fiscal year, so they won't appear in any GJ filter
- This is expected behavior - old docs need to be migrated or manually assigned
