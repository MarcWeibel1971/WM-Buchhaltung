#!/usr/bin/env bash
set -euo pipefail

schema_root="${1:-/tmp/ech0217-xsd}"
schema_file="${schema_root}/eCH-0217-2-0-0.xsd"
validator_dir="/tmp/wm-ech0217-validator"

if [[ ! -f "${schema_file}" ]]; then
  echo "eCH-0217-Schema fehlt: ${schema_file}. Zuerst pnpm tsx scripts/syncEchSchemas.ts ausführen." >&2
  exit 1
fi

if ! command -v javac >/dev/null 2>&1; then
  echo "Für die XSD-Validierung wird ein Java-JDK mit javac benötigt." >&2
  exit 1
fi

rm -rf "${validator_dir}"
mkdir -p "${validator_dir}"
javac -d "${validator_dir}" scripts/ValidateXml.java

for fixture in \
  scripts/ech0217-draft-fixture.xml \
  scripts/ech0217-effective-all-rates-fixture.xml \
  scripts/ech0217-net-tax-rate-fixture.xml \
  scripts/ech0217-flat-tax-rate-fixture.xml; do
  java -cp "${validator_dir}" ValidateXml "${schema_file}" "${fixture}"
done
