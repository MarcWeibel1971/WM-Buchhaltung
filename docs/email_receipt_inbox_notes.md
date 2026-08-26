# E-Mail-Beleg-Postfach: Integrationsbefund

Die aktivierte Outlook-Mail-Integration bietet der aktuellen Arbeitsumgebung Such-, Lese- und Versandoperationen. Sie ist jedoch eine aufgabengebundene Integration und keine vom veröffentlichten Webserver aufrufbare Laufzeit-API.

Ein produktives, dauerhaftes Beleg-Postfach benötigt deshalb zusätzlich eine serverseitig erreichbare Quelle, beispielsweise Microsoft Graph mit einer freigegebenen Mailbox und OAuth- bzw. App-Berechtigung oder einen eingehenden E-Mail-WebHook eines spezialisierten Dienstes. Erst dann können Anhänge automatisiert in den bestehenden Belegimport und die organisationssichere Ablage überführt werden.

Die vorhandene Outlook-Integration kann bis dahin für kontrollierte, manuelle Abläufe verwendet werden; sie wird nicht in den veröffentlichten Anwendungscode eingebettet, damit keine anwendungsexternen Sitzungsrechte oder Zugangsdaten offengelegt werden.
