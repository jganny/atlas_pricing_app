#!/usr/bin/env bash
# Push to GitHub → Firebase auto-deploys via GitHub Actions.
# Usage (from project folder):  ./scripts/go-live.sh
set -e
cd "$(dirname "$0")/.."

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Not a git repo. Open Terminal inside atlas_pricing_app first."
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  You are on branch '$BRANCH'. Live site deploys from 'main'."
  read -r -p "Switch to main and continue? [y/N] " ans
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    git checkout main
  else
    exit 1
  fi
fi

AHEAD="$(git rev-list --count origin/main..main 2>/dev/null || echo 0)"
if [ "$AHEAD" = "0" ]; then
  echo "ℹ️  Nothing new to push — GitHub already has your latest commits."
else
  echo "🚀 Pushing $AHEAD commit(s) to GitHub (main)..."
  git push -u origin main
  echo "✅ Push complete."
fi

echo ""
echo "Firebase deploy runs automatically (about 1–3 minutes)."
echo "  Watch progress: https://github.com/jganny/atlas_pricing_app/actions"
echo "  Check version:  https://vertex-35d95.web.app/version.txt"
echo "  Live app:       https://vertex-35d95.web.app"
echo ""
echo "When version.txt shows 129.08 (or newer), hard-refresh the app: Cmd+Shift+R"
