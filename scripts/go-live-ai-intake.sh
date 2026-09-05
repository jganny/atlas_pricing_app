#!/usr/bin/env bash
# Go live: slim AI IMAP intake + React /app/ hosting (vertex-35d95).
#
# Run on your Mac from the atlas_pricing_app repo root:
#   chmod +x scripts/go-live-ai-intake.sh
#   ./scripts/go-live-ai-intake.sh
#
# Optional env:
#   GH_TOKEN=ghp_...          # push this branch to GitHub
#   FIREBASE_TOKEN=...        # if not already firebase login
#   SKIP_GITHUB=1             # skip git push
#   SKIP_HOSTING=1            # only redeploy the poller
#   SKIP_FUNCTIONS=1          # only hosting
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT="${FIREBASE_PROJECT:-vertex-35d95}"
BRANCH="$(git branch --show-current)"
FB=(--project "$PROJECT")
if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
  FB+=(--token "$FIREBASE_TOKEN")
fi

echo "==> Branch: ${BRANCH}"
echo "==> Project: ${PROJECT}"

if ! command -v firebase >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  echo "Install Firebase CLI: npm i -g firebase-tools"
  exit 1
fi
FIREBASE_CMD=(firebase)
if ! command -v firebase >/dev/null 2>&1; then
  FIREBASE_CMD=(npx firebase)
fi

# --- GitHub (optional) ---
if [[ "${SKIP_GITHUB:-0}" != "1" ]]; then
  TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  if [[ -n "$TOKEN" ]]; then
    echo "==> Pushing ${BRANCH} to GitHub..."
    git push "https://x-access-token:${TOKEN}@github.com/jganny/atlas_pricing_app.git" "${BRANCH}:${BRANCH}"
    echo "GitHub push done."
  else
    echo "WARN: No GH_TOKEN — skipping GitHub push."
    echo "  export GH_TOKEN=ghp_... && $0"
    echo "  Or paste a PAT and run: ./scripts/push-to-github.sh ${BRANCH}"
  fi
fi

# --- Functions: slim AI poller ---
if [[ "${SKIP_FUNCTIONS:-0}" != "1" ]]; then
  echo "==> Installing functions deps..."
  (cd functions && npm install)

  echo "==> Deploying pollPricingInboxes (slim AI intake)..."
  "${FIREBASE_CMD[@]}" deploy --only functions:pollPricingInboxes "${FB[@]}"

  echo ""
  echo "Optional AI upgrade (better classification):"
  echo "  firebase functions:secrets:set ANTHROPIC_API_KEY --project ${PROJECT}"
  echo "  firebase deploy --only functions:pollPricingInboxes --project ${PROJECT}"
  echo ""
fi

# --- Hosting: React /app/ ---
if [[ "${SKIP_HOSTING:-0}" != "1" ]]; then
  echo "==> Building React app → app/"
  ./scripts/build-react.sh

  echo "==> Deploying Firebase Hosting..."
  "${FIREBASE_CMD[@]}" deploy --only hosting "${FB[@]}"
fi

echo ""
echo "Done."
echo "  New app:  https://${PROJECT}.web.app/app/"
echo "  Mobile:   https://${PROJECT}.web.app/app/m/"
echo "  Intake:   https://${PROJECT}.web.app/app/inbox/"
echo "  Version:  https://${PROJECT}.web.app/version.txt"
echo ""
echo "Hard-refresh after deploy: Cmd+Shift+R"
