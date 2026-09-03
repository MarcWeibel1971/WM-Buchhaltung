#!/usr/bin/env bash
# check-code.sh — Rippletide Hook (WM-Buchhaltung)
# Prüft generierten Code auf Regelverstösse bevor er geschrieben wird.
# Bei Verstoss: Ausgabe der Verletzung → Claude schreibt automatisch um.

set -euo pipefail

# Lese den generierten Code aus stdin (übergeben von Claude Code)
CODE=$(cat)

VIOLATIONS=()

# Regel: Kein raw process.env ausserhalb von server/_core/env.ts
if echo "$CODE" | grep -qE 'process\.env\.[A-Z_]+' 2>/dev/null; then
  if ! echo "$CODE" | grep -qE '_core/env\.ts|drizzle\.config|vite\.config|scripts/' 2>/dev/null; then
    FILE_HINT=$(echo "$CODE" | grep -oE 'process\.env\.[A-Z_]+' | head -3 | tr '\n' ', ')
    VIOLATIONS+=("VERSTOSS: process.env direkt verwendet ($FILE_HINT) — Env-Variablen gehören in server/_core/env.ts (ENV) und .env.example.")
  fi
fi

# Regel: Kein TypeScript 'any'
if echo "$CODE" | grep -qE ':\s*any\b|as\s+any\b' 2>/dev/null; then
  VIOLATIONS+=("VERSTOSS: TypeScript 'any' verwendet — stattdessen 'unknown' mit Type Guard oder explizite Typen verwenden.")
fi

# Regel: Kein console.log in Produktionscode (ausser mit TODO-Kommentar)
if echo "$CODE" | grep -qE 'console\.log\(' 2>/dev/null; then
  if ! echo "$CODE" | grep -qE '//\s*TODO.*console\.log|console\.log.*//\s*TODO' 2>/dev/null; then
    VIOLATIONS+=("VERSTOSS: console.log() in Produktionscode — createLogger() aus server/_core/logger.ts verwenden.")
  fi
fi

# Regel: Org-Daten nur über orgProcedure (protectedProcedure hat keinen Mandantenfilter)
if echo "$CODE" | grep -qE 'protectedProcedure' 2>/dev/null; then
  if echo "$CODE" | grep -qE 'journalEntries|journalLines|documents|bankTransactions|invoices|accounts|employees|payrollEntries' 2>/dev/null; then
    VIOLATIONS+=("VERSTOSS: protectedProcedure greift auf organisationsbezogene Tabellen zu — orgProcedure verwenden und ctx.organizationId filtern.")
  fi
fi

# Regel: Kein z.any() in tRPC-Inputs
if echo "$CODE" | grep -qE 'z\.any\(\)' 2>/dev/null; then
  VIOLATIONS+=("VERSTOSS: z.any() in Zod-Schema — Input explizit typisieren.")
fi

# Regel: E-Mail-Links nicht aus input.origin bauen
if echo "$CODE" | grep -qE 'input\.origin\}' 2>/dev/null; then
  VIOLATIONS+=("VERSTOSS: Link aus input.origin gebaut — resolvePublicOrigin(ctx.req, input.origin) aus server/_core/publicUrl.ts verwenden.")
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
