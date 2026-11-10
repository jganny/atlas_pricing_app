# Atlas Pricing: handoff for another AI tool (Cursor, ChatGPT, etc.)

Written 2026-11-10 so work can continue if Claude usage runs out before Saturday 12:30 pm. Read this whole file first. Do not guess: where it says "ask the owner", ask.

## 0. Who the owner is and how to talk to them
- The owner (Ganny, jganny6@gmail.com) runs Atlas Logistics, a freight forwarder in India. They are **not technical**. Explain in plain words first, then name the technical term.
- They want work that is **error-free and precise** and **cheap to run** (AI credit especially).
- Reply to every request with: what changed, what it costs (AI credit: which model, rough rupees, how often, or "no AI credit"), and what is still waiting on them.

## 1. Standing rules (the owner's, non-negotiable)
1. **Show a mockup before building any new screen** (throwaway HTML picture), build only after approval. Pure rule/logic changes with no new screen can proceed.
2. **Deploy only when the owner writes "deploy it".** Commit locally otherwise.
3. **Never change the legacy app** (the vanilla JS app at the hosting root). Check after every release: `md5 -q app-v4.js` must print `18959b505791d59a33e04f265b0590ec`.
4. Make changes only in the new Next.js app (`web/`), the Cloud Functions (`functions/`) and `packages/pricing-core`.
5. Never type passwords or logins for the owner. If the Firebase CLI says credentials are invalid, the owner must run `npx firebase login --reauth` and click Allow in the browser.
6. Never put the owner's personal details in outside requests. "Vertex" is the product brand; the group name is never shown in app text.
7. Every AI feature: cheapest model that passes, its own monthly budget, no AI at all if fixed rules can do it. Tell the cost first.
8. Move to cheaper Anthropic models when they appear (test on real examples first, keep a fallback).

## 2. What lives where
- Repo: `~/atlas_pricing_app` (GitHub jganny/atlas_pricing_app). Work on the checked-out branch; commit with clear messages.
- `web/` Next.js (React, TypeScript, Tailwind) static export. Routes under `web/src/app/(workspace)/` (air, sea, courier, enquiries, inbox, circulars, admin, ...).
- `functions/` Firebase Cloud Functions (Node 22; v1 and v2 mixed), Firestore, Storage. IMAP/SMTP at czipop.logix.in.
- `packages/pricing-core/` pure pricing maths (air weight breaks, sea, courier). After editing `src`, run `npx vitest run` and `npm run build` there and **commit the rebuilt `dist/`**.
- Firebase project `vertex-35d95`. Three hosting sites, all built from the same code:
  - live app: https://vertex-35d95.web.app/app (the team uses it daily)
  - demo: https://vertex-35d95-demo.web.app (mock data, no Firebase calls, public sales demo)
  - chat: https://vertex-35d95-chat.web.app (standalone chat app)
- Currently live: **v0.3.153**. Release notes are in `web/src/lib/release-notes.ts`.

## 3. How to test, build, release (learned the hard way)
- Tests: web `cd web && npm test` (all files must pass); functions `cd functions && for f in *.test.js; do node $f || echo FAIL $f; done`; pricing-core `npx vitest run`. Type check: `cd web && npx tsc --noEmit`.
- Version bump on every release: change `NEXT_PUBLIC_APP_VERSION` in all four files `web/.env.development`, `.env.production`, `.env.chat`, `.env.demo` (suffixes `-test-app`, `-test-app`, `-chat`, `-demo`) AND add an entry at the top of `RELEASE_NOTES` in `web/src/lib/release-notes.ts` (a test checks it). Release notes are written for the desks in plain language.
- Build order: `rm -rf web/.next; bash scripts/build-react.sh` (to `app/`), then again for `scripts/build-chat.sh` (to `app-chat/`), then `scripts/build-demo.sh` (to `app-demo/`).
  - The Google Fonts download sometimes fails with "Module not found ... font/google". It is a network flake: just run the build again.
  - After each build, check the log for "Build error" and grep the output for a string from the new code before deploying (a build can fail silently).
  - `build-demo.sh` temporarily swaps two real-names files for stubs (`team-roles-real-names.ts`, `desk-seats-real-names.ts`). **Never `git add web/src` while it runs**, and afterwards `git status` must not list those two files.
