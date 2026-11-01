#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Installing & building pricing-core..."
cd "$ROOT/packages/pricing-core"
npm install
npm run build

echo "==> Building the Vertex Chat app (chat only, real data)..."
cd "$ROOT/web"
npm install
# Shell env beats .env.local. This build shows only the chat and sits at the root of its own site.
set -a
# shellcheck disable=SC1091
source "$ROOT/web/.env.chat"
set +a
npm run build

echo "==> Copying static export to app-chat/..."
rm -rf "$ROOT/app-chat"
mkdir -p "$ROOT/app-chat"
cp -r out/* "$ROOT/app-chat/"
# The Pricing app's manifest, service worker and icons are in the export; the chat app has its own.
cp "$ROOT/web/chat-app/"* "$ROOT/app-chat/"

if [[ ! -f "$ROOT/app-chat/index.html" ]]; then
  echo "ERROR: chat build failed — app-chat/index.html missing" >&2
  exit 1
fi

echo "Vertex Chat copied to app-chat/ — it gets its own Hosting site (see firebase.json once the site exists)."
