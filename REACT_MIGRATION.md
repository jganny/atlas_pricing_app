# Atlas Pricing — React / Next.js Migration

Branch: `cursor/react-migration-116f`

This branch introduces a **Next.js + React + TypeScript** app alongside the legacy HTML shell. The legacy app remains untouched at `/index.html`.

## Quick start

```bash
cd web
npm install
npm run dev
```

Open: **http://127.0.0.1:43221/app/**

### Live Firebase (default)

Login with your **Atlas desk username** and password — same as the legacy app (`username` → `username@atlaspricing.com`).

Green banner = connected to Firestore (read-only preview).

### Mock mode (offline / demo)

Set in `web/.env.development`:

```bash
NEXT_PUBLIC_MOCK_MODE=true
```

Login: `ganny` / `demo` (or `manager` / `demo`). Amber banner = mock data, no Firebase.

## What's included

| Surface | Status |
|---------|--------|
| Next.js App Router + `basePath: /app` | ✅ |
| Firebase Auth (email/password) | ✅ Phase 2 |
| TanStack Query (enquiries, tariffs, circulars) | ✅ Phase 2 |
| Dashboard + SLA stats | ✅ live `quotes` collection |
| Smart Quote · Air / Sea | ✅ live + mock tariffs |
| Enquiry database table | ✅ live quotes (read-only) |
| Circulars library + tariffs | ✅ live read |
| Courier desk (React) | ✅ Phase 4 — calculate + save |
| Enquiry DB search/filter | ✅ Phase 4 |
| Air / Sea full desks | ❌ legacy only |
| Firebase deploy | ❌ awaiting your approval |

## Environment variables

Public Firebase config lives in `web/.env.development` and `web/.env.production`:

- `NEXT_PUBLIC_MOCK_MODE` — `true` for demo, `false` for live (default)
- `NEXT_PUBLIC_FIREBASE_*` — client SDK config (public keys)

Toggle mock mode without code changes.

## Firestore rules (manual deploy)

Phase 2 adds read/write rules for tariff collections used by the legacy Circulars engine:

```
match /air_tariffs/{tariffId} { allow read, write: if isSignedIn(); }
match /sea_tariffs/{tariffId} { allow read, write: if isSignedIn(); }
```

Deploy rules when ready (not auto-deployed):

```bash
firebase deploy --only firestore:rules --project vertex-35d95
```

## Legacy coexistence

- Legacy app: `/index.html`
- New app: `http://127.0.0.1:43221/app/`
- **Open legacy app** link in the header

## Build for hosting (do not deploy until approved)

```bash
chmod +x scripts/build-react.sh
./scripts/build-react.sh
```

Copies static export to `app/` for Firebase route `/app/**`.

### Deploy steps (after your approval)

1. Run `./scripts/build-react.sh`
2. `firebase deploy --only firestore:rules --project vertex-35d95` (if rules changed)
3. `firebase deploy --only hosting --project vertex-35d95`

## Migration phases

| Phase | Work | Status |
|-------|------|--------|
| 0 | Vite React mock shell | ✅ |
| 1 | Next.js foundation | ✅ |
| 2 | Firebase v9 + TanStack Query + live reads | ✅ |
| 3 | Pure TS `pricing-core` packages | ✅ |
| 4 | Courier desk + Enquiry DB filters | ✅ |
| 5 | Air/Sea desks, retire legacy, deploy on approval | planned |

See **MIGRATION_STATUS.md** for what each phase does and when deployment happens.

- Next.js 16 + React 19 + TypeScript
- Firebase v11 modular SDK (Auth + Firestore)
- TanStack Query + Zustand
- Tailwind CSS 4 + Lucide icons
- Static export for Firebase Hosting at `/app`
