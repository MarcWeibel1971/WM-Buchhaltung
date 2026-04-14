// One-time migration: fix documentType for existing documents based on AI metadata and filename
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const VALID_DOC_TYPES = ["invoice_in", "invoice_out", "receipt", "bank_statement", "other"];

function detectTypeFromFilename(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes("kreditkartenabrechnung") || lower.includes("visa")) return "bank_statement";
  if (lower.includes("rechnung") || lower.includes("rg") || lower.includes("invoice")) return "invoice_in";
  if (lower.includes("quittung") || lower.includes("receipt") || lower.includes("kassenbon")) return "receipt";
  if (lower.includes("kontoauszug") || lower.includes("bank statement")) return "bank_statement";
  return null;
}

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Get all documents with type "other"
  const [rows] = await conn.execute(
    "SELECT id, filename, aiMetadata, documentType FROM documents WHERE documentType = 'other'"
  );
  
  console.log(`Found ${rows.length} documents with type "other"`);
  let updated = 0;
  
  for (const row of rows) {
    let newType = null;
    
    // Try AI metadata first
    if (row.aiMetadata) {
      try {
        const meta = JSON.parse(row.aiMetadata);
        if (meta.documentType && VALID_DOC_TYPES.includes(meta.documentType) && meta.documentType !== "other") {
          newType = meta.documentType;
        }
      } catch { /* ignore */ }
    }
    
    // Fallback to filename detection
    if (!newType) {
      newType = detectTypeFromFilename(row.filename);
    }
    
    if (newType && newType !== "other") {
      await conn.execute(
        "UPDATE documents SET documentType = ? WHERE id = ?",
        [newType, row.id]
      );
      console.log(`  Doc #${row.id} (${row.filename}): "other" → "${newType}"`);
      updated++;
    } else {
      console.log(`  Doc #${row.id} (${row.filename}): kept as "other"`);
    }
  }
  
  console.log(`\nMigration complete! Updated ${updated} of ${rows.length} documents.`);
  await conn.end();
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
