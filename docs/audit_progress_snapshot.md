# Auditfortschritt: Technischer Stand

## Abgeschlossene technische P2-Bausteine

| Bereich | Ergebnis |
|---|---|
| Modularisierung | Journal-, Bankimport- und Settings-Fachbereiche sind in Router, Fachmodule und UI-Komponenten zerlegt; insbesondere ist der Bankimport-Transaktionseditor in fokussierte Dialog-, Eingabe-, Sammelbuchungs-, Vorschau- und Aktionskomponenten aufgeteilt. |
| Geldpfade | KI-Buchungsvorschläge und Dokumentmetadaten sind mit Zod-DTOs abgesichert. |
| Qualität | Vitest-Coverage-Lauf und CI-Artefakt sind eingerichtet. |
| MWST | Organisationssicherer ESTV-Vorbereitungs-CSV-Download sowie klar als nicht produktiv gekennzeichnete eCH-0217-XML-Entwürfe für effektive Methode, Saldo- und Pauschalsteuersatzmethode sind verfügbar. Repräsentative Periodenfixtures aller Methoden validieren gegen die lokal synchronisierte offizielle eCH-0217:2025-XSD-Importkette. |
| Archiv und Auszüge | GeBüV-Manifest, Debitoren-/Kreditorenposten und Kontenblätter sind exportierbar. |
| Wiederkehrende Rechnungen | Vorlagen, manuelle Fälligkeit, Heartbeat-Handler und Aufgabenverwaltung sind umgesetzt. |

## Externe Restvoraussetzungen

Die XSD-Validierungsbasis ist lokal vorhanden und mit repräsentativen Fixtures geprüft; die XML-Ausgabe bleibt bis zu einer fachlichen ESTV-Abnahme und einem autorisierten Produktivtest ausdrücklich ein Entwurf. Die aktivierte Outlook-Integration erlaubt in diesem Arbeitskontext das Suchen, Lesen und Senden von Nachrichten, stellt jedoch keinen serverseitigen Mailbox-Webhook oder dauerhaften Abrufdienst bereit. Das E-Mail-Belegpostfach benötigt daher weiterhin eine serverseitig freigegebene Mailbox-Integration. Produktionsnachtests sind derzeit durch einen CloudFront-403 beim Manus-OAuth-Aufruf blockiert. Ein finaler Last- und Restore-Nachweis benötigt ein isoliertes Staging- bzw. Sicherungsumfeld.

Der technische P2.2-Refactoringblock ist abgeschlossen. Die verbleibenden Auditpunkte sind überwiegend autorisierte Produktionsnachtests oder externe Infrastrukturvoraussetzungen.
