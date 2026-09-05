"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  Database,
  FileText,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  PackageCheck,
  PlaneTakeoff,
  Shield,
  Ship,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appVersion } from "@/lib/env";
import { useAuthStore } from "@/store/auth";
import {
  canAccessRoute,
  deskFocusLabel,
  preferredHomePath,
  type AppRouteId,
} from "@/lib/auth/rbac";
import { MockBanner } from "./MockBanner";
import { RouteGuard } from "./RouteGuard";
import { FxConverter, GlobalRefreshButton, OfflineBadge } from "./ShellChrome";
import { PremiumPip, PremiumPipToggle } from "./PremiumPip";
import { PremiumQuoteOverlay, QuoteOverlayToggle } from "./PremiumQuoteOverlay";

const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  route: AppRouteId;
}> = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true, route: "dashboard" },
  { href: "/quote", label: "Quote hub", icon: Sparkles, route: "smart-quote" },
  { href: "/air", label: "Air desk", icon: PlaneTakeoff, route: "air" },
  { href: "/sea", label: "Sea desk", icon: Ship, route: "sea" },
  { href: "/courier", label: "Courier", icon: Package, route: "courier" },
  { href: "/transport", label: "Transport", icon: Truck, route: "transport" },
  { href: "/warehouse", label: "Warehouse", icon: Warehouse, route: "warehouse" },
  { href: "/inbox", label: "Inbox", icon: Inbox, route: "inbox" },
  { href: "/enquiries", label: "Enquiry DB", icon: Database, route: "enquiries" },
  { href: "/carriers", label: "Carriers", icon: Ship, route: "directory" },
  { href: "/circulars", label: "Circulars", icon: FileText, route: "circulars" },
  { href: "/directory", label: "Directory", icon: Users, route: "directory" },
  { href: "/sales", label: "Sales", icon: Briefcase, route: "sales" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, route: "analytics" },
  { href: "/ops", label: "Operations", icon: PackageCheck, route: "ops" },
  { href: "/finance", label: "Finance", icon: Landmark, route: "finance" },
  { href: "/admin", label: "Admin", icon: Shield, route: "admin" },
  { href: "/hr", label: "HR roster", icon: Users, route: "hr" },
  { href: "/docs", label: "Docs", icon: BookOpen, route: "docs" },
  { href: "/feature-parity", label: "Feature parity", icon: ClipboardCheck, route: "feature-parity" },
];

function pathActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const visibleNav = useMemo(
    () => navItems.filter((item) => canAccessRoute(user?.username, user?.role, item.route)),
    [user?.username, user?.role],
  );

  const mobileTabs = useMemo(() => {
    const tabs: Array<{
      href: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      route: AppRouteId;
      exact?: boolean;
    }> = [
      { href: "/", label: "Home", icon: Home, route: "dashboard", exact: true },
      { href: "/quote", label: "Quote", icon: Sparkles, route: "smart-quote" },
      { href: "/inbox", label: "Inbox", icon: Inbox, route: "inbox" },
      { href: "/carriers", label: "Lines", icon: Ship, route: "directory" },
    ];
    return tabs.filter((t) => canAccessRoute(user?.username, user?.role, t.route));
  }, [user?.username, user?.role]);

  const focus = deskFocusLabel(user?.username);
  const home = preferredHomePath(user?.username, user?.role);
  const showInbox = canAccessRoute(user?.username, user?.role, "inbox");

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <MockBanner />
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-atlas-navy)] text-white md:flex md:flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-[11px] font-black text-white">
                A
              </span>
              ATLAS PRICING
            </div>
            <div className="mt-1 text-xs text-white/60">Quote · book · track · v{appVersion}</div>
            <div className="mt-2 inline-flex rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-100">
              {focus}
            </div>
            <button
              type="button"
              onClick={() => setQuoteOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-3 py-2 text-xs font-bold text-white hover:bg-teal-400"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New quote
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
            {visibleNav.map((item) => {
              const active = pathActive(normalized, item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-teal-400" />
                  ) : null}
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="text-xs text-white/50">Signed in as</div>
            <div className="text-sm font-semibold">{user?.displayName}</div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-[90] md:hidden">
            <button
              type="button"
              className="atlas-overlay absolute inset-0"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-[min(20rem,92vw)] flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-atlas-navy)] px-4 py-4 text-white">
                <span className="font-extrabold">Menu</span>
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto">
                {visibleNav.map((item) => {
                  const active = pathActive(normalized, item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-sm font-semibold",
                        active ? "bg-sky-50 text-[var(--color-atlas-navy)]" : "text-slate-700",
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-0 h-full w-1 bg-teal-500" />
                      ) : null}
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-[var(--color-border)] p-4 text-xs text-[var(--color-text-muted)]">
                Help · Connectivity · v{appVersion}
              </div>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col pb-[4.25rem] md:pb-0">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-[var(--color-atlas-navy)] px-3 py-2.5 text-white md:hidden">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-white/10"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href={home} className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-[10px]">
                A
              </span>
              Atlas
            </Link>
            <div className="flex items-center gap-1">
              <QuoteOverlayToggle onOpen={() => setQuoteOpen(true)} />
              {showInbox ? (
                <Link href="/inbox" className="rounded-lg p-2 hover:bg-white/10" aria-label="Inbox">
                  <Inbox className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </header>

          <header className="sticky top-0 z-40 hidden items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white/90 px-6 py-2.5 backdrop-blur-md md:flex">
            <div className="min-w-0 text-sm text-[var(--color-text-muted)]">
              {focus} workspace —{" "}
              <kbd className="rounded border border-[var(--color-border)] bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold">
                ⌘K
              </kbd>{" "}
              to jump
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OfflineBadge />
              <GlobalRefreshButton />
              <FxConverter />
              <PremiumPipToggle onOpen={() => setPipOpen(true)} />
              <QuoteOverlayToggle onOpen={() => setQuoteOpen(true)} />
              {showInbox ? (
                <Link
                  href="/inbox"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--color-atlas-navy)] hover:bg-slate-50"
                >
                  <Inbox className="h-3.5 w-3.5" />
                  Inbox
                </Link>
              ) : null}
              <a
                href="/index.html"
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:bg-slate-50"
              >
                Legacy
              </a>
            </div>
          </header>

          <main className="flex-1 p-3 md:p-5">
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--color-border)] bg-white/95 backdrop-blur md:hidden">
        {mobileTabs.map((tab) => {
          const active = pathActive(normalized, tab.href, tab.exact);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold",
                active ? "text-teal-600" : "text-[var(--color-text-muted)]",
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-[var(--color-text-muted)]"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      <PremiumPip open={pipOpen} onOpenChange={setPipOpen} title="Atlas focus">
        <p className="text-xs text-[var(--color-text-muted)]">
          Keep notes beside any desk. Heavy reports stay on desktop.
        </p>
        <ul className="mt-3 space-y-2 text-xs">
          <li className="rounded-lg border border-[var(--color-border)] bg-slate-50 px-2.5 py-2">
            Use <strong>New quote</strong> for the 3-step rate finder overlay.
          </li>
          <li className="rounded-lg border border-[var(--color-border)] bg-slate-50 px-2.5 py-2">
            Mobile keeps Quote, Inbox, and Carriers — full desks on larger screens.
          </li>
          <li className="rounded-lg border border-[var(--color-border)] bg-slate-50 px-2.5 py-2">
            <Link
              href="/quote"
              className="font-semibold text-sky-800 hover:underline"
              onClick={() => setPipOpen(false)}
            >
              Open quote hub →
            </Link>
          </li>
        </ul>
      </PremiumPip>

      <PremiumQuoteOverlay open={quoteOpen} onOpenChange={setQuoteOpen} />
    </div>
  );
}
