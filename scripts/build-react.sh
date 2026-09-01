#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/web"
npm run build
rm -rf "$ROOT/app"
mkdir -p "$ROOT/app"
cp -r dist/* "$ROOT/app/"
echo "React build copied to app/ — ready for Firebase hosting at /app"
