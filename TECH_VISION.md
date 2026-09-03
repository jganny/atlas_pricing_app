# Atlas Pricing — Premium Tech Vision (Phase 0 → Cutover)

**Your standing instruction:** This is a **new version** of Atlas — not a minimal port. From **Phase 0 onward**, every phase delivers:

1. **Legacy parity** — nothing your team relies on gets left behind  
2. **Premium innovation** — patterns from Salesforce, CargoWise, SAP, Microsoft, Google  

No leaf unturned. The agent proposes modern tech proactively — you should not have to ask for React, real-time sync, command palettes, or the next stack upgrade.

Legacy stays at `/index.html` until you approve cutover. Innovation ships inside `/app/` without breaking quotes or pricing math.

---

## The lesson (why we’re doing this)

Vanilla HTML/JS worked, but it hid better options:

| We stayed on | We should have moved to | Why sooner |
|--------------|----------------------|------------|
| Single `app-v4.js` monolith | **React + components** | Reuse desks, test UI in isolation |
| Copy-paste pricing in JS | **`pricing-core` TypeScript package** | One source of truth, unit tests |
| Manual refresh / localStorage | **Firestore + live subscriptions** | Team sees same data instantly |
| Alert boxes & tables | **Enterprise UX** (⌘K, inspector, toasts) | Speed for daily quoting |
| No typed API layer | **Next.js + TypeScript** | Catch bugs before deploy |

**From now on:** each phase is scored on parity **and** premium bar.

---

## North star (who we’re building toward)

| Class | Products | Atlas equivalent |
|-------|----------|------------------|
| Freight ops | CargoWise, Magaya | Air/Sea/Courier desks, Circulars, SLA |
| CRM | Salesforce | Enquiry DB, pipeline, inspector, Won/Lost |
| ERP | SAP | Roles, audit, finance reports |
| Productivity | Microsoft 365, Google | ⌘K, keyboard flows, live sync |

---

## Dual-track model — every phase from Phase 0

```
Phase N =  (A) Legacy features from Feature Parity tracker
        +  (B) Innovation items from Innovation tracker (/app/feature-parity)
        +  (C) Retrofit — upgrade earlier phases if we find gaps
```

**Retrofit rule:** If Phase 7 needs shadcn/ui tables, we also upgrade Enquiry DB (Phase 4) — not leave old pages on bare HTML tables.

---

## Phase-by-phase: parity + innovation (full timeline)

### Phase 0 — Prove the modern shell
| Parity | Innovation (should have been day 1) |
|--------|-------------------------------------|
| Mock screens | ✅ React component model |
| | ✅ Design tokens (CSS variables) |
| | ✅ Loading skeletons on all data pages |
| | ✅ Error boundaries (graceful failures) |

### Phase 1 — Foundation
| Parity | Innovation |
|--------|------------|
| Next.js at `/app` | ✅ App Router, TypeScript, Tailwind 4 |
| | ✅ Static export for Firebase |
| | 🔜 Route-level metadata & SEO |
| | ✅ Accessible layout (skip link, focus rings) |

### Phase 2 — Live data
| Parity | Innovation |
|--------|------------|
| Firebase auth + reads | ✅ Firebase v11 modular SDK |
| | ✅ TanStack Query (server state) |
| | ✅ Live Firestore subscriptions (enquiries) |
| | 🔜 Real-time tariffs & circulars |
| | 🔜 Optimistic cache updates |

### Phase 3 — Trusted math
| Parity | Innovation |
|--------|------------|
| Air/Sea/Courier calculations | ✅ `@atlas/pricing-core` package |
| | ✅ Vitest unit tests (17+) |
| | 🔜 Property-based tests on weight breaks |
| | 🔜 Quote calc audit trail in Firestore |

