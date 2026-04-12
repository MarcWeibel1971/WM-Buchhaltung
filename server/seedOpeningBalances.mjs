/**
 * Seed opening balances for fiscal year 2026 from Eröffnungsbilanz per 01.01.2026
 * 
 * Eröffnungsbuchung: Each account gets a journal entry line.
 * Aktiven (assets) → Soll (debit)
 * Passiven (liabilities/equity) → Haben (credit)
 * 
 * We create one Sammelbuchung (compound entry) with all lines.
 */
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Account mappings: number → { id, amount, side }
  const openingBalances = [
    // AKTIVEN (Soll/debit)
    { number: '1000', id: 1,  amount: '280.05',    side: 'debit' },
    { number: '1010', id: 2,  amount: '13609.35',  side: 'debit' },
    { number: '1050', id: 8,  amount: '91500.00',  side: 'debit' },
    { number: '1051', id: 9,  amount: '35000.00',  side: 'debit' },
    { number: '1080', id: 13, amount: '87768.05',  side: 'debit' },
    { number: '1090', id: 16, amount: '16355.09',  side: 'debit' },
    { number: '1110', id: 17, amount: '1300.00',   side: 'debit' },
    { number: '1111', id: 18, amount: '400.00',    side: 'debit' },
    { number: '1113', id: 19, amount: '9400.00',   side: 'debit' },
    { number: '1200', id: 20, amount: '850000.00', side: 'debit' },
    // PASSIVEN (Haben/credit)
    { number: '2000', id: 21, amount: '7828.05',   side: 'credit' },
    { number: '2010', id: 22, amount: '50000.00',  side: 'credit' },
    { number: '2020', id: 23, amount: '87000.00',  side: 'credit' },
    { number: '2035', id: 25, amount: '150000.00', side: 'credit' },
    { number: '2051', id: 27, amount: '200000.00', side: 'credit' },
    { number: '2052', id: 28, amount: '200000.00', side: 'credit' },
    { number: '2053', id: 29, amount: '200000.00', side: 'credit' },
    { number: '2079', id: 30, amount: '20000.00',  side: 'credit' },
    { number: '2090', id: 31, amount: '26288.38',  side: 'credit' },
    { number: '2200', id: 32, amount: '100000.00', side: 'credit' },
    { number: '2220', id: 33, amount: '50000.00',  side: 'credit' },
    { number: '2290', id: 34, amount: '14496.11',  side: 'credit' },
  ];

  // Verify totals
  const totalDebit = openingBalances
    .filter(b => b.side === 'debit')
    .reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalCredit = openingBalances
    .filter(b => b.side === 'credit')
    .reduce((s, b) => s + parseFloat(b.amount), 0);

  console.log(`Total Soll (Aktiven):  ${totalDebit.toFixed(2)}`);
  console.log(`Total Haben (Passiven): ${totalCredit.toFixed(2)}`);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.error('ERROR: Soll != Haben! Aborting.');
    process.exit(1);
  }
  console.log('✓ Bilanz stimmt: Soll = Haben');

  // Get next entry number
  const [maxEntry] = await conn.execute(
    "SELECT MAX(CAST(REPLACE(entryNumber, '2026-', '') AS UNSIGNED)) as maxNum FROM journal_entries WHERE fiscalYear = 2026"
  );
  const nextNum = (maxEntry[0]?.maxNum || 0) + 1;
  const entryNumber = `2026-${String(nextNum).padStart(5, '0')}`;

  // Create the journal entry
  const [result] = await conn.execute(
    `INSERT INTO journal_entries (entryNumber, bookingDate, valueDate, description, status, source, fiscalYear) 
     VALUES (?, '2026-01-01', '2026-01-01', 'Eröffnungsbilanz per 01.01.2026', 'approved', 'system', 2026)`,
    [entryNumber]
  );
  const entryId = result.insertId;
  console.log(`\nJournal entry created: ID=${entryId}, Number=${entryNumber}`);

  // Insert all lines
  for (const bal of openingBalances) {
    await conn.execute(
      `INSERT INTO journal_lines (entryId, accountId, side, amount, description) VALUES (?, ?, ?, ?, ?)`,
      [entryId, bal.id, bal.side, bal.amount, `Eröffnungssaldo ${bal.number}`]
    );
    console.log(`  ${bal.number}: ${bal.side === 'debit' ? 'Soll' : 'Haben'} CHF ${bal.amount}`);
  }

  console.log(`\n✓ ${openingBalances.length} Eröffnungsbuchungszeilen erstellt`);
  console.log(`  Total Aktiven:  CHF ${totalDebit.toFixed(2)}`);
  console.log(`  Total Passiven: CHF ${totalCredit.toFixed(2)}`);

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
