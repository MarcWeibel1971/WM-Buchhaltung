/**
 * Belege-Seite: Wrapper um die bestehende Documents-Seite
 * mit neuen Status-Tabs und KI-Workflow-Sichtbarkeit.
 * 
 * Leitet direkt zur Documents-Seite weiter, die bereits die
 * volle Funktionalität hat (Upload, Filter, AI-Analyse, Matching).
 */
import Documents from "./Documents";

export default function Belege() {
  return <Documents />;
}