### Phase 4 — First desk + DB
| Parity | Innovation |
|--------|------------|
| Courier desk, Enquiry filters | ✅ Unified API mock/live switch |
| | 🔜 TanStack Table (sort, resize, virtual scroll) |
| | 🔜 Zod + React Hook Form on desks |
| | ✅ Toast notifications on save/error |

### Phase 5 — Air & Sea desks
| Parity | Innovation |
|--------|------------|
| Simplified Air/Sea + save | ✅ Shared desk patterns |
| | 🔜 Inline validation with field-level errors |
| | 🔜 Tariff intelligence (“rate vs last 10 quotes”) |
| | ✅ Desk keyboard shortcuts (Save = ⌘S) |

### Phase 6 — Quote lifecycle
| Parity | Innovation |
|--------|------------|
| View/print/amend/won/lost | ✅ Quote preview + print CSS |
| | ✅ Structured ref IDs (AE/AI/SE/…) |
| | ✅ Command palette ⌘K |
| | ✅ Live enquiry sync |
| | 🔜 Optimistic won/lost/amend |
| | 🔜 Quote diff on amend |

### Phases 7–10 — Full desks + platform data
| Parity | Innovation |
|--------|------------|
| Multi-carrier Air/Sea, Transport, Warehouse | ✅ shadcn-style Input/Label/Tabs + TanStack Table |
| ✅ Air/Sea multi-carrier + fees + 3-step + export/import | ✅ Zod shipment validation |
| Smart Quote files, full Enquiry DB | Full-text search, CSV export |
| Circulars upload | Drag-drop upload, Excel → tariff pipeline |
| | 🔜 React PDF official quotations |
| | Route prefetch from Enquiry inspector |

### Phases 11–13 — CRM, admin, analytics
| Parity | Innovation |
|--------|------------|
| Directory, Sales, Admin, NRS, Ops | RBAC-aware UI |
| Manager analytics | Charts (Recharts), export |
| | Audit log collection |
| | Customer 360 panel |
| | AI Smart Inbox (email → quote draft) |

### Phase 14 — Cutover readiness
| Parity | Innovation |
|--------|------------|
| Switch default to `/app/` (your approval) | Sentry error monitoring |
| | Playwright E2E on parity checklist |
| | PWA + offline quote draft |
| | WCAG 2.1 AA audit |
| | Performance budgets (LCP &lt; 2.5s) |
| | i18n scaffolding |

✅ = shipped · 🔜 = planned / retrofit

---

## Innovation backlog (agent will propose proactively)

- **Smart inbox** — forward enquiry email → parsed quote  
- **Rate intelligence** — Circulars vs historical lane performance  
- **SLA autopilot** — escalate overdue to manager  
- **FX desk** — live rates with quote lock  
- **Team presence** — who’s on which desk  
- **Quote diff** — amend side-by-side  
- **Voice-to-quote** (future) — mobile field sales  

---

## Retrofit queue (upgrade earlier phases — no leaf unturned)

These apply **across Phases 0–6** as we continue:

| Item | Affects | Priority |
|------|---------|----------|
| ~~Toast notifications~~ | All save actions | ✅ Done |
| ~~Error boundaries~~ | Whole app | ✅ Done |
| ~~Loading skeletons~~ | Dashboard, EDB | ✅ Done (Circulars next) |
| Zod validation | All desks | High — Phase 7 start |
| shadcn/ui | All forms & tables | High — Phase 7 start |
| Optimistic updates | EDB actions | Medium |
| ~~⌘S save shortcut~~ | Desks | ✅ Done |
| Real-time tariffs | Air/Sea desks | Medium |
| ~~Skip link (a11y)~~ | All pages | ✅ Done |

---

## What we will NOT do without your approval

- Make `/app/` the default homepage  
- Break Firestore quote schema or pricing math  
- Auto-deploy to production  
- Paid SaaS without a local/mock fallback  

---

**Track live progress:** `/app/feature-parity` (Parity + Innovation tabs)  
**See also:** `FEATURE_PARITY.md`, `REACT_MIGRATION.md`
