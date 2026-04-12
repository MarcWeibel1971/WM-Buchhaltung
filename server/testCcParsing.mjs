import mysql from 'mysql2/promise';

const c = await mysql.createConnection(process.env.DATABASE_URL);

// Load rules and accounts
const [rules] = await c.query('SELECT counterpartyPattern, debitAccountId FROM booking_rules WHERE isActive = 1 ORDER BY priority DESC, usageCount DESC');
const [accts] = await c.query('SELECT id, number, name, accountType FROM accounts WHERE isActive = 1 ORDER BY sortOrder');

const acctMap = {};
accts.forEach(a => { acctMap[a.id] = { number: a.number, name: a.name }; });

const rulesContext = rules
  .filter(r => r.debitAccountId && acctMap[r.debitAccountId])
  .map(r => `${r.counterpartyPattern} → ${acctMap[r.debitAccountId].number} ${acctMap[r.debitAccountId].name}`)
  .join('\n');

const accountList = accts
  .filter(a => a.number.startsWith('4') || a.number.startsWith('1'))
  .map(a => `${a.number} ${a.name}`)
  .join('\n');

console.log('Rules count:', rules.length);
console.log('Account count:', accts.filter(a => a.number.startsWith('4') || a.number.startsWith('1')).length);

const prompt = `Du bist Buchhalter der WM Weibel Mueller AG in der Schweiz.
Analysiere diese Kreditkartenabrechnung (VISA Cornèr Banca SA) und extrahiere ALLE Einzelpositionen/Transaktionen.

WICHTIG:
- Jede Zeile in der Abrechnung ist eine separate Transaktion
- Extrahiere ALLE Transaktionen, überspringe keine
- Das Datum steht links (Format DD.MM.YYYY), dann der Beschreibungstext, dann der Betrag rechts
- Beträge sind in CHF, verwende den Absolutwert (ohne Minus)
- Ignoriere Zeilen wie "Saldo Vormonat", "Zahlung", "Neuer Saldo", "Total" – nur echte Einkäufe/Transaktionen
- Die Beschreibung soll den Vendor/Händler-Namen enthalten, NICHT die ganze Zeile kopieren

GELERNTE KONTENZUORDNUNGEN (verwende diese als Priorität!):
${rulesContext}

VOLLSTÄNDIGER KONTENPLAN (falls kein gelernter Match):
${accountList}

FALLBACK-REGELN:
- Software/SaaS/Cloud → 4305 Software & ITBeratung mw
- Restaurant/Essen auswärts (geschäftlich) → 4891 Repräsentationsspesen mw
- Restaurant/Essen (privat) → 1081 Kontokorrent mw
- Reisen/Transport/SBB/Taxi/Uber/Parkhaus → 4821 Reisespesen mw
- Bücher/Zeitungen/Medien → 4711 Fachliteratur mw
- Lebensmittel/Migros/Coop/Aldi → 4792 Übriger Betriebs- und Verwaltungsaufwand jm
- Kleidung/Shopping (privat) → 1081 Kontokorrent mw
- Bankgebühren/Kartengebühren → 4222 Bankspesen mw
- Zinsen → 4220 Zinsen
- Unbekannt → 4799 Diverser Aufwand

Antwort NUR als JSON-Array, keine Erklärung:
[{"date": "YYYY-MM-DD", "description": "Vendor/Händler Kurzbeschreibung", "amount": "123.45", "suggestedAccount": "4xxx Kontoname"}]`;

// Call LLM
const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

const resp = await fetch(`${apiUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'file_url', file_url: { url: 'https://d2xsxph8kpxj0f.cloudfront.net/114467201/g3uYPYRzWxJLqW5bmLAtac/VISAKreditkartenabrechnungen2025_48cc6093.pdf', mime_type: 'application/pdf' } },
      ],
    }],
  }),
});

const data = await resp.json();
const text = data.choices?.[0]?.message?.content || '';
const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);

if (jsonMatch) {
  const items = JSON.parse(jsonMatch[0]);
  console.log(`\nExtracted ${items.length} items:`);
  items.forEach((i, idx) => console.log(`${idx+1}. ${i.date} | ${i.description} | CHF ${i.amount} → ${i.suggestedAccount}`));
} else {
  console.log('No JSON found. Raw response:', text.substring(0, 1000));
}

await c.end();
