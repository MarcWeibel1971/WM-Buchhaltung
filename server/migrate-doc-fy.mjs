// One-time migration: set fiscalYear on existing documents based on their createdAt date
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Get all documents without a fiscal year
  const [rows] = await conn.execute(
    "SELECT id, createdAt, filename FROM documents WHERE fiscalYear IS NULL"
  );
  
  console.log(`Found ${rows.length} documents without fiscal year`);
  
  for (const row of rows) {
    const year = new Date(row.createdAt).getFullYear();
    await conn.execute(
      "UPDATE documents SET fiscalYear = ? WHERE id = ?",
      [year, row.id]
    );
    console.log(`  Set doc #${row.id} (${row.filename}) → GJ ${year}`);
  }
  
  console.log("Migration complete!");
  await conn.end();
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
