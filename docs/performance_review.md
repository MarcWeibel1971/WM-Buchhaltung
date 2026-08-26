# P2.10: Index- und Lastprüfungsnotizen

Der Index `journal_entries_org_fiscal_status_date_idx` wurde auf den in der Anwendung verwendeten Filter `organizationId`, `fiscalYear`, `status` und die Sortierung `bookingDate` zugeschnitten. Er wurde schema- und datenbankseitig erfolgreich angelegt und per Informationsschema verifiziert.

Die nichtinvasive Ausführungsplanprüfung konnte in der aktuellen Datenbank keine repräsentative freigegebene Journalmenge auswerten; der Optimierer lieferte deshalb einen leeren Plan. Für einen belastbaren Lastnachweis ist ein separates, anonymisiertes Staging-Dataset erforderlich. Produktionsdaten wurden hierfür bewusst nicht verändert.

Der Wiederherstellungsablauf verbleibt als separater P2.10-Teilpunkt, weil er eine abgestimmte Sicherungskopie und einen isolierten Testkontext voraussetzt.
