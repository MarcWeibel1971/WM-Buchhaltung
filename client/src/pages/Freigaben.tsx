/**
 * Freigaben-Seite: Wrapper um die bestehende Journal-Seite
 * Zeigt standardmässig die ausstehenden Buchungen (pending).
 * Die Journal-Seite enthält bereits alle Freigabe-Funktionalität.
 */
import Journal from "./Journal";

export default function Freigaben() {
  return <Journal />;
}
