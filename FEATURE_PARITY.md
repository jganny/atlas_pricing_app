# Feature parity — legacy vs React

**Policy (your decision):** Migration from legacy to React stays **on hold** until every legacy feature exists in the React app, you have tested each one, and you approve cutover only when React is **equal or better**.

- **Production today:** https://vertex-35d95.web.app/index.html (legacy)
- **Preview / build target:** https://vertex-35d95.web.app/app/ (React)
- **Live tracker in React:** `/app/feature-parity`

---

## Progress snapshot

Run the React app and open **Feature parity** in the sidebar for the live checklist (updates as we ship).

Rough counts (~120 tracked features):

| Status | Meaning |
|--------|---------|
| **Done** | Works in React — ready for your side-by-side test |
| **Partial** | Started but missing pieces vs legacy |
| **Missing** | Legacy only — still to build |

**Current:** ~25 done, ~5 partial, ~90 missing (~21% complete).

---

## Original phases 0–5 (foundation — done)

| Phase | Work |
|-------|------|
| 0 | Vite React mock shell |
| 1 | Next.js foundation (`/app`) |
| 2 | Firebase auth + live reads |
| 3 | `pricing-core` math package |
| 4 | Courier desk + Enquiry DB filters |
| 5 | Air & Sea desks (simplified) + save |

These proved the stack. They did **not** migrate the full legacy product.

---

## New phases 6–14 (full parity — your gate for migration)

| Phase | Focus | Examples |
|-------|--------|----------|
| **6** | Quote lifecycle + courier polish | View/print quote, amend, won/lost, full surcharges |
| **7** | Air & Sea full parity | Multi-carrier cards, origin/dest fees, PDF, 3-step flow |
| **8** | Smart Quote full parity | File upload, apply to desk, save draft |
| **9** | Enquiry DB full parity | Inspector, row actions, GP modes, CSV reports, archive |
| **10** | Transport & Warehouse | Full desks with save |
| **11** | Circulars manage + Directory + Sales | Upload tariffs, CRM, pipeline kanban |
| **12** | Admin, roles & NRS | User mgmt, credit control, NRS convert |
| **13** | Manager panel & platform | Analytics, ops board, member dashboard |
| **14** | Shell UX + cutover | Cmd+K, FX ticker, mobile nav — **only after you approve** |

Say **“Start Phase 6”** (or any number) when you want the next chunk built.

---

## Your testing workflow

1. Open legacy and React side by side.
2. In React, go to **Feature parity** → expand a group → follow **Test** hints on each row.
3. Mark mentally (or tell the agent): works / broken / missing.
4. When **all rows are Done** and you are satisfied → say **“Approve migration.”**
5. Then (and only then) we switch `/` to serve React instead of `index.html`.

---

## What we will NOT do without your approval

- Make `/app/` the default homepage
- Retire or remove legacy files
- Tell the team to stop using legacy

Legacy stays the daily app until you sign off on parity.

---

See also: `MIGRATION_STATUS.md`, `REACT_MIGRATION.md`
