# Externe Auditvoraussetzungen

Die folgenden Restpunkte sind nicht durch weiteren Anwendungscode lösbar und bleiben getrennt von den abgeschlossenen technischen P2-Maßnahmen nachzuverfolgen.

| Restpunkt | Erforderliche Grundlage | Nachtest |
|---|---|---|
| ESTV-XML | Vollständiger eCH-0217:2025-XSD-Satz einschließlich referenzierter Normschemas | XML gegen bereitgestellte XSD validieren |
| E-Mail-Belegpostfach | Serverseitige Microsoft-Graph- oder WebHook-Integration | Mailanhang organisationssicher in Belegimport überführen |
| Produktiver Live-Test | Funktionsfähige KLAX- oder Manus-OAuth-Anmeldung | MWST-CSV, Vorlagenverwaltung und CAMT-Abgleich im geschützten Bereich prüfen |
| Belastbarkeit und Restore | Anonymisiertes Staging-Dataset und isolierter Sicherungsstand | Indexlast und Wiederherstellungs-Integrität nachweisen |

Der aktuelle technische Stand der jeweiligen Fachfunktionen wird durch TypeScript und die vollständige Vitest-Suite abgesichert.
