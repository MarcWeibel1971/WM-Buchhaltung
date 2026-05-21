#!/usr/bin/env bash
# fetch-rules.sh — Rippletide Hook
# Injiziert die Projektregeln in jeden Claude Code Prompt.
# Wird automatisch vor jeder Claude-Antwort ausgeführt.

set -euo pipefail

RULES_FILE="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")/.rippletide/selected-rules.md"

if [[ -f "$RULES_FILE" ]]; then
  echo "## Aktive Projektregeln (Rippletide)"
  echo ""
  cat "$RULES_FILE"
  echo ""
fi
