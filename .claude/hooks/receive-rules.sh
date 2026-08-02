#!/usr/bin/env bash
# receive-rules.sh — Rippletide Hook
# Empfängt geteilte Regeln via OTP.
# Verwendung: receive-rules <otp>

set -euo pipefail

OTP="${1:-}"
if [[ -z "$OTP" ]]; then
  echo "Verwendung: receive-rules <otp>"
  exit 1
fi

echo "📥 Regeln werden empfangen (OTP: $OTP)..."
npx rippletide-code --receive "$OTP" 2>/dev/null || echo "Fehler: Bitte zuerst 'npx rippletide-code' ausführen und einloggen."