- Deploy each hosting site on its own (one combined deploy kept stalling): `npx firebase deploy --only hosting:vertex-35d95 --project vertex-35d95`, then `hosting:vertex-35d95-demo`, then `hosting:vertex-35d95-chat`. Retry on a network error. **Verify on the live site yourself** (fetch a chunk that contains a new string such as `data-testid` text); never trust CLI output alone. Users with the app open see an "Updated" banner and press Reload.
- Functions: `FUNCTIONS_DISCOVERY_TIMEOUT=90 npx firebase deploy --only functions:NAME1,functions:NAME2 --project vertex-35d95`. It ends with a harmless "could not set up cleanup policy in asia-south1" error; the functions are updated if you see "Successful update operation".
- Long jobs must not be run with a tool timeout; they get killed mid-upload.

## 4. The AI cost system (important)
- Every Anthropic call is counted by a fetch wrapper in `functions/ai-usage.js` under the calling function's name. Admin screen: Admin > AI credit and cost. Monthly budgets live in Firestore `aiBilling/budgets` (`{totalUsd, perFeature}`), saved by the admin callable `aiBudgetsSave`. Over budget = refusal with a plain message.
- Current budgets (2026-11-10): Quote Hub reading (`extractShipmentFromDocuments`) $15/month, mailbox sorting (`pollPricingInboxes`) $3, Ask Vertex (`vertexChat`) $2. No total cap and no circular-reader cap (November already used about $24 on circulars; a cap would lock everything). Set the circular and total caps on 1 December if the owner agrees.
- Models: Sonnet 5.5 $2/$10 per million tokens; Haiku 5.5 $0.10/$0.50. A Quote Hub read costs about $0.013 on Sonnet. An admin switch (Admin > AI credit and cost) reads enquiries with Haiku first and escalates when incomplete; it is OFF until tried on 5 to 10 real enquiries.
- Circular (tariff PDF) reading: fixed-rules readers in `functions/table-reader.js` first (free, exact, same answer every time; they decline when unsure), AI only as a checker or fallback. Layouts handled: header with ORIGIN/DESTINATION/CURRENCY, EK-style sections, EY "DESTINATION Min N 45 100 250" lists (incl. offline tables with blank first columns), WY commodity blocks (GCR/XPS/DGR/COL/CRT/VAL). Add a new layout reader rather than paying the AI to re-read.
- The admin can call the circular reader from the browser (see section 8).

## 5. Business rules already built (do not break)
- **Weight breaks:** min, minus45, plus45, plus100, plus250, plus300, plus500, plus1000. Breakeven rule: breakeven kg = next rate x next start weight / current rate; if the shipment weighs MORE than breakeven, bill the next break on its start weight, otherwise stay (+100 at 5.2, +300 at 4.9: breakeven 282.7; 250 kg stays +100, 290 kg billed as 300 kg at +300). Next break = next one up that holds a rate. Applied per side (sell, buy) in `packages/pricing-core/src/air/breaks.ts`; the Carrier Board follows the same rule.
- **Air Nom desk, EXW/FCA default local charges** (`web/src/lib/pricing/exw-air-charges.ts`): Pickup (EXW only, blank), Handling / C.Clr = higher of 0.15/kg and 75 below 500 kg, 0.10/kg from 500 kg, 0.07/kg from 1000 kg, on chargeable weight (higher of gross and volume weight), one rate for the whole shipment; Fumigation 35 per invoice. Same numbers in USD, EUR, GBP; nothing for INR. Amounts in the Buy column.
- **Sea EXW local charges** come from the agents' sheet (`exw-sea-charges.ts`).
- **Client copy:** carrier names can be hidden (shown as "Airline option 1"), and agent rates ("Rates procured from an Agent", Import only) never appear on the client copy.
- **Inbox rules:** only real enquiries, circulars/tariffs and shipment confirmations are kept; noise is never stored. Enquiries leave the app when their quote is saved (daily clean-up is the safety net). Circular emails from airlines/liners are filed into Circulars automatically. Shipment confirmations are recorded in NRS and the NRS desk is notified.
- **Desk seats own the data**, not people: Air Nom, Sea Nom, NRS, Free Hand, etc. People are swappable (Admin > Desk seats). Key everything by seat. pricing@ is handled by Air Nom + Sea Nom, pricingsales@ by Free Hand + NRS.
- **Automatic replies** (acknowledge enquiries; acknowledge confirmations with the branch team copied and documents attached) are built but both switches are OFF. Admin > Automatic replies has test mode, a test-send button and a log. The branch-team entry screen for desks was mocked and **shelved by the owner** ("ruled out for now"); branch teams stay admin-only.
- Mail polling: Cloud Function `pollPricingInboxes` every 2 minutes, IMAP by UID with a cursor in Firestore; it never marks mail read. Passwords are Firebase secrets `IMAP_PRICING_PASSWORD`, `IMAP_PRICINGSALES_PASSWORD` (never print them).

