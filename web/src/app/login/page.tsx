"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { preferredHomePath } from "@/lib/auth/rbac";

export default function LoginPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const [username, setUsername] = useState("ganny");
  const [password, setPassword] = useState(
    process.env.NEXT_PUBLIC_MOCK_MODE !== "false" ? "demo" : "",
  );

  useEffect(() => {
    if (user) router.replace(preferredHomePath(user.username, user.role));
  }, [user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(username, password);
    } catch {
      /* store holds error */
    }
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-atlas-sky)]">
            Atlas Pricing
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Use your Atlas desk username and password
            {process.env.NEXT_PUBLIC_MOCK_MODE !== "false" ? (
              <>
                {" "}
                — mock mode: <strong>ganny</strong> / <strong>demo</strong>
              </>
            ) : (
              <> — same login as the legacy app</>
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
            />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Enter workspace"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
