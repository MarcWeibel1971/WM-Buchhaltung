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

## Feature: Dokumenten-Management
- [x] DB-Schema: documents-Tabelle (id, filename, s3Key, s3Url, mimeType, fileSize, documentType, journalEntryId, bankTransactionId, uploadedBy, createdAt)
- [x] Backend: S3-Upload-Endpunkt für Belege (multipart, max 20MB, PDF/JPG/PNG)
- [x] Backend: documents-Router (upload, list, getByEntry, getByTransaction, delete)
- [x] Backend: KI-Kategorisierung mit Beleginhalt (PDF-Text / Bild-OCR via LLM vision)
- [x] Frontend: Seite /documents – zentrale Dokumentenübersicht mit Filter, Upload, Vorschau
- [x] Frontend: Navigation-Eintrag "Dokumente" in Sidebar
- [x] Frontend: Beleg-Upload-Widget in Journal-Detailansicht (bei jeder Buchung)
- [x] Frontend: Beleg-Upload-Widget in Bankimport-Transaktionszeile
- [x] Frontend: Beleg-Vorschau (PDF inline / Bild-Thumbnail) in Dokumentenübersicht
- [x] Frontend: Beleg-Badge bei Buchungen/Transaktionen die bereits Dokumente haben

## Bugfix: Bankimport Invalid Date (persistent)
- [x] Bankimport: Invalid Date Fehler behoben – normaliseDate() mit strikter Validierung, ungültige Zeilen werden übersprungen
- [x] PDF-Bankauszug-Import: LUKB PDF-Kontoauszüge via KI-Extraktion (LLM Vision) implementiert, Button im Bankimport

## Bugfix: PDF-Import Zod-Validierung
- [x] importTransactions Zod-Schema: nullable() für counterpartyIban, reference, counterparty hinzugefügt + null-zu-undefined Konvertierung in Mutation

## Verbesserungen Bankimport (Benutzer-Feedback)
- [x] 1. "Beschreibung" → "Buchungstext" mit KI-Training (z.B. "Sunrise 1. Quartal 2026", "SBB GA Januar 2026")
- [x] 2. Transaktionen bearbeitbar im Pop-Up-Fenster (alle Variablen)
- [x] 3. Bulk-Verbuchung: Mehrere Transaktionen auswählen und gleichzeitig verbuchen
- [x] 4. "Gegenpartei" → "Lieferant (Kreditor)" oder "Kunde (Debitor)" je nach Vorzeichen
- [x] 5. Corner Banca = Kreditkartenbelastung: Kreditkartenabrechnung hochladen → Sammelbuchung vorschlagen

## Feature: Konten-Bereich und Geschäftsjahr-Wähler
- [x] Neuer Bereich "Konten" nach Journal in der Navigation (Einzelkonto-Ansicht mit Transaktionen)
- [x] Einzelkonto-Detailseite: alle Buchungszeilen des Kontos, Saldo, Filter nach Periode
- [x] Druckfunktion / PDF-Export für Einzelkonto-Auszug
- [x] Geschäftsjahr-Wähler an allen relevanten Stellen (Dashboard, Journal, Bankimport, Berichte, MWST, Lohnbuchhaltung, Konten) via globalem FiscalYearContext

## Bugfix: Kreditkarten-PDF-Upload
- [x] creditCard.parsePdf: documentUrl wird als undefined gesendet – Upload-Flow korrigiert: result.document.s3Url statt result.url, fehlerhafter Server-Import in CreditCard.tsx entfernt