## 6. Open items waiting on the owner
1. **Inbox reading pane mockup** (whole email view + one "Quote" split button with Air/Sea/Courier choice): https://claude.ai/artifact/Bd844D5Ge6AbWozsmmmU83 . Awaiting approval. The Inbox currently shows only a short preview ("Preview only (full mail on IMAP)"); the full email is already fetchable (`fetchInboxEml`, callable `fetchInboxEmail`, client parser `parseEmailFile`), and reading it with the AI happens only when someone presses Quote. Wanted: customer name = the agent's name/company (not the email address), POL/POD, cargo, commodity, airline options from the Carrier Board, local and destination charges, saved as a **draft quote** for a person to check. Fill on click only (decided), not automatically on arrival.
2. Etihad Gothenburg (GOT) route is held because Etihad's own sheet shows the 250 kg rate higher than the 100 kg rate (probable typo). Owner may confirm with Etihad.
3. Auto-reply switches: owner still has to enter branch teams (admin) and send the two test messages before turning them on.
4. Cheaper-model switch for enquiry reading: try on 5 to 10 real enquiries, then decide.
5. Hold/limits on 1 December: set an overall and a circular-reader budget if wanted.
6. The Voltus Freight study (section 7) needs the owner's decisions.

## 7. Backlog from the Voltus Freight meeting (2026-11-10), with the owner's decisions
Mockup for the next batch (routing, SLA board, Inbox folders, AI switches, drill-down): https://claude.ai/artifact/BbJMZJr9dbGJP32JdN3wTv . Awaiting approval and answers before building. None of these uses AI credit.
- **Enquiry routing with backups (decided):** an enquiry addressed to Air Nom goes to Sea Nom, then Jabeena or Cathrina, then the Manager (admin). Addressed to Sea Nom: Air Nom, then Jabeena or Cathrina, then Manager. Addressed to Jabeena: Cathrina, then Manager. Addressed to Cathrina: Jabeena, then Manager. **1 hour per step** with no action. Still to confirm with the owner: (a) does the clock stop outside working hours (suggested 09:30 to 18:30, Mon to Sat)? (b) "actioned" = Claim, Quote or Ignore pressed (suggested); (c) which seats Jabeena and Cathrina hold (Free Hand / NRS), and that the people come from Desk seats; (d) after Manager, does it stay there. Implementation idea: fields `assignedSeat`, `stage`, `stageSince`, `history` on `inbox_enquiries`, a scheduled function every 5 minutes moves overdue items and sends a push to the next holder. Existing helper: `web/src/lib/mail/inbox-assign.ts`.
- **SLA board (decided, linked to routing):** live list of open enquiries with who holds them, time in step, next holder, state (On time, Due soon, Moved, Breached); counters; average time to first action per desk and person. Arrival and quote-saved times already exist.
- **AI on/off (go ahead):** master switch plus one per feature in Admin > AI credit and cost; optional "off outside office hours". Existing pause logic: `pausedNow` in `functions/ai-usage-logic.js`.
- **Drill-down (implement):** clickable summary numbers with a breadcrumb (Enquiry DB tonnage by mode, then desk, then quotes; AI cost by month, feature, day, call; Carrier Board; SLA board).
- **Inbox folders and thread grouping (ok):** virtual folders as filters (All open, Mine, Moved to me, Escalated, Air Export/Import/Cross Trade/EXW, Sea Export/Import, Confirmations, Circulars, Done 7 days), replies grouped by thread (`threadRoot` in `functions/inbox-reply.js`), emails stored once and removed after the quote is saved.
- **Backups (already in place, checked 2026-11-10):** Firestore daily backup schedule retained 30 days, point-in-time recovery 7 days, database in asia-south1. Missing: delete protection is OFF (turn it on), and no copy outside the project. "Noisy neighbours" does not apply to one company on managed Firestore.
- **App Check (27):** not required now. Enforcing it would break the legacy app, which cannot be changed. Possible later in monitor mode for the new app's callables only.
- **DEV environment (2):** useful, not urgent. Share it with the SaaS track below (a second Firebase project).
- **SaaS / enterprise edition (7, 22):** owner wants to start in parallel without affecting the live app: separate Firebase project and separate git branch, per-client private stores, one privacy standard (see enterprise plan notes). Needs the owner to create the new Firebase project and enable billing.
- **Warehouse (23):** owner wants the existing Warehouse desk (storage quoting) enhanced with operations (aisles and zones, floor plan, tenants and leases, gate overview, entry and exit registers, dock schedules, vehicle log). Treat it as an enterprise-edition module; first agree the first 3 features.
- **Bun (26):** only as an optional local package manager / test runner on a trial branch with timings; Firebase Functions run Node only; Next.js builds use Node/Turbopack.
- **WhatsApp (6):** Cloud API has no licence fee but Meta charges per message (rules changing in 2026; check Meta's pricing page). Plan: inbound enquiries into the Inbox first, outbound quotes later. Needs a registered business number and Meta approval.
- **ULIP / ICEGATE (1):** ULIP needs registration, a stated use case and an NDA; ICEGATE has no registration fee but API access is for approved software providers. Neither confirmed free. Value is mostly shipment tracking and customs, not pricing; ask the owner for the exact use case before registering.
- **Portal rate capture (16):** the vendor's "built-in DID" is probably browser automation; not verified. Do not build stealth scraping or CAPTCHA bypass. Offer a user-assisted "capture this rate" button for a user who is already logged in, plus official rate services.
- **"Chord rails / AI appending" (9):** unclear words; probable meaning is guardrails (limits on the AI, already present) and appending (add to a record without overwriting, already present for typed values). Idea: an AI activity log. Low priority.
- **Multilingual quotes (19):** fixed wording translated once and checked by a native speaker (no per-quote AI cost); needs the owner's language list; Arabic needs right-to-left layout.
- **Workflow templates (18):** owner says the Voltus idea is only a reference; design our own later (admin-editable quote presets by terms).
- **Skip:** finance module (4, for Vertex Earn), MySQL (15), AWS migration (21).

## 8. Technique: calling the admin Cloud Functions from the browser
The owner is signed in as an admin in the app's browser. In a page on `https://vertex-35d95.web.app/app/`, read the refresh token from IndexedDB database `firebaseLocalStorageDb` (store `firebaseLocalStorage`, `value.stsTokenManager.refreshToken`), exchange it at `https://securetoken.googleapis.com/v1/token?key=<web api key found in that record's key>`, then POST `{data: {...}}` with `Authorization: Bearer <id token>` to `https://us-central1-vertex-35d95.cloudfunctions.net/<callable>`. Example: `readLibraryCircular` with `{circularId, force:true, trustTable:true}`. Firestore REST works with the same token. Keep calls under about 45 seconds per tool call and poll.

## 9. Known traps
- A python/heredoc patch that never writes the file changes nothing silently; check with `git diff`.
- Contract tests exist: callables must mention `chatOnly`; a test matches `case "ai-credit-and-cost": return <AiUsageAdmin />`.
- When rates in a tariff rise with weight the checks hold the row on purpose; do not loosen without the owner's say.
- Never guess a rate, a currency or a weight break. If a layout is not understood, decline and report.
