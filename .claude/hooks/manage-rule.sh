#!/usr/bin/env bash
# manage-rule.sh — Rippletide Hook
# Verwaltet Regeln in .rippletide/selected-rules.md
# Verwendung: manage-rule add "Neue Regel" | manage-rule list | manage-rule sync

set -euo pipefail

RULES_FILE="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")/.rippletide/selected-rules.md"
ACTION="${1:-list}"

case "$ACTION" in
  add)
    RULE="${2:-}"
    if [[ -z "$RULE" ]]; then
      echo "Verwendung: manage-rule add \"Neue Regel\""
      exit 1
    fi
    echo "- $RULE" >> "$RULES_FILE"
    echo "✅ Regel hinzugefügt: $RULE"
    ;;
  list)
    echo "Aktive Regeln:"
    grep -E '^- ' "$RULES_FILE" | head -30 || echo "(keine Regeln gefunden)"
    ;;
  sync)
    # Sync mit Rippletide Cloud (erfordert Login)
    if command -v npx &>/dev/null; then
      npx rippletide-code --sync-only 2>/dev/null || echo "Sync fehlgeschlagen — bitte 'npx rippletide-code' ausführen."
    fi
    ;;
  *)
    echo "Unbekannte Aktion: $ACTION (verfügbar: add, list, sync)"
    exit 1
    ;;
esac
