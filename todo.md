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

## Feature: Lern-System für Buchungsvorschläge (Refresh)
- [x] DB-Schema: booking_rules Tabelle (counterpartyPattern, bookingTextTemplate, debitAccountId, creditAccountId, vatRate, priority, usageCount)
- [x] Backend: Beim Verbuchen einer manuell angepassten Transaktion automatisch eine Regel lernen/aktualisieren
- [x] Backend: refreshSuggestions-Endpunkt – alle ausstehenden Transaktionen gegen gelernte Regeln matchen und Vorschläge aktualisieren
- [x] Frontend: "Refresh (gelernt)" Button neben "Buchungstexte generieren" im Bankimport
- [x] Frontend: Visuelles Feedback: Buch-Icon bei Transaktionen die von gelernten Regeln profitieren, 98% Konfidenz
- [x] Tests: 17 Vitest-Tests für Regel-Matching, Buchungstext-Template-Generierung und Lern-Flow

## Feature: KK-Buchungsregeln aus Beispiel lernen
- [x] Booking Rules für KK-Positionen aus Benutzer-Beispiel geseeded (SBB→4821, Uber→4821, bexio→4305, Restaurant→1081, I/O Fund→4305, Perplexity→4305, Musik Hug→1081, Parkhaus→4821, Klara→4720, Hotel→4891, Mobility→4821, Jazz Kantine→4891, Envato→4305, Adobe→4305, Jahresbeitrag Karte→4222, Sollzinsen→4220, Kost+Brechbühl→4792)
- [x] KK-Sammelbuchung: Beim Verbuchen die gelernten Regeln anwenden (Konto-Vorschlag pro Position)

## Feature: Buchungsdetail-Popup (Journal & Kontoblatt)
- [x] Backend: getEntryDetail-Endpunkt – vollständige Buchung mit allen Zeilen, Gegen-Konto, Soll/Haben laden
- [x] Frontend: Popup-Komponente "Buchungsliste" mit Spalten: Beleg, Datum, Konto, Text, Gegen-Konto, Soll, Haben
- [x] Frontend: Popup zeigt Total Soll / Total Haben am Ende
- [x] Frontend: Popup in Journal-Seite integrieren (Klick auf Transaktion)
- [x] Frontend: Popup in Konten/Kontoblatt-Seite integrieren (Klick auf Buchungszeile)

## Feature: Eröffnungsbilanz 2026 aktualisieren
- [x] Eröffnungsbilanz-Daten aus PDF extrahieren (alle Konten mit Salden per 01.01.2026)
- [x] Bestehende Eröffnungsbuchungen löschen/aktualisieren (keine vorhanden, neu erstellt)
- [x] Neue Eröffnungsbuchungen für alle Konten erstellt: 10 Aktiven (Soll) + 12 Passiven (Haben) = CHF 1'105'612.54
- [x] Bilanz verifiziert: Total Soll = Total Haben = CHF 1'105'612.54, Entry #2026-00005, Status approved

## Feature: KK-Buchungsregeln aus VISA-Abrechnungen 2025 lernen
- [x] Alle 6 Seiten der VISA-Kreditkartenabrechnungen 2025 extrahiert (~300 Buchungszeilen)
- [x] 70 neue + 17 aktualisierte Booking Rules geseeded (Total: 91 Regeln in DB)
- [x] Verifiziert: 91 Regeln in DB, alle 39 Tests grün

## Feature: Dokument-Transaktions-Matching
- [x] DB-Schema: matchedDocumentId und matchScore zu bank_transactions, matchStatus und matchScore zu documents hinzugefügt
- [x] Backend: Matching-Algorithmus implementiert (Betrag 40%, Counterparty 30%, Datum 10%, IBAN 10%, Referenz 10%)
- [x] Backend: Auto-Match Endpunkt – alle ungematchten Dokumente gegen pending Transaktionen prüfen
- [x] Backend: Unmatch-Endpunkt zum Aufheben von Matches
- [x] Backend: improveBookingSuggestionFromDocument – Rechnungsdetails für Buchungsvorschläge nutzen
- [x] Frontend Dokumente: Matched/Offen Status-Badges, Match-Score %, verlinkte Txn-Nummer, Match-Filter
- [x] Frontend Dokumente: Auto-Match Button, Unmatch Button
- [x] Frontend Bankimport: Matched-Dokument-Icon (FileText grün) bei Transaktionen
- [x] Tests: 13 Vitest-Tests für calculateMatchScore und improveBookingSuggestionFromDocument
- [x] Frontend Bankimport: Rechnungsdetails im Bearbeitungsdialog anzeigen wenn gematched (Dokumentname, Betrag, Datum, Gegenpartei, Match-Score, Link zur Rechnung)

## Bugfix: Kreditkarten-PDF-Analyse
- [x] KK-PDF-Parsing: LLM-Prompt komplett überarbeitet mit 91 gelernten Regeln + vollständigem Kontenplan als Kontext, JSON-Extraktion robuster (Markdown-Code-Blöcke)
- [x] KK-Dialog: Breite auf volle Seitenbreite (sm:max-w-[95vw]) ohne horizontales Scrollen

## Verbesserungen Journal-Ansicht
- [x] Journal: Typ-Spalte hinzugefügt (Einzel=grau, Sammel=blau Badge)
- [x] Journal: Konto (Soll) und Gegenkonto (Haben) Spalten – bei Sammelbuchungen "Diverse" im Soll, Bankkonto im Haben
- [x] Journal: Betrag CHF Spalte mit korrekten Beträgen (Total Soll der Buchungszeilen)
- [x] Journal: LUKB mw Buchungen: Alle 48 Transaktionen sind noch pending im Bankimport, erscheinen nach Verbuchung automatisch

## Bugfix: Fundamentale Probleme (Benutzer-Feedback)
- [x] Fix 1: Konto 1031→1032 korrigieren – Alle LUKB mw Transaktionen müssen Konto 1032 im Soll oder Haben haben, nicht 1031
- [x] Fix 2: Toggle verbucht↔ausstehend – Verbuchte Transaktionen im Bankimport und KK-Abrechnungen müssen rückgängig gemacht werden können (Journal-Einträge löschen, Status zurück auf pending)
- [x] Fix 3: Doppelte Eröffnungsbilanz entfernen – Eröffnungssalden wurden doppelt gebucht
- [x] Fix 4: Ausstehende KK-Abrechnungen löschen – Lösch-Button für pending KK-Abrechnungen auf der Kreditkarte-Seite

## Neue Features (Benutzer-Feedback)
- [x] Feature: Neue Buchung – Auswahl zwischen Einzelbuchung und Sammelbuchung
- [x] Feature: Rechnungsvorschau bei gematchten Bankimport-Transaktionen (Dokumente-Matching)

## Bugfix: Journal Löschen/Rückgängig
- [x] Journal: Buchungen löschen und rükgängig machen (Delete/Revert-Buttons) reparieren

## Feature: KK-Verbuchung im Bankimport (Doppelbuchung)
- [x] Bankimport Bearbeiten-Dialog: Button "Verbuchungsvorschlag aufrufen" wenn KK-Abrechnung verknüpft ist
- [x] Bankimport Verbuchen: Bei KK-Transaktionen zwei Journal-Einträge erstellen (1082/1032 + Aufwand/1082)
- [x] KK-Verbuchungs-Dialog: Zeigt Sammelbuchung mit Aufwandkonten aus KK-Abrechnung und ermöglicht direkte Verbuchung
- [x] KK-Verbuchungs-Dialog: Feld "Effektiv bezahlter Betrag" (Bankbelastung) separat eingeben können (kann kleiner als Abrechnungstotal sein wegen Vormonatsguthaben)

## Feature: Gewerbe-Treuhand Fremdhonorare
- [x] Booking Rules: Gewerbe-Treuhand AG → Konto 3000 Fremdhonorar (statt 4740 Rechts- und Beratungsaufwand)
- [x] LLM-Prompt: Bei Gewerbe-Treuhand Rechnungen den Kundennamen aus der Rechnung extrahieren und in Buchungstext integrieren
- [x] Bestehende Gewerbe-Treuhand Transaktionen im Bankimport: Konto auf 3000 aktualisieren und Buchungstexte mit Kundennamen neu generieren

## Feature: Kontoüberträge zwischen LUKB-Konten
- [x] Backend: detectTransfers Endpunkt - automatische Erkennung von Kontoüberträgen (gleicher Betrag, entgegengesetztes Vorzeichen, max. 2 Tage Differenz)
- [x] Backend: approveTransfer Endpunkt - Kontoübertrag als Journal-Eintrag verbuchen (Soll/Haben = die zwei Bankkonten)
- [x] Frontend: Bankimport zeigt erkannte Kontoüberträge mit Matching-Partner und "Übertrag verbuchen"-Button
- [x] Frontend: Kontoüberträge werden korrekt als interne Buchungen (1031/1032, 1031/1033 etc.) dargestellt

## Feature: IBAN im Kontenplan und Bankimport-Konto-Validierung
- [x] Schema: IBAN-Feld zu bank_accounts Tabelle hinzugefügt und DB migriert
- [x] Bankimport: LLM-Prompt dynamisch mit korrektem Bankkonto basierend auf bankAccountId/IBAN
- [x] Bestehende Transaktionen: 85 Transaktionen von Konto 1031/1033 mit falschem Bankkonto (1032) korrigiert
- [x] Backend: updateBankAccount Endpunkt für IBAN-Bearbeitung hinzugefügt
- [x] Frontend: IBAN in Bankkonten-Auswahl angezeigt

## Einstellungen-Bereich
- [x] DB: Tabellen company_settings, insurance_settings erstellt und migriert
- [x] Backend: settingsRouter (Unternehmensdaten CRUD) implementiert
- [x] Backend: insuranceRouter (Versicherungsparameter CRUD) implementiert
- [x] Frontend: /settings Seite mit Tab-Navigation (Unternehmen, Bankkonten, Mitarbeiter, Versicherungen, Buchungsregeln)
- [x] Frontend: Unternehmensdaten-Formular (Name, Rechtsform, Adresse, UID, MWST-Nr., Geschäftsjahr)
- [x] Frontend: Bankkonten-Verwaltung mit IBAN-Bearbeitung
- [x] Frontend: Mitarbeiterstamm-Liste mit Hinzufügen/Bearbeiten/Löschen
- [x] Frontend: Versicherungsparameter (AHV, BVG, UVG, KTG, FAK) mit Beitragssätzen
- [x] Frontend: Buchungsregeln-Übersicht mit Bearbeiten/Löschen
- [x] Navigation: "Einstellungen" in Layout.tsx Sidebar hinzugefügt

## Verbesserungen (Runde 2)

### Mitarbeiter-Lohnkonto aus Kontenplan
- [x] Backend: getEmployees Endpunkt mit Konto-Anreicherung (salaryAccountId, grossSalaryAccountId)
- [x] Frontend: Settings/Mitarbeiter – Kontenplan-Dropdown für Lohnkonto (Netto) und Bruttolohnkonto
- [x] Frontend: Kontenauswahl mit Kontonummer + Name

### Lohnbuchhaltung mit Versicherungsparametern aus DB
- [x] Backend: Versicherungsparameter aus insurance_settings via settings.getInsuranceSettings
- [x] Frontend: Lohnberechnung mit dynamischen Sätzen (AHV, BVG, KTG/UVG) aus DB, Fallback auf Schweizer Richtwerte
- [x] Frontend: Bruttolohn-Änderung löst automatische Neuberechnung aus

### Firmendaten auf Ausdrucken
- [x] Frontend: Lohnausweis PDF mit Firmenname, Adresse, UID (jsPDF, client-side)
- [x] Frontend: Bilanz-PDF-Export mit Firmenname, Adresse, UID, MWST-Nr.
- [x] Frontend: Erfolgsrechnung-PDF-Export mit Firmendaten
- [x] Frontend: MWST-Abrechnung Detail-Dialog mit PDF-Export-Button und Firmendaten

## Feature: Jahreslohnabrechnung

- [x] Backend: annualPayroll-Endpunkt – alle Monatslöhne eines Mitarbeiters pro Jahr summieren
- [x] Backend: Bruttolohn-Rückrechnung aus Nettolohn + AHV + BVG + KTG (Netto + AN-Abzüge = Brutto)
- [x] Frontend: Lohnbuchhaltung – Tab "Jahreslohnausweis" neben Monatsliste (Tabs-Komponente)
- [x] Frontend: Jahreslohnausweis zeigt alle Monate mit Brutto/Abzüge/Netto pro Monat + Jahrestotal
- [x] Frontend: 4 Summary-Cards: Jahresbruttolohn, Total AN-Abzüge, Jahresnettolohn, Total AG-Lohnkosten
- [x] Frontend: PDF-Export Jahreslohnausweis (Firmenname, Mitarbeiter, Monatstabelle, Jahrestotale)
- [x] Frontend: Monatslohnausweis-PDF zeigt Bruttolohn korrekt

## Feature: Offizieller Lohnausweis Form. 11

