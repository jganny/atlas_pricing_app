# Atlas Pricing — React / Next.js Migration

Branch: `cursor/react-migration-116f`

This branch introduces a **Next.js + React + TypeScript** app alongside the legacy HTML shell. The legacy app remains untouched at `/index.html`. The new app runs in **mock mode** by default — no Firebase credentials required.

## Quick start (local mock)

```bash
cd web
npm install
npm run dev
```

Open: **http://127.0.0.1:43221/app/**

Login: `ganny` / `demo` (or `manager` / `demo`)

## What's included (Phase 1 — Next.js foundation)

| Surface | Status |
|---------|--------|
| Next.js App Router + `basePath: /app` | ✅ |
| Auth shell (mock) | ✅ |
| Dashboard + SLA stats | ✅ mock data |
| Smart Quote · Air | ✅ parse + mock tariffs |
| Smart Quote · Sea | ✅ parse + mock tariffs |
| Enquiry database table | ✅ mock data |
| Circulars tariff list | ✅ mock air/sea tariffs |
| Full Air/Sea pricing desks | ❌ legacy only |
| Firebase live connection | ❌ Phase 2 |

## Mock environment

- `web/.env.development` sets `NEXT_PUBLIC_MOCK_MODE=true`
- All API calls go through `web/src/lib/mock/api.ts`
- Amber banner shows **Mock environment** in the UI
- No writes to Firestore or existing quote schema

## Legacy coexistence

- Legacy app: `/index.html` on your static server root
- New app: `http://127.0.0.1:43221/app/`
- Link **Open legacy app** in the header jumps to `/index.html`

## Build for hosting (do not deploy until approved)

```bash
chmod +x scripts/build-react.sh
./scripts/build-react.sh
```

This runs `next build` (static export) and copies `web/out/` into `app/` for Firebase route `/app/**`.

### Deploy steps (after your approval)

1. Run `./scripts/build-react.sh`
2. Confirm `firebase.json` rewrites include `/app/**` → `/app/index.html`
3. `firebase deploy --only hosting --project vertex-35d95`

Legacy `/` continues to serve the HTML app until you switch the default route.

## Migration phases

| Phase | Work | Status |
|-------|------|--------|
| 0 | Vite React mock shell | ✅ done |
| 1 | Next.js foundation (this branch) | ✅ |
| 2 | Firebase v9 + TanStack Query + Zustand live data | planned |
| 3 | Pure TS `pricing-core` packages | planned |
| 4 | Migrate modules: Smart Quote → Enquiry DB → Circulars → Courier → Air → Sea | planned |
| 5 | Retire legacy; deploy only on user approval | planned |

## Stack

- Next.js 16 + React 19 + TypeScript
- Zustand (auth persistence)
- Tailwind CSS 4
- Lucide icons
- Static export for Firebase Hosting at `/app`
