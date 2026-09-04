"use client";

import { BookOpen } from "lucide-react";
import { Badge, Card } from "@/components/ui";

const LINKS = [
  { title: "REACT_MIGRATION.md", href: "/feature-parity", blurb: "Parity tracker in-app" },
  { title: "Air / Sea desks", href: "/air", blurb: "Nomination quoting" },
  { title: "Enquiry DB", href: "/enquiries", blurb: "Lifecycle & reports" },
  { title: "Circulars", href: "/circulars", blurb: "Tariffs & documents" },
  { title: "Directory", href: "/directory", blurb: "Agents & vendors" },
  { title: "Legacy app", href: "/index.html", blurb: "Full classic UI until cutover" },
];

export default function DocsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Documentation</h1>
        <Badge tone="info">Phase 13</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <a key={l.title} href={l.href}>
            <Card className="h-full transition hover:border-sky-300">
              <div className="font-bold text-[var(--color-atlas-navy)]">{l.title}</div>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{l.blurb}</p>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
