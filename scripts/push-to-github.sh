#!/usr/bin/env bash
# Push a branch to GitHub (jganny/atlas_pricing_app). Requires GH_TOKEN or GITHUB_TOKEN.
set -euo pipefail

BRANCH="${1:-cursor/react-migration-116f}"
REPO="https://github.com/jganny/atlas_pricing_app.git"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Set GH_TOKEN or GITHUB_TOKEN (repo scope) and re-run."
  echo "  export GH_TOKEN=ghp_..."
  echo "  $0 $BRANCH"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git push "https://x-access-token:${TOKEN}@github.com/jganny/atlas_pricing_app.git" "${BRANCH}:${BRANCH}"
echo "Pushed ${BRANCH} to GitHub."
