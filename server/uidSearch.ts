/**
 * Swiss UID Register Search (PublicServices SOAP API v5.0)
 * Searches the Swiss commercial register for company information.
 * Free, public API - no authentication required.
 */

const UID_ENDPOINT = "https://www.uid-wse.admin.ch/V5.0/PublicServices.svc";
const SOAP_ACTION_SEARCH = "http://www.uid.admin.ch/xmlns/uid-wse/IPublicServices/Search";

// Legal form code mapping (eCH-0097)
const LEGAL_FORM_MAP: Record<string, string> = {
  "0101": "Einzelunternehmen",
  "0102": "Einfache Gesellschaft",
  "0103": "Kollektivgesellschaft",
  "0104": "Kommanditgesellschaft",
  "0105": "Kommanditaktiengesellschaft",
  "0106": "AG",
  "0107": "GmbH",
  "0108": "Genossenschaft",
  "0109": "Verein",
  "0110": "Stiftung",
  "0111": "Zweigniederlassung CH",
  "0113": "Institut des öffentlichen Rechts",
  "0114": "Zweigniederlassung ausl. Gesellschaft",
  "0115": "Zweigniederlassung ausl. Gesellschaft",
  "0116": "Öffentl. Verwaltung",
  "0117": "Ausländische Rechtsform",
  "0118": "Nicht zugeteilt",
  "0151": "Einzelunternehmen",
  "0152": "Einfache Gesellschaft",
  "0220": "Kantonale Verwaltung",
  "0221": "Bezirksverwaltung",
  "0222": "Gemeindeverwaltung",
  "0223": "Öffentl.-rechtl. Körperschaft",
  "0224": "Öffentl.-rechtl. Anstalt",
  "0230": "Schweizerische Botschaft",
  "0231": "Schweizerisches Konsulat",
  "0232": "Ausländische Botschaft",
  "0233": "Ausländisches Konsulat",
  "0234": "Internationale Organisation",
  "0302": "Nicht def. Rechtsform",
  "0312": "Nicht def. Rechtsform",
  "0327": "Nicht def. Rechtsform",
};

// Map legal form code to dropdown value used in Onboarding
function legalFormToDropdown(code: string): string {
  const text = LEGAL_FORM_MAP[code] || "";
  if (text.includes("AG") || text.includes("Aktiengesellschaft")) return "AG";
  if (text.includes("GmbH")) return "GmbH";
  if (text.includes("Einzelunternehmen")) return "Einzelunternehmen";
  if (text.includes("Kollektivgesellschaft")) return "Kollektivgesellschaft";
  if (text.includes("Kommanditgesellschaft")) return "Kommanditgesellschaft";
  if (text.includes("Genossenschaft")) return "Genossenschaft";
  if (text.includes("Verein")) return "Verein";
  if (text.includes("Stiftung")) return "Stiftung";
  return "Andere";
}

function formatUid(category: string, id: string): string {
  // Format: CHE-XXX.XXX.XXX
  const padded = id.padStart(9, "0");
  return `${category}-${padded.slice(0, 3)}.${padded.slice(3, 6)}.${padded.slice(6, 9)}`;
}

export interface UidSearchResult {
  name: string;
  legalName: string;
  uid: string;
  uidFormatted: string;
  legalForm: string;
  legalFormCode: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  town: string;
  canton: string;
  vatNumber: string;
  vatStatus: string;
}

function buildSearchEnvelope(organisationName: string, maxResults: number = 10): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:uid="http://www.uid.admin.ch/xmlns/uid-wse"
               xmlns:v5="http://www.uid.admin.ch/xmlns/uid-wse/5"
               xmlns:shared="http://www.uid.admin.ch/xmlns/uid-wse-shared/2">
  <soap:Body>
    <uid:Search>
      <uid:searchParameters>
        <v5:uidEntitySearchParameters>
          <v5:organisationName>${escapeXml(organisationName)}</v5:organisationName>
        </v5:uidEntitySearchParameters>
      </uid:searchParameters>
      <uid:config>
        <shared:searchMode>Auto</shared:searchMode>
        <shared:maxNumberOfRecords>${maxResults}</shared:maxNumberOfRecords>
        <shared:searchNameAndAddressHistory>false</shared:searchNameAndAddressHistory>
      </uid:config>
    </uid:Search>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractText(xml: string, tag: string): string {
  // Extract text between tags, ignoring namespace prefixes
  const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${tag}>`, "g");
  const match = regex.exec(xml);
  return match ? match[1].trim() : "";
}

function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  const regex = /<(?:[a-zA-Z0-9]+:)?uidEntitySearchResultItem[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?uidEntitySearchResultItem>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

function parseItem(itemXml: string): UidSearchResult {
  const uidCategory = extractText(itemXml, "uidOrganisationIdCategorie");
  const uidId = extractText(itemXml, "uidOrganisationId");
  const legalFormCode = extractText(itemXml, "legalForm");

  // Extract address fields - need to be careful with multiple occurrences
  const street = extractText(itemXml, "street");
  const houseNumber = extractText(itemXml, "houseNumber");
  const town = extractText(itemXml, "town");
  const zipCode = extractText(itemXml, "swissZipCode");
  const canton = extractText(itemXml, "cantonAbbreviation");

  // Extract VAT info
  const vatStatus = extractText(itemXml, "vatStatus");

  // organisationName and organisationLegalName
  const orgName = extractText(itemXml, "organisationName");
  const legalName = extractText(itemXml, "organisationLegalName");

  return {
    name: orgName,
    legalName: legalName || orgName,
    uid: uidId,
    uidFormatted: uidCategory && uidId ? formatUid(uidCategory, uidId) : "",
    legalForm: legalFormToDropdown(legalFormCode),
    legalFormCode,
    street: houseNumber ? `${street} ${houseNumber}` : street,
    houseNumber,
    zipCode,
    town,
    canton,
    vatNumber: uidCategory && uidId ? formatUid(uidCategory, uidId) + " MWST" : "",
    vatStatus: vatStatus === "2" ? "active" : vatStatus === "3" ? "inactive" : "unknown",
  };
}

export async function searchCompanies(name: string, maxResults: number = 10): Promise<UidSearchResult[]> {
  if (!name || name.trim().length < 2) {
    return [];
  }

  const envelope = buildSearchEnvelope(name.trim(), maxResults);

  const response = await fetch(UID_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": SOAP_ACTION_SEARCH,
    },
    body: envelope,
  });

  if (!response.ok) {
    const text = await response.text();
    // Check for SOAP fault
    if (text.includes("Data_validation_failed") || text.includes("No_data_found")) {
      return [];
    }
    throw new Error(`UID API error: ${response.status}`);
  }

  const xml = await response.text();

  // Check for no results
  if (xml.includes("No_data_found") || !xml.includes("uidEntitySearchResultItem")) {
    return [];
  }

  const items = extractAllItems(xml);
  return items.map(parseItem);
}
