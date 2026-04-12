# WM Weibel Mueller AG – Buchhaltung TODO

## Datenbankschema & Kontenplan
- [x] Datenbankschema: accounts, journal_entries, journal_lines, bank_accounts, bank_transactions, payroll, employees, vat_periods
- [x] Kontenplan (101 Konten) aus extrahierten Daten in DB seeden
- [x] Eröffnungssalden aus Bilanz 2025 importieren

## Backend – Buchhaltung
- [x] tRPC Router: accounts (list, get, getBalance, getLedger)
- [x] tRPC Router: journal (list, create, approve, reject, delete)
- [x] Double-Entry-Validierung (Soll = Haben)
- [x] Kontenansicht (Hauptbuch pro Konto)

## Backend – Bankimport
- [x] CAMT.053 XML Parser
- [x] MT940 Text Parser
- [x] CSV Parser (generisch)
- [x] Bank-Transaktionen speichern und Duplikate erkennen
- [x] KI-Kategorisierung via LLM (Buchungsvorschlag Soll/Haben)
- [x] Regelbasierte Kategorisierung (wiederkehrende Transaktionen)
- [x] tRPC Router: bankImport (upload, listPending, approve, reject)

## Backend – Kreditkarte
- [x] PDF-Upload für VISA-Kreditkartenauszüge
- [x] PDF-Textextraktion und Parsing der Einzelpositionen
- [x] Sammelbelastung über Durchlaufkonto 1082
- [x] tRPC Router: creditCard (upload, listPending, approve)

## Backend – Lohnbuchhaltung
- [x] Mitarbeiterstammdaten (mw, jm)
- [x] Lohnberechnung (Brutto, AHV, BVG, KTG/UVG, Netto)
- [x] Lohnbuchung ins Journal
- [x] Lohnausweis PDF-Generierung
- [x] tRPC Router: payroll (list, create, generateSlip)

## Backend – MWST
- [x] MWST-Perioden (Quartal/Semester)
- [x] Automatische Zusammenstellung der MWST-Daten
- [x] MWST-Sätze: 8.1%, 2.6%, 3.8%
- [x] tRPC Router: vat (list, create)

## Backend – Berichte
- [x] Bilanz-Berechnung (Aktiven/Passiven mit Vorjahresvergleich)
- [x] Erfolgsrechnung-Berechnung (Aufwand/Ertrag mit Vorjahresvergleich)
- [x] tRPC Router: reports (balanceSheet, incomeStatement)

## Frontend – Design & Layout
- [x] Design-System: Farben, Typografie, Tailwind-Theme (Dunkel-Sidebar, helles Content)
- [x] DashboardLayout mit Sidebar-Navigation
- [x] Responsive Design

## Frontend – Dashboard
- [x] Übersichts-Dashboard mit KPIs (Umsatz, Aufwand, Ergebnis)
- [x] Ausstehende Buchungen (Pending-Counter)
- [x] Schnellzugriff auf häufige Aktionen

## Frontend – Journal & Buchungsfreigabe
- [x] Journal-Ansicht mit Filter und Suche
- [x] Buchungsvorschläge-Liste (ausstehend)
- [x] Buchung freigeben per Klick
- [x] Soll/Haben-Konto anpassen vor Freigabe
- [x] Manuelle Buchungserfassung

## Frontend – Bankimport
- [x] Datei-Upload (CAMT/MT940/CSV)
- [x] Transaktionsliste mit KI-Vorschlägen
- [x] Batch-Freigabe mehrerer Buchungen

## Frontend – Kreditkarte
- [x] PDF-Upload VISA-Auszug
- [x] Einzelpositionen anzeigen und prüfen
- [x] Sammelbelastung buchen

## Frontend – Lohnbuchhaltung
- [x] Lohnerfassung für mw und jm
- [x] Lohnübersicht und Historie
- [x] Lohnausweis PDF-Download

## Frontend – MWST
- [x] MWST-Perioden-Übersicht
- [x] MWST-Abrechnung anzeigen

## Frontend – Berichte
- [x] Bilanz-Ansicht mit Vorjahresvergleich
- [x] Erfolgsrechnung-Ansicht mit Vorjahresvergleich
- [x] PDF-Export Bilanz und Erfolgsrechnung (jsPDF, client-side)

## Tests
- [x] Vitest: Double-Entry-Validierung
- [x] Vitest: Schweizer MWST-Berechnung
- [x] Vitest: Lohnberechnung
- [x] Vitest: Bank-Parser
- [x] Vitest: Kontenplan-Klassifizierung
- [x] Vitest: auth.logout (Template-Test)

## Bugfixes
- [x] Bankimport: transactionDate 'Invalid Date' behoben – alle date()-Spalten auf mode:'string' umgestellt, toDateStr()-Hilfsfunktion eingeführt
