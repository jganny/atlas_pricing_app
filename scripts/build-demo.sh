#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TEAM_NAMES_FILE="$ROOT/web/src/lib/quotes/team-roles-real-names.ts"
SEAT_NAMES_FILE="$ROOT/web/src/lib/auth/desk-seats-real-names.ts"
TEAM_NAMES_BACKUP="$(mktemp)"
SEAT_NAMES_BACKUP="$(mktemp)"

restore_real_names() {
  cp "$TEAM_NAMES_BACKUP" "$TEAM_NAMES_FILE"
  cp "$SEAT_NAMES_BACKUP" "$SEAT_NAMES_FILE"
  rm -f "$TEAM_NAMES_BACKUP" "$SEAT_NAMES_BACKUP"
}
trap restore_real_names EXIT

echo "==> Swapping real staff names out for a demo-safe stub before building..."
cp "$TEAM_NAMES_FILE" "$TEAM_NAMES_BACKUP"
cp "$SEAT_NAMES_FILE" "$SEAT_NAMES_BACKUP"

cat > "$TEAM_NAMES_FILE" <<'EOF'
/** DEMO BUILD STUB — scripts/build-demo.sh restores the real file on exit.
 * Never edit this by hand; edit the real file and rebuild. */
export const REAL_NAMES: Record<string, string> = {};
export const REAL_MAILBOX_EMAILS = { pricing: "", pricingsales: "", monitor: "" };
export const REAL_IMAP_HOST = "";
export const REAL_OWN_EMAIL_DOMAINS: string[] = [];
EOF

cat > "$SEAT_NAMES_FILE" <<'EOF'
/** DEMO BUILD STUB — scripts/build-demo.sh restores the real file on exit.
 * Never edit this by hand; edit the real file and rebuild. */
import type { DeskSeatId } from "@/lib/auth/desk-seats";
export const REAL_SEAT_LABELS: Record<DeskSeatId, string> = {
  admin: "", manager: "", "air-nom": "", "sea-nom": "", nrs: "", freehand: "", pricing: "",
};
export const REAL_PERSON_NAMES: Record<string, string> = {};
EOF

echo "==> Installing & building pricing-core..."
cd "$ROOT/packages/pricing-core"
npm install
npm run build

echo "==> Building Next.js app (demo build — mock data, no live Firebase)..."
cd "$ROOT/web"
npm install
# Shell env beats .env.local — this is the one build that must run in mock
# mode with demo-safe names, never against live data.
set -a
# shellcheck disable=SC1091
source "$ROOT/web/.env.demo"
set +a
npm run build

echo "==> Copying static export to app-demo/..."
rm -rf "$ROOT/app-demo"
mkdir -p "$ROOT/app-demo"
cp -r out/* "$ROOT/app-demo/"

if [[ ! -f "$ROOT/app-demo/index.html" ]]; then
  echo "ERROR: demo build failed — app-demo/index.html missing" >&2
  exit 1
fi

echo "Demo build copied to app-demo/ — deploy with: firebase deploy --only hosting:vertex-35d95-demo"
