#!/usr/bin/env bash
# Build, push to GitHub, and deploy to Firebase (vertex-35d95).
# Requires GH_TOKEN and/or FIREBASE_TOKEN in environment (or local firebase login).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-cursor/react-migration-116f}"
PROJECT="vertex-35d95"

echo "==> Building Next.js app → app/"
./scripts/build-react.sh

TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "$TOKEN" ]]; then
  echo "==> Pushing ${BRANCH} to GitHub..."
  git push "https://x-access-token:${TOKEN}@github.com/jganny/atlas_pricing_app.git" "${BRANCH}:${BRANCH}"
  echo "GitHub push done."
else
  echo "WARN: No GH_TOKEN — skipping GitHub push."
  echo "  export GH_TOKEN=ghp_... && $0"
fi

FB_TOKEN="${FIREBASE_TOKEN:-}"
DEPLOY_ARGS=(--project "$PROJECT")
if [[ -n "$FB_TOKEN" ]]; then
  DEPLOY_ARGS+=(--token "$FB_TOKEN")
fi

echo "==> Deploying Firestore rules..."
npx firebase deploy --only firestore:rules "${DEPLOY_ARGS[@]}"

echo "==> Deploying Firebase Hosting (legacy + /app/)..."
npx firebase deploy --only hosting "${DEPLOY_ARGS[@]}"

echo ""
echo "Done."
echo "  Legacy:  https://${PROJECT}.web.app/index.html"
echo "  New app: https://${PROJECT}.web.app/app/"
echo "  Version: https://${PROJECT}.web.app/version.txt"
