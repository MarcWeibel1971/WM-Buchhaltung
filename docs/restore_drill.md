# Wiederherstellungsablauf für den P2.10-Restore-Drill

Der Restore-Drill darf ausschließlich mit einem zeitlich eindeutig bezeichneten, verschlüsselten Sicherungsstand und einer **isolierten** Datenbankinstanz erfolgen. Die produktive Datenbank wird weder überschrieben noch durch Testdaten ergänzt.

1. Den Sicherungsstand mit Erstellzeitpunkt, Quelle, Dateigröße und Prüfsumme erfassen.
2. Eine isolierte Testdatenbank bereitstellen und die Verbindung ausschließlich dort konfigurieren.
3. Das Backup einspielen und den Importabschluss protokollieren.
4. Tabellenanzahl, zentrale Summen pro Organisation sowie den Zugriff auf Journal, Belege und Kontenblätter gegen die Sicherungsmetadaten prüfen.
5. Eine lesende Journalexport- und eine Belegverzeichnisabfrage ausführen; Prüfsummen und Datensätze im Drill-Protokoll festhalten.
6. Die Testinstanz und temporäre Wiederherstellungsdateien nach Abschluss kontrolliert entfernen.

Der konkrete Drill bleibt offen, bis ein dafür freigegebener, anonymisierter Sicherungsstand und ein isolierter Testkontext vorliegen.
