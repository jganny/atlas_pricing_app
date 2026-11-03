"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { redeemChatInvite } from "@/lib/firebase/chat-staff";
import { useAuthStore } from "@/store/auth";
import { CHAT_APP_NAME, CHAT_CLIENT_NAME } from "@/lib/chat-app-mode";

/** The page a new person lands on from their private link: choose a password, and you are in. */
export default function JoinPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("t") || "");
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) return setError("This link is incomplete. Open it again from your message, or ask your admin for a new one.");
    if (password.length < 8) return setError("Choose a password of at least 8 characters.");
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      const username = await redeemChatInvite(token, password);
      await login(username, password);
      router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg && !/internal|functions\//i.test(msg) ? msg : "Something went wrong. Try again, or ask your admin for a new link.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-surface)] p-4">
      <div className="w-full max-w-sm">
        <Card>
          <div className="mb-4 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-atlas-navy)] text-2xl font-extrabold text-white">V</div>
            <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Welcome to {CHAT_APP_NAME}</h1>
            <p className="text-xs text-[var(--color-text-muted)]">{CHAT_CLIENT_NAME}</p>
            <p className="mt-2 text-sm text-slate-600">Choose a password to join your team&apos;s chat.</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-semibold">
              Password
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2" data-testid="join-password" />
            </label>
            <label className="block text-sm font-semibold">
              Type it again
              <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2" data-testid="join-again" />
            </label>
            {error ? <p className="text-sm font-semibold text-red-600" data-testid="join-error">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy} data-testid="join-submit">
              {busy ? "Joining…" : "Join the chat"}
            </Button>
            <p className="text-center text-[11px] text-[var(--color-text-muted)]">Work chats are company records, kept 100 days. After this, add the app to your Home Screen.</p>
          </form>
        </Card>
      </div>
    </div>
  );
}
