import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Update the booking rule template to remove "Fremdhonorar" and "{period}"
console.log("=== Updating Booking Rules ===");
await conn.execute(
  "UPDATE booking_rules SET bookingTextTemplate = 'Gewerbe-Treuhand' WHERE counterpartyPattern LIKE '%Gewerbe-Treuhand%'"
);
console.log("Updated booking rules for Gewerbe-Treuhand");

// 2. Get all Gewerbe-Treuhand transactions
const [txns] = await conn.execute(
  "SELECT bt.id, bt.description, bt.suggestedBookingText, bt.matchedDocumentId, d.filename, d.aiMetadata FROM bank_transactions bt LEFT JOIN documents d ON bt.matchedDocumentId = d.id WHERE bt.counterparty LIKE '%Gewerbe%' AND bt.status = 'pending'"
);

console.log(`\n=== Updating ${txns.length} Gewerbe-Treuhand Transactions ===`);
for (const tx of txns) {
  let customerName = "";
  
  // Try to extract customer name from matched document filename
  if (tx.filename) {
    // "Gewerbe-Treuhand RG722597 Manser Urs.pdf" -> "Manser Urs"
    const fnMatch = tx.filename.match(/Gewerbe[\-\s]?Treuhand\s+\S+\s+(.+?)\.(pdf|jpg|png)/i);
    if (fnMatch) customerName = fnMatch[1].trim();
  }
  
  // Also try from AI metadata description
  if (!customerName && tx.aiMetadata) {
    try {
      const meta = JSON.parse(tx.aiMetadata);
      // e.g. "Finanzbuchhaltung 2024 und 2025 für Urs Manser"
      const descMatch = (meta.description ?? "").match(/für\s+(.+)/i);
      if (descMatch) customerName = descMatch[1].trim();
    } catch {}
  }
  
  const newText = customerName ? `Gewerbe-Treuhand ${customerName}` : "Gewerbe-Treuhand";
  
  console.log(`TX ${tx.id}: "${tx.description}" -> "${newText}"`);
  await conn.execute(
    "UPDATE bank_transactions SET description = ?, suggestedBookingText = ? WHERE id = ?",
    [newText, newText, tx.id]
  );
}

console.log("\nDone!");
await conn.end();
