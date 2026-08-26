/**
 * Bank-Seite: Wrapper um die bestehende BankImport-Seite
 * Die BankImport-Seite enthält bereits Kreditkarten-Integration,
 * Matching, Bulk-Approval etc.
 */
import BankImport from "./BankImport";

export default function Bank() {
  return <BankImport />;
}
