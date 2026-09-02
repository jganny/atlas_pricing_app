# What happens when you say "go ahead" or "start Phase X"

Plain English — no jargon.

---

## The short answer on deployment

**Nothing goes live on https://vertex-35d95.web.app automatically when you approve a phase.**

Every time you say "go ahead", the agent:

1. **Writes code** on a development branch (`cursor/react-migration-116f`)
2. **Tests it** in a cloud preview (the Preview button in Cursor)
3. **Saves to Cursor's git** (backup you see in the agent view)

Your **live Firebase site stays exactly as it is** until **you** run deploy commands on your computer (or explicitly ask the agent to deploy, which you have not done yet).

---

## What each phase has done (so far)

| Phase | What was built | Live site changed? |
|-------|----------------|-------------------|
| **0** | First React mock screens (demo data) | No |
| **1** | Proper Next.js app at `/app` path | No |
| **2** | Real Firebase login + live enquiries/tariffs (read-only) | No |
| **3** | Tested pricing math package (air/sea) | No |
| **4** | Courier desk in React + better Enquiry DB | No (until you deploy) |
| **5** | Retire legacy, switch default route | Only when you approve |

Think of it like **renovating a new wing of a building while the old wing stays open**. Customers still use the old wing (`/index.html`) until you open the new door (`/app/`).

---

## When does it become the "live app"?

There are **two levels** of "live":

### Level A — New app visible alongside legacy (you can do this anytime)

After `./scripts/build-react.sh` and `firebase deploy --only hosting`:

- **Legacy (unchanged):** https://vertex-35d95.web.app/index.html  
- **New React app:** https://vertex-35d95.web.app/app/

Your team opens `/app/` manually. Legacy keeps working for everything not migrated yet.

### Level B — New app becomes the default (Phase 5, your explicit approval)

Change Firebase so `/` serves the new app instead of `index.html`. Only after Air/Sea desks and save flows are fully migrated and you sign off.

**We have not done Level A or B yet** — by your earlier instruction ("no Firebase deploy until I approve").

---

## What to say when you want it live

| You want… | Say this |
|-----------|----------|
| Deploy new `/app/` alongside legacy | **"Deploy to Firebase now"** |
| Push code to GitHub | **"Push to GitHub"** (needs your token) or push from your Mac |
| Make `/app/` the default homepage | **"Switch default to new app"** (Phase 5) |
| Keep building, don't deploy | **"Continue next phase"** (what you've been doing) |

---

## What happens behind each "start phase" instruction

```
You say "start phase X"
        ↓
Agent reads the migration plan
        ↓
Builds that slice of the new app (code only)
        ↓
Runs tests / build
        ↓
Commits + pushes to Cursor git
        ↓
Dev server runs in cloud → Preview card (if you're in Cursor)
        ↓
Live Firebase site: UNCHANGED unless you deploy
```

---

## Recommended moment to deploy

| Milestone | Good time to deploy `/app/`? |
|-----------|------------------------------|
| After Phase 2 | Yes — team can preview dashboard + Smart Quote with live data |
| After Phase 4 | Better — Courier desk + enquiries usable |
| After Phase 5 | Deploy + switch default when legacy can be retired |

**Practical suggestion:** Deploy **Level A** after Phase 4 so your team can try `/app/` on the real site while legacy handles full Air/Sea quoting.

---

## One-command deploy (when you're ready)

From repo root on your machine:

```bash
./scripts/build-react.sh
firebase deploy --only firestore:rules --project vertex-35d95
firebase deploy --only hosting --project vertex-35d95
```

Then open: **https://vertex-35d95.web.app/app/**

See also: `DEPLOY_AND_PREVIEW.md` for GitHub push and Preview instructions.