- [x] DB/Backend: employees-Tabelle um Adressfelder (street, zipCode, city, employmentEnd) erweitert
- [x] DB/Backend: employees-Tabelle um Bemerkungen-Feld (lohnausweisRemarks) erweitert
- [x] Backend: annualSummary-Endpunkt gibt alle Felder für Lohnausweis zurück
- [x] Frontend: Settings/Mitarbeiter – Strasse, PLZ, Ort, Austritt, Bemerkungen Ziffer 15 bearbeitbar
- [x] Frontend: Offizieller Lohnausweis PDF (Form. 11) mit exaktem Layout
  - Checkboxen A (Lohnausweis angekreuzt) / B (Rentenbescheinigung leer)
  - Felder C (AHV-Nr.), D (Jahr), E (Von/Bis aus Eintrittsdatum)
  - Checkboxen F (Beförderung), G (Kantine) – beide leer
  - Adressblock H (Arbeitnehmer: Name, Strasse, PLZ/Ort)
  - Ziffern 1–11 (Lohn, Nebenleistungen, Bruttolohn, AHV+KTG, BVG, Nettolohn)
  - Ziffern 12–15 (Quellensteuer, Spesen, Nebenleistungen, Bemerkungen aus DB)
  - Footer I (Ort/Datum, Arbeitgeber-Adresse aus companySettings, UID)
- [x] Frontend: Jahreslohnausweis-Tab – zwei Buttons: "Interner Lohnausweis" und "Offizieller Lohnausweis (Form. 11)"

## Fix: Dialog-Breiten responsive

- [x] dialog.tsx: Standard-Breite auf w-[min(95vw,56rem)] max-w-none responsive umgestellt
- [x] BookingDetailDialog.tsx: Breite responsive, Tabelle mit overflow-x-auto
- [x] Journal.tsx: Alle DialogContent-Breiten responsive
- [x] BankImport.tsx: Alle DialogContent-Breiten responsive
- [x] CreditCard.tsx: DialogContent-Breite responsive
- [x] Payroll.tsx: DialogContent-Breite responsive
- [x] Vat.tsx: Beide DialogContent-Breiten responsive
- [x] Settings.tsx: Beide DialogContent-Breiten responsive

## Feature: Eröffnungssalden manuell anpassen

- [x] Backend: getOpeningBalances Endpunkt (alle Konten mit aktuellem Eröffnungssaldo)
- [x] Backend: upsertOpeningBalances mit Aktiven=Passiven Validierung (TRPCError bei Differenz)
- [x] Backend: Eröffnungsbilanz-Journalbuchung wird beim Speichern automatisch neu erstellt
- [x] Frontend: Settings Tab "Eröffnungssalden" mit Aktiven/Passiven-Tabellen
- [x] Frontend: Live-Anzeige Aktiven/Passiven-Summen und Differenz-Warnung
- [x] Frontend: Speichern-Button deaktiviert wenn Aktiven ≠ Passiven

## Fix: Buchung-Bearbeiten-Dialog + Kontoauszug-Layout

- [x] Buchung-Bearbeiten-Dialog: Betrag-Synchronisation Soll⇔Haben (bei 2-Zeilen-Buchung: Änderung in einem Feld übernimmt Wert ins andere)
- [x] Buchung-Bearbeiten-Dialog: Konten-Tauschen-Button ⇄ (tauscht Soll⇔Haben bei allen Zeilen)
- [x] Kontoauszug-Seite: table-layout fixed mit colgroup, Buchungstext truncate+title, Datum+Beleg-Nr. zentriert

## Feature: Lohnbuchhaltung aus Journal-Buchungen befüllen

- [x] Backend: Journal-Buchungen mit 'Lohn' im Buchungstext analysieren und Mitarbeiter/Monat/Beträge extrahieren
- [x] Backend: syncFromJournal Endpunkt – erstellt/aktualisiert payroll_entries aus Journal-Buchungen
- [x] Backend: Bruttolohn aus Konto 4000/4001 (Soll), Nettolohn aus Personalkonto (Haben)
- [x] Frontend: "Aus Journal synchronisieren" Button (mit Spinner) in Lohnbuchhaltung
- [x] Frontend: Erfolgsmeldung zeigt Anzahl neue/aktualisierte/übersprungene Einträge

## Fix: BVG CHF-Beträge + Bruttolohn Bottom-Up

- [x] Schema: insurance_settings um bvgEmployeeMonthly und bvgEmployerMonthly Felder erweitert (Migration 0008)
- [x] Backend: settingsRouter upsertInsuranceSetting speichert BVG-Monatsbeträge korrekt
- [x] Frontend: InsurancesTab – BVG-Formular zeigt CHF/Monat Felder statt %-Felder
- [x] Frontend: InsurancesTab – Tabelle zeigt BVG als "CHF x.xx/Mt." statt Prozentsatz
- [x] Frontend: CreatePayrollDialog – BVG-Abzug verwendet feste CHF-Monatsbeträge aus DB
- [x] Frontend: CreatePayrollDialog – Nettolohn-Eingabefeld (Bottom-Up): Netto eingeben → Brutto wird berechnet
- [x] Frontend: CreatePayrollDialog – Bruttolohn-Eingabefeld weiterhin möglich (Top-Down)
- [x] Frontend: AHV-Rate-Parsing korrigiert (DB-Wert ist Dezimalzahl, durch 100 dividiert für Prozentrechnung)

## Feature: Journal Bulk-Selektion und Aktionen

- [x] Frontend: Checkbox-Spalte in Journal-Tabelle (Einzelselektion pro Zeile)
- [x] Frontend: "Alle markieren" Checkbox im Tabellenkopf (selektiert alle sichtbaren Einträge)
- [x] Frontend: Bulk-Aktionsleiste erscheint wenn mindestens 1 Eintrag markiert ist (Anzahl, Aktionen)
- [x] Frontend: Bulk-Aktion "Genehmigen" (alle markierten pending-Einträge freigeben)
- [x] Frontend: Bulk-Aktion "Löschen" (alle markierten Einträge löschen, mit Bestätigung)
- [x] Frontend: Bulk-Aktion "Zurücksetzen" (alle markierten approved-Einträge auf pending)
- [x] Backend: bulkApprove Endpunkt (Array von Entry-IDs genehmigen)
- [x] Backend: bulkDelete Endpunkt (Array von Entry-IDs löschen)
- [x] Backend: bulkRevert Endpunkt (Array von Entry-IDs zurücksetzen)

## Feature: Journal Erweiterte Selektion

- [x] Frontend: Shift-Klick Bereichsselektion (alle Einträge zwischen letztem und aktuellem Klick markieren)
- [x] Frontend: Seitenübergreifende Selektion – Banner "Alle Y Buchungen auswählen" nach Alle-markieren
- [x] Frontend: Banner "Alle X Buchungen sind ausgewählt" mit Option "Nur diese Seite behalten"
- [x] Backend: getAllIds Endpunkt – alle IDs der aktuellen Abfrage (Filter/Suche) zurückgeben

## Fix: Bruttolohn-Rückrechnung korrigieren

- [x] Recherche: Schweizer Lohnabzüge korrekt (AHV/IV/EO, ALV, BVG, KTG/UVG)
- [x] Backend: syncFromJournal – Bruttolohn korrekt aus Journal-Buchungen extrahieren
- [x] Backend: Bottom-Up Berechnung: Brutto = (Netto + BVG_AN) / (1 - AHV_Rate - KTG_Rate)
- [x] Frontend: Jahreslohnausweis zeigt Brutto > Netto mit korrekten Abzügen

## Bugfix: Bruttolohn-Berechnung (Brutto muss > Netto sein)

- [x] Backend: syncFromJournal auch aus bank_transactions synchronisieren (Journal ist leer)
- [x] Backend: Versicherungsparameter (AHV, BVG, KTG) aus insurance_settings laden
- [x] Backend: Bruttolohn-Rückrechnung: Brutto = (Netto + BVG_AN) / (1 - AHV_Rate - KTG_Rate)
- [x] Backend: Alle Abzüge (AHV AN/AG, BVG AN/AG, KTG AN/AG) korrekt berechnen und speichern
- [x] Backend: totalEmployerCost = Brutto + AG-Anteile (AHV_AG + BVG_AG + KTG_AG)
- [x] Backend: recalculatePayroll Endpunkt – bestehende Einträge mit korrekten Abzügen neu berechnen
- [x] Tests: Vitest für Bruttolohn-Rückrechnung und Abzugsberechnung
- [x] Verifizierung: Brutto > Netto für alle Payroll-Einträge in der DB

## Bugfix: Gelöschte Journal-Buchungen geben Banktransaktionen nicht frei

- [x] Backend: bulkDelete setzt zugehörige Banktransaktionen auf 'pending' zurück (war der Bug!)
- [x] Backend: revertBankTransaction setzt Status korrekt auf 'pending'
- [x] DB-Fix: 156 verwaiste Banktransaktionen auf 'pending' zurückgesetzt
- [x] Verifizierung: 158 Banktransaktionen erscheinen wieder im Bankimport

## Bugfix: Verbuchungsvorschlag bei gematchter KK-Abrechnung überspringt Upload nicht

- [x] Frontend: "Verbuchungsvorschlag aufrufen" bei gematchter KK-Abrechnung soll Upload-Schritt überspringen
- [x] Frontend: Dialog direkt mit Verbuchungsvorschlag öffnen, wenn Beleg bereits verknüpft ist

## Feature: Spalten-Sortierung für Bankimport und Journal

- [x] Frontend: Bankimport – Sortierung für alle Spalten (Datum, Buchungstext, Lieferant, Soll-Konto, Haben-Konto, Betrag, Status)
- [x] Frontend: Journal – Sortierung für alle Spalten (Nr, Datum, Typ, Beschreibung, Konto, Gegenkonto, Betrag, Quelle, Status)

## Feature: Aufklappbare Banktransaktionen in Lohnbuchhaltung
- [x] Backend: getTransactions Endpunkt – Banktransaktionen für Mitarbeiter/Monat abrufen (Suche über Buchungstext mit Mitarbeiter-Code)
- [x] Frontend: Klickbare Lohnzeilen mit Chevron-Icon und aufklappbarem Bereich
- [x] Frontend: Banktransaktionen-Tabelle (Datum, Beschreibung, Bankkonto, Betrag CHF, Status) mit Total-Zeile

## Feature: Kontoauszug-Verbesserungen
- [x] Frontend: Buchungstext aufklappbar – Klick auf Zeile zeigt langen Buchungstext vollständig an (statt nur Tooltip)
- [x] Frontend: Suchfeld für Buchungstext im Kontoauszug
- [x] Frontend: Datumsbereich-Filter (von/bis) im Kontoauszug mit Filter-Total und Ergebniszähler
- [x] Frontend: Lupe/Stift-Icon in Kontoauszug-Zeile öffnet Buchungsdetail bzw. Bearbeiten-Dialog direkt (ohne Umweg über Journal)

## Feature: Jahresabschluss

### DB-Schema
- [x] Tabelle: fiscal_years erweitert (closingStatus, isClosed, balanceCarriedForward, closedAt)
- [x] Tabelle: depreciation_settings (assetAccountId, depreciationRate, method, depreciationExpenseAccountId, isActive)
- [x] Tabelle: year_end_bookings (id, fiscalYear, type, debitAccountId, creditAccountId, amount, description, status, journalEntryId, reversalJournalEntryId, sourceDocumentId)

### Backend: Jahresendbuchungs-Vorschläge
- [x] Transitorische Passiven: Rechnungen mit Datum im neuen GJ aber Leistung im alten GJ erkennen (Kto 2300)
- [x] Kreditoren: Rechnungen mit Datum im alten GJ aber Bezahlung im neuen GJ erkennen (Kto 2000)
- [x] Transitorische Aktiven: Vorauszahlungen/Rückerstattungen im neuen GJ für Aufwand im alten GJ (Kto 1300)
- [x] Debitoren: Offene Forderungen am Jahresende (Kto 1100)
- [x] Abschreibungen: Automatische Berechnung basierend auf Abschreibungssätzen und Anlagevermögen
- [x] Rückbuchungen: Automatische Gegenbuchungen im neuen GJ für transitorische Buchungen

### Backend: Geschäftsjahr-Verwaltung
- [x] Neues Geschäftsjahr eröffnen (fiscal_years Eintrag erstellen)
- [x] Saldovortrag: Jahresendwerte als neue Eröffnungssaldi ins neue GJ übertragen
- [x] Geschäftsjahr abschliessen (Status auf 'closed', keine weiteren Buchungen möglich)

### Frontend: Jahresabschluss-Seite
- [x] Neue Seite /year-end in Navigation (zwischen Berichte und Dokumente)
- [x] Wizard-Flow: 5 Schritte (Abschluss starten → Vorschläge generieren → Buchungen prüfen → Rückbuchungen & Saldovortrag → Abschluss finalisieren)
- [x] Übersicht aller vorgeschlagenen Jahresendbuchungen mit Genehmigen/Ablehnen
- [x] Summary-Cards: Status, Vorschläge, Genehmigt, Saldovortrag
- [x] Hinweise zu TP, TA, Kreditoren, Abschreibungen, Rückbuchungen

### Frontend: Abschreibungssätze in Einstellungen
- [x] Neuer Tab "Abschreibungen" in Einstellungen
- [x] Tabelle: Konto, Satz, Methode, Aufwandkonto, Aktiv, Aktionen
- [x] CRUD für Abschreibungssätze (Neuer Satz / Bearbeiten / Löschen)
- [x] Info-Box: Steuerlich zulässige Abschreibungssätze (Schweiz)

### Tests: Jahresabschluss
- [x] Vitest: Abschreibungsberechnung (linear 25%, degressiv 40%)
- [x] Vitest: Transitorische Buchungen Klassifizierung (TP, TA, Kreditoren)
- [x] Vitest: Saldovortrag-Berechnung (Bilanzkonten übertragen, Erfolgsrechnung abschliessen)
- [x] Vitest: Rückbuchungen (Gegenbuchung am 01.01. des neuen GJ)
- [x] Total: 109 Tests bestanden

