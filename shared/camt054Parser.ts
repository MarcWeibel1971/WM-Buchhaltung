/**
 * CAMT.054 (Bank-to-Customer Debit/Credit Notification) Parser
 * Parses payment confirmations from banks to reconcile with pain.001 exports.
 */

export interface Camt054Notification {
  messageId: string;
  creationDateTime: string;
  entries: Camt054Entry[];
}

export interface Camt054Entry {
  amount: number;
  currency: string;
  creditDebitIndicator: "CRDT" | "DBIT";
  status: string;
  bookingDate: string;
  valueDate?: string;
  endToEndId?: string;
  creditorName?: string;
  creditorIban?: string;
  debtorName?: string;
  debtorIban?: string;
  remittanceInfo?: string;
  reference?: string;
}

export function parseCAMT054(xmlContent: string): Camt054Notification {
  // Extract message ID
  const msgIdMatch = xmlContent.match(/<MsgId>(.*?)<\/MsgId>/);
  const creDtTmMatch = xmlContent.match(/<CreDtTm>(.*?)<\/CreDtTm>/);

  const notification: Camt054Notification = {
    messageId: msgIdMatch?.[1] ?? "unknown",
    creationDateTime: creDtTmMatch?.[1] ?? "",
    entries: [],
  };

  // Parse each Ntfctn (Notification) block
  const ntfctnRegex = /<Ntfctn>([\s\S]*?)<\/Ntfctn>/g;
  let ntfctnMatch;
  while ((ntfctnMatch = ntfctnRegex.exec(xmlContent)) !== null) {
    const ntfctn = ntfctnMatch[1];
    
    // Parse each Ntry (Entry) block within the notification
    const entryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
    let entryMatch;
    while ((entryMatch = entryRegex.exec(ntfctn)) !== null) {
      const entry = entryMatch[1];
      
      // Parse amount
      const amtMatch = entry.match(/<Amt Ccy="([^"]+)">([\d.]+)<\/Amt>/);
      if (!amtMatch) continue;
      
      const currency = amtMatch[1];
      const amount = parseFloat(amtMatch[2]);
      
      // Credit/Debit indicator
      const cdtDbtMatch = entry.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/);
      const creditDebitIndicator = (cdtDbtMatch?.[1] as "CRDT" | "DBIT") ?? "DBIT";
      
      // Status
      const statusMatch = entry.match(/<Sts>[\s\S]*?<Cd>(.*?)<\/Cd>/);
      const status = statusMatch?.[1] ?? "BOOK";
      
      // Dates
      const bookingDateMatch = entry.match(/<BookgDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);
      const valueDateMatch = entry.match(/<ValDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);
      
      if (!bookingDateMatch) continue;
      
      // Parse transaction details from TxDtls
      const txDtlsRegex = /<TxDtls>([\s\S]*?)<\/TxDtls>/g;
      let txMatch;
      const txDetails: Camt054Entry[] = [];
      
      while ((txMatch = txDtlsRegex.exec(entry)) !== null) {
        const txDtl = txMatch[1];
        
        // EndToEndId - key for matching with pain.001
        const endToEndMatch = txDtl.match(/<EndToEndId>(.*?)<\/EndToEndId>/);
        
        // Amount at transaction level (may differ from entry level for batch payments)
        const txAmtMatch = txDtl.match(/<Amt Ccy="([^"]+)">([\d.]+)<\/Amt>/);
        const txAmount = txAmtMatch ? parseFloat(txAmtMatch[2]) : amount;
        const txCurrency = txAmtMatch ? txAmtMatch[1] : currency;
        
        // Creditor info
        const creditorNameMatch = txDtl.match(/<RltdPties>[\s\S]*?<Cdtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
        const creditorIbanMatch = txDtl.match(/<RltdPties>[\s\S]*?<CdtrAcct>[\s\S]*?<IBAN>(.*?)<\/IBAN>/);
        
        // Debtor info
        const debtorNameMatch = txDtl.match(/<RltdPties>[\s\S]*?<Dbtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
        const debtorIbanMatch = txDtl.match(/<RltdPties>[\s\S]*?<DbtrAcct>[\s\S]*?<IBAN>(.*?)<\/IBAN>/);
        
        // Remittance info
        const ustrdMatch = txDtl.match(/<Ustrd>(.*?)<\/Ustrd>/);
        const strdRefMatch = txDtl.match(/<Ref>(.*?)<\/Ref>/);
        
        txDetails.push({
          amount: txAmount,
          currency: txCurrency,
          creditDebitIndicator,
          status,
          bookingDate: bookingDateMatch[1],
          valueDate: valueDateMatch?.[1],
          endToEndId: endToEndMatch?.[1],
          creditorName: creditorNameMatch?.[1]?.trim(),
          creditorIban: creditorIbanMatch?.[1]?.trim(),
          debtorName: debtorNameMatch?.[1]?.trim(),
          debtorIban: debtorIbanMatch?.[1]?.trim(),
          remittanceInfo: ustrdMatch?.[1]?.trim(),
          reference: strdRefMatch?.[1]?.trim(),
        });
      }
      
      // If no TxDtls found, create a single entry from the Ntry level
      if (txDetails.length === 0) {
        const endToEndMatch = entry.match(/<EndToEndId>(.*?)<\/EndToEndId>/);
        const creditorNameMatch = entry.match(/<Cdtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
        const creditorIbanMatch = entry.match(/<CdtrAcct>[\s\S]*?<IBAN>(.*?)<\/IBAN>/);
        const ustrdMatch = entry.match(/<Ustrd>(.*?)<\/Ustrd>/);
        
        txDetails.push({
          amount,
          currency,
          creditDebitIndicator,
          status,
          bookingDate: bookingDateMatch[1],
          valueDate: valueDateMatch?.[1],
          endToEndId: endToEndMatch?.[1],
          creditorName: creditorNameMatch?.[1]?.trim(),
          creditorIban: creditorIbanMatch?.[1]?.trim(),
          remittanceInfo: ustrdMatch?.[1]?.trim(),
        });
      }
      
      notification.entries.push(...txDetails);
    }
  }
  
  // Also handle BkToCstmrDbtCdtNtfctn format (alternative CAMT.054 structure)
  if (notification.entries.length === 0) {
    const entryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
    let entryMatch;
    while ((entryMatch = entryRegex.exec(xmlContent)) !== null) {
      const entry = entryMatch[1];
      const amtMatch = entry.match(/<Amt Ccy="([^"]+)">([\d.]+)<\/Amt>/);
      if (!amtMatch) continue;
      
      const currency = amtMatch[1];
      const amount = parseFloat(amtMatch[2]);
      const cdtDbtMatch = entry.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/);
      const bookingDateMatch = entry.match(/<BookgDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);
      const valueDateMatch = entry.match(/<ValDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);
      const endToEndMatch = entry.match(/<EndToEndId>(.*?)<\/EndToEndId>/);
      const creditorNameMatch = entry.match(/<Cdtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
      const ustrdMatch = entry.match(/<Ustrd>(.*?)<\/Ustrd>/);
      
      if (!bookingDateMatch) continue;
      
      notification.entries.push({
        amount,
        currency,
        creditDebitIndicator: (cdtDbtMatch?.[1] as "CRDT" | "DBIT") ?? "DBIT",
        status: "BOOK",
        bookingDate: bookingDateMatch[1],
        valueDate: valueDateMatch?.[1],
        endToEndId: endToEndMatch?.[1],
        creditorName: creditorNameMatch?.[1]?.trim(),
        remittanceInfo: ustrdMatch?.[1]?.trim(),
      });
    }
  }
  
  return notification;
}

/**
 * Check if the XML content is a CAMT.054 file
 */
export function isCAMT054(content: string): boolean {
  return content.includes("camt.054") || 
         content.includes("BkToCstmrDbtCdtNtfctn") ||
         (content.includes("<Document") && content.includes("<Ntfctn>"));
}
