import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.log('No DATABASE_URL'); process.exit(1); }

// Strip SSL params and add our own
const baseUrl = url.split('?')[0];

const conn = await createConnection({
  uri: baseUrl,
  ssl: { rejectUnauthorized: false }
});

// Find all payroll-related journal entries
const [entries] = await conn.execute(
  `SELECT id, description, source, booking_date, status 
   FROM journal_entries 
   WHERE description LIKE '%Lohn%' OR source = 'payroll' 
   ORDER BY booking_date 
   LIMIT 30`
);
console.log('=== Lohnbuchungen im Journal ===');
console.log(JSON.stringify(entries, null, 2));

// Check payroll_entries table
const [payrollEntries] = await conn.execute(
  `SELECT pe.*, e.code, e.first_name, e.last_name 
   FROM payroll_entries pe 
   JOIN employees e ON pe.employee_id = e.id 
   ORDER BY pe.year, pe.month 
   LIMIT 20`
);
console.log('\n=== Payroll Entries in DB ===');
console.log(JSON.stringify(payrollEntries, null, 2));

// Check employees
const [emps] = await conn.execute('SELECT id, code, first_name, last_name, ahv_number FROM employees');
console.log('\n=== Employees ===');
console.log(JSON.stringify(emps, null, 2));

await conn.end();