## Feature: Letzten Kontoauszug laden & Duplikate-Erkennung

- [x] DB: import_history Tabelle (bankAccountId, filename, fileType, s3Key, transactionsImported, transactionsDuplicate, dateRange)
- [x] Backend: importTransactions speichert Import-Historie (Dateiname, Typ, Anzahl importiert/Duplikate)
- [x] Backend: getLastImport Endpunkt – letzter Import pro Bankkonto
- [x] Backend: getImportHistory Endpunkt – alle Imports pro Bankkonto
- [x] Backend: Duplikate-Erkennung via txHash UNIQUE-Constraint (prüft gegen alle bestehenden Transaktionen)
- [x] Frontend: "Letzter Import" Info-Box unter Bankkonto-Auswahl (Dateiname, Datum, Anzahl, Zeitraum)
- [x] Frontend: "Import-Historie" aufklappbare Tabelle mit allen bisherigen Imports
- [x] Frontend: Duplikate-Feedback beim Import (Toast: "X neue, Y Duplikate übersprungen")

## Bug: Refresh (gelernt) überschreibt manuelle Änderungen

- [x] Bug: "Refresh (gelernt)" überschreibt manuell geänderte Buchungstexte und Konten mit alten KI-Vorschlägen
- [x] Fix: Refresh muss gelernte Regeln auf ÄHNLICHE unbearbeitete Transaktionen anwenden, aber bereits manuell geänderte Transaktionen NICHT überschreiben
- [x] Sicherstellen, dass Booking Rules korrekt aus manuellen Korrekturen gelernt und beim Refresh priorisiert werden

## Feature: Geschäftsjahr-Zuordnung für Dokumente

- [x] DB-Schema: fiscalYear-Spalte (int) zur documents-Tabelle hinzufügen
- [x] Backend: Beim Upload automatisch das übergebene Geschäftsjahr zuweisen
- [x] Backend: documents.list nach fiscalYear filtern
- [x] Backend: Endpunkt zum Ändern des Geschäftsjahrs pro Dokument
- [x] Frontend: Neue Spalte "Jahr" in der Dokumentenliste
- [x] Frontend: Dokumente nach gewähltem Geschäftsjahr filtern (GJ-Wähler oben rechts)
- [x] Frontend: Geschäftsjahr pro Dokument editierbar (Dropdown/Select)
- [x] Frontend: Statistik-Karten nur für das gewählte GJ anzeigen
- [x] Migration: Bestehende 13 Dokumente auf GJ 2026 migriert

## Feature: Automatische Dokumententyp-Erkennung

- [x] Backend: LLM-Prompt beim Upload anpassen, damit documentType korrekt erkannt wird (invoice_in, invoice_out, receipt, bank_statement, other)
- [x] Backend: documentType aus KI-Analyse in DB speichern statt immer "other"
- [x] Bestehende Dokumente nachträglich mit korrektem Typ aktualisieren (Migration)

## Feature: Manuelles Dokument-Transaktions-Matching im Bankimport

- [x] Backend: Neuer Endpunkt documents.manualMatch – Dokument manuell mit einer Banktransaktion verknüpfen
- [x] Backend: Neuer Endpunkt documents.listUnmatched – Unverknüpfte Dokumente mit Suchfunktion auflisten
- [x] Frontend Bankimport: Paperclip-Button pro Transaktion zum manuellen Verknüpfen
- [x] Frontend Bankimport: Dialog mit Suchfeld und Liste unverknüpfter Dokumente (Typ, Gegenpartei, Betrag, Datum)
- [x] Frontend Bankimport: Visuelles Feedback nach erfolgreichem manuellen Match (Toast + Refresh)

## Feature: Manuelles Matching von der Dokumente-Seite aus

- [x] Backend: Endpunkt bankImport.listUnmatchedTransactions – ausstehende Transaktionen ohne verknüpftes Dokument auflisten (mit Suchfunktion)
- [x] Frontend Dokumente: Paperclip-Button bei offenen Dokumenten zum manuellen Verknüpfen mit einer Banktransaktion
- [x] Frontend Dokumente: Dialog zur Auswahl einer ungematchten Banktransaktion (Datum, Buchungstext, Betrag, Bankkonto)
- [x] Frontend Dokumente: Visuelles Feedback nach erfolgreichem Match (Toast + Status-Refresh)

## Fix: Gewerbe-Treuhand Buchungstext mit Kundenname statt "Fremdhonorar"

- [x] Buchungstext für Gewerbe-Treuhand soll "Gewerbe-Treuhand [Kundenname]" lauten statt "Fremdhonorar Gewerbe-Treuhand {period}"
- [x] Kundenname aus der Bankbeschreibung oder dem gematchten Dokument extrahieren
- [x] Booking Rule für Gewerbe-Treuhand anpassen
- [x] Bestehende pending Transaktionen aktualisiert (3 mit Kundenname, 4 ohne weil kein Dokument gematcht)

## Feature: Kontenplan-Verwaltung (Chart of Accounts)

- [x] Sidebar: Neuer Menüpunkt "Kontenplan" nach "Bankkonten" in den Einstellungen
- [x] Backend: CRUD-Endpunkte für Konten (erstellen, bearbeiten, löschen, aktivieren/deaktivieren)
- [x] Backend: MWST-Toggle und MWST-Satz pro Konto (updateVat-Endpunkt)
- [x] Frontend: Kontenplan-Seite mit Baumstruktur (Hauptkategorien > Unterkategorien > Konten)
- [x] Frontend: Inline-Bearbeitung von Konten (Name, Nummer) via Edit-Dialog
- [x] Frontend: Aktivieren/Deaktivieren per Toggle-Switch pro Konto
- [x] Frontend: MWST-Toggle und MWST-Satz-Auswahl pro Konto (8.1%, 2.6%, 3.8%)
- [x] Frontend: Löschen von Konten (mit Warnung wenn Buchungen vorhanden)
- [x] Frontend: Suchfunktion (Kontonummer, Name, Kategorie)
- [x] Frontend: Alle öffnen / Alle schliessen Buttons
- [x] Frontend: Inaktive Konten ein-/ausblenden Toggle
- [x] Frontend: Neues Konto erstellen Dialog
- [x] Fix: Abschreibungen-Seite zeigt Anlagekonten (1100-1899) im Anlagekonto-Dropdown
- [x] Frontend: Drag-and-Drop zum Verschieben von Konten (Sortieren-Button mit @dnd-kit)
- [x] Frontend: Upload-Bereich für eigenen Kontenplan Excel/CSV (Import-Dialog mit xlsx-Parsing)
- [x] Frontend: Standard-KMU-Kontenplan als Vorlage für Neukunden (63 Konten nach Käfer-Kontenrahmen)


## Bug: LUKB jm Transaktion bei LUKB mw Filter sichtbar

- [x] Fix: Swisscom-Transaktion hatte falsches Gegenkonto (1033 LUKB jm statt 1032 LUKB mw) – 8 Transaktionen korrigiert
- [x] Fix: Booking Rules speichern keine Bankkonten mehr als debit/credit (werden aus Transaktion abgeleitet)
- [x] Fix: approve, bulkApprove und updateTransaction schliessen Bankkonten aus Rule-Learning aus

## Feature: PDF-Bankauszüge ansehen/herunterladen

- [x] Import-Historie: PDF-Spalte mit Augen-Icon zum Öffnen des gespeicherten PDF-Bankauszugs

## Änderung: Manuelles Matching nur in Dokumente, nicht im Bankimport

- [x] Bankimport: Büroklammer-Button und ManualMatch-Dialog entfernt
- [x] Dokumente: Manuelles Matching bleibt bestehen (einziger Ort dafür)

## Änderung: Konten unter Berichte verschieben

- [x] Sidebar: "Konten" Eintrag entfernen
- [x] Berichte: Neuer dritter Tab "Konten" nach ER und Bilanz
- [x] Konten-Inhalt (Kontenliste mit Saldo, Suche, Filter) in den Berichte-Tab integrieren
- [x] Route /accounts auf /reports umleiten (Rückwärtskompatibilität)

## Feature: Sammelbuchung-Dialog (Buchungsmaske)

- [x] Sammelbuchung-Dialog: Buchungstext und Datum oben
- [x] Sammelbuchung-Dialog: Gesamtbetrag mit Bankkonto im HABEN (Belastung) als Kopfzeile
- [x] Sammelbuchung-Dialog: Einzelne Aufwandspositionen im SOLL darunter (dynamisch hinzufügen/entfernen)
- [x] Sammelbuchung-Dialog: Differenz-Anzeige (Diff.) zwischen Haben-Total und Soll-Summe
- [x] Sammelbuchung-Dialog: Speichern nur möglich wenn Differenz = 0
- [x] Sammelbuchung-Dialog: Bankkonto-Dropdown vorbelegt mit verfügbaren Bankkonten
- [x] Sammelbuchung-Dialog: Vorschau-Tabelle unten (Konto, Text, Soll, Haben, Steuer)

## Feature: Bankimport – Einzelbuchung/Sammelbuchung Umschalten

- [x] Bankimport Transaktions-Dialog: Toggle zwischen Einzelbuchung und Sammelbuchung
- [x] Sammelbuchung-Modus: Bankkonto im Soll (Eingang) oder Haben (Ausgang), mehrere Gegenkonten
- [x] Sammelbuchung-Modus: Differenz-Anzeige und Speichern nur bei Diff=0
- [x] Sammelbuchung-Modus: Vorschau-Tabelle mit Buchungszeilen

## Bug: MWST-Abrechnungen löschen und Saldosteuersatz

- [x] MWST: Lösch-Button für erstellte Abrechnungsperioden hinzufügen
- [x] MWST: Umsatzberechnung korrigieren – Saldosteuersatz 6.2% statt Normalsatz verwenden
- [x] MWST: Umsatz aus verbuchten Ertragskonten mit MWST-Flag korrekt berechnen (aktuell 0.00)

## Bug: Kontoübertrag-Duplikate bei zwei Bankauszügen

- [x] Bankimport: Duplikaterkennung für Kontoüberträge – automatische Erkennung nach jedem Import

## Feature: Bankimport – Rückgängig-Button

- [x] Bankimport: Snapshot-Mechanismus – vor jeder Bulk-Aktion den Zustand der betroffenen Transaktionen speichern
- [x] Bankimport: Rückgängig-Button in der Toolbar anzeigen (nur wenn ein Snapshot vorhanden ist)
- [x] Bankimport: Restore-Funktion – gespeicherten Snapshot wiederherstellen und Änderungen rückgängig machen

## Bug: Lohnabrechnung – 4 Probleme

- [x] Lohn Bug 1: Bruttolohn mw wird nicht berechnet (Brutto = Netto) – wenn grossFromSalaryAcc == netFromBankAcc, als Netto behandeln und calcFromNet verwenden
- [x] Lohn Bug 2: Refresh/Sync findet März-Lohnzahlungen nicht – Regex für deutsche Umlaute (März) korrigiert, Banktransaktionen als zusätzliche Quelle
- [x] Lohn Bug 3: Monatlich "Lohnausweis" → "Lohnabrechnung" umbenennen (Lohnausweis nur jährlich)
- [x] Lohn Bug 4: Offizieller Lohnausweis als PDF nach Schweizer Formular 11 – exaktes Layout nachgebaut

## Feature: Lohnausweis PDF – Originalformular als Hintergrund

- [x] Lohnausweis PDF: Originales Formular 11 als AcroForm-Vorlage verwenden und Felder pixelgenau über Formularfelder befüllen (pdf-lib getForm/getTextField/setText/flatten)

## Feature: QR-Rechnung (Swiss QR-Bill)

- [x] Backend: swissqrbill Paket installieren und QR-Rechnung-Generierung implementieren
- [x] Backend: tRPC-Endpunkt generateQrBill – erzeugt PDF mit QR-Zahlungsteil (Creditor=WM Weibel Mueller AG, IBAN, Betrag, Referenz)
- [x] Frontend: QR-Rechnung-Seite (Sidebar) – generiert QR-Rechnung mit Debtor-Formular
- [x] Frontend: QR-Rechnung-Einstellungen (IBAN, Referenztyp, Währung) unter Einstellungen

## Feature: ISO 20022 – Zahlungsdatei-Export (pain.001)

- [x] Backend: ISO 20022 pain.001 XML-Generator implementieren (Schweizer Format pain.001.001.09)
- [x] Backend: tRPC-Endpunkt generatePain001 – erzeugt pain.001 XML für Lohnzahlungen
- [x] Frontend: Zahlungsdatei-Export-Button in Lohnbuchhaltung (Sammellohnzahlung als pain.001)
- [x] Frontend: Zahlungsdatei-Export im Bankimport für offene Kreditorenrechnungen (ISO 20022 Zahlung-Button mit Dialog)

## Feature: DSG-Konformität (Schweizer Datenschutzgesetz)

- [x] Backend: Audit-Log-Tabelle (wer hat wann welche Daten geändert/gelesen)
- [x] Backend: Datenexport-Endpunkt (Auskunftsrecht Art. 25 DSG) – alle personenbezogenen Daten als JSON/CSV
- [x] Backend: Datenlöschung-Endpunkt (Löschungsrecht) – Anonymisierung von Mitarbeiterdaten
- [x] Frontend: Datenschutzerklärung-Seite mit Schweizer DSG-konformem Inhalt (8 Abschnitte)
- [x] Frontend: Audit-Log-Ansicht unter Einstellungen (wer hat wann was geändert)
- [x] Frontend: Datenexport- und Löschungs-Buttons unter Einstellungen

