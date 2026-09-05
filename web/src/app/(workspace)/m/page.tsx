"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Download,
  Inbox,
  Plane,
  Share,
  Ship,
  Sparkles,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { PremiumQuoteOverlay } from "@/components/PremiumQuoteOverlay";
import { useAuthStore } from "@/store/auth";
import { deskFocusLabel } from "@/lib/auth/rbac";

/**
 * Mobile / PWA home — only the essentials:
 * Quote · Inbox · Air · Sea · Install
 * Heavy reports stay on the desktop webapp.
 */
export default function MobileHomePage() {
  const user = useAuthStore((s) => s.user);
  const focus = deskFocusLabel(user?.username);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(Boolean(isStandalone));

    function onBip(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  const tiles = [
    {
      title: "New quote",
      blurb: "3-step rate finder",
      icon: Sparkles,
      onClick: () => setQuoteOpen(true),
    },
    {
      title: "Inbox",
      blurb: "Pricing mail queue",
      icon: Inbox,
      href: "/inbox",
    },
    {
      title: "Air desk",
      blurb: "Full air quote",
      icon: Plane,
      href: "/air",
    },
    {
      title: "Sea desk",
      blurb: "Full sea quote",
      icon: Ship,
      href: "/sea",
    },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-4">
      <div className="rounded-2xl bg-[var(--color-atlas-navy)] px-5 py-6 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">Atlas mobile</p>
        <h1 className="mt-1 text-2xl font-extrabold">Hi {user?.displayName?.split(" ")[0] || "desk"}</h1>
        <p className="mt-1 text-sm text-white/75">{focus} · essentials only</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const inner = (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-atlas-navy)] text-white">
                <t.icon className="h-5 w-5" />
              </span>
              <span className="mt-3 text-sm font-extrabold text-[var(--color-atlas-navy)]">{t.title}</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{t.blurb}</span>
            </>
          );
          if (t.href) {
            return (
              <Link
                key={t.title}
                href={t.href}
                className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm active:scale-[0.98]"
              >
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={t.title}
              type="button"
              onClick={t.onClick}
              className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-white p-4 text-left shadow-sm active:scale-[0.98]"
            >
              {inner}
            </button>
          );
        })}
      </div>

      {!installed ? (
        <Card className="py-4">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 text-teal-600" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Install Atlas app</div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Add to your home screen for a full-screen mobile app (Quote, Inbox, desks). Reports
                stay on the desktop site.
              </p>
              {installEvent ? (
                <Button type="button" className="mt-3" onClick={() => void install()}>
                  Install
                </Button>
              ) : (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                  <Share className="h-3.5 w-3.5" />
                  iPhone: Share → Add to Home Screen
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs font-bold">
        <Link href="/quote" className="text-sky-800 hover:underline">
          Quote hub →
        </Link>
        <Link href="/carriers" className="text-sky-800 hover:underline">
          Carriers →
        </Link>
        <Link href="/" className="text-[var(--color-text-muted)] hover:underline">
          Full desktop home
        </Link>
      </div>

      <PremiumQuoteOverlay open={quoteOpen} onOpenChange={setQuoteOpen} />
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
