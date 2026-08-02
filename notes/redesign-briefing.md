# Redesign-Briefing: Belegzentrierte Informationsarchitektur

## Grundsatz
Der Nutzer startet mit Belegen, nicht mit Buchungssätzen. Der Flow ist:
Upload → KI verarbeitet → Matching → Genehmigung

## Neue Sidebar-Struktur
```
Dashboard
Inbox

Belege
- Alle Belege
- Neu hochgeladen
- Von KI verarbeitet
- Zu prüfen
- Gematcht
- Archiv

Bank
- Banktransaktionen
- Importe
- Ungematchte Transaktionen
- Gematchte Transaktionen
- Bankkonten & Karten

Freigaben
- Bereit zur Genehmigung
- Mit Warnungen
- Manuell angepasst
- Verbucht

Rechnungen
- Ausgangsrechnungen
- Offene Forderungen
- Zahlungseingänge
- Mahnwesen
- Kunden

Berichte
- Erfolgsrechnung
- Bilanz
- Kontoblätter
- Cashflow
- Offene Posten

Abschluss & MWST
- MWST
- Periodenabschluss
- Jahresabschluss

Einstellungen
- Firma
- Kontenplan
- Benutzer
- Integrationen
- Zahlungsarten

Admin
- KI-Regeln
- Prüfregeln
- Logs / Historie
```

## Umbenennungen
| Alt | Neu | Grund |
|---|---|---|
| Journal | Freigaben | näher am Nutzerziel |
| Bankimport | Bank | importieren ist nur technischer Schritt |
| Dokumente | Belege | fachlich klarer |
| Kreditkarte | unter Bank integrieren | kein eigener Primärbereich |
| Ausstehend | konkrete Aufgaben | z.B. "Zur Freigabe", "Ungematcht" |

## Dashboard-Aufbau (Priorität)
1. HEUTE ZU ERLEDIGEN (Neue Belege, Zur Freigabe, Ungematchte Banktx, Offene Debitoren)
2. KI HAT FÜR DICH VORBEREITET (Automatisch erkannt, Kontiert, Gematcht, Prüfquote, Trefferquote)
3. BELEGE + BANK (Statusübersicht)
4. FREIGABEN + RECHNUNGEN (Statusübersicht)
5. FINANZSTATUS (Liquidität, Forderungen, Verbindlichkeiten, Ertrag, Aufwand, Ergebnis)
6. FRISTEN & HINWEISE (MWST, Periodenabschluss, Überfällige Rechnungen, KI-Ausnahmen)

## KPI-Reihenfolge
1. Liquidität
2. Offene Forderungen
3. Offene Verbindlichkeiten
4. Ertrag Monat/Jahr
5. Aufwand Monat/Jahr
6. Ergebnis
Optional: Automatisierungsquote, Freigaben heute, Match-Quote

## Empty States (aktivierend)
- Keine neuen Belege → "Lade Rechnungen, Spesen oder KK-Abrechnungen hoch..."
- Keine offenen Freigaben → "Alle Vorschläge verbucht. Neue Belege erscheinen hier automatisch."
- Keine ungematchten Banktx → "Alle Bankbewegungen zugeordnet."

## Primäre CTAs
1. Beleg hochladen
2. Bank importieren
3. Rechnung erstellen

## Sekundäre CTAs
- Freigaben prüfen
- pain.001 exportieren
- Bericht öffnen

## Designprinzipien
- Belege sind der Startpunkt
- Inbox ist der tägliche Arbeitsort
- Freigaben statt Journal
- Bank als Matching-Bereich
- Debitoren als eigener Zukunftsbereich
- KI-Mehrwert sichtbar machen
- Task first, KPIs second
