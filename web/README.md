# Atlas Pricing (React / Next.js)

Desk app for Atlas Logistics pricing: quotes, IMAP inbox, circulars, and carrier tools.

- **Dev:** `npm run dev` → [http://127.0.0.1:43221/app/](http://127.0.0.1:43221/app/)
- **Production path:** `/app/` on Firebase Hosting (legacy UI stays at `/`)
- **Mobile PWA:** `/app/m/` — Quote, Inbox, Air, Sea, Install only
- **Integrations:** `/app/integrations/` — DCSA ocean + IATA ONE Record (standards + demo)

## IMAP email automation

Passwords are **never** in git. Mailboxes: `pricing@atlaslogistics.co.in`, `pricingsales@atlaslogistics.co.in` → `czipop.logix.in:993`.

On your Mac (from the repo root that has `scripts/set-imap-secrets.sh`):

```bash
git pull   # must include scripts/set-imap-secrets.sh — if missing, your clone is behind
cp scripts/imap-secrets.env.example scripts/imap-secrets.env
# fill IMAP_PRICING_PASSWORD and IMAP_PRICINGSALES_PASSWORD
./scripts/set-imap-secrets.sh
cd functions && npm install && cd ..
firebase deploy --only functions:pollPricingInboxes --project vertex-35d95
```

**If `./scripts/set-imap-secrets.sh` is missing**, set secrets interactively (no script required):

```bash
firebase functions:secrets:set IMAP_PRICING_PASSWORD --project vertex-35d95
firebase functions:secrets:set IMAP_PRICINGSALES_PASSWORD --project vertex-35d95
cd functions && npm install && cd ..
firebase deploy --only functions:pollPricingInboxes --project vertex-35d95
```

Deploy requires `npm install` inside `functions/` first — otherwise Firebase reports “Couldn't find firebase-functions package”.

## Carrier APIs (honest scope)

DCSA / ONE Record are free **OpenAPI specs**, not a free live-rate gateway. Each carrier hosts its own API; you still need a customer portal account. Atlas ships a shared adapter + demo sailings until credentials exist. Live sell rates stay on Atlas Circulars.
