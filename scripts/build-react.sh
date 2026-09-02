#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Installing & building pricing-core..."
cd "$ROOT/packages/pricing-core"
npm install
npm run build

echo "==> Building Next.js app..."
cd "$ROOT/web"
npm install
npm run build

echo "==> Copying static export to app/..."
rm -rf "$ROOT/app"
mkdir -p "$ROOT/app"
cp -r out/* "$ROOT/app/"

if [[ ! -f "$ROOT/app/index.html" ]]; then
  echo "ERROR: build failed — app/index.html missing" >&2
  exit 1
fi

echo "Next.js static export copied to app/ — ready for Firebase hosting at /app"
