/**
 * Seed CC booking rules from all 2025 VISA credit card statements.
 * Extracted from VISAKreditkartenabrechnungen2025.pdf (6 pages, ~300 line items).
 * 
 * Each rule maps a vendor name pattern to a debit account number.
 * Credit account is always 1082 (Durchlaufkonto VISA mw).
 * 
 * Uses upsert: if a rule for the same vendor already exists, it updates the account
 * and increments the usage count.
 */
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Complete vendor → account mappings from all 6 pages
  // Format: [vendorPattern, accountNumber, description]
  const mappings = [
    // 4891 - Repräsentation / Restaurants (gehobene Gastronomie)
    ['Barbatti', '4891', 'Restaurant Barbatti'],
    ['Villa Schweizerhof', '4891', 'Hotel/Restaurant Villa Schweizerhof'],
    ['Rest. Herrenboden', '4891', 'Restaurant Herrenboden'],
    ['Conditorei Schelbert', '4891', 'Conditorei Schelbert'],
    ['Rest. Rossstall', '4891', 'Restaurant Rossstall'],
    ['Hotel Cascada', '4891', 'Hotel Cascada'],
    ['Jazz Kantine', '4891', 'Jazz Kantine'],
    ['Suite-Smallplates', '4891', 'Suite-Smallplates & Cock'],
    ['Rest. Perlen', '4891', 'Restaurant Perlen'],
    ['Rest. Schwanen', '4891', 'Restaurant Schwanen'],
    ['Rest. Ochsen', '4891', 'Restaurant Ochsen'],
    ['La Bonne Cave', '4891', 'La Bonne Cave'],
    ['Rest. Barbatti', '4891', 'Restaurant Barbatti (alt)'],

    // 1081 - Privatbezüge / Einkäufe
    ['Moonpay', '1081', 'Moonpay Crypto'],
    ['Under Armour', '1081', 'Under Armour'],
    ['Fruugo', '1081', 'Fruugo Online Shop'],
    ['Manufactum', '1081', 'Manufactum'],
    ['Zalando', '1081', 'Zalando'],
    ['Schweizer Modewelt', '1081', 'Schweizer Modewelt'],
    ['Brasserie Bodu', '1081', 'Brasserie Bodu'],
    ['Rest. Portofino', '1081', 'Restaurant Portofino'],
    ['Musik Hug', '1081', 'Musik Hug'],
    ['Rest. Stadtkeller', '1081', 'Restaurant Stadtkeller'],
    ['Mode Mobile', '1081', 'Mode Mobile Investment'],
    ['Josephinenhütte', '1081', 'Josephinenhütte'],
    ['Coop Disentis', '1081', 'Coop Disentis'],
    ['Aeropuerto Tenerife', '1081', 'Aeropuerto Tenerife'],
    ['Markthalle Luzern', '1081', 'Markthalle Luzern'],

    // 4821 - Reisespesen / Transport
    ['Uber', '4821', 'Uber Fahrten'],
    ['SBB', '4821', 'SBB Bahnreisen'],
    ['Hauser Parking', '4821', 'Hauser Parking'],
    ['Ecarup', '4821', 'Ecarup Ladestrom'],
    ['ecarup', '4821', 'Ecarup Ladestrom (klein)'],
    ['PH Seehof', '4821', 'Parkhaus Seehof'],
    ['Parkhaus National', '4821', 'Parkhaus National'],
    ['Parkhaus Bahnhofplat', '4821', 'Parkhaus Bahnhofplatz'],
    ['Mobility', '4821', 'Mobility Carsharing'],
    ['Express Limousine', '4821', 'Express Limousine'],

    // 4305 - Informatik / Software / SaaS
    ['Adobe', '4305', 'Adobe Software'],
    ['Perplexity', '4305', 'Perplexity AI'],
    ['bexio', '4305', 'bexio Buchhaltung'],
    ['Envato', '4305', 'Envato Marketplace'],
    ['I/O Fund', '4305', 'I/O Fund'],
    ['Docusign', '4305', 'Docusign'],
    ['docusign', '4305', 'Docusign (klein)'],
    ['Galaxy AI', '4305', 'Galaxy AI'],
    ['GoDaddy', '4305', 'GoDaddy Hosting'],
    ['DeepL', '4305', 'DeepL Übersetzer'],
    ['Banana', '4305', 'Banana Buchhaltung'],
    ['Beautiful.AI', '4305', 'Beautiful.AI Präsentationen'],
    ['Steamgames', '4305', 'Steam Games'],
    ['Midjourney', '4305', 'Midjourney AI'],
    ['Manus AI', '4305', 'Manus AI'],
    ['Paddle.net', '4305', 'Paddle.net Payment'],
    ['Microsoft', '4305', 'Microsoft Software'],
    ['Moby.co', '4305', 'Moby.co'],
    ['IA Rotation Model', '4305', 'IA Rotation Model'],
    ['IA-Rotation Model', '4305', 'IA-Rotation Model'],
    ['Techsmith', '4305', 'Techsmith Software'],
    ['Portfolio BIG', '4305', 'Portfolio BIG'],
    ['Twilio', '4305', 'Twilio API'],
    ['Dropbox', '4305', 'Dropbox Cloud'],
    ['EODHD', '4305', 'EODHD Finanzdaten'],
    ['EODH', '4305', 'EODH Finanzdaten'],
    ['Fiscal.AI', '4305', 'Fiscal.AI'],

    // 4711 - Zeitungen / Bücher / Medien
    ['Brither with Herbert', '4711', 'Brither with Herbert'],
    ['Orell Füssli', '4711', 'Orell Füssli Bücher'],
    ['Tom Walker', '4711', 'Tom Walker'],
    ['Republik', '4711', 'Republik Magazin'],
    ['NZZ', '4711', 'NZZ Zeitung'],

    // 4792 - Lebensmittel / Detailhandel
    ['Confiseur Bachmann', '4792', 'Confiseur Bachmann'],
    ['Elvetino', '4792', 'Elvetino Bahnverpflegung'],
    ['Migros', '4792', 'Migros Einkauf'],
    ['Kost + Brechbühl', '4792', 'Kost + Brechbühl'],
    ['Rundung', '4792', 'Rundungsdifferenz'],
    ['Yooji', '4792', 'Yooji\'s Passage'],
    ['N-Security', '4792', 'N-Security GmbH'],
    ['Aldi', '4792', 'Aldi Einkauf'],
    ['Marché Gunzgen', '4792', 'Marché Gunzgen'],
    ['Migros Schweizerhof', '4792', 'Migros Schweizerhof'],
    ['Conditorei Schelbert', '4792', 'Conditorei Schelbert (Lebensmittel)'],

    // 4720 - Versicherungen / Klara
    ['Klara', '4720', 'Klara Versicherung/Admin'],

    // 4222 - Bankgebühren
    ['Jahresbeitrag Karte', '4222', 'VISA Jahresbeitrag'],

    // 4220 - Zinsen
    ['Sollzinsen', '4220', 'VISA Sollzinsen'],

    // 4701 - Elektronik
    ['Interdiscount', '4701', 'Interdiscount Elektronik'],

    // 4300 - digitec
    ['digitec', '4300', 'digitec Elektronik'],

    // 4811 - La Bonne Cave (Wein)
    ['La Bonne Cave', '4811', 'La Bonne Cave Wein'],
  ];

  // Load account IDs by number
  const [accounts] = await conn.execute('SELECT id, number FROM accounts');
  const acctMap = {};
  for (const a of accounts) {
    acctMap[a.number] = a.id;
  }

  // Get credit account 1082 (Durchlaufkonto VISA mw)
  const creditAccountId = acctMap['1082'];
  if (!creditAccountId) {
    console.error('ERROR: Account 1082 not found!');
    process.exit(1);
  }
  console.log(`Credit account 1082 (Durchlaufkonto VISA mw): ID=${creditAccountId}`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const [vendor, acctNum, desc] of mappings) {
    const debitAccountId = acctMap[acctNum];
    if (!debitAccountId) {
      console.warn(`  SKIP: Account ${acctNum} not found for "${vendor}"`);
      skipped++;
      continue;
    }

    // Normalize vendor pattern for matching
    const pattern = vendor.toLowerCase().trim();

    // Check if rule already exists
    const [existing] = await conn.execute(
      'SELECT id, usageCount FROM booking_rules WHERE counterpartyPattern = ?',
      [pattern]
    );

    if (existing.length > 0) {
      // Update existing rule: increment usage count, update account if different
      await conn.execute(
        `UPDATE booking_rules 
         SET debitAccountId = ?, creditAccountId = ?, 
             usageCount = usageCount + 1, updatedAt = NOW()
         WHERE id = ?`,
        [debitAccountId, creditAccountId, existing[0].id]
      );
      updated++;
    } else {
      // Insert new rule
      await conn.execute(
        `INSERT INTO booking_rules 
         (counterpartyPattern, bookingTextTemplate, debitAccountId, creditAccountId, usageCount, priority)
         VALUES (?, ?, ?, ?, 1, 50)`,
        [pattern, `VISA, ${vendor}`, debitAccountId, creditAccountId]
      );
      inserted++;
    }
  }

  console.log(`\n✓ Booking rules seeded from 2025 VISA statements:`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);

  // Show total rules count
  const [total] = await conn.execute('SELECT COUNT(*) as cnt FROM booking_rules');
  console.log(`  Total rules in DB: ${total[0].cnt}`);

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
