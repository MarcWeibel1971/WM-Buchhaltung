# Live-Testnotizen

## 17. August 2026: ESTV-MWST-CSV

Die produktive Anmeldung mit dem hinterlegten Testkonto wurde einmalig versucht. Die Anwendung antwortete mit **„E-Mail oder Passwort ist falsch.“**. Daher konnte der geschützte MWST-Bereich und der Download nicht über die Oberfläche verifiziert werden.

Die Exportfunktion wurde stattdessen mit TypeScript und der vollständigen Vitest-Suite validiert. Der Router ist organisationssicher; die CSV-Erzeugung wird über eine gezielte Regression abgesichert.

## 17. August 2026: erneuter geschützter Nachtest

Der gespeicherte Testzugang wurde erneut in der veröffentlichten Anwendung verwendet. Die Anmeldung wurde wiederum mit **„E-Mail oder Passwort ist falsch.“** abgelehnt. Der geschützte MWST-Download sowie die neue Oberfläche für wiederkehrende Rechnungen können deshalb bis zur Wiederherstellung oder Aktualisierung des Testkontos nicht über die Live-Oberfläche geprüft werden. Es wurden keine weiteren Anmeldeversuche durchgeführt.

## 17. August 2026: autorisierter persönlicher Produktionszugang

Auf ausdrückliche Nutzerfreigabe wurde die Anmeldung über **„Mit Manus-Konto anmelden“** versucht. Der OAuth-Aufruf wurde vor der eigentlichen Anmeldung durch einen CloudFront-Fehler `403 – Request blocked` auf `manus.im/app-auth` abgewiesen. Damit stand auch der persönliche Produktionszugang für diesen Nachtest nicht zur Verfügung. Der Fehler liegt im vorgelagerten OAuth-Zugriff, nicht in den implementierten Buchhaltungsfunktionen.

## 17. August 2026: Heartbeat-Bestand

Die Tabelle für wiederkehrende Rechnungsvorlagen wurde schema-seitig geprüft. Aktuell sind keine Vorlagen angelegt; daher existiert auch keine produktiv zu aktivierende Heartbeat-Aufgabe. Die automatische Zeitplanung wird beim Anlegen der ersten aktiven Vorlage erzeugt und kann anschließend über deren gespeicherte Aufgaben-ID geprüft werden.

## 17. August 2026: erneuter autorisierter Login-Nachtest

Der vom Nutzer freigegebene persönliche Zugang wurde erneut ausschließlich für den geschützten Nachtest verwendet. Die Anmeldeseite antwortete wiederum mit **„E-Mail oder Passwort ist falsch.“**. Es wurden keine weiteren Versuche ausgeführt. Der Live-Nachtest von MWST-Download, wiederkehrenden Rechnungsvorlagen und CAMT-Debitorenabgleich bleibt daher blockiert; die automatisierten TypeScript-, Vitest- und XSD-Validierungen bleiben die aktuelle technische Nachweisbasis.

Der anschliessend gestartete alternative Manus-OAuth-Weg erreichte die Weiterleitungs-URL, stellte jedoch keinen fortsetzbaren Anmeldedialog bereit und endete im Browser auf einer leeren Seite. Damit konnte auch dieser autorisierte Nachtest den geschützten Bereich nicht öffnen.

## 26. August 2026: GitHub- und Railway-Abgleich

Der Railway-Dashboardzugang ist verfügbar. Der aktuell sichtbare Dashboardbestand enthält mehrere generisch benannte Projekte; das konkrete WM-Deployment ist dort noch eindeutig dem GitHub-Repository zuzuordnen, bevor eine Infrastruktur- oder Deploymentaktion erfolgen darf. Der geprüfte GitHub-Stand `MarcWeibel1971/WM-Buchhaltung` weicht außerdem erheblich von der aktuellen Audit-Arbeitskopie ab; ein automatischer Merge oder Deploy wäre deshalb nicht sicher.

Der GitHub-Hauptzweig wurde separat installiert und mit `pnpm check` erfolgreich typgeprüft. Er steht auf Commit `a4b610f` vom 15. August 2026 und unterscheidet sich strukturell deutlich von der laufenden Audit-Arbeitskopie. Die Audit-Änderungen werden deshalb erst nach klarer Zuordnung des Railway-Services und als gezielter Abgleich in den GitHub-Stand überführt, nicht als unkontrollierter Komplettmerge.

Die angemeldete Railway-Projektliste wurde zusätzlich gezielt nach „buchhaltung“ durchsucht. Es wurde kein passendes Projekt angezeigt; exemplarisch geprüfte Projekte gehören zu Mosaicprint beziehungsweise Finanzplan. Somit ist im aktuell zugänglichen Railway-Dashboard kein eindeutig zugeordnetes WM-Buchhaltungsdeployment sichtbar.

## 26. August 2026: GitHub-Branchschutz

Für `MarcWeibel1971/WM-Buchhaltung` besteht auf `main` bereits ein Branchschutz mit dem erforderlichen CI-Check `check-test-build`. Pull-Request-Reviews sind derzeit nicht verpflichtend, Administratoren werden nicht einbezogen und es sind keine weiteren Restriktionen konfiguriert. Eine Verschärfung dieser Richtlinie ist eine wirksame Änderung am gemeinsamen Entwicklungsprozess und wird deshalb nicht stillschweigend vorgenommen.
