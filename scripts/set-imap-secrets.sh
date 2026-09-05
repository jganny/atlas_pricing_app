#!/usr/bin/env bash
# Set Firebase Functions IMAP secrets from a local env file (gitignored).
# Usage:
#   1. Copy scripts/imap-secrets.env.example → scripts/imap-secrets.env
#   2. Fill passwords
#   3. ./scripts/set-imap-secrets.sh
#   4. firebase deploy --only functions:pollPricingInboxes
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${IMAP_SECRETS_FILE:-$ROOT/scripts/imap-secrets.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy scripts/imap-secrets.env.example and add passwords first."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ -z "${IMAP_PRICING_PASSWORD:-}" || -z "${IMAP_PRICINGSALES_PASSWORD:-}" ]]; then
  echo "IMAP_PRICING_PASSWORD and IMAP_PRICINGSALES_PASSWORD must be set in $ENV_FILE"
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "Install Firebase CLI first: npm i -g firebase-tools"
  exit 1
fi

echo "Setting IMAP_PRICING_PASSWORD…"
printf '%s' "$IMAP_PRICING_PASSWORD" | firebase functions:secrets:set IMAP_PRICING_PASSWORD --data-file=-

echo "Setting IMAP_PRICINGSALES_PASSWORD…"
printf '%s' "$IMAP_PRICINGSALES_PASSWORD" | firebase functions:secrets:set IMAP_PRICINGSALES_PASSWORD --data-file=-

echo "Done. Deploy the poller:"
echo "  firebase deploy --only functions:pollPricingInboxes --project vertex-35d95"
