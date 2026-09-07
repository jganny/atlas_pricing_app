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

## Dashboard / sidebar tab counts by role

**Primary sidebar** (grouped): **Desks** · **Work** · **Library** · **More** (admins). Max still ~18 links by role, but sectioned so desks stay on top.

| Login / role | Sidebar links (approx) | Notes |
|---|---|---|
| Admin (`ganny` / manager) | **18** + **More** (Docs, Feature parity, Mobile) | Full desk |
| `cathrina` (NRS) | **16** (CORE + Admin + NRS; no Analytics/Ops) | NRS follow-ups page |
| `kavya` / `jaya` (Free Hand) | **15** | CORE desks |
| `shashank` (Air Nomination) | **12** | Air + transport/warehouse; no Sea/Courier |
| `shaheer` (Sea Nomination) | **12** | Sea + transport/warehouse; no Air/Courier |
| `pricing` | **11** | Air/Sea focus; no transport/warehouse/sales |

Mobile bottom bar: up to **4** tabs (Home, Quote, Inbox, Lines) + **More**.

Home cards (Open / Won / revenue / SLA) use **scoped** enquiry counts (admins see all; desk users see their own).

## Adding a new user (employee)

**Yes — the employee can self-sign up.** On `/app/login`, click **Need an account? Sign up**, pick a username + password (min 6 chars) and display name. That creates a Firebase Auth account (`{username}@atlaspricing.com`) and queues them in Admin → pending users.

**Admin still must finish setup** (desk role + Firestore profile), or they will not get the correct Air/Sea/Inbox desks:

1. **Firebase Console → Authentication → Users** — confirm the account exists (signup creates it).
2. **Firestore → `users/{username}`** document, e.g.  
   `{ "fullName": "Display Name", "role": "member" }`
3. **RBAC** — if they need a custom desk map (Air-only, Sea-only, NRS, etc.), add the username in `web/src/lib/auth/rbac.ts` / `team-roles.ts`, then redeploy.
4. Optional: **Admin → Queue registration** (local queue reminder) or mark the pending signup done after Auth + Firestore are set.

**Admin-created path (recommended for controlled rollouts):** create the user in Firebase Auth yourself (or call `adminCreateUser` as `ganny`), set Firestore profile + RBAC, then share the temporary password out-of-band (WhatsApp/1Password) — never paste passwords into chat or git.

Ask them to sign in at `/app/login`, then change password via Forgot/reset if needed.

## Admin nav streamlining

Default sidebar keeps desks + Inbox / Enquiry DB / Carriers / Standards / Circulars / Directory / Sales / Analytics / Ops / Admin / **NRS follow-ups**. Docs, Feature parity, and Mobile sit under a **More** subsection for admins only. Finance/HR stay out of Pricing (separate apps later).
