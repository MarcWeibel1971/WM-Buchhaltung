# Externe Restvoraussetzungen für den Auditabschluss

## Ausgangslage

Die extern unabhängigen P2-Umsetzungen sind abgeschlossen und automatisiert geprüft. Die verbleibenden Punkte erfordern entweder einen autorisierten Zugang zur veröffentlichten Anwendung, eine serverseitig freigegebene Mailbox-Integration oder ein isoliertes Restore-/Staging-Umfeld. Sie dürfen nicht gegen die produktive Datenbank simuliert werden.

| Auditbereich | Auslöser für den Nachtest | Kontrollschritte | Abschlusskriterium |
|---|---|---|---|
| ESTV-CSV und XML-Entwurf | Wiederhergestellter geschützter Login | MWST-Periode öffnen, CSV und XML-Entwurf herunterladen, XML mit `pnpm validate:ech0217` gegen die lokale Schemaimportkette prüfen | Download, Organisationsbezug und XSD-Validierung sind protokolliert |
| Wiederkehrende Rechnungen | Autorisierter Zugriff und erste aktive Vorlage | Vorlage erstellen, Aufgaben-ID prüfen, einmal fällige Vorlage verarbeiten und Entwurf/Folgetermin kontrollieren | Heartbeat-Aufgabe, Idempotenz und Folgetermin sind nachgewiesen |
| E-Mail-Belegpostfach | Serverseitige Microsoft-Graph- oder Webhook-Freigabe | Eingehenden Beleg in isolierter Mailbox zustellen, Abruf und sichere Dokumentablage kontrollieren | Abruf, Zuordnung und Fehlerbehandlung sind dokumentiert |
| Restore-Drill und Indexlast | Anonymisierter Sicherungsstand und isolierte Testdatenbank | Restore gemäss `docs/restore_drill.md`, Integritätsprüfungen sowie Journalindexmessung unter Last ausführen | Restore-Protokoll, Prüfsummen und Messwerte liegen vor |
| CAMT-Debitorenabgleich | Erfolgreiche OAuth-Anmeldung und echter CAMT.054-Zahlungseingang | Abgleich über die Oberfläche ausführen und Ergebnis gegen die Matching-Regression vergleichen | Visuelles Ergebnis und Referenzzuordnung sind bestätigt |

## Aktuell bestätigte Grenzen

Die Outlook-Integration des Arbeitskontexts unterstützt Nachrichtensuche, Lesen und Senden. Ein serverseitiger Webhook oder dauerhafter Abrufdienst ist dort nicht verfügbar. Der fehlende Mailbox-Nachtest bleibt deshalb eine Infrastrukturvoraussetzung. Die personalisierte Manus-OAuth-Anmeldung war zuletzt durch einen vorgelagerten CloudFront-Fehler `403` blockiert; es werden ohne geänderte Ausgangslage keine weiteren Login-Versuche durchgeführt.
