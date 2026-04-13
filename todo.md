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
