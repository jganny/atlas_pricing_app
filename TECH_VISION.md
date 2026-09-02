# Atlas Pricing — Premium Tech Vision (Phases 7–14)

**Your standing instruction:** While building legacy feature parity, we also push the app toward **Salesforce / CargoWise / SAP / Microsoft** class quality — proactively adopting modern tech, not waiting to be asked.

Legacy stays production until you approve cutover. Innovation ships **inside** the React app at `/app/` without breaking saved quotes or pricing math.

---

## What we missed before (lesson learned)

Vanilla HTML/JS carried Atlas for years, but it blocked:

- Component reuse, typed pricing logic, real-time sync
- Enterprise UX patterns (command palette, keyboard flows, design systems)
- Faster iteration without risking the whole monolith

**React + Next.js + TypeScript** should have been proposed earlier. From Phase 7 onward, every phase includes an **Innovation slice** alongside parity work.

---

## Target experience (north star)

| Tier | Examples | What Atlas should feel like |
|------|----------|----------------------------|
| **Ops platforms** | CargoWise, Magaya | Dense desks, keyboard-first, live data |
| **CRM / sales** | Salesforce | Pipeline, inspector panels, audit trail |
| **ERP** | SAP | Role-aware UI, reports, compliance |
| **Productivity** | Microsoft 365, Google Workspace | Cmd+K, instant search, real-time co-presence |

---

## Innovation stack (adopt progressively)

### Already in place
- Next.js 16 App Router, React 19, TypeScript
- Firebase Auth + Firestore
- TanStack Query + Zustand
- Shared `pricing-core` package (tested math)
- Static export on Firebase Hosting (`/app/`)

### Phase 6+ (shipping now)
| Tech | Why | Status |
|------|-----|--------|
| **Live Firestore subscriptions** | Enquiries update instantly like Salesforce lists — no manual Refresh | ✅ Phase 6+ |
| **Command palette (⌘K)** | Jump anywhere in one keystroke — Microsoft/Google pattern | ✅ Phase 6+ |
| **Structured ref IDs** | Legacy-compatible AE/AI/SE refs in modern app | ✅ Phase 6 |
| **Quote lifecycle + print** | View/amend/won without legacy | ✅ Phase 6 |

### Phases 7–10 (parity + premium)
| Tech | Why |
|------|-----|
| **shadcn/ui + Radix** | Accessible dialogs, sheets, data tables — Salesforce-grade components |
| **Zod + React Hook Form** | Validated desks — fewer bad saves, clearer errors |
| **TanStack Table** | Enquiry DB: sort, column pin, virtual scroll for 1000+ rows |
| **React PDF / print CSS** | Official quotation PDFs matching legacy layout |
| **Optimistic updates** | Won/lost/amend feels instant; rolls back on error |
| **Route prefetch** | Desks load instantly from Enquiry DB |

### Phases 11–13 (platform)
| Tech | Why |
|------|-----|
| **Firestore real-time everywhere** | Circulars, tariffs, ops board — team sees same data |
| **Full-text search (Algolia or Firestore extension)** | Find quote/customer/lane in &lt;100ms |
| **Role-based UI (RBAC)** | Air Nomination / NRS / Admin see correct fields |
| **Audit log collection** | Who amended what, when — compliance like SAP |
| **Background sync + PWA** | Quote on tablet at airport, sync when online |
| **AI assist (structured)** | Smart Quote + desk prefill from email/PDF — extend legacy copilot |

### Phase 14 (cutover readiness)
| Tech | Why |
|------|-----|
| **Error monitoring (Sentry)** | Production visibility before go-live |
| **E2E tests (Playwright)** | Parity checklist automated |
| **Performance budgets** | LCP &lt; 2.5s on desks |
| **WCAG 2.1 AA** | Keyboard + screen reader for enterprise buyers |
| **i18n ready** | INR/USD teams, future Arabic/German labels |

---

## How each phase will work (dual track)

```
Phase N =  (A) Legacy parity items from Feature Parity tracker
        +  (B) Innovation slice from this document
```

You test both: *“Does it match legacy?”* and *“Does it feel premium?”*

---

## Innovation ideas on the backlog (agent proposes; you approve)

- **Smart inbox** — paste or forward enquiry email → structured quote draft
- **Rate intelligence** — highlight when Circulars rate beats last 10 quotes on lane
- **SLA autopilot** — escalate overdue enquiries to manager dashboard
- **Customer 360** — one pane: quotes, credit status, agency agreement
- **Multi-currency FX desk** — live XE-style ticker with locked quote rates
- **Quote diff** — amend shows side-by-side old vs new (Git-style)
- **Team presence** — “Shaheer is on Air desk” (optional, Firestore presence)

We will surface these as we build — not hide them until you ask.

---

## What we will NOT do without asking

- Replace legacy as default homepage
- Change Firestore quote schema in breaking ways
- Auto-deploy to production
- Add paid third-party services without a free/local fallback

---

See also: `FEATURE_PARITY.md`, `/app/feature-parity`, `REACT_MIGRATION.md`