## Fix: Kontoüberträge als eine zusammengefasste Zeile anzeigen

- [x] Backend: Kontoübertrag-Erkennung verbessern – zusammengehörige Belastung/Gutschrift zwischen eigenen Konten als ein Paar identifizieren
- [x] Frontend: Gepaarte Kontoüberträge als eine kombinierte Zeile im Bankimport anzeigen statt zwei separate Zeilen (⇄-Symbol, Partner-Kontoname, Label "Übertrag")

## Feature: ISO 20022 Zahlungen aus Dokumenten/Rechnungen

- [x] Backend: Dokumente/Rechnungen als Quelle für offene Zahlungen verwenden statt Bankimport-Transaktionen (getUnpaidInvoices Endpunkt)
- [x] Backend: Abgleich Rechnungen vs. Bankimport – prüfen ob Rechnung bereits als Banktransaktion importiert wurde (= bezahlt)
- [x] Frontend: ISO 20022 Vorschau zeigt unbezahlte Rechnungen mit automatischem Zahlungsdatum (Rechnungsdatum + 30 Tage Zahlungsfrist)
- [x] Frontend: Checkbox in ISO 20022 Vorschau ob Rechnung bereits manuell bezahlt wurde + "Als unbezahlt markieren" Button

## Feature: Kreditkartenabrechnungen Vorschau

- [x] Frontend: Expandierbare Zeilen in der KK-Abrechnungstabelle – Klick auf eine Abrechnung zeigt die Einzelpositionen (Datum, Beschreibung, Betrag, Konto)
- [x] Frontend: Vorschau der Einzelpositionen mit Kontierung (gelerntes Konto aus Booking Rules)

## Feature: Mobile Kamera-Aufnahme für Dokumente

- [x] Frontend: "Foto aufnehmen"-Button neben dem bestehenden Upload-Bereich auf der Dokumente-Seite
- [x] Frontend: HTML5 input capture="environment" für direkte Kamera-Aktivierung auf Mobile
- [x] Frontend: Aufgenommenes Foto wird automatisch hochgeladen und von der KI analysiert (gleicher Workflow wie PDF-Upload)

## Feature: QR-Code IBAN und Rechnungsvorlage einbauen

- [x] QR-Code dekodieren und IBAN für LUKB mw Konto extrahieren
- [x] IBAN in QR-Rechnungs-Einstellungen als Standard hinterlegen
- [x] Rechnungsvorlage (DOCX) analysieren und als PDF-Rechnungstemplate implementieren
- [x] QR-Rechnung-Seite: Rechnungsvorlage mit QR-Zahlungsteil als kombinierten PDF-Download anbieten

## Bugfix: QR-Rechnung PDF-Generierung (Referenztyp-Mismatch)

- [x] Fix: Regulärer IBAN (CH3700778010355583209) mit QR-Referenz (27-stellig numerisch) verursachte Fehler in swissqrbill-Library
- [x] Fix: Bei regulärem IBAN wird jetzt korrekte SCOR-Referenz (ISO 11649, RF-Format) generiert statt QR-Referenz
- [x] Fix: Professionelle Rechnung (generateInvoiceWithQr) und einfacher QR-Einzahlungsschein (generateQrBill) beide korrigiert
- [x] Beide Endpunkte erfolgreich getestet mit IBAN CH3700778010355583209

## Feature: Navigation Umstrukturierung – Zahlungen (Debitoren/Kreditoren)

- [x] Navigation: Neuer Bereich "Zahlungen" in der Sidebar unter Dashboard
- [x] Navigation: Untermenü "Debitoren" unter Zahlungen (bisherige QR-Rechnung-Seite)
- [x] Navigation: Untermenü "Kreditoren" unter Zahlungen (ISO 20022 Rechnungszahlung, bisher unter Bankimport)
- [x] Kreditoren-Seite: Eigenständige Seite für Kreditorenzahlungen (ISO 20022 pain.001) statt Dialog im Bankimport
- [x] Kreditoren-Seite: Bankkonto-Auswahl (welches Konto soll belastet werden) als Dropdown
- [x] QR-Rechnung aus Sidebar entfernen (wird zu Debitoren)
- [x] ISO 20022 Button aus Bankimport entfernen (wird zu Kreditoren)

## Bugfix: PensExpert fälschlicherweise als bezahlt markiert

- [x] Fix: Rechnungen nur als "bezahlt" markieren wenn tatsächlich eine passende Transaktion im Bankimport vorhanden ist
- [x] Fix: PensExpert-Rechnung muss als "offen" erscheinen da noch nicht im Bankimport

## Feature: Pain.001 Pflichtfelder Ort und Land

- [x] Pain.001 XML: Ort (Twnm) als Pflichtfeld für Begünstigten einbauen
- [x] Pain.001 XML: Land (Ctry) als Pflichtfeld für Begünstigten einbauen
- [x] Frontend: Ort und Land Felder in der Kreditoren-Zahlungsansicht anzeigen und editierbar machen
- [x] Dokumente/AI-Extraktion: Ort und Land des Lieferanten wenn möglich aus Rechnungen extrahieren

## Feature: Korrekter Zahlungsworkflow (Kreditoren)

- [x] Rechnungen erst als "bezahlt" markieren wenn pain.001 tatsächlich heruntergeladen wird (nicht beim Öffnen der Seite)
- [x] Manuelles Zurücksetzen auf "offen" ermöglichen (Button "Als unbezahlt markieren")
- [x] Automatischer Match beim Bankimport: Wenn Banktransaktion zu bekannter Rechnung passt (Betrag, Kreditor, Referenz), automatisch Match erstellen und Rechnung als bezahlt markieren

## Feature: AcroForms-basierte Rechnungsvorlage (wie Lohnausweis)

- [x] PDF-Vorlage analysieren und AcroForms-Template erstellen (exaktes Layout wie WM Rechnung)
- [x] AcroForms-Felder: Logo, Firmenname, Adresse, Empfänger, Datum, Referenz, Betreff, Positionen, MWST, Total, Zahlungsfrist, Grussformel
- [x] Backend-Endpoint: AcroForms-Template mit Rechnungsdaten füllen und als PDF generieren
- [x] Debitoren-Seite: Neue Rechnungserstellung mit AcroForms-basiertem PDF-Download
- [x] QR-Zahlungsteil in AcroForms-Rechnung integrieren (Seite 2 oder unten)

## Feature: Firmenlogo-Upload unter Einstellungen/Unternehmen

- [x] Einstellungen/Unternehmen: Logo-Upload-Funktion implementieren (S3-Storage)
- [x] Logo in der Sidebar/Header der Webseite anzeigen
- [x] Logo in der AcroForms-Rechnungsvorlage verwenden
- [x] WM Logo als Standard hochladen

## Bugfix: Kreditoren zeigen Rechnungen als "offen" obwohl im Bankimport als "matched"

- [x] Fix: Kreditoren-Status muss Bankimport-Matches berücksichtigen (z.B. OWIBA als bezahlt anzeigen wenn im Bankimport gematcht)
- [x] Prüfen: listUnpaidInvoices-Logik erweitern um auch Dokumente mit matchStatus='matched' als bezahlt zu erkennen

## Feature: Dokumenten-Beschriftung beim Hochladen

- [x] Beim Upload: Dokument automatisch nach Inhalt beschriften (Lieferant + Beschreibung statt generischer Dateiname)
- [x] AI-Extraktion: Extrahierten Lieferantnamen und Beschreibung als Dokumenttitel verwenden

## Cleanup: QR-Rechnung aus Einstellungen entfernen

- [x] QR-Rechnung Tab/Bereich aus der Einstellungen-Seite entfernen (Funktion ist jetzt unter Zahlungen/Debitoren)

## Feature: Rechnungsvorlage pixelgenau nach WM Briefblatt-Vermessung

- [ ] Briefblatt_Vermassung.pdf analysieren für exakte Masse und Positionen
- [ ] ZwoOT-Bold und ZwoOT-Light Fonts einbetten (statt Helvetica)
- [ ] AcroForms-Template komplett neu erstellen mit korrekten Massen
- [ ] Logo-Position, Absenderzeile, Empfänger-Fenster exakt positionieren
- [ ] Positionen-Tabelle, MWST, Total korrekt ausrichten
- [ ] Fusszeile mit Firmenadresse und Kontaktdaten
- [ ] Backend-Endpoint aktualisieren für neues Template
- [ ] PDF-Ausgabe visuell mit Original vergleichen und korrigieren

## Feature: MWST-Abrechnung Transaktionsdetails

- [ ] MWST-Abrechnung Dialog: Aufklappbare Detailansicht mit allen Transaktionen inkl. MWST-Anteil
- [ ] MWST-Abrechnung: Export/Druckfunktion für detaillierte Transaktionsliste
- [ ] Backend: Endpoint für MWST-relevante Transaktionen pro Periode mit MWST-Berechnung

## MWST-Abrechnung: Aufklappbare Detailzeilen und Export/Druck
- [x] MWST-Abrechnung: Aufklappbare Detailzeilen mit einzelnen Transaktionen inkl. MWST-Anteil
- [x] MWST-Abrechnung: Backend-Endpunkt für detaillierte Transaktionsliste pro Periode
- [x] MWST-Abrechnung: Export/Druckfunktion für detaillierte MWST-Abrechnung mit Transaktionen
- [x] Fix: Stadt "Lucerne" → "Luzern" in Datenbank korrigiert
- [x] Fix: Rechnungs-PDF mit pdf-lib komplett neu geschrieben (WM Logo, ZwoOT Fonts, exaktes Layout)

## Journal Export-Funktion
- [x] Backend: Export-Endpoint für Journal-Buchungen im Infoniqa CSV-Format
- [x] Backend: Mapping von Journal-Daten auf Infoniqa-Felder (BlgNr, Date DD.MM.YY, AccId, MType, Type, CAcc, TaxId, ValNt, Text)
- [x] Backend: Korrekte Behandlung von Einzel- vs. Sammelbuchungen (MType 1 vs 2)
- [x] Backend: MWST-Steuercode-Mapping (USt81 für 8.1%)
- [x] Backend: Latin-1 Encoding für CSV-Ausgabe
- [x] Frontend: Export-Dialog mit Auswahl-Möglichkeiten (Infoniqa als erste Option)
- [x] Frontend: Datumsbereich-Filter für Export
- [x] Frontend: Export-Button im Journal-Header

## Kontenplan ↔ Bankkonten Synchronisation
- [x] Wenn im Kontenplan ein Konto als Bankkonto markiert wird (isBankAccount=true), automatisch Eintrag in Bankkonten erstellen
- [x] Wenn im Kontenplan isBankAccount auf false gesetzt wird, Bankkonten-Eintrag entfernen (falls keine Transaktionen)
- [x] Wenn in Bankkonten ein neues Bankkonto erstellt wird, muss es einem Kontenplan-Konto zugeordnet sein
- [x] Bestehende Bankkonten ohne Kontenplan-Zuordnung identifizieren und synchronisieren
- [x] Frontend: Hinweis anzeigen wenn Bankkonto erstellt/entfernt wird durch Kontenplan-Änderung

## Eröffnungssalden ↔ Kontenplan Synchronisation
- [x] Eröffnungssalden: Nur aktive Konten aus dem Kontenplan anzeigen
- [x] Eröffnungssalden: Neues Konto hinzufügen (erstellt auch im Kontenplan)
- [x] Eröffnungssalden: Drag & Drop zum Verschieben/Umsortieren von Konten
- [x] Eröffnungssalden: Bidirektionale Sync mit Kontenplan (Änderungen in beiden Richtungen)
- [x] Eröffnungssalden: Kontenplan-Änderungen (Aktivierung/Deaktivierung) sofort reflektieren

## Feature: Lieferanten-Stammdaten
- [x] DB-Schema: suppliers Tabelle (id, name, street, zipCode, city, country, iban, bic, paymentTermDays, contactPerson, email, phone, notes, defaultDebitAccountId, isActive, createdAt, updatedAt)
- [x] Backend: suppliersRouter (list, create, update, delete, getById)
- [x] Backend: Integration mit pain.001 Export (IBAN/BIC aus Lieferanten-Stammdaten)
- [ ] Backend: Auto-Vorschlag Lieferant bei Bankimport basierend auf Gegenpartei (TODO: spätere Erweiterung)
- [x] Frontend: Lieferanten-Seite unter Einstellungen mit CRUD-Funktionalität
- [ ] Frontend: Lieferanten-Auswahl bei Kreditoren-Zahlungen (TODO: spätere Integration)
- [ ] Frontend: Lieferanten-Link in Bankimport-Transaktionen (TODO: spätere Integration)

## Feature: Kunden-Stammdaten / CRM
- [x] DB-Schema: customers Tabelle (id, name, company, street, zipCode, city, country, email, phone, salutation, notes, isActive, createdAt, updatedAt)
- [x] DB-Schema: customerServices Tabelle (id, customerId, description, revenueAccountId, hourlyRate, isDefault, sortOrder)
- [x] Backend: customersRouter (list, create, update, delete, getById, getServices)
- [x] Backend: Zuordnung mehrerer Ertragskonten pro Kunde (erstes = häufigstes)
- [x] Frontend: Kunden-Seite unter Einstellungen mit CRUD-Funktionalität
- [x] Frontend: Kunden-Detailansicht mit Dienstleistungen und Ertragskonten
- [ ] Frontend: Kunden-Auswahl bei Debitorenrechnungen (TODO: spätere Integration)

