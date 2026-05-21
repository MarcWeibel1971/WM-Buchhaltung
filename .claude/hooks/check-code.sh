#!/usr/bin/env bash
# check-code.sh — Rippletide Hook
# Prüft generierten Code auf Regelverstösse bevor er geschrieben wird.
# Bei Verstoss: Ausgabe der Verletzung → Claude schreibt automatisch um.

set -euo pipefail

# Lese den generierten Code aus stdin (übergeben von Claude Code)
CODE=$(cat)

VIOLATIONS=()

# Regel: Kein raw process.env ausserhalb von Env.ts
if echo "$CODE" | grep -qE 'process\.env\.[A-Z_]+' 2>/dev/null; then
  FILE_HINT=$(echo "$CODE" | grep -oE 'process\.env\.[A-Z_]+' | head -3 | tr '\n' ', ')
  VIOLATIONS+=("VERSTOSS: process.env direkt verwendet ($FILE_HINT) — Env-Variablen müssen in src/libs/Env.ts deklariert werden.")
fi

# Regel: Kein TypeScript 'any'
if echo "$CODE" | grep -qE ':\s*any\b|as\s+any\b' 2>/dev/null; then
  VIOLATIONS+=("VERSTOSS: TypeScript 'any' verwendet — stattdessen 'unknown' mit Type Guard oder explizite Typen verwenden.")
fi

# Regel: Kein console.log in Produktionscode (ausser mit TODO-Kommentar)
if echo "$CODE" | grep -qE 'console\.log\(' 2>/dev/null; then
  if ! echo "$CODE" | grep -qE '//\s*TODO.*console\.log|console\.log.*//\s*TODO' 2>/dev/null; then
    VIOLATIONS+=("VERSTOSS: console.log() in Produktionscode — entfernen oder mit '// TODO: remove' markieren.")
  fi
fi

# Regel: API-Routen ohne auth()-Check
if echo "$CODE" | grep -qE 'export async function (GET|POST|PUT|DELETE|PATCH)' 2>/dev/null; then
  if ! echo "$CODE" | grep -qE "auth\(\)" 2>/dev/null; then
    VIOLATIONS+=("VERSTOSS: API-Route ohne auth()-Aufruf — jede Route muss auth() von @clerk/nextjs/server aufrufen.")
  fi
fi

# Regel: Steuerberechnung nicht über Modul
if echo "$CODE" | grep -qiE '(einkommenssteuer|kantonsteuer|bundessteuer).*=.*[0-9]' 2>/dev/null; then
  if ! echo "$CODE" | grep -qE 'berechneEinkommenssteuer|@/modules/steuer' 2>/dev/null; then
    VIOLATIONS+=("VERSTOSS: Steuerberechnung nicht über berechneEinkommenssteuer() aus @/modules/steuer.")
  fi
fi

# Ausgabe der Verstösse
if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
  echo "⚠️  Rippletide hat ${#VIOLATIONS[@]} Regelverstoss/-verstösse gefunden:"
  echo ""
  for v in "${VIOLATIONS[@]}"; do
    echo "  • $v"
  done
  echo ""
  echo "Bitte den Code anpassen und die Regeln in .rippletide/selected-rules.md beachten."
  exit 1
fi

exit 0
