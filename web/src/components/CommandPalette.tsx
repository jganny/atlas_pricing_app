"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Anchor,
  ClipboardCheck,
  Database,
  FileText,
  Inbox,
  LayoutDashboard,
  Package,
  Plane,
  PlaneTakeoff,
  Search,
  Ship,
  Sparkles,
  Users,
} from "lucide-react";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { canAccessRoute, type AppRouteId } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import type { EnquiryRecord } from "@/lib/types";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  group: "Quotes" | "Navigate" | "Desks" | "Tools" | "System";
  route?: AppRouteId;
}

const NAV_COMMANDS: Omit<CommandItem, "action">[] = [
  { id: "home", label: "Dashboard", href: "/", icon: LayoutDashboard, group: "Navigate", route: "dashboard" },
  { id: "air", label: "Air desk", href: "/air", icon: PlaneTakeoff, group: "Desks", route: "air" },
  { id: "sea", label: "Sea desk", href: "/sea", icon: Ship, group: "Desks", route: "sea" },
  { id: "courier", label: "Courier desk", href: "/courier", icon: Package, group: "Desks", route: "courier" },
  { id: "sq-air", label: "Smart Quote · Air (standalone)", hint: "optional", href: "/smart-quote/air", icon: Plane, group: "Tools", route: "smart-quote" },
  { id: "sq-sea", label: "Smart Quote · Sea (standalone)", hint: "optional", href: "/smart-quote/sea", icon: Anchor, group: "Tools", route: "smart-quote" },
  { id: "inbox", label: "Enquiry inbox", href: "/inbox", icon: Inbox, group: "Tools", route: "inbox" },
  { id: "edb", label: "Enquiry database", href: "/enquiries", icon: Database, group: "Tools", route: "enquiries" },
  { id: "circulars", label: "Circulars library", href: "/circulars", icon: FileText, group: "Tools", route: "circulars" },
  { id: "directory", label: "Directory CRM", href: "/directory", icon: Users, group: "Tools", route: "directory" },
  { id: "parity", label: "Feature parity tracker", href: "/feature-parity", icon: ClipboardCheck, group: "System", route: "feature-parity" },
];

function rankQuote(row: EnquiryRecord, q: string): number {
  const ref = row.ref.toLowerCase();
  const customer = row.customer.toLowerCase();
  const lane = `${row.origin} ${row.destination}`.toLowerCase();
  const carrier = (row.carrier || "").toLowerCase();
  if (ref === q) return 100;
  if (ref.startsWith(q)) return 90;
  if (ref.includes(q)) return 80;
  if (customer.startsWith(q)) return 70;
  if (customer.includes(q)) return 60;
  if (carrier.includes(q)) return 50;
  if (lane.includes(q)) return 40;
  if (row.assignee.toLowerCase().includes(q) || row.creator.includes(q)) return 30;
  return 0;
}

export function CommandPalette() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: enquiries = [] } = useEnquiries();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    const allowedNav = NAV_COMMANDS.filter(
      (c) => !c.route || canAccessRoute(user?.username, user?.role, c.route),
    );
    const nav: CommandItem[] = [
      ...allowedNav.map((c) => ({
        ...c,
        action: c.href ? () => router.push(c.href!) : undefined,
      })),
      {
        id: "legacy",
        label: "Open legacy production app",
        hint: "index.html",
        action: () => {
          window.location.href = "/index.html";
        },
        icon: Sparkles,
        group: "System" as const,
      },
    ];

    const quoteHits: CommandItem[] = [];
    if (q.length >= 2 && canAccessRoute(user?.username, user?.role, "enquiries")) {
      const ranked = enquiries
        .map((row) => ({ row, score: rankQuote(row, q) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      for (const { row } of ranked) {
        quoteHits.push({
          id: `quote-${row.id}`,
          label: row.ref,
          hint: `${row.customer} · ${row.origin}→${row.destination}`,
          icon: Database,
          group: "Quotes",
          action: () =>
            router.push(
              `/enquiries/?q=${encodeURIComponent(row.ref)}&select=${encodeURIComponent(row.id)}`,
            ),
        });
      }
    }

    const all = [...quoteHits, ...nav];
    if (!q) return nav;
    return all.filter(
      (item) =>
        item.group === "Quotes" ||
        item.label.toLowerCase().includes(q) ||
        item.hint?.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [query, router, enquiries, user?.username, user?.role]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setActiveIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function run(item: CommandItem) {
    setOpen(false);
    setQuery("");
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[activeIndex]) {
      e.preventDefault();
      run(items[activeIndex]);
    }
  }

  const groups = ["Quotes", "Navigate", "Desks", "Tools", "System"] as const;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
            placeholder="Find quote by ref, customer, carrier… or jump to a desk"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <kbd className="rounded border border-[var(--color-border)] bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)]">
            ESC
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">No matches</li>
          ) : (
            groups.map((group) => {
              const groupItems = items.filter((i) => i.group === group);
              if (!groupItems.length) return null;
              return (
                <li key={group}>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {group}
                  </div>
                  {groupItems.map((item) => {
                    const idx = items.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                          idx === activeIndex ? "bg-[var(--color-atlas-navy)] text-white" : "hover:bg-slate-50",
                        )}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => run(item)}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-80" />
                        <span className="flex-1 font-semibold">{item.label}</span>
                        {item.hint ? (
                          <span
                            className={cn(
                              "max-w-[45%] truncate text-xs",
                              idx === activeIndex ? "text-white/70" : "text-[var(--color-text-muted)]",
                            )}
                          >
                            {item.hint}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-muted)]">
          ↑↓ navigate · Enter open · ⌘K toggle — type a ref to jump straight into Enquiry DB
        </div>
      </div>
    </div>
  );
}