## Feature: Zeiterfassung
- [x] DB-Schema: timeEntries Tabelle (id, customerId, serviceId, date, hours, description, hourlyRate, status, invoiceId, userId, createdAt, updatedAt)
- [x] DB-Schema: services Tabelle (id, name, description, defaultHourlyRate, revenueAccountId, isActive, sortOrder)
- [x] Backend: timeTrackingRouter (list, create, update, delete, getByCustomer, getUninvoiced)
- [x] Backend: servicesRouter (list, create, update, delete)
- [x] Backend: Verknüpfung Zeiterfassung → Debitorenrechnung (uninvoiced entries → Rechnungspositionen)
- [x] Frontend: Zeiterfassung-Seite zwischen Jahresabschluss und Einstellungen in Navigation
- [x] Frontend: Zeiterfassung-Eingabe mit Kunde, Dienstleistung, Stunden, Beschreibung
- [x] Frontend: Übersicht uninvoiced Stunden pro Kunde
- [x] Frontend: "Rechnung erstellen" Button → QR-Rechnung mit Zeiteinträgen als Positionen

## Feature: CAMT.054 Import
- [x] Backend: CAMT.054 XML Parser (Zahlungsbestätigungen)
- [x] Backend: Abgleich mit exportierten pain.001 Dateien (EndToEndId Matching)
- [x] Backend: Automatisches Markieren bezahlter Rechnungen als erledigt
- [x] Frontend: CAMT.054 Upload im Kreditoren-Bereich
- [x] Frontend: Abgleich-Ergebnis anzeigen (matched/unmatched Zahlungen)

## Feature: Mehrfach-Upload Dokumente
- [x] Backend: Batch-Upload Endpoint für mehrere Dateien gleichzeitig
- [x] Frontend: Multi-File-Upload mit Drag & Drop Zone
- [x] Frontend: Thumbnail-Vorschau für Bilder in der Dokumentenliste
- [x] Frontend: Upload-Fortschritt pro Datei anzeigen

## Feature: Einstellungen Erweiterungen
- [x] Backend: Firmenlogo Upload und Speicherung in S3 (bereits vorhanden)
- [x] Backend: Vorlagen-Verwaltung (upload, list, delete) für Rechnungsvorlagen etc.
- [x] Frontend: Logo-Upload bei Unternehmensdaten (mit Vorschau, bereits vorhanden)
- [x] Frontend: Neuer Unterbereich "Vorlagen" in Einstellungen
- [x] Frontend: Vorlagen hochladen, anzeigen, löschen (Rechnungsvorlagen, Briefvorlagen)

## UI Cleanup
- [x] QR-Rechnung Tab aus Einstellungen-Sidebar entfernen

## Lieferanten: Auto-Erstellung aus Rechnungen + Listenimport
- [x] Backend: Auto-Erstellung Lieferant aus Rechnungs-AI-Metadaten (senderName, senderAddress, IBAN)
- [x] Backend: Bestehende Rechnungen durchgehen und fehlende Lieferanten nachträglich erstellen
- [x] Backend: Bei zukünftigen Rechnungs-Uploads automatisch Lieferant erstellen/zuordnen
- [x] Backend: CSV/Excel-Upload Endpoint für Lieferantenliste
- [x] Frontend: "Lieferanten importieren" Button mit CSV/Excel-Upload Dialog
- [x] Frontend: Vorschau der importierten Daten vor dem Speichern
- [x] Frontend: Hinweis bei automatisch erstellten Lieferanten (aus Rechnung)

## Kunden: Listenimport
- [x] Backend: CSV/Excel-Upload Endpoint für Kundenliste mit Extraktion
- [x] Frontend: "Kunden importieren" Button mit CSV/Excel-Upload Dialog
- [x] Frontend: Vorschau der importierten Kundendaten vor dem Speichern

## Bugfix: Bankkonten ↔ Kontenplan Synchronisation
- [x] Beim Erstellen eines Bankkontos automatisch ein entsprechendes Konto im Kontenplan anlegen (falls nicht vorhanden)
- [x] Möglichkeit Bankkonten zu löschen (mit Prüfung ob Buchungen vorhanden)
- [x] Beim Löschen eines Bankkontos auch das verknüpfte Konto im Kontenplan berücksichtigen
- [x] Fix: createAccount setzt automatisch category="Umlaufvermögen" und subCategory="Flüssige Mittel" für Bankkonten
- [x] Fix: Bestehende Bankkonten ohne Kategorie (1099) nachträglich korrigiert
- [x] Feature: Neues Bankkonto direkt aus Bankkonten-Ansicht erstellen (mit automatischem Kontenplan-Eintrag)

## Kundendaten-Import aus Kundenliste und Debitoren-Rechnungen
- [x] Kundenliste.xlsm auslesen und Kundendaten extrahieren (Name, Ort, Kunden-Nr.) – 143 Kunden
- [x] Debitoren-Rechnungen scannen und zusätzliche Kundeninfos extrahieren – 18 zusätzliche Kunden
- [x] Daten aus beiden Quellen zusammenführen und deduplizieren – 161 total, 4 Duplikate entfernt
- [x] Kundeneinträge in der App erstellt – 157 Kunden importiert
- [x] customerNumber Feld zum Schema hinzugefügt
- [x] Kunden-Nr. in UI anzeigen und bearbeitbar machen

## Kunden-Schema erweitern und QR-Rechnung Kundenauswahl
- [x] Schema: Name aufteilen in firstName (Vorname) und lastName (Nachname)
- [x] Schema: Feld für Ehepartner (spouseFirstName, spouseLastName)
- [x] Schema: Feld für Zivilstand (maritalStatus)
- [x] Schema: Geburtsdatum für Kunde (birthDate) und Ehepartner (spouseBirthDate)
- [x] Backend: Router-Endpoints für neue Felder anpassen (create, update, importFromList)
- [x] Frontend: Kundenformular mit neuen Feldern aktualisieren
- [x] Frontend: Kundenliste-Anzeige mit Vorname/Nachname anpassen
- [x] Datenmigration: 157 bestehende Namen in firstName/lastName aufgeteilt
- [x] QR-Rechnung: Kundenauswahl-Dropdown im Rechnungsformular (Empfänger automatisch ausfüllen)

## Branding: Max (maximal einfache Buchhaltung)
- [ ] Logo-Entwürfe generieren (freundlich/verspielt, aber nicht zu fest)
- [ ] App-Titel auf "Max" ändern (VITE_APP_TITLE)
- [ ] Logo in der App einbinden (VITE_APP_LOGO)

## Eigenes Auth-System (SaaS-fähig)
- [ ] Eigenes Registrierungs-/Login-System (E-Mail + Passwort)
- [ ] users-Tabelle erweitern (passwordHash, emailVerified) - Migration 0024+
- [ ] Registrierungsseite mit E-Mail-Verifizierung
- [ ] Login-Seite (eigenes Portal statt Manus OAuth)
- [ ] Passwort vergessen / zurücksetzen
- [ ] HINWEIS: currentOrganizationId NICHT anrühren (Claude Phase 1)
- [ ] HINWEIS: Claude nutzt Migrationen 0022, 0023 - wir starten ab 0024+

## Auth-System Implementierung (Detail)
- [x] Schema: passwordHash, emailVerified, verificationToken, resetToken, resetTokenExpiry in users-Tabelle
- [x] Backend: tRPC auth.register (E-Mail + Passwort, bcrypt)
- [x] Backend: tRPC auth.login (E-Mail + Passwort, Session-Cookie)
- [x] Backend: tRPC auth.forgotPassword (Reset-Token per E-Mail)
- [x] Backend: tRPC auth.resetPassword (Neues Passwort setzen)
- [x] Backend: tRPC auth.verifyEmail (Token verifizieren)
- [x] Backend: E-Mail-Versand via Resend (Verifizierung + Passwort-Reset)
- [x] Frontend: /login Seite
- [x] Frontend: /register Seite
- [x] Frontend: /forgot-password Seite
- [x] Frontend: /reset-password Seite
- [x] Frontend: /verify-email Seite
- [x] Manus OAuth als zusätzliche Login-Option beibehalten

## Öffentliche Landing Page
- [x] Landing Page mit Produktbeschreibung (Hero, Features, Vorteile)
- [x] Pricing-Sektion (Pläne/Preise)
- [x] CTA "Jetzt registrieren"
- [x] Responsive Design (Mobile + Desktop)

## Tests: Auth-System
- [x] Vitest: auth.register (6 Tests – Registrierung, Duplikate, schwache Passwörter, ungültige E-Mail, leerer Name)
- [x] Vitest: auth.login (3 Tests – nicht existierender User, falsches Passwort, unverifizierte E-Mail)
- [x] Vitest: auth.verifyEmail (1 Test – ungültiger Token)
- [x] Vitest: auth.forgotPassword (2 Tests – nicht existierende E-Mail, existierende E-Mail)
- [x] Vitest: auth.resetPassword (2 Tests – ungültiger Token, schwaches Passwort)
- [x] Vitest: auth.resendVerification (2 Tests – nicht existierende E-Mail, existierender User)
- [x] Vitest: Vollständiger Register→Verify→Login Flow (1 Test – End-to-End mit DB-Token)
- [x] Vitest: E-Mail-Service (3 Tests – API-Key Validierung, Verifizierungs-E-Mail, Reset-E-Mail)

## Branding: KLAX
- [x] App-Titel (VITE_APP_TITLE) auf "KLAX" setzen
- [x] Landing Page: Alle Texte auf KLAX-Branding aktualisieren (Hero, Features, Pricing, CTA)
- [x] index.html: Seitentitel und Meta-Tags auf KLAX aktualisieren
- [x] Login/Register/Auth-Seiten: Produktname auf KLAX aktualisieren
- [x] DashboardLayout: Produktname auf KLAX aktualisieren

## Bugfix: Landing Page und Logout
- [x] Landing Page /landing muss auch für eingeloggte User erreichbar sein (kein Redirect zum Onboarding)
- [x] Logout-Funktion muss auf der published Site funktionieren (nicht nur Manus OAuth)
- [x] Nach Logout → Redirect auf Landing Page

## Feature: Stripe-Bezahlfunktion
- [x] Stripe-Feature via webdev_add_feature einrichten (Dependencies, Webhooks, Scaffold)
- [x] Stripe API-Keys konfigurieren (Secret Key, Publishable Key, Webhook Secret)
- [x] DB-Schema: subscriptions-Tabelle (stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodEnd)
- [x] Backend: Stripe Checkout Session erstellen (pro Plan: Starter/Professional/Enterprise)
- [x] Backend: Stripe Webhook Handler (checkout.session.completed, invoice.paid, customer.subscription.updated/deleted)
- [x] Backend: Kundenportal-Session erstellen (Abo verwalten, kündigen, Zahlungsmethode ändern)
- [x] Backend: Abo-Status-Abfrage (aktueller Plan, Ablaufdatum, Status)
- [x] Frontend: Pricing-Seite mit echten Stripe Checkout-Buttons verbinden
- [x] Frontend: Abo-Status im Dashboard/Settings anzeigen (aktueller Plan, nächste Zahlung)
- [x] Frontend: "Abo verwalten" Button → Stripe Kundenportal
- [ ] Feature-Gating: Funktionen je nach Plan einschränken (z.B. Anzahl Firmen, Lohnbuchhaltung)
- [ ] Tests: Vitest für Stripe Webhook-Verarbeitung und Abo-Status-Logik
- [x] Stripe Checkout: CHF als Währung fixieren (nicht EUR)
- [x] Stripe Webhook: Registrierung und Handler für Abo-Status-Updates
- [ ] Stripe Dashboard: Firmennamen auf KLAX setzen

## Bugfix: GitHub Actions CI
- [x] CI: "Multiple versions of pnpm specified" – packageManager in package.json und PNPM_VERSION in ci.yml synchronisieren

## Feature: Zefix-Integration (Handelsregister-Autofill)
- [x] Backend: tRPC-Endpunkt für Zefix/UID-Suche (SOAP API)
- [x] Frontend: Onboarding-Formular mit Autocomplete-Dropdown
- [x] Autofill: Firmenname, Rechtsform, UID, Adresse, MWST-Nr. automatisch abfüllen
- [x] Autofill: Kanton korrekt aus UID-Daten übernommen

## Feature: Beleganalyse Detailansicht (Kontera-Style)
- [x] Frontend: Beleg-Detailansicht mit PDF/Bild-Vorschau links und editierbaren Feldern rechts
- [x] Frontend: Tabs/Schritte wie Kontera (Kontakt, Belegdetails, Kontierung, Zahlung)
- [x] Frontend: Kontakt-Sektion: Firmenname, UID, MWST-Nr., Strasse, PLZ, Ort, Land (aus AI-Extraktion)
- [x] Frontend: Belegdetails-Sektion: Belegnummer, Belegdatum, Fälligkeitsdatum, Beschreibung, Betrag, MWST
- [x] Frontend: Kontierung-Sektion: Konto-Vorschlag (Auto-Learn hat Priorität, LLM als Fallback), Steuersatz, Brutto
- [x] Frontend: Zahlungs-Sektion: IBAN, QR-Referenz, Zahlungsart, Betrag, Währung, Empfänger-Details
- [x] Frontend: Beleg-Liste mit Thumbnail, Datum, Kontakt, Kontierung, Betrag (wie Kontera Übersicht)
- [x] Backend: Erweiterte AI-Extraktion für alle Kontera-Felder (Fälligkeitsdatum, QR-Referenz, Zahlungsart etc.)
- [x] Integration: Auto-Learn Kontierung bleibt bestehen, LLM-Vorschlag nur als Fallback

