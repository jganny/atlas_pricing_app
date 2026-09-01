# Atlas Pricing — React Migration

Branch: `cursor/react-migration-116f`

This branch introduces a **React + TypeScript** app alongside the legacy HTML shell. The legacy app remains untouched at `/index.html`. React runs in **mock mode** by default — no Firebase credentials required.

## Quick start (local mock)

```bash
cd web
npm install
npm run dev
```

Open: **http://127.0.0.1:43221/app/**

Login: `ganny` / `demo` (or `manager` / `demo`)

## What's included (Phase 0)

| Surface | Status |
|---------|--------|
| Auth shell (mock) | ✅ |
| Dashboard + SLA stats | ✅ mock data |
| Smart Quote · Air | ✅ parse + mock tariffs |
| Smart Quote · Sea | ✅ parse + mock tariffs |
| Enquiry database table | ✅ mock data |
| Circulars tariff list | ✅ mock air/sea tariffs |
| Full Air/Sea pricing desks | ❌ legacy only |
| Firebase live connection | ❌ awaiting approval |

## Mock environment

- `web/.env.development` sets `VITE_MOCK_MODE=true`
- All API calls go through `web/src/lib/mock/api.ts`
- Amber banner shows **Mock environment** in the UI
- No writes to Firestore or existing quote schema

## Legacy coexistence

- Legacy app: `http://127.0.0.1:43141/index.html` (or your static server root)
- React app: `http://127.0.0.1:43221/app/`
- Link **Open legacy app** in the React header jumps to `/index.html`

## Build for hosting (do not deploy until approved)

```bash
chmod +x scripts/build-react.sh
./scripts/build-react.sh
```

This builds Vite output into `app/` for Firebase route `/app/**`.

### Deploy steps (after your approval)

1. Run `./scripts/build-react.sh`
2. Confirm `firebase.json` rewrites include `/app/**` → `/app/index.html`
3. `firebase deploy --only hosting --project vertex-35d95`

Legacy `/` continues to serve the HTML app until you switch the default route.

## Next migration phases

1. Extract `calculateAirFreight` / `calculateSeaFreight` into `packages/pricing-core` with unit tests
2. Wire Firebase Auth + Firestore (replace mock API)
3. Port Courier desk as first full pricing desk in React
4. Port Air/Sea desks incrementally
5. Retire `app-v4.js` panel by panel

## Stack

- Vite 8 + React 19 + TypeScript
- React Router 7
- Zustand (auth persistence)
- Tailwind CSS 4
- Lucide icons
