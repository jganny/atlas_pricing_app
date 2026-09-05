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