## Bugfix + Feature: Kontoplan-Import (Excel + PDF)
- [x] Bugfix: Excel-Kontoplan-Import funktioniert nicht – Spalten mit Sternchen ("Nummer*", "Name*") werden jetzt erkannt, Gruppen-Zeilen gefiltert, Kontoart-Spalte wird genutzt
- [x] Feature: PDF-Kontoplan-Import als zusätzliche Option anbieten (LLM-basierte Extraktion)
- [x] Frontend: Import-Dialog mit Excel/CSV und PDF/Bild Buttons, KI-Ladeindikator
- [x] Tests: 20 Vitest-Tests für Kontoplan-Import-Logik (getCol, mapAccountType, parseRow, Borgas-Simulation)

## Bugfixes Benutzer-Feedback (Runde 2)
- [x] UX: Visueller Klick-Hinweis in Dokumentenliste (Hover-Effekt, Cursor-Pointer, Chevron-Icon)
- [x] Bug: Manuelles Verknüpfen zeigt Transaktionen von WM statt vom aktuellen Mandanten (orgId-Filter hinzugefügt)
- [x] Bug: Dokument-Detail (Split-Panel) zeigt kein Konto obwohl Bankimport das Konto erkannt hat – Konto-Vorschlag aus Matching + matched Txn übernommen
- [x] Bug: Dateiname im Dokument-Detail und Bankimport unterschiedlich – abgleichen
- [x] Bug: Kreditkartenabrechnung wird als "Kontoauszug" erkannt statt "Kreditkartenabrechnung" – credit_card_statement als neuer Typ
- [x] Bug: Bankimport GJ-Filter zeigt bei GJ 2024 auch Transaktionen von 2025 – fiscalYear-Filter in Query implementiert

## Batch Re-Analyse bestehender Dokumente
- [x] Backend: Endpunkt zum Neu-Analysieren aller bestehenden Dokumente (batchReanalyze mit credit_card_statement Erkennung)
- [x] Frontend: Button "Alle neu analysieren" in Dokumente-Seite

## Bug 6: Automatische Kategorie-Zuordnung beim Kontoplan-Import
- [x] Backend/Frontend: Beim Import eines individuellen Kontenplans Konten automatisch einer Kategorie zuordnen (Aktiven, Passiven, Aufwand, Ertrag)
- [x] Intelligente Zuordnung basierend auf Kontonummer-Bereiche (1xxx=Aktiven, 2xxx=Passiven, 3xxx=Ertrag, 4-6xxx=Aufwand etc.) – autoCategory() mit Schweizer KMU-Kontenrahmen

## Feature: Drag & Drop für Konten in Einstellungen
- [x] Frontend: Konten per Drag & Drop verschieben/umordnen (wie bei Eröffnungssaldi) – SortableAccountRow/SortableAccountList
- [x] Backend: Konto-Reihenfolge und Kategorie-Zuordnung speichern – updateAccountSortOrder mit category/subCategory
- [x] Frontend: Konten zwischen Kategorien verschieben können – Kategorie-Dropdown im Drag-Modus

## Feature: Verbuchen-Tab in Dokument-Detailansicht
- [x] Neuer Tab "Verbuchen" in DocumentDetail (nur sichtbar wenn Dokument mit Transaktion verknüpft)
- [x] Verbuchen-Tab zeigt: verknüpfte Transaktion, Soll-/Haben-Konto, Betrag, Buchungstext, Status
- [x] Direkte Verbuchung aus Dokument-Detail heraus (approveTransaction Mutation)
- [x] Automatische Vorbefüllung: Konten aus Kontierung-Tab, Betrag aus Belegdetails
- [x] Status-Anzeige: Offen → Verbucht mit visueller Bestätigung

## Feature: Zwei-Ebenen-Regelsystem (Globale KI-Regeln + Kundenspezifische Regeln)
- [x] DB-Schema: scope Enum ("global"/"org") in booking_rules + globalDebitAccountNumber, globalCreditAccountNumber, categoryHint
- [x] DB-Schema: organizationId bleibt für org-Regeln, globale Regeln haben scope="global"
- [x] Backend: Matching-Logik angepasst – findMatchingRule: org-Regeln zuerst, globale als Fallback mit Account-Nummer-Auflösung
- [x] Backend: Beim Verbuchen mit manueller Korrektur: kundenspezifische Regel lernen (wie bisher)
- [x] Backend: Admin-Endpunkte (globalRulesRouter): list, listWithStats, create, update, delete, promoteToGlobal
- [x] Backend: Training-Workflow – Admin kann Testkunden-Regeln zu globalen Regeln hochstufen
- [x] Frontend: Admin-Bereich /admin/global-rules mit separater Ansicht für globale KI-Regeln
- [x] Frontend: Globale Regeln für normale Kunden nicht sichtbar (Sidebar adminOnly, Settings filtert scope!="global")
- [x] Frontend: Admin kann kundenspezifische Regel zu globaler Regel hochstufen (promoteToGlobal)
- [x] Frontend: Übersicht mit Scope-Badge (Global/Org), Kategorie-Hint, Statistiken
- [x] Tests: 12 Vitest-Tests für Zwei-Ebenen-Matching, Scope-Filterung, Account-Resolution, Admin-Sichtbarkeit

## Bug: Inkonsistente Kontovorschläge zwischen Kontierung-Tab, Verbuchen-Tab und Bankimport
- [x] Verbuchen-Tab: Soll/Haben-Konten aus Kontierung-Tab (bookingSuggestion) übernehmen, nicht aus Transaktion
- [x] Verbuchen-Tab: Bankkonto aus linkedBankAccount verwenden
- [x] Konsistenz: Kontierung-Tab und Verbuchen-Tab zeigen gleichen Kontovorschlag (bookingSuggestion hat Priorität)

## Verbesserung: Saldosteuersatz-Auswahl im Onboarding
- [x] Onboarding: Bei MWST-Methode "Saldosteuersatz" ein Dropdown mit offiziellen ESTV-Saldosteuersätzen anzeigen
- [x] ESTV-Saldosteuersätze als Konstante hinterlegen (0.1% bis 6.8%)
- [x] Saldosteuersatz in Organization-Schema speichern (vatSaldoRate)

## Bug: GJ-Wähler zeigt aktuelles Jahr statt erstes Geschäftsjahr
- [x] FiscalYearContext: Default-GJ auf das älteste offene Geschäftsjahr setzen (aus DB geladen, nicht hardcoded)
- [x] Wenn GJ 2025 im Onboarding gewählt wird, soll Dashboard automatisch GJ 2025 anzeigen

## Redesign: Belegzentrierte Informationsarchitektur (Komplett-Überarbeitung)

### Sidebar-Navigation (neu)
- [x] Sidebar komplett umbauen: Dashboard, Inbox, Belege, Bank, Freigaben, Rechnungen, Berichte, Abschluss & MWST, Einstellungen, Admin
- [x] Belege-Section mit Unterpunkten: Alle Belege, Neu hochgeladen, Von KI verarbeitet, Zu prüfen, Gematcht, Archiv
- [x] Bank-Section mit Unterpunkten: Banktransaktionen, Importe, Ungematchte, Gematchte, Bankkonten & Karten
- [x] Freigaben-Section mit Unterpunkten: Bereit zur Genehmigung, Mit Warnungen, Manuell angepasst, Verbucht
- [x] Rechnungen-Section mit Unterpunkten: Ausgangsrechnungen, Offene Forderungen, Zahlungseingänge, Mahnwesen, Kunden
- [x] Berichte-Section: Erfolgsrechnung, Bilanz, Kontoblätter, Journal
- [x] Abschluss & MWST: MWST, Periodenabschluss, Jahresabschluss
- [x] Einstellungen und Admin-Bereich konsolidieren
- [x] Umbenennungen: Journal→Freigaben, Bankimport→Bank, Dokumente→Belege, Kreditkarte→unter Bank

### Inbox-Seite (neu)
- [x] Neue Inbox-Seite: Zentrale Aufgabenübersicht für alles was Aufmerksamkeit braucht
- [x] Inbox zeigt: Neue Belege, KI-Vorschläge zur Freigabe, Ungematchte Banktx, Offene Rechnungen, Fällige Zahlungen
- [x] Inbox: Klickbare Aufgaben-Karten die direkt zum jeweiligen Bereich navigieren

### Dashboard (komplett neu)
- [x] Block 1: "Heute zu erledigen" – Aufgaben-Übersicht mit Empty State
- [x] Block 2: "KI hat für dich vorbereitet" – Automatisch erkannt, Gematcht, Automatisierungsquote, Match-Quote
- [x] Block 3: Belege + Bank Statusübersicht (nebeneinander)
- [x] Block 4: Freigaben + Rechnungen Statusübersicht (nebeneinander)
- [x] Block 5: Finanzstatus – Liquidität, Ertrag, Aufwand, Ergebnis, Off. Forderungen, Off. Verbindlichkeiten
- [x] Block 6: Fristen & Hinweise – MWST, Periodenabschluss
- [x] Primäre CTAs: Beleg hochladen, Bank importieren, Rechnung erstellen

### Belege-Seite (aufgewertet)
- [x] Belege-Seite: Status-Tabs (Alle, Neu, KI verarbeitet, Zu prüfen, Gematcht, Archiv) via Sidebar-Sub-Items
- [x] Belege: KI-Workflow sichtbar machen (bestehende Documents-Seite mit Status-Filtern)

### Bank-Bereich (konsolidiert)
- [x] Bank-Seite: Bankimport und Kreditkarte zusammenführen unter "Bank"
- [x] Bank: Sidebar-Sub-Items für Transaktionen, Importe, Ungematchte, Gematchte, Konten & Karten

### Freigaben-Seite (neu, ersetzt Journal als Primärbereich)
- [x] Freigaben-Seite: Ersetzt Journal als primären Arbeitsbereich
- [x] Freigaben: Sidebar-Sub-Items für Bereit zur Genehmigung, Mit Warnungen, Manuell angepasst, Verbucht
- [x] Journal bleibt als technische Detailansicht unter Berichte erreichbar

### Empty States & CTAs
- [x] Aktivierende Empty States: "Lade Rechnungen hoch...", "Alle Vorschläge verbucht...", etc.
- [x] Globale primäre CTAs: Beleg hochladen, Bank importieren, Rechnung erstellen

### Routing
- [x] Alle neuen Routes registrieren in App.tsx
- [x] Alte Routes als Redirects beibehalten für Kompatibilität

## Verbesserung: Rückgängig-Button im Kontenplan
- [x] Rückgängig-Button im Kontenplan hinzufügen (letzte Änderung rückgängig machen)
- [x] Undo-Stack für Kontenplan-Aktionen (Aktivieren/Deaktivieren, MWST-Toggle, Umbenennung, Erstellen, Löschen)

## Bug: Referenznummer aus QR-Einzahlungsschein wird nicht erkannt
- [x] KI-Analyse soll Referenznummer (RF-Nummer, QR-Referenz, ESR-Referenz) aus Belegen extrahieren
- [x] Referenznummer ins Feld "Referenznummer" übernehmen (+ Fallback: qrReference → referenceNumber)

## Bug: IBAN aus QR-Einzahlungsschein wird nicht korrekt erkannt
- [x] IBAN im Zahlungs-Tab zeigt "CH00 0000 0000 0000 0000 0" statt der korrekten IBAN aus dem Beleg
- [x] LLM-Prompt verbessert: IBAN aus QR-Zahlteil 'Konto / Zahlbar an' wird jetzt explizit extrahiert

## Bug: Sidebar-Sub-Items nicht aktiviert (Belege, Bank, Freigaben)
- [x] Sub-Items in Belege-Section klickbar machen mit Filter-Funktionalität (Neu hochgeladen, Von KI verarbeitet, Zu prüfen, Gematcht, Archiv)
- [x] Sub-Items in Bank-Section klickbar machen (Importe, Ungematchte, Gematchte, Konten & Karten)
- [x] Sub-Items in Freigaben-Section klickbar machen (Mit Warnungen, Manuell angepasst, Verbucht)

## Feature: Verbuchung ohne Banktransaktion (Barauslagen)
- [x] Verbuchen-Tab im Belegdetail auch ohne verknüpfte Banktransaktion ermöglichen
- [x] Barauslagen direkt aus dem Beleg verbuchen können (Soll/Haben manuell wählen)
- [x] Konto "Kasse" (1000) als Default-Gegenkonto für Barauslagen

## Bug: Bankkonto-Dropdown im Bankimport
- [x] Bankkonto-Dropdown funktioniert korrekt – zeigt Bankkonten aus Einstellungen (Daten-Problem wenn leer, kein Code-Bug)

## UX: Bankimport - Hinweis wenn keine Bankkonten erfasst
- [x] Wenn bankAccounts leer ist: Hinweis + Link zu Einstellungen → Bankkonten anzeigen

## UX: Sidebar vereinfachen + Filter-Kacheln
- [x] Sidebar: Unterpunkte bei Belege entfernen (nur "Alle Belege" bleibt als Einstieg)
- [x] Sidebar: Unterpunkte bei Bank entfernen (nur "Banktransaktionen" bleibt)
- [x] Sidebar: Unterpunkte bei Freigaben entfernen (nur "Freigaben" bleibt)
- [x] Belege-Seite: Farbige Filter-Kacheln oben (Alle, Neu, KI verarbeitet, Zu prüfen, Gematcht, Archiv)
- [x] Bank-Seite: Farbige Filter-Kacheln oben (Alle, Ungematchte, Gematchte, Importe)
- [x] Freigaben-Seite: Farbige Filter-Kacheln oben (Bereit, Mit Warnungen, Manuell, Verbucht)
- [ ] Rechnungen-Unterpunkte bleiben in Sidebar (echte Seiten)
- [ ] Berichte-Unterpunkte bleiben in Sidebar (echte Seiten)

