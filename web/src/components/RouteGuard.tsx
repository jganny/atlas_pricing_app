"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  canAccessRoute,
  preferredHomePath,
  routeIdFromPath,
} from "@/lib/auth/rbac";
import { Button, Card } from "@/components/ui";

/** Soft route guard — blocks pages outside the signed-in user’s desk role. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const user = useAuthStore((s) => s.user);
  const route = routeIdFromPath(pathname);

  if (!user || !route) return <>{children}</>;

  if (canAccessRoute(user.username, user.role, route)) {
    return <>{children}</>;
  }

  const home = preferredHomePath(user.username, user.role);

  return (
    <Card className="mx-auto max-w-lg border-amber-300 bg-amber-50 py-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
        <div>
          <h2 className="text-base font-extrabold text-amber-950">Desk not available for your role</h2>
          <p className="mt-1 text-sm text-amber-900/90">
            Your login (<strong>{user.username}</strong>) does not include this page. Open your home desk
            instead.
          </p>
          <Link href={home} className="mt-4 inline-block">
            <Button type="button" className="h-9">
              Go to my desk
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
