# How to preview, push to GitHub, and deploy to Firebase

Plain-English guide for Atlas Pricing / Vertex.

---

## Why you couldn't see the Preview

The agent runs on a **remote cloud computer**, not on your laptop. When the agent says:

`http://127.0.0.1:43221/app/`

that address only works **inside that cloud session** — it is not a link you can open in Chrome on your PC.

### How to see the preview in Cursor

1. Open your agent run: [cursor.com/agents](https://cursor.com/agents) → pick this run.
2. In the agent chat, look for a **Preview** card (blue link).
3. Click **Preview** — it opens the **Cloud Agent Desktop** (a virtual browser inside Cursor).
4. You should see the login page. Sign in with your Atlas username/password (or `ganny` / `demo` in mock mode).

If Preview does not appear, click **Desktop** on the agent run page — the browser may already be open there.

### How to see it on your own computer

Clone the repo and run locally:

```bash
git clone https://github.com/jganny/atlas_pricing_app.git
cd atlas_pricing_app/web
npm install
npm run dev
```

Then open **http://127.0.0.1:43221/app/** in your browser.

---

## How to commit and push to GitHub

The agent pushes to **Cursor's temporary git** automatically. To get code onto **your GitHub repo** (`jganny/atlas_pricing_app`):

### Option A — From your Mac/PC (easiest)

```bash
cd atlas_pricing_app
git fetch origin
git checkout cursor/react-migration-116f   # or merge into main when ready
git pull
git push origin cursor/react-migration-116f
```

When you are happy with the migration, merge to `main`:

```bash
git checkout main
git merge cursor/react-migration-116f
git push origin main
```

### Option B — GitHub token script (from agent or CI)

1. Create a GitHub Personal Access Token (repo scope):  
   https://github.com/settings/tokens
2. Run:

```bash
export GH_TOKEN=ghp_your_token_here
chmod +x scripts/push-to-github.sh
./scripts/push-to-github.sh cursor/react-migration-116f
```

---

## How to deploy to Firebase (make it live)

Live site today: **https://vertex-35d95.web.app**  
Legacy app: `https://vertex-35d95.web.app/index.html`  
New Next.js app (after deploy): `https://vertex-35d95.web.app/app/`

Auto-deploy on push is **OFF** — you deploy manually when ready.

### Step 1 — Install Firebase CLI (once)

```bash
npm install -g firebase-tools
firebase login
```

### Step 2 — Build the Next.js app

From the repo root:

```bash
chmod +x scripts/build-react.sh
./scripts/build-react.sh
```

This builds the React app and copies it into the `app/` folder for hosting.

### Step 3 — Deploy Firestore rules (if changed)

Needed for tariff reads in the new app:

```bash
firebase deploy --only firestore:rules --project vertex-35d95
```

### Step 4 — Deploy hosting

```bash
firebase deploy --only hosting --project vertex-35d95
```

### Step 5 — Verify

- Legacy: https://vertex-35d95.web.app/index.html  
- New app: https://vertex-35d95.web.app/app/  
- Version file: https://vertex-35d95.web.app/version.txt  

### What goes live vs what stays the same

| URL | What it serves |
|-----|----------------|
| `/` and `/index.html` | Legacy app (unchanged until you switch) |
| `/app/` | New Next.js app (after build + deploy) |

Nothing replaces the legacy app until you choose to. Both can run side by side.

---

## Quick checklist

| Goal | Action |
|------|--------|
| See preview in Cursor | Click **Preview** or **Desktop** on the agent run |
| See preview on your PC | Clone repo → `cd web && npm run dev` |
| Push to GitHub | `git push origin <branch>` from your machine |
| Go live (new `/app`) | `./scripts/build-react.sh` then `firebase deploy --only hosting` |
| Go live (rules) | `firebase deploy --only firestore:rules` |

---

## Need mock mode offline?

In `web/.env.development` set:

```
NEXT_PUBLIC_MOCK_MODE=true
```

Restart the dev server. Login: `ganny` / `demo`.