## QR-Rechnung PDF in Neue Rechnung
- [x] Neue Rechnung: Button "Verbuchen & QR-Rechnung PDF" hinzufügen (Entwurf → Verbuchen → PDF öffnen in einem Schritt)

## UX: Fortschrittsanzeige bei KI-Operationen und Importen
- [x] Fortschrittsanzeige bei KI-Analyse von Belegen (Dokument-Upload + "Alle neu analysieren")
- [x] Fortschrittsanzeige bei Bankimport (CAMT/MT940/CSV/PDF-Upload + KI-Kategorisierung)
- [x] Fortschrittsanzeige bei Kreditkarten-PDF-Analyse
- [x] Fortschrittsanzeige bei Auto-Match (Dokument-Matching)
- [x] Fortschrittsanzeige bei Kontenplan-Import (Excel/CSV/PDF)

## UX: Kontenplan-Import-Dialog verbessern
- [x] Dialog-Höhe vergrössern (mehr Konten sichtbar im Vorschaufenster)
- [x] Checkbox-Spalte hinzufügen: Alle auswählen / einzeln an-/abwählen
- [x] Import-Button zeigt Anzahl ausgewählter Konten (nicht immer alle)
- [x] "Alle auswählen" / "Alle abwählen" Toggle-Button

## Feature: Kontenplan Kategorie-Verschiebung
- [x] Kontenplan: Beim Bearbeiten eines Kontos Kategorie und Unterkategorie ändern können (Dropdown)
- [ ] Kontenplan: Konto per Drag & Drop in andere Kategorie verschieben (wie Eröffnungssaldi) [offen - Dropdown bereits implementiert]

## Feature: Eröffnungssaldi Import
- [x] Eröffnungssaldi: Import-Button für Eröffnungsbilanz (PDF oder Excel/CSV)
- [x] Eröffnungssaldi: KI-Extraktion aus PDF (Kontonummer + Saldo)
- [x] Eröffnungssaldi: Excel/CSV-Parser (Spalten: Konto, Bezeichnung, Saldo)
- [x] Eröffnungssaldi: Vorschaufenster mit Bulk-Auswahl (Checkbox, Alle/Keine)
- [x] Eröffnungssaldi: Fortschrittsanzeige bei KI-Extraktion

## Belege-Seite: Übersicht/Details-Toggle + Label-Klärung
- [x] Zwischen Suche und Dokumentenliste: Toggle "Übersicht" / "Details" einbauen
- [x] Übersicht-Modus: nur erste Zeile (Dateiname + Badges) sichtbar
- [x] Details-Modus: auch zweite/dritte Zeile (Gegenpartei, Betrag, Datum, MWST, Beschreibung) sichtbar
- [x] "Offen" Label umbenennen in "Nicht verbucht" (= noch kein Journal-Eintrag vorhanden)

## Bugfix: Beleg-Status-Konsistenz
- [x] Beim Zurücksetzen eines Journal-Eintrags (reset/revert): verknüpfte Belege-Status auch zurücksetzen (journalEntryId auf null)
- [x] Beim Verbuchen: verknüpfte Belege-Status auf "verbucht" setzen (bereits vorhanden)
- [x] DocumentDetail.tsx: Beleg-Status-Konsistenz durch journalEntryId-Clearing beim Revert sichergestellt

## Bugfix: DocumentDetail Status-Anzeige
- [x] DocumentDetail: "Offen" Badge oben links → "Nicht verbucht" umbenennen
- [x] DocumentDetail: "Erfolgreich verbucht" Banner nur zeigen wenn Journal-Eintrag Status = "approved", nicht bei "pending/ausstehend"
- [x] DocumentDetail: Bei Journal-Status "pending" → Banner "Im Journal (ausstehend)" mit anderem Design (orange statt grün)

## Feature: 3D-ChatBot-Avatar (Berater-Look)
- [x] npm-Pakete installieren: @pixiv/three-vrm, three, @react-three/fiber, @react-three/drei
- [x] VRM-Modell: NeonGlitch86 "EL BUENO" Placeholder zu S3 hochgeladen (/manus-storage/advisor_avatar_c531768f.vrm)
- [x] AvatarScene.tsx: Three.js/React Three Fiber Komponente mit VRM-Loader, Idle-Animation, Lip-Sync, CSS-Fallback-Avatar
- [x] AvatarChatWidget.tsx: Schwebendes Widget unten rechts (Button zum Öffnen/Schliessen)
- [x] AvatarChatWidget.tsx: Chat-Interface (Texteingabe + Nachrichtenverlauf + Sprachaufnahme)
- [x] Backend: tRPC-Procedure avatarChat.chat mit System-Prompt (Buchhaltungs-Kontext + Software-Doku)
- [x] Backend: Zugriff auf echte Daten (Konten, Belege, Buchungen) im Avatar-Chat
- [x] Spracheingabe: Mikrofon-Button + Whisper-Transkription (Built-in via avatarChat.transcribeVoice)
- [x] TTS: Browser Web Speech API als Fallback (ElevenLabs optional via ELEVENLABS_API_KEY)
- [x] Lip-Sync: Audio-Analyse für Mundbewegung des Avatars (CSS-Fallback + WebAudio für ElevenLabs)
- [x] App.tsx: AvatarChatWidget global einbinden (auf allen Seiten sichtbar)
- [x] ElevenLabs API-Key als Secret konfigurieren (ELEVENLABS_API_KEY gesetzt, Daniel-Stimme eleven_multilingual_v2)

## Bugfix: Avatar-Widget Absturz + Mikrofon
- [x] Avatar-Absturz behoben: WebGL/Three.js entfernt, reiner CSS-Avatar (kein WebGL-Context-Loss mehr)
- [x] CSS-Avatar: professioneller Berater mit grauem Haar, Brille, Jacket, Krawatte, Lip-Sync
- [x] VAD-Mikrofon implementiert: automatisches Senden nach 1.5s Stille (kein manuelles Stop nötig)
- [x] AudioContext.decodeAudioData für robuste ElevenLabs-Wiedergabe

## Bugfix: Zahlungsstatus "Mit Banktransaktion verknüpft" falsch angezeigt
- [x] DocumentDetail Zahlung-Tab: "Mit Banktransaktion verknüpft" nur anzeigen wenn bankTransactionId tatsächlich gesetzt ist
- [x] Sprach-Transkription: direkter /api/upload/transcribe Endpunkt ohne S3-Umweg implementiert

## Bugfix: BankImport Bankkonto-Auswahl
- [x] BankImport: Bankkonto-Dropdown zeigt keine Bankkonten obwohl hinterlegt (INNER JOIN → LEFT JOIN, fehlende accounts-Einträge für accountId 210001-210003)

## Feature: Avatar-Chatbot Einstellungen (Admin)
- [x] DB: avatar_settings Tabelle (organizationId, language, style, customPrompt, voiceId, maxSentences) – Schema erstellt und migriert
- [x] Backend: avatarSettings.get und avatarSettings.upsert tRPC-Prozeduren (orgProcedure)
- [x] Admin-UI: AvatarSettingsTab in Settings.tsx (Tab "Avatar-Chatbot")
- [x] Avatar-Chat: Einstellungen aus DB laden (maxSentences, customPrompt, avatarName, voiceId) und in System-Prompt einbauen

## Bugfix: Bankimport zeigt 0 Transaktionen
- [x] Bankimport: 46 ungematchte Transaktionen in DB vorhanden, aber Bankimport zeigt 0 Transaktionen – GJ-Filter für ausstehende Transaktionen entfernt (getBankTransactionsByStatus)

## Feature: Geschäftsjahr-Konsistenz
- [x] Bankimport: Ausstehende Transaktionen ohne GJ-Filter anzeigen (alle pending immer sichtbar)
- [x] Bankimport: Beim Upload automatisch GJ wechseln basierend auf Transaktionsdatum (auto-switch + Warnung bei geschlossenem GJ)
- [x] Alle Ansichten: Konsistenter GJ-Wechsel über FiscalYearContext (isOpen, fiscalYearInfos exportiert)
- [x] Layout.tsx: GJ-Selector markiert geschlossene Jahre visuell (Schloss-Icon)
- [x] AvatarSettingsTab: Komponente in Settings.tsx implementiert

## Feature: Import-Automatisierungs-Einstellungen

- [x] DB-Schema: import_automation_settings Tabelle (organizationId, autoKiCategorize, autoGenerateBookingTexts, autoRefreshLearned, autoDetectTransfers, autoMatchDocuments) – alle Default true
- [x] Backend: importAutomationRouter (get/upsert) via orgProcedure
- [x] Frontend: Neuer Tab "Import-Automatisierung" in Einstellungen (unter Bankkonten)
- [x] Frontend: Toggle-Switches für jede Auto-Aktion mit Beschreibung
- [x] Frontend: Link im Admin-Bereich der Sidebar zu diesem Tab
- [x] BankImport: Nach Upload die Einstellungen laden und nur aktivierte Aktionen ausführen
- [ ] BankImport: Visuelle Anzeige welche Aktionen beim letzten Import ausgeführt wurden (optional)

## Feature: Bankimport GJ-Pflicht und GJ-Filter

- [x] Bankimport: Beim Import prüfen ob passendes GJ geöffnet ist; wenn nicht → Fehlermeldung mit Hinweis GJ zu eröffnen
- [x] Bankimport: Ausstehende Transaktionen immer nach gewähltem GJ filtern (nicht mehr "alle pending anzeigen")
- [x] Bankimport: GJ-Wechsel beim Upload nur wenn Ziel-GJ geöffnet ist (kein auto-switch zu geschlossenem GJ)

## Feature: Belege-Seite Verbesserungen

- [x] Belege: "Dokumente" → "Belege" umbenennen (Seitenname, Sidebar, Header)
- [x] Belege: Prominenter "Abgleichen"-Banner wenn ungematchte Belege vorhanden (oben, mit Anzahl)
- [x] Belege: Farbliche Unterscheidung der Dokumentkategorien (Rechnungen=blau, Kreditkartenabrechnungen=lila, Barbelege=grün)
- [x] Backend: credit_card_statement zu VALID_DOC_TYPES hinzugefügt (wurde vorher als 'other' gespeichert)

## Bugfix: Auto-Match findet keine Banktransaktionen
- [x] Auto-Match: Debug-Info hinzugefügt (zeigt Anzahl Belege + Transaktionen in Toast-Meldung)
- [x] Auto-Match: Sicherstellen dass alle pending Transaktionen (org-weit) für Matching verfügbar sind

## Feature: Chatbot Begrüssungsaudio
- [x] Chatbot: Beim Öffnen den Begrüssungstext via ElevenLabs TTS als Audio sprechen (speakGreeting Mutation)
- [x] Chatbot: Audio-Wiedergabe nur beim ersten Öffnen (greetingPlayedRef verhindert Wiederholung)

## Feature: Bankimport IBAN-Validierung
- [x] Backend: extractCAMT053AccountIban Funktion in bankParser.ts
- [x] Backend: IBAN-Validierung im handleFileUpload (Frontend-seitig, kein Server-Round-Trip nötig)
- [x] Frontend: IBAN-Fehler als Toast mit 8s Dauer anzeigen

## Feature: Bankimport Rükgängig
- [x] Backend: deleteImport Prozedur – alle Transaktionen eines Imports löschen (anhand importBatchId)
- [x] Frontend: Papierkorb-Button in Import-Historie für jeden Import
- [x] Frontend: Bestätigungsdialog vor dem Löschen (Anzahl Transaktionen anzeigen)

## Bugfix: Belege/Journal Inkonsistenzen (6 Punkte)
- [x] Terminologie: "Verbucht / Matched" → "Verknüpft" in Belege-Kacheln, Filter und Badges
- [x] Beleg-Status: Zahlungsstatus zeigt jetzt ob Beleg im Journal verbucht ist (journalEntryStatus)
- [x] 1:1 Matching: applyMatches prüft ob Transaktion/Dokument bereits vergeben (1:1 Constraint)
- [x] Konto-Konsistenz: journalEntryAccounts aus JournalLines geladen und in Belegdetails angezeigt
- [x] Gegenkonto: Initialisierung in DocumentDetail nutzt linkedBankAccount.accountId korrekt
- [x] Journal: "Bereit zur Freigabe" → "Zu genehmigen", "Verbucht / Genehmigt" → "Verbucht"
- [x] Belegdetail: Buchungskonten (Soll/Haben) aus JournalLines in Belegdetails-Tab angezeigt

## Neue Änderungen (Benutzer-Feedback 20.04.2026)
- [x] Navigation: "Freigaben" → "Buchungen" in Layout.tsx umbenennen
- [x] Terminologie: "Verknüpft" → "Mit Bank abgeglichen" in Documents.tsx, DocumentDetail.tsx und allen anderen Dateien
- [x] Öffentliche URL wmbuchhaltung-g3uypyrz.manus.space prüfen und erreichbar machen

## Bugfixes Bank + Berichte (20.04.2026)
- [x] Berichte: "Journal"-Tab in Berichte-Navigation (neben Konten) hinzugefügt
- [x] Bank: Zähler "Alle Transaktionen" zeigt jetzt korrekt 44 (pending + matched im GJ)
- [x] Bank: "Alle Transaktionen" Filter zeigt jetzt alle Transaktionen (pending immer, matched nach GJ)
- [x] Bank: Verbuchte Transaktionen (Status "matched") werden in "Verbucht"-Kachel korrekt gezählt

