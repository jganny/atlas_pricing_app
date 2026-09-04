/**
 * Feature parity tracker — legacy (index.html / app-v4.js) vs React (/app).
 * Migration stays ON HOLD until every item is "done" and user-tested.
 * Update statuses as features ship.
 */

export type ParityStatus = "done" | "partial" | "missing";

export interface ParityFeature {
  id: string;
  name: string;
  legacy: string;
  react?: string;
  status: ParityStatus;
  testHint?: string;
}

export interface ParityGroup {
  id: string;
  title: string;
  description: string;
  plannedPhase: number;
  features: ParityFeature[];
}

export const MIGRATION_POLICY = {
  headline: "Migration on hold until full feature parity",
  summary:
    "Legacy remains the production app. React is built until every legacy capability exists in /app, " +
    "you have tested each one, and you approve cutover only when React is equal or better.",
  legacyUrl: "/index.html",
  reactUrl: "/app/",
};

export const parityGroups: ParityGroup[] = [
  {
    id: "auth-admin",
    title: "Auth & admin",
    description: "Login, user management, desk roles, credit control",
    plannedPhase: 12,
    features: [
      { id: "auth-login", name: "Desk login (Firebase email/password)", legacy: "Login screen", react: "/login", status: "done", testHint: "Sign in with Atlas username/password" },
      { id: "auth-logout", name: "Sign out", legacy: "Header", react: "Sidebar", status: "done" },
      { id: "auth-signup", name: "Self-service sign up", legacy: "Login page", status: "missing" },
      { id: "auth-forgot", name: "Forgot / change password", legacy: "Login + admin", react: "/login", status: "partial", testHint: "Login forgot form queues reset; admin processes queue; Auth console sets password" },
      { id: "auth-admin-register", name: "Admin register new user", legacy: "Admin console", react: "/admin", status: "partial", testHint: "Queues roster entry locally until Auth Cloud Function" },
      { id: "auth-admin-reset", name: "Force password reset", legacy: "Admin console", react: "/admin", status: "partial", testHint: "Admin reset queue mark done; password change in Firebase Auth" },
      { id: "auth-roles", name: "Desk role switcher (Air/Sea/NRS/Sales)", legacy: "Sidebar", react: "AppShell RBAC", status: "done", testHint: "Nav filtered by login; soft route guard" },
      { id: "auth-credit", name: "Customer credit control & block", legacy: "Admin console", status: "done" },
      { id: "auth-firebase-config", name: "Firebase config paste / reconnect", legacy: "Admin console", status: "missing" },
    ],
  },
  {
    id: "home-manager",
    title: "Home & manager panel",
    description: "Admin overview, analytics, performance reports",
    plannedPhase: 13,
    features: [
      { id: "home-hub", name: "Home hub cards (Overview, Agents, EDB, Analytics)", legacy: "Home", react: "/", status: "done" },
      { id: "home-kpi", name: "Admin KPI rings (revenue, conversions, rate)", legacy: "Overview", react: "/", status: "done" },
      { id: "home-leaderboard", name: "Staff performance leaderboard", legacy: "Overview", status: "done" },
      { id: "home-reports", name: "Performance report generator (daily→annual)", legacy: "Overview", status: "missing" },
      { id: "home-amendments", name: "Pending amendment approval queue", legacy: "Overview", react: "/", status: "done", testHint: "Approve/reject on manager home — 2h unlock" },
      { id: "home-agents", name: "Quoting agents registry", legacy: "Quoting Agents tab", react: "/", status: "done" },
      { id: "home-analytics", name: "Analytics (pipeline, GP charts, route performance)", legacy: "Analytics tab", status: "done" },
      { id: "home-news", name: "Control tower / logistics news", legacy: "Overview", status: "missing" },
      { id: "dash-basic", name: "Basic SLA dashboard", legacy: "Member/admin home", react: "/", status: "done" },
    ],
  },
  {
    id: "member-desk",
    title: "Member / desk user dashboard",
    description: "Personal KPIs, NRS, sticky notes, quote logs",
    plannedPhase: 13,
    features: [
      { id: "member-kpi", name: "Personal KPI rings", legacy: "Member dashboard", react: "/", status: "done" },
      { id: "member-logs", name: "My quotation logs table", legacy: "Member dashboard", react: "/", status: "done" },
      { id: "member-nrs-alerts", name: "NRS confirmation intimation alerts", legacy: "Member dashboard", status: "partial", testHint: "NRS registry shown on member home; push alerts still open" },
      { id: "member-nrs-registry", name: "NRS shippers & consignees registry", legacy: "Member dashboard", react: "/ + /admin", status: "done" },
      { id: "member-sticky", name: "Connected desk sticky notes", legacy: "Member dashboard", react: "/", status: "done" },
      { id: "member-sms", name: "Instant SMS gateway", legacy: "Member dashboard", react: "/", status: "partial", testHint: "Local outbox UI; live gateway needs API key" },
      { id: "member-restore", name: "Restore cached quotes (browser backup)", legacy: "Member dashboard", react: "/", status: "done" },
      { id: "member-recreate", name: "Recreate / quick assist from prior quote", legacy: "Member dashboard", react: "/enquiries", status: "done", testHint: "Duplicate from inspector / recent quotes" },
    ],
  },
  {
    id: "air-desk",
    title: "Air freight desk",
    description: "Full export/import air quoting",
    plannedPhase: 7,
    features: [
      { id: "air-cargo", name: "Cargo dimensions matrix", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-breaks", name: "Weight breaks (sell/buy per bracket)", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-calc", name: "Chargeable weight & base freight calc", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-save", name: "Save new air quote to Firestore", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-tariff", name: "Load Circulars tariff", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-multi-carrier", name: "Multi-airline option cards + select quoted", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-origin-dest-fees", name: "Origin & destination surcharge tables", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-export-import", name: "Export / Import module toggle (AE/AI)", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-3step", name: "3-step flow (Shipment · Carrier · Terms)", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-agreement", name: "Agency agreement upload & compliance", legacy: "Air desk", react: "/air + /directory", status: "partial", testHint: "Nomination reminder on Terms; files live in Directory" },
      { id: "air-role-defaults", name: "Role-based currency, terms, surcharge visibility", legacy: "Air desk", react: "/air", status: "done" },
      { id: "air-smart-embed", name: "Embedded Smart Quote + file upload in desk", legacy: "Air desk", react: "/air", status: "done", testHint: "Paste enquiry strip on Air desk → Parse → Apply" },
      { id: "air-preview", name: "Official quote preview / print / PDF", legacy: "Air desk", react: "/air", status: "done", testHint: "Letterhead preview + print" },
      { id: "air-maps", name: "Google Maps airport embed", legacy: "Air desk", react: "/air", status: "partial", testHint: "Open airport map links (external Maps)" },
      { id: "air-fx", name: "Custom USD→INR exchange override", legacy: "Air desk", react: "/air", status: "done" },
    ],
  },
  {
    id: "sea-desk",
    title: "Sea freight desk",
    description: "Full FCL/LCL/BB ocean quoting",
    plannedPhase: 7,
    features: [
      { id: "sea-fcl-lcl", name: "FCL / LCL / break bulk modes", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-containers", name: "Container matrix + LCL rates", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-calc", name: "Chargeable RT & base freight calc", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-save", name: "Save new sea quote to Firestore", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-tariff", name: "Load Circulars tariff", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-multi-liner", name: "Multi-liner option cards", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-surcharges", name: "Origin/destination local surcharges", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-alternatives", name: "Sea alternatives comparison table", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-export-import", name: "Export / Import toggle (SE/SI)", legacy: "Sea desk", react: "/sea", status: "done" },
      { id: "sea-smart-embed", name: "Embedded Smart Quote + file upload", legacy: "Sea desk", react: "/sea", status: "done", testHint: "Paste enquiry strip on Sea desk → Parse → Apply" },
      { id: "sea-preview", name: "Official quote preview / print / PDF", legacy: "Sea desk", react: "/sea", status: "done", testHint: "Letterhead preview + print" },
      { id: "sea-warnings", name: "Heavy-weight / multi-axle trailer warnings", legacy: "Sea desk", react: "/sea", status: "done" },
    ],
  },
  {
    id: "courier-desk",
    title: "Courier desk",
    description: "Express parcel quoting",
    plannedPhase: 6,
    features: [
      { id: "courier-packages", name: "Package matrix + chargeable weight", legacy: "Courier desk", react: "/courier", status: "done" },
      { id: "courier-carriers", name: "Multi-carrier comparison + selection", legacy: "Courier desk", react: "/courier", status: "done" },
      { id: "courier-save", name: "Save courier quote", legacy: "Courier desk", react: "/courier", status: "done" },
      { id: "courier-surcharges", name: "Full surcharge grid (remote, DG, oversized…)", legacy: "Courier desk", react: "/courier", status: "done" },
      { id: "courier-terms", name: "Terms tab + default T&C", legacy: "Courier desk", react: "/courier", status: "done" },
      { id: "courier-preview", name: "Quote preview / print", legacy: "Courier desk", react: "/courier", status: "done" },
      { id: "courier-reset", name: "Reset desk with confirmation", legacy: "Courier desk", react: "/courier", status: "done" },
    ],
  },
  {
    id: "other-desks",
    title: "Transport & warehouse desks",
    description: "Road and storage quoting modules",
    plannedPhase: 10,
    features: [
      { id: "transport-desk", name: "Transportation desk (charges, surcharges, save)", legacy: "Transport tab", status: "done" },
      { id: "warehouse-desk", name: "Warehousing desk (rates, fees, save)", legacy: "Warehouse tab", status: "done" },
    ],
  },
  {
    id: "smart-quote",
    title: "Smart Quote automation",
    description: "Enquiry parsing and desk prefill",
    plannedPhase: 8,
    features: [
      { id: "sq-air-text", name: "Air — paste enquiry text", legacy: "Smart Quote", react: "/smart-quote/air", status: "done" },
      { id: "sq-sea-text", name: "Sea — paste enquiry text", legacy: "Smart Quote", react: "/smart-quote/sea", status: "done" },
      { id: "sq-file-upload", name: "File upload (PDF, Excel, Word, email)", legacy: "Air/Sea desk", react: "/smart-quote/air", status: "done", testHint: "Drop PDF/Excel/DOCX/TXT/EML on Smart Quote" },
      { id: "sq-apply-desk", name: "Apply parsed enquiry to full desk form", legacy: "Air/Sea desk", react: "/smart-quote/air", status: "done", testHint: "After parse → Apply to Air/Sea desk" },
      { id: "sq-home-launcher", name: "Home New quote launcher (Option B)", legacy: "Smart Quote", react: "/", status: "missing", testHint: "Ruled out — removed from Dashboard" },
      { id: "sq-excel-publish", name: "Excel tariff import → Circulars publish", legacy: "Circulars", status: "done" },
      { id: "sq-save", name: "Save Smart Quote draft as quote", legacy: "Smart Quote", react: "/smart-quote/air", status: "done", testHint: "Save draft quote from Smart Quote result" },
      { id: "sq-imap-inbox", name: "IMAP enquiry inbox (pricing + pricingsales)", legacy: "Email", react: "/inbox", status: "partial", testHint: "Apply re-parses full body; needs IMAP secrets + functions deploy for live mail" },
    ],
  },
  {
    id: "enquiry-db",
    title: "Enquiry database",
    description: "Pipeline, filters, reports, quote actions",
    plannedPhase: 9,
    features: [
      { id: "edb-list", name: "Searchable quote list", legacy: "Enquiry DB", react: "/enquiries", status: "done" },
      { id: "edb-sla", name: "SLA badges (due soon / overdue)", legacy: "Enquiry DB", react: "/enquiries", status: "done" },
      { id: "edb-pipeline", name: "Pipeline chips (Quoted / Won / Lost / Cancelled)", legacy: "Enquiry DB", react: "/enquiries", status: "done" },
      { id: "edb-advanced-filters", name: "Advanced filters + column picker", legacy: "Enquiry DB", react: "/enquiries", status: "done", testHint: "POL/POD/carrier + Columns toggles" },
      { id: "edb-gp-modes", name: "Buy / sell / GP display modes", legacy: "Enquiry DB", react: "/enquiries", status: "done", testHint: "Toggle Buy/Sell Total|Per kg and GP Amount|%" },
      { id: "edb-inspector", name: "Enquiry inspector (view / amend / won)", legacy: "Enquiry DB", react: "/enquiries", status: "done", testHint: "Click a row → inspector panel on the right" },
      { id: "edb-actions", name: "Duplicate, cancel, lost, delete row actions", legacy: "Enquiry DB", react: "/enquiries", status: "done", testHint: "Won/lost/cancel/delete/duplicate" },
      { id: "edb-reports", name: "Financial reports + CSV export", legacy: "Enquiry DB", react: "/enquiries", status: "partial", testHint: "Export CSV of filtered view + sell/GP summary cards; FY report cards in 9b" },
      { id: "edb-archive", name: "90-day archive + find old quote", legacy: "Enquiry DB", react: "/enquiries", status: "partial", testHint: "Find old/archived quote lookup — auto-archive write deferred" },
      { id: "edb-ownership", name: "Per-desk quote ownership filter", legacy: "Enquiry DB", react: "/enquiries", status: "done", testHint: "Desk filter + My desk for non-admin" },
    ],
  },
  {
    id: "quote-lifecycle",
    title: "Quote lifecycle",
    description: "View, amend, convert, print — after create",
    plannedPhase: 6,
    features: [
      { id: "ql-view", name: "View saved quote (official layout)", legacy: "Enquiry DB / desk", react: "/enquiries", status: "done", testHint: "Inspector → View / Print" },
      { id: "ql-print", name: "Print / PDF export", legacy: "All desks", react: "Quote preview", status: "done", testHint: "Print button in preview modal" },
      { id: "ql-amend", name: "Amend quote", legacy: "Enquiry DB", react: "/enquiries", status: "done", testHint: "Request unlock + amend on desk for air/sea/courier" },
      { id: "ql-amend-approve", name: "Admin amendment approval", legacy: "Manager panel", react: "/", status: "done" },
      { id: "ql-won", name: "Convert to Won", legacy: "Enquiry DB", react: "/enquiries", status: "done" },
      { id: "ql-lost", name: "Mark Lost / Cancelled", legacy: "Enquiry DB", react: "/enquiries", status: "done" },
      { id: "ql-delete", name: "Delete quote", legacy: "Enquiry DB", react: "/enquiries", status: "done" },
      { id: "ql-duplicate", name: "Duplicate / recreate onto desk", legacy: "Enquiry DB", react: "/enquiries", status: "done" },
      { id: "ql-refid", name: "Structured ref IDs (AE/AI/SE/SI/TR/WH/CR)", legacy: "Save flow", react: "Enquiry DB", status: "done" },
      { id: "ql-offline", name: "LocalStorage cache + offline recovery", legacy: "Global", react: "/ + desks", status: "done" },
    ],
  },
  {
    id: "circulars",
    title: "Circulars & tariffs",
    description: "Document library and tariff management",
    plannedPhase: 11,
    features: [
      { id: "circ-browse-air", name: "Browse published air tariffs", legacy: "Circulars", react: "/circulars", status: "done" },
      { id: "circ-browse-sea", name: "Browse published sea tariffs", legacy: "Circulars", react: "/circulars", status: "done" },
      { id: "circ-docs", name: "Circular documents list", legacy: "Circulars", react: "/circulars", status: "done" },
      { id: "circ-upload", name: "Upload documents (PDF/Excel/Word)", legacy: "Circulars", status: "done" },
      { id: "circ-delete", name: "Delete circulars", legacy: "Circulars", status: "done" },
      { id: "circ-categories", name: "Category tabs (tariffs, fuel, line circulars)", legacy: "Circulars", status: "done" },
      { id: "circ-import", name: "Excel import → publish tariffs", legacy: "Circulars", status: "done" },
    ],
  },
  {
    id: "directory-sales",
    title: "Directory & sales pipeline",
    description: "CRM and leads",
    plannedPhase: 11,
    features: [
      { id: "dir-contacts", name: "Global contacts grid", legacy: "Directory", status: "done" },
      { id: "dir-crud", name: "Add / edit / delete contacts", legacy: "Directory", status: "done" },
      { id: "dir-excel", name: "Excel import / export", legacy: "Directory", status: "done" },
      { id: "dir-agency", name: "Agent agreement file per contact", legacy: "Directory", status: "done" },
      { id: "dir-weekly", name: "Weekly agency list email", legacy: "Directory", status: "done" },
      { id: "sales-kanban", name: "Sales pipeline kanban + leads", legacy: "Sales tab", status: "done" },
      { id: "sales-activity", name: "Lead activity log", legacy: "Sales tab", status: "done" },
    ],
  },
  {
    id: "platform",
    title: "Platform modules (Ops / Docs / Finance / HR)",
    description: "Operations and roadmap shells",
    plannedPhase: 13,
    features: [
      { id: "ops-board", name: "Operations command center (won shipments)", legacy: "Operations", status: "done" },
      { id: "docs-module", name: "Documentation module shell", legacy: "Documentation", status: "done" },
      { id: "finance-module", name: "Finance module + financial reports link", legacy: "Finance", status: "done" },
      { id: "hr-module", name: "HR module shell", legacy: "HR", status: "partial" },
    ],
  },
  {
    id: "nrs-roles",
    title: "NRS & desk roles",
    description: "Nomination desk workflows",
    plannedPhase: 12,
    features: [
      { id: "nrs-convert", name: "NRS convert flow (shipper/consignee capture)", legacy: "NRS desk", react: "/admin", status: "done" },
      { id: "nrs-rules", name: "Role-specific quoting rules per desk category", legacy: "TEAM_ROLES", react: "desk-rules", status: "done" },
      { id: "nrs-agreement-hide", name: "Hide agency agreement for NRS / Free Hand", legacy: "Air/Sea desk", react: "/air", status: "done" },
    ],
  },
  {
    id: "shell-ux",
    title: "App shell & cross-cutting UX",
    description: "Navigation, assistant, FX, offline",
    plannedPhase: 14,
    features: [
      { id: "nav-modules", name: "Full module navigation (12+ areas)", legacy: "Sidebar + tabs", react: "Sidebar", status: "done" },
      { id: "nav-cmdk", name: "Command palette (Ctrl/Cmd+K)", legacy: "Global", react: "Global", status: "done", testHint: "Press ⌘K or Ctrl+K anywhere in /app" },
      { id: "nav-live-sync", name: "Live Firestore sync (enquiries)", legacy: "Global", react: "Enquiry DB", status: "done", testHint: "Save a quote in another tab — list updates automatically" },
      { id: "nav-assistant", name: "Atlas Help / AI copilot FAB", legacy: "Global", react: "HelpFab", status: "done", testHint: "Help button / ⌘?" },
      { id: "nav-fx", name: "Live FX ticker + converter", legacy: "Header", status: "done" },
      { id: "nav-offline", name: "Offline / sync status badge", legacy: "Header", status: "done" },
      { id: "nav-legacy-link", name: "Link to legacy app", legacy: "—", react: "Header", status: "done" },
      { id: "nav-mobile", name: "Mobile drawer navigation", legacy: "Sidebar", status: "done" },
      { id: "pwa", name: "PWA manifest + service worker", legacy: "Global", status: "partial", testHint: "Manifest shipped; full SW offline still open" },
    ],
  },
];

export function parityStats(groups: ParityGroup[] = parityGroups) {
  const all = groups.flatMap((g) => g.features);
  return {
    total: all.length,
    done: all.filter((f) => f.status === "done").length,
    partial: all.filter((f) => f.status === "partial").length,
    missing: all.filter((f) => f.status === "missing").length,
    percent: Math.round((all.filter((f) => f.status === "done").length / all.length) * 100),
  };
}

export const plannedPhases = [
  { phase: 6, title: "Quote lifecycle + courier polish", items: "View/print/amend/won/lost, full courier surcharges" },
  { phase: 7, title: "Air & Sea full parity", items: "Multi-carrier, surcharges, 3-step flow, preview/PDF" },
  { phase: 8, title: "Smart Quote full parity", items: "File upload, apply to desk, save draft" },
  { phase: 9, title: "Enquiry DB full parity", items: "Inspector, actions, reports, archive, GP modes" },
  { phase: 10, title: "Transport & Warehouse desks", items: "Full desks with save" },
  { phase: 11, title: "Circulars manage + Directory + Sales", items: "Upload, CRM, pipeline" },
  { phase: 12, title: "Admin, roles & NRS", items: "User mgmt, credit control, NRS convert" },
  { phase: 13, title: "Manager panel & platform modules", items: "Analytics, ops board, member dashboard" },
  { phase: 14, title: "Shell UX polish + your cutover approval", items: "Cmd+K, FX, offline, mobile — then switch default" },
];
