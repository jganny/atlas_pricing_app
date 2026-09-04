/**
 * Innovation tracker — premium tech from Phase 0 onward.
 * Dual track with legacy parity: every phase must score here too.
 */

export type InnovationStatus = "done" | "partial" | "planned" | "retrofit";

export interface InnovationItem {
  id: string;
  name: string;
  phase: number;
  status: InnovationStatus;
  why: string;
  react?: string;
}

export const INNOVATION_PRINCIPLE =
  "This is a new version — not a minimal port. From Phase 0, every phase ships legacy parity AND premium tech (Salesforce / CargoWise / SAP class). No leaf unturned.";

export const innovationItems: InnovationItem[] = [
  // Phase 0
  { id: "i0-react", name: "React component architecture", phase: 0, status: "done", why: "Reuse, test, scale — vs monolithic HTML", react: "All pages" },
  { id: "i0-tokens", name: "Design tokens (CSS variables)", phase: 0, status: "done", why: "Consistent premium brand", react: "globals.css" },
  { id: "i0-skeleton", name: "Loading skeleton states", phase: 0, status: "done", why: "Perceived performance like enterprise apps", react: "Dashboard, EDB" },
  { id: "i0-error-boundary", name: "Error boundaries", phase: 0, status: "done", why: "Graceful failure — not white screen", react: "App shell" },

  // Phase 1
  { id: "i1-next", name: "Next.js 16 App Router", phase: 1, status: "done", why: "Modern routing, static export, future SSR option", react: "/app" },
  { id: "i1-ts", name: "TypeScript strict mode", phase: 1, status: "done", why: "Catch bugs at build time", react: "web/" },
  { id: "i1-tailwind", name: "Tailwind CSS 4", phase: 1, status: "done", why: "Fast, consistent UI", react: "web/" },
  { id: "i1-a11y", name: "Skip link + keyboard focus", phase: 1, status: "done", why: "WCAG foundation", react: "Layout" },

  // Phase 2
  { id: "i2-firebase", name: "Firebase v11 modular SDK", phase: 2, status: "done", why: "Tree-shakeable, maintained", react: "lib/firebase" },
  { id: "i2-query", name: "TanStack Query", phase: 2, status: "done", why: "Server state cache — Salesforce lists", react: "hooks/" },
  { id: "i2-live", name: "Live Firestore subscriptions", phase: 2, status: "done", why: "No manual refresh", react: "Enquiry DB" },
  { id: "i2-live-tariffs", name: "Live tariff/circular sync", phase: 2, status: "partial", why: "Circulars + tariffs load live; publish path shipped", react: "/circulars" },

  // Phase 3
  { id: "i3-core", name: "pricing-core package", phase: 3, status: "done", why: "Shared tested math — air/sea/courier", react: "packages/" },
  { id: "i3-vitest", name: "Unit tests on pricing math", phase: 3, status: "done", why: "Trust numbers vs legacy", react: "17+ tests" },
  { id: "i3-audit", name: "Calc audit trail in quotes", phase: 3, status: "planned", why: "SAP-style traceability", react: "Firestore" },

  // Phase 4
  { id: "i4-api", name: "Unified mock/live API layer", phase: 4, status: "done", why: "Dev without Firebase", react: "lib/api" },
  { id: "i4-table", name: "TanStack Table (sort/virtual)", phase: 4, status: "done", why: "1000+ enquiry rows", react: "/enquiries" },
  { id: "i4-zod", name: "Zod + React Hook Form", phase: 4, status: "partial", why: "Field-level validation", react: "Desks (Zod schemas)" },
  { id: "i4-toast", name: "Toast notifications", phase: 4, status: "done", why: "Save/error feedback like SaaS", react: "Global" },

  // Phase 5
  { id: "i5-desks", name: "Shared desk architecture", phase: 5, status: "done", why: "Air/Sea/Courier same patterns", react: "/air /sea /courier" },
  { id: "i5-tariff-ai", name: "Tariff intelligence hints", phase: 5, status: "planned", why: "Rate vs lane history", react: "Desks" },
  { id: "i5-cmd-s", name: "⌘S save on desks", phase: 5, status: "done", why: "Keyboard-first ops", react: "/air /sea /courier" },

  // Phase 6
  { id: "i6-cmdk", name: "Command palette ⌘K", phase: 6, status: "done", why: "Microsoft/Google navigation", react: "Global" },
  { id: "i6-lifecycle", name: "Quote lifecycle in React", phase: 6, status: "done", why: "View/amend/won without legacy", react: "Enquiry DB" },
  { id: "i6-print", name: "Print-ready quote preview", phase: 6, status: "done", why: "Official output", react: "Preview modal" },
  { id: "i6-optimistic", name: "Optimistic status updates", phase: 6, status: "planned", why: "Instant won/lost feel", react: "Inspector" },

  // Phase 7–10
  { id: "i7-shadcn", name: "shadcn/ui + Radix", phase: 7, status: "partial", why: "Accessible enterprise components", react: "Input/Label/Tabs/Table primitives" },
  { id: "i7-pdf", name: "React PDF quotations", phase: 7, status: "planned", why: "Match legacy print layout", react: "Quote export" },
  { id: "i7-multi-carrier", name: "Multi-carrier desk architecture", phase: 7, status: "done", why: "Compare airline/liner options like CargoWise", react: "/air /sea" },
  { id: "i7-fees", name: "Origin/dest surcharge engine", phase: 7, status: "done", why: "True grand totals with local fees", react: "pricing/surcharges" },
  { id: "i8-smart-file", name: "Smart Quote file upload", phase: 8, status: "done", why: "PDF/Excel/email parse", react: "/smart-quote/air" },
  { id: "i8-confidence", name: "Field-level confidence review", phase: 8, status: "done", why: "Edit before apply — better than legacy status string", react: "Smart Quote" },
  { id: "i8-apply-desk", name: "One-click apply to desk", phase: 8, status: "done", why: "Prefill Air/Sea from Smart Quote", react: "/air /sea" },
  { id: "i10-option-a", name: "Option A — paste on desk", phase: 10, status: "done", why: "Refined parse + editable review before Apply; rates blank until Circulars", react: "/air /sea" },
  { id: "i10-option-b", name: "Option B — Home New quote launcher", phase: 10, status: "planned", why: "Ruled out — duplicated desk paste; removed from Dashboard", react: "removed" },
  { id: "i9-search", name: "Full-text quote find in ⌘K", phase: 9, status: "done", why: "Ranked ref/customer/carrier → Enquiry DB inspector", react: "Command palette + /enquiries" },
  { id: "i9-gp-modes", name: "Buy/Sell/GP metric modes", phase: 9, status: "done", why: "Finance view without leaving the list", react: "/enquiries" },
  { id: "i9-csv", name: "One-click filtered CSV export", phase: 9, status: "done", why: "Legacy report columns for Excel", react: "/enquiries" },
  { id: "i10-imap-inbox", name: "IMAP AI enquiry inbox", phase: 10, status: "partial", why: "Full re-parse on Apply + richer poller; live mail needs secrets + functions deploy", react: "/inbox" },

  // Phase 11–14
  { id: "i11-rbac", name: "Role-based UI (RBAC)", phase: 11, status: "done", why: "Nav + soft route guard by desk login (Air Nom / Sea Nom / Free Hand / NRS / Admin)", react: "AppShell + RouteGuard" },
  { id: "i11-directory", name: "Directory CRM", phase: 11, status: "done", why: "Agents/Vendors grid + search + CRUD + CSV; live Firestore contactsDirectory", react: "/directory" },
  { id: "i11-ai", name: "AI Smart Inbox", phase: 11, status: "partial", why: "Inbox re-parse on Apply shipped in Phase 10; live IMAP + smarter routing still open", react: "/inbox" },
  { id: "i11-circulars", name: "Circulars manage + Excel publish", phase: 11, status: "done", why: "Upload/delete/categories + Excel→air_tariffs", react: "/circulars" },
  { id: "i11-sales", name: "Sales kanban + activity", phase: 11, status: "done", why: "Drag-drop pipeline + lead activity log", react: "/sales" },
  { id: "i10-transport", name: "Transport & warehouse desks", phase: 10, status: "done", why: "Charge desks with save + ⌘S", react: "/transport /warehouse" },
  { id: "i12-admin", name: "Admin credit + NRS capture", phase: 12, status: "done", why: "Credit control + NRS parties + user/reset queues", react: "/admin" },
  { id: "i13-analytics", name: "Analytics + ops + modules", phase: 13, status: "done", why: "KPI/leaderboard, ops board, finance/docs/HR shells", react: "/analytics /ops" },
  { id: "i13-member-home", name: "Member home + amendment queue", phase: 13, status: "done", why: "Sticky notes, SMS outbox, offline restore, admin amend approvals", react: "/" },
  { id: "i14-shell", name: "Mobile nav + FX + offline badge", phase: 14, status: "done", why: "Shell polish for cutover readiness", react: "AppShell" },
  { id: "i14-help", name: "Help FAB + FAQ", phase: 14, status: "done", why: "In-app help without leaving desk", react: "HelpFab" },
  { id: "i14-sentry", name: "Sentry monitoring", phase: 14, status: "planned", why: "Pre-cutover observability", react: "Production" },
  { id: "i14-e2e", name: "Playwright E2E", phase: 14, status: "planned", why: "Automated parity tests", react: "CI" },
  { id: "i14-pwa", name: "PWA + offline draft", phase: 14, status: "partial", why: "Manifest + offline quote cache; SW deferred", react: "public/manifest + offline-cache" },
];

export function innovationStats(items: InnovationItem[] = innovationItems) {
  return {
    total: items.length,
    done: items.filter((i) => i.status === "done").length,
    partial: items.filter((i) => i.status === "partial").length,
    planned: items.filter((i) => i.status === "planned").length,
    retrofit: items.filter((i) => i.status === "retrofit").length,
  };
}

export const innovationByPhase = (phase: number) =>
  innovationItems.filter((i) => i.phase === phase);
