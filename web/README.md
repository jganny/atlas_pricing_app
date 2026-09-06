# Atlas Pricing (React / Next.js)

Desk app for Atlas Logistics pricing: quotes, IMAP inbox, circulars, and carrier tools.

- **Dev:** `npm run dev` → [http://127.0.0.1:43221/app/](http://127.0.0.1:43221/app/)
- **Production path:** `/app/` on Firebase Hosting (legacy UI stays at `/`)
- **Mobile PWA:** `/app/m/` — Quote, Inbox, Air, Sea, Install only
- **Integrations:** `/app/integrations/` — DCSA ocean + IATA ONE Record (standards + demo)

## IMAP email automation (slim AI intake)

Passwords are **never** in git. Mailboxes: `pricing@atlaslogistics.co.in`, `pricingsales@atlaslogistics.co.in` → `czipop.logix.in:993`.

The poller **does not store full emails** in Firestore. It classifies each message (`new_enquiry` / `follow_up` / `noise` / `needs_human`), drops noise, and keeps only a slim ticket (subject, from, short preview, structured POL/POD/cargo). Full mail stays on IMAP.

Optional: set `ANTHROPIC_API_KEY` for better classification (heuristic rules apply if missing).

```bash
# Secrets (once)
firebase functions:secrets:set IMAP_PRICING_PASSWORD --project vertex-35d95
firebase functions:secrets:set IMAP_PRICINGSALES_PASSWORD --project vertex-35d95
# optional AI:
# firebase functions:secrets:set ANTHROPIC_API_KEY --project vertex-35d95

cd functions && npm install && cd ..
firebase deploy --only functions:pollPricingInboxes --project vertex-35d95
```

Or use `./scripts/set-imap-secrets.sh` when that file is on your Mac clone.

Deploy requires `npm install` inside `functions/` first — otherwise Firebase reports “Couldn't find firebase-functions package”.

## Carrier APIs (honest scope)

DCSA / ONE Record are free **OpenAPI specs**, not a free live-rate gateway. Each carrier hosts its own API; you still need a customer portal account. Atlas ships a shared adapter + demo sailings until credentials exist. Live sell rates stay on Atlas Circulars.

## Dashboard tab counts by role

Home cards (Open / Won / revenue / SLA) use **scoped** enquiry counts:

- **Admins** (`ganny`, `manager`, …): all enquiries.
- **Desk members**: only quotes they created (or assigned to their desk focus).

Shortcut tiles (Air, Sea, Inbox, Analytics, …) still respect RBAC — a user only sees links for routes they can open.

## Adding a new user

1. Create the Firebase Auth user with email `{username}@atlaspricing.com` (Auth console or Admin SDK).
2. Create Firestore doc `users/{username}` with at least `{ role, displayName }` (role drives RBAC via `web/src/lib/auth/rbac.ts` / `team-roles.ts`).
3. Never commit or document passwords in README or git.

## Admin nav streamlining

Default sidebar keeps desks + Inbox / EDB / Carriers / Circulars / Directory / Sales / Analytics / Ops / Admin / **NRS follow-ups**. Docs, Feature parity, and Mobile sit under a **More** subsection shown to admins only. Integrations is labeled **Standards** next to Carriers.
