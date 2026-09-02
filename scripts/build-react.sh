#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/packages/pricing-core"
npm run build
cd "$ROOT/web"
npm install
npm run build
rm -rf "$ROOT/app"
mkdir -p "$ROOT/app"
cp -r out/* "$ROOT/app/"
echo "Next.js static export copied to app/ — ready for Firebase hosting at /app"