## Feature: Vorschau-Button öffnet Detailansicht (20.04.2026)
- [x] Documents.tsx: Vorschau-Button (Auge-Icon) soll Detailansicht (/documents/:id) öffnen statt PDF direkt

## Feature: Benutzer-Verwaltung & Treuhänder-Einladung (20.04.2026)
- [x] DB-Schema: invitations-Tabelle (token, email, role, expiresAt, usedAt, createdBy)
- [x] Backend: invitations Router (create, list, revoke, accept)
- [x] Frontend: Benutzer-Seite in Einstellungen aktivieren (aktuell inaktiv)
- [x] Frontend: Benutzer-Liste mit Rolle und Status anzeigen
- [x] Frontend: Treuhänder einladen via E-Mail + Einladungslink generieren (7 Tage gültig)
- [x] Frontend: Einladungslink kopieren und anzeigen
- [x] Frontend: Öffentliche Einladungs-Annahme-Seite (/einladung/:token)

## Feature-Batch (20.04.2026 - Nachmittag)
- [ ] Kunden-Import: Datei-Auswahl-Bug fixen (label/input Portal-Problem in Dialog)
- [ ] Zeiterfassung: Link in Sidebar-Navigation hinzufügen
- [ ] Einstellungen: Globaler "Dienstleistungen/Produkte" Tab hinzufügen
- [ ] QR-Rechnung: Logo in PDF-Generierung (renderInvoicePdf) einbinden
- [ ] QR-Rechnung: QR-Code-Bild Upload in Einstellungen (für Einzahlungsschein-Grafik)

## Navigation-Umstrukturierung (20.04.2026 - Session 2)
- [x] Einstellungen: Unterpunkte aus Sidebar entfernen (nur Hauptlink, direkt zu /einstellungen)
- [x] Einladungslink Bug: /einladung/:token Route in App.tsx als öffentliche Route registriert
- [x] AcceptInvitation.tsx: Öffentliche Seite für Einladungslinks erstellt (zeigt Org-Name, Rolle, Registrieren-Button)
- [x] invitationsRouter: getByToken um orgName (JOIN mit organizations) erweitert
- [x] Rechnungen: Hauptpunkt "Rechnungen" mit Unterpunkten "Kunden (Debitoren)" und "Lieferanten (Kreditoren)"
- [x] Layout.tsx: 3-Ebenen-Navigation für Rechnungen (renderNavItem mit verschachtelten Gruppen)
- [x] sectionPrefixes: /zahlungen/kreditoren zu /rechnungen-Gruppe hinzugefügt

## Bugfixes (20.04.2026 - Session 3)
- [x] GJ-Eröffnungsabfrage beim Beleg-Upload: Wenn Belegdatum in nicht eröffnetes GJ fällt, Dialog anzeigen und GJ automatisch eröffnen
- [x] Kunden-Import CSV/Excel: CSV-Encoding-Fix (UTF-8 + Latin-1 Fallback für Umlaute aus Excel-Exporten)

## QR-Rechnung Navigation (21.04.2026)
- [x] "Neue Rechnung"-Button navigiert zu QrBillGenerator statt InvoicesEditor-Dialog
- [x] Route /rechnungen/neu → QrBillGenerator
- [x] QrBillGenerator: Kunden aus Stammdaten auswählen (Dropdown mit Suche bereits vorhanden)

## Navigation Bereinigung (22.04.2026)
- [x] Kunden (Debitoren): Unterpunkte "Offene Forderungen", "Zahlungsausgänge" und "Kunden" entfernen (nur "Ausgangsrechnungen" und "Mahnwesen" behalten)

## QR-Rechnung + Zeiterfassung (22.04.2026)
- [x] QrBillGenerator: "Kunde wählen"-Button auch im Tab "Einfacher QR-Einzahlungsschein" hinzugefügt
- [x] QrBillGenerator: Toggle "Mit Leistungsdetails" bei Leistungspositionen (Tab Rechnung mit QR-Zahlungsteil)
- [x] QrBillGenerator: Beim Aktivieren von "Mit Leistungsdetails" Kunden-Zeiteinträge laden und nach QR-Seite als Leistungsblatt anhängen
- [x] Backend: generateInvoiceAcroform um optionale Leistungsdetail-Seite erweitert (Datum, Dienstleistung, Beschreibung, Std., Ansatz, Betrag, Total)

## Eröffnungssalden-Verbesserungen (22.04.2026)
- [x] Eröffnungssalden: GJ-Selector prominenter anzeigen (Label "Geschäftsjahr" + Dropdown oben rechts)
- [x] Eröffnungssalden: Toggle "Konten ohne Betrag ausblenden" (filtert Konten mit Saldo 0.00, zeigt Anzahl ausgeblendeter Konten)

## Bug: Verbuchte KK-Abrechnung verschwunden (22.04.2026)
- [ ] Journal zeigt verbuchte Kreditkartenabrechnung nicht an (nur 2 Buchungen sichtbar)
- [ ] Banktransaktionen: KK-Abrechnung nach Verbuchung nicht mehr sichtbar
- [ ] Ursache prüfen: GJ-Filter, fehlende Daten, oder Lösch-Bug

## QrBillGenerator – Entwurf-Speicherfunktion
- [x] Schema: customerId in invoices nullable gemacht (Rechnungen ohne Kundenzuordnung möglich)
- [x] Backend: saveFromQrGenerator-Prozedur in invoicesRouter (Insert/Update Entwurf, nullable customerId)
- [x] Frontend: "Als Entwurf speichern" Button im QrBillGenerator (Tab Rechnung mit QR-Zahlungsteil)
- [x] Frontend: Auto-Save als Entwurf beim Klick auf "Rechnung als PDF generieren"
- [x] Frontend: Nach erstem Speichern wechselt Button zu "Entwurf aktualisieren" (savedInvoiceId-State)
- [x] Frontend: Toast-Notification mit Link zu Entwürfen nach erfolgreichem Speichern
- [x] Invoices.tsx: customerName für null-Fall abgesichert (Entwürfe ohne Kunden zeigen "—")

## Bank & Belege – UI-Verbesserungen (Apr 2026)
- [x] Bank: Internen h2-Header "Bankimport" entfernen (Layout-Header reicht)
- [x] Bank: GJ-Button im Bankimport-Bereich prominenter (grösser, rechts im Import-Bereich)
- [x] Bank: Verbuchen-Button öffnet Bearbeiten-Dialog (mit Abbrechen, Speichern, Verbuchen)
- [x] Belege: Internen h2-Header "Belege" entfernen (Layout-Header reicht)
- [x] Belege: Farbkennzeichnung links deutlicher (farbige Hinterlegung der Dokument-Kachel/Thumbnail)
- [x] Belege: "Verbuchen"-Button statt Vorschau-Icon rechts in der Liste
- [x] Belege: Manuelle Verknüpfung mit Banktransaktion auch in Detailansicht
- [x] Belege-Detailansicht: KK-Abrechnungen – automatischer Verbuchungsvorschlag wie im Bankbereich

## Bugfix: Debitorenkonto 1100 nicht gefunden (Apr 2026)
- [x] invoicesRouter.ts: issue-Prozedur – Konto 1100 in DB eingefügt, MWST-Konto Default von 2200 auf 2040 korrigiert

## KK-Sammelbuchung in Beleg-Detailansicht (Apr 2026)
- [x] DocumentDetail.tsx: KK-Abrechnung Verbuchen-Tab – Sammelbuchung mit allen Einzelpositionen und KI-Aufwandskonten (analog Bankbereich Kreditkartenzahlungen-Button)

## Bugfix: Rechnungs-PDF Format nach Verbuchen (Apr 2026)
- [x] Nach Verbuchen einer QR-Rechnung: PDF-Button in Rechnungsliste soll dasselbe Briefformat (QrBillGenerator-Template) wie beim direkten PDF-Generieren verwenden
  - Schema: closingText, greeting, signatory, signatoryTitle zu invoices-Tabelle hinzugefügt (Migration 0032)
  - Backend: saveFromQrGenerator speichert diese Felder, renderInvoicePdf rendert sie korrekt
  - Frontend: buildSaveDraftInput() übergibt alle Briefformat-Felder beim Speichern

## Bugfixes + Features (22.04.2026 - Session 4)
- [x] Bug: Eingangsrechnungen (Belege) zeigt auch Ausgangsrechnungen – URL-Parameter ?type=incoming, Dropdown-Filter "Eingangsrechnungen (alle)" hinzugefügt
- [x] QR-Rechnung PDF: Logo kleiner (maxW 130pt, maxH 45pt)
- [x] QR-Rechnung PDF: Währung weiter nach links (curColRight rightEdge-75 statt -55)
- [x] QR-Rechnung PDF: QR-Code auf Seite 1 entfernt (erscheint auf Seite 2 als SwissQRBill)
- [x] Admin: Rechnungen einzeln oder mehrfach löschen – adminDelete + adminBulkDelete Prozeduren + Checkboxen in Invoices.tsx

## Bugfix: Debitorenkonto dynamisch aus Kontenplan (später)
- [ ] invoicesRouter.ts: Debitorenkonto nicht hardcoded 1100, sondern dynamisch aus Kontenplan laden (erstes aktives Konto mit subCategory "Debitoren" oder Kontonummer 1050/1100)
- [ ] Konto 1100 aus DB entfernen falls es ein Duplikat zu 1050 ist

## Feature: Bulk-Löschen für Belege (22.04.2026)
- [x] Backend: delete + bulkDelete-Prozeduren in documentsRouter (Admin-only, löscht S3-Dateien + DB-Einträge), storageDelete in storage.ts
- [x] Frontend: Checkboxen in Documents.tsx (Admin-only), Toolbar mit "X Belege löschen"-Button, Select-All-Header
- [x] Frontend: AlertDialog-Bestätigungsdialog vor Bulk-Delete

## Refactoring: KK-Abrechnung Buchungslogik (22.04.2026)
- [x] KK-Abrechnung: Zwei separate Buchungen – neues UI mit approveCcFromBankImport (Buchung 1: 1082/1032 Zahlungsbetrag editierbar; Buchung 2: Div. Aufwandkonten/1082 Sammelbuchung)
- [x] Tab "Kontierung" für KK-Abrechnungen ausgeblendet (nicht relevant, Konten im Verbuchen-Tab)
- [x] Tab "Zahlung": Buchungskonten-Abschnitt entfernt
- [x] Verbuchte Belege: bookDirect setzt direkt status=approved + approveJournalEntry (kein Genehmigungsschritt)
- [x] Nach Verbuchen: automatisch zurück zu /belege navigieren
- [ ] Verbuchungsvorschlag auch für Einzelbuchungen automatisch anzeigen (noch offen)

## Best-Practice Optimierungen Priorität 1 (Apr 2026)
- [ ] Konfidenz-Score bei KK-Buchungsvorschlägen anzeigen (Embedding-Score als %-Badge + "Why?"-Erklärung)
- [ ] Aging-Buckets in der Rechnungsliste (0-30 / 31-60 / 61-90+ Tage offen, Zusammenfassungskarte rechts)
- [ ] Sparklines in den KPI-Karten auf dem Dashboard (Mini-Liniendiagramm der letzten 6 Monate)

## Best-Practice Optimierungen Priorität 2 (Apr 2026)
- [ ] Live-PDF-Preview im QrBillGenerator (Split-Screen: Formular links, PDF-Preview rechts)
- [ ] KI-Insights in Reports (P&L, Bilanz): 2-3 automatisch generierte Erkenntnisse via LLM
- [ ] Vollständiger Verbuchungsvorschlag bei Belegöffnung (Konto Soll / Haben vorausgefüllt)

## Best-Practice Optimierungen Priorität 3 (Apr 2026)
- [ ] KI-Chat-Assistent "Ask KLAX" (Slide-over Panel, Quick-Action-Chips, LLM-Integration)
- [ ] Cashflow-Forecast (13 Wochen, Base/Best/Worst-Case, Konfidenzband)
- [ ] Mobile Beleg-Scanner (Kamera-Integration, Live-OCR, Kategorievorschlag)

## Priorität 1: KLAX Best-Practice-Optimierungen (infinity.swiss-Analyse)
- [x] Priorität 1a: Konfidenz-Score bei KK-Buchungsvorschlägen – farbige %-Badges (grün/gelb/rot) + "📚 Regel" / "🤖 KI" Label + Tooltip mit Erklärung
- [x] Priorität 1b: Aging-Buckets in Rechnungsliste – 4 klickbare Kacheln (1-30 / 31-60 / 61-90 / 90+ Tage), Farbkodierung, Filter-Integration
- [x] Priorität 1c: Sparklines im Dashboard – echte Monatsdaten (getMonthlyAggregates), Recharts LineChart, Tooltip mit CHF-Beträgen

## Priorität 2: UX-Verbesserungen (KLAX Best-Practice)

- [x] 2a: Live-PDF-Preview im Rechnungseditor (Split-Screen, Echtzeit-Vorschau mit Firmen-/Kundendaten, Positionen, QR-Platzhalter)
- [x] 2b: KI-Insights in Berichten (Eigenkapitalquote, Umsatzentwicklung, Gewinnmarge, Liquidität 1. Grades)
- [x] 2c: Buchungsvorschlag-Banner im Verbuchen-Tab (Quelle: Regel vs. KI, "Vorschlag übernehmen"-Button)
