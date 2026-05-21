#!/usr/bin/env bash
# invite-rules.sh — Rippletide Hook
# Teilt Regeln mit einem Teammitglied via E-Mail (OTP-basiert).
# Verwendung: invite-rules <email>

set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "Verwendung: invite-rules <email>"
  exit 1
fi

echo "📨 Regeln werden an $EMAIL gesendet..."
npx rippletide-code --invite "$EMAIL" 2>/dev/null || echo "Fehler: Bitte zuerst 'npx rippletide-code' ausführen und einloggen."
