"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Button, Card } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { preferredHomePath } from "@/lib/auth/rbac";
import {
  DESK_SEATS,
  occupantLoginForSeat,
  personDisplayName,
} from "@/lib/auth/desk-seats";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useLiveData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";

export default function LoginPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(
    process.env.NEXT_PUBLIC_MOCK_MODE !== "false" ? "demo" : "",
  );
  const [displayName, setDisplayName] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUser, setForgotUser] = useState("");
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [signupMsg, setSignupMsg] = useState<string | null>(null);
  const [signupBusy, setSignupBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(preferredHomePath(user.username, user.role));
  }, [user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      await handleSignup();
      return;
    }
    try {
      await login(username, password);
    } catch {
      /* store holds error */
    }
  }

  async function handleSignup() {
    const u = username.trim().toLowerCase();
    if (!u || password.length < 6) {
      setSignupMsg("Choose a personal username and a password (min 6 characters).");
      return;
    }
    setSignupBusy(true);
    setSignupMsg(null);
    try {
      const entry = {
        username: u,
        displayName: displayName.trim() || u,
        role: "pricing",
        at: Date.now(),
        status: "pending_role",
      };
      const prev = JSON.parse(localStorage.getItem("atlas_pending_users") || "[]");
      prev.push(entry);
      localStorage.setItem("atlas_pending_users", JSON.stringify(prev));

      if (useLiveData) {
        try {
          const auth = getFirebaseAuth();
          await createUserWithEmailAndPassword(auth, `${u}@atlaspricing.com`, password);
          setSignupMsg(
            `Account created for “${displayName.trim() || u}”. Sign in, then ask Admin to assign a desk seat (Air Nom, Sea Nom, NRS, Free Hand) if needed.`,
          );
        } catch (err) {
          const code = (err as { code?: string }).code || "";
          if (code === "auth/email-already-in-use") {
            setSignupMsg("Username already registered — try Sign in or Forgot password.");
          } else {
            setSignupMsg(
              `Queued for admin (${u}). Live Auth: ${err instanceof Error ? err.message : "failed"} — you can still sign in if the account exists.`,
            );
          }
        }
      } else {
        setSignupMsg(`Queued signup for “${u}” (mock). Ask admin to assign a desk seat.`);
      }
      setMode("signin");
    } catch {
      setSignupMsg("Could not complete signup.");
    } finally {
      setSignupBusy(false);
    }
  }

  if (user) return null;

  const mock = process.env.NEXT_PUBLIC_MOCK_MODE !== "false";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] p-4">
      <div className="grid w-full max-w-4xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="order-2 lg:order-1">
          <div className="mb-5">
            <div className="flex items-center gap-2.5">
              <BrandMark size={44} />
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-atlas-sky)]">
                  Atlas Pricing
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">Vertex workspace</div>
              </div>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
              {mode === "signin" ? "Sign in" : "Create your login"}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {mode === "signin" ? (
                <>
                  Use your personal username. Desk seats (Air Nom, Sea Nom, NRS, Free Hand) stay —
                  Admin assigns who sits in them.
                  {mock ? (
                    <>
                      {" "}
                      Mock: <strong>ganny</strong> / <strong>demo</strong>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Create a named login (not the seat name). After signup, an admin maps you onto a
                  stable desk seat if you cover Air Nom / Sea Nom / NRS / Free Hand.
                </>
              )}
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-semibold">
              Username
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="your.name"
              />
            </label>
            {mode === "signup" ? (
              <label className="block text-sm font-semibold">
                Full name
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Goutham"
                />
              </label>
            ) : null}
            <label className="block text-sm font-semibold">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </label>
            {hint ? <p className="text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
            {error && mode === "signin" ? (
              <p className="text-sm font-semibold text-red-600">{error}</p>
            ) : null}
            {signupMsg ? (
              <p className="text-sm font-semibold text-emerald-700">{signupMsg}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading || signupBusy}>
              {mode === "signin"
                ? loading
                  ? "Signing in…"
                  : "Enter workspace"
                : signupBusy
                  ? "Creating…"
                  : "Create account"}
            </Button>
          </form>
          <div className="mt-3 text-center text-xs">
            <button
              type="button"
              className="font-semibold text-sky-700 hover:underline"
              onClick={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setSignupMsg(null);
              }}
            >
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 hover:underline"
              onClick={() => setForgotOpen((v) => !v)}
            >
              Forgot / change password?
            </button>
            {forgotOpen ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Submits a reset request for admin review.
                </p>
                <input
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                  placeholder="Your username"
                  value={forgotUser}
                  onChange={(e) => setForgotUser(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    const u = (forgotUser || username).trim();
                    if (!u) return;
                    try {
                      const key = "atlas_password_reset_requests";
                      const prev = JSON.parse(localStorage.getItem(key) || "[]");
                      prev.unshift({ username: u, at: Date.now(), status: "pending" });
                      localStorage.setItem(key, JSON.stringify(prev));
                      setForgotMsg(`Reset requested for “${u}”. Ask an admin to process it.`);
                    } catch {
                      setForgotMsg("Could not save request locally.");
                    }
                  }}
                >
                  Request password reset
                </Button>
                {forgotMsg ? (
                  <p className="text-xs font-semibold text-emerald-700">{forgotMsg}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <div className="order-1 space-y-3 lg:order-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Stable desks
            </p>
            <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">Pick a seat to fill your login</h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Seats never rename. Occupants can be swapped in Admin.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {DESK_SEATS.filter((s) => s.id !== "admin" && s.id !== "manager").map((seat) => {
              const login = occupantLoginForSeat(seat.id);
              const occupant = personDisplayName(login);
              return (
                <button
                  key={seat.id}
                  type="button"
                  onClick={() => {
                    setUsername(login);
                    setHint(
                      `${seat.label} is currently ${occupant} (${login}). Sign in with that person’s password, or ask Admin to assign you.`,
                    );
                  }}
                  className={cn(
                    "rounded-xl border bg-white px-3 py-3 text-left transition hover:border-[var(--color-atlas-gold)] hover:shadow-sm",
                    username.toLowerCase() === login.toLowerCase()
                      ? "border-[var(--color-atlas-gold)] ring-1 ring-[var(--color-atlas-gold-soft)]"
                      : "border-[var(--color-border)]",
                  )}
                >
                  <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">{seat.label}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">{seat.blurb}</div>
                  <div className="mt-1 text-xs font-semibold text-[var(--color-atlas-navy)]">
                    Occupant · {occupant}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
