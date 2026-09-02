# What happens when you say "go ahead" or "start Phase X"

Plain English — no jargon.

---

## Migration policy (updated)

**Legacy → React cutover is ON HOLD.**

We will keep building React until it has **all** legacy features. You test each feature in React vs legacy. When React is **equal or better**, you approve migration. Until then:

- **Production:** https://vertex-35d95.web.app/index.html (legacy — unchanged)
- **Preview:** https://vertex-35d95.web.app/app/ (React — growing toward parity)

Track progress: **Feature parity** page in the React sidebar, or `FEATURE_PARITY.md` in the repo.

---

## The short answer on deployment

Deploying to Firebase **does not** switch your team to React. It only publishes whatever is in `/app/` alongside legacy.

Every time you say "start phase X", the agent builds that slice, you test it, and legacy keeps running for everything not yet migrated.

---

## Phases completed (0–5) — foundation only

| Phase | What was built | Full legacy parity? |
|-------|----------------|---------------------|
| **0** | First React mock screens | No |
| **1** | Next.js at `/app` | No |
| **2** | Firebase login + live reads | No |
| **3** | Pricing math package | No |
| **4** | Courier desk + Enquiry filters | Partial |
| **5** | Air/Sea desks (simplified) + save | Partial |

**~21% of legacy features are in React today.** See `/app/feature-parity` for the full list.

---

## Phases 6–14 — remaining work before migration

| Phase | What gets built |
|-------|-----------------|
| **6** | Quote view/print/amend/won/lost + courier surcharges |
| **7** | Full Air & Sea desks (multi-carrier, fees, PDF) |
| **8** | Smart Quote files + apply to desk |
| **9** | Full Enquiry DB (actions, reports, archive) |
| **10** | Transport + Warehouse desks |
| **11** | Circulars upload + Directory + Sales |
| **12** | Admin + roles + NRS |
| **13** | Manager analytics + Ops/Docs/Finance/HR |
| **14** | UX polish + **your cutover approval** |

---

## When does migration actually happen?

Only after:

1. Every item on the **Feature parity** tracker is **Done**
2. You have tested workflows you care about in both apps
3. You explicitly say **“Approve migration”**

Then we change Firebase so `/` opens React instead of `index.html`.

---

## What to say

| You want… | Say this |
|-----------|----------|
| See what's missing | Open `/app/feature-parity` or read `FEATURE_PARITY.md` |
| Build the next chunk | **"Start Phase 6"** (or 7, 8, …) |
| Deploy preview to Firebase | **"Deploy to Firebase now"** |
| Switch team to React as default | **"Approve migration"** (only when parity is done) |
| Keep legacy, keep building | **"Continue next phase"** |

---

## Deploy `/app/` preview (does not replace legacy)

```bash
./scripts/build-react.sh
firebase deploy --only hosting --project vertex-35d95
```

- Legacy: https://vertex-35d95.web.app/index.html  
- React: https://vertex-35d95.web.app/app/  
- Parity tracker: https://vertex-35d95.web.app/app/feature-parity  

See also: `DEPLOY_AND_PREVIEW.md`, `FEATURE_PARITY.md`
