"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Eye,
  Pencil,
  Trash2,
  Trophy,
  XCircle,
  Ban,
} from "lucide-react";
import type { EnquiryRecord, SavedQuote } from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import {
  convertQuoteToWon,
  deleteQuoteById,
  fetchQuoteById,
  setQuoteStatus,
} from "@/lib/firebase/quote-lifecycle";
import { deskPathForQuote } from "@/lib/quotes/desk-loader";
import { useLiveData } from "@/lib/api";
import { queryKeys } from "@/hooks/query-keys";
import { toast } from "@/components/Toast";
import { formatCurrency } from "@/lib/utils";

export function EnquiryInspector({
  row,
  onClose,
}: {
  row: EnquiryRecord;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showWon, setShowWon] = useState(false);
  const [shipperName, setShipperName] = useState("");
  const [consigneeName, setConsigneeName] = useState("");
  const [commodity, setCommodity] = useState("");

  async function loadFullQuote(): Promise<SavedQuote | null> {
    if (quote) return quote;
    if (!useLiveData) {
      const msg = "Mock mode — open legacy app for full quote actions.";
      setMsg(msg);
      toast(msg, "info");
      return null;
    }
    setLoading(true);
    try {
      const q = await fetchQuoteById(row.id);
      if (q) setQuote(q);
      else {
        const msg = "Quote not found in Firestore.";
        setMsg(msg);
        toast(msg, "error");
      }
      return q;
    } finally {
      setLoading(false);
    }
  }

  async function handleView() {
    const q = await loadFullQuote();
    if (q) setShowPreview(true);
  }

  async function goToDesk(mode: "edit" | "duplicate") {
    const q = await loadFullQuote();
    if (!q) return;
    const path = deskPathForQuote(q);
    if (!path) {
      const msg = `Desk not available in React for ${q.type} — use legacy app.`;
      setMsg(msg);
      toast(msg, "info");
      return;
    }
    const param = mode === "edit" ? "edit" : "duplicate";
    router.push(`${path}?${param}=${q.id}`);
    onClose();
  }

  async function handleStatus(
    action: "won" | "lost" | "cancelled" | "delete",
  ) {
    if (!useLiveData) {
      const msg = "Mock mode — status changes disabled.";
      setMsg(msg);
      toast(msg, "info");
      return;
    }
    if (action === "won") {
      setShowWon(true);
      await loadFullQuote();
      return;
    }
    const labels = {
      lost: "mark as LOST",
      cancelled: "mark as CANCELLED",
      delete: "DELETE",
    };
    if (!window.confirm(`${labels[action]} quote for "${row.customer}"?`)) return;
    setLoading(true);
    setMsg(null);
    try {
      if (action === "delete") {
        await deleteQuoteById(row.id);
        toast("Quote deleted.", "success");
      } else {
        await setQuoteStatus(row.id, action);
        toast(`Status updated to ${action}.`, "success");
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      setMsg(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function confirmWon() {
    setLoading(true);
    setMsg(null);
    try {
      await convertQuoteToWon(row.id, {
        shipperName: shipperName.trim() || undefined,
        consigneeName: consigneeName.trim() || undefined,
        commodity: commodity.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
      setShowWon(false);
      toast("Converted to Won.", "success");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion failed";
      setMsg(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  const canAct = row.status === "quoted" || row.status === "open";

  return (
    <>
      <Card className="sticky top-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Enquiry inspector</h2>
            <p className="text-xs text-[var(--color-text-muted)]">#{row.ref} · {row.customer}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--color-text-muted)] hover:text-slate-800">
            ✕
          </button>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--color-text-muted)]">Mode</dt>
            <dd className="font-semibold uppercase">{row.mode}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-text-muted)]">Lane</dt>
            <dd className="text-right text-xs">{row.origin} → {row.destination}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-text-muted)]">Status</dt>
            <dd>
              <Badge tone={row.status === "won" ? "success" : row.status === "quoted" ? "warn" : "neutral"}>
                {row.status}
              </Badge>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-text-muted)]">Assignee</dt>
            <dd>{row.assignee}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-text-muted)]">Total</dt>
            <dd className="font-bold">
              {row.grandTotal ? formatCurrency(row.grandTotal, row.currency) : "—"}
            </dd>
          </div>
        </dl>

        {msg ? (
          <p className={`text-sm font-semibold ${msg.includes("failed") || msg.includes("Mock") ? "text-amber-800" : "text-emerald-800"}`}>
            {msg}
          </p>
        ) : null}

        <div className="grid gap-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleView()}>
            <Eye className="mr-2 h-4 w-4" />
            View / Print
          </Button>
          {canAct ? (
            <>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void goToDesk("edit")}>
                <Pencil className="mr-2 h-4 w-4" />
                Amend on desk
              </Button>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void goToDesk("duplicate")}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate to desk
              </Button>
              <Button type="button" disabled={loading} onClick={() => void handleStatus("won")}>
                <Trophy className="mr-2 h-4 w-4" />
                Convert to Won
              </Button>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleStatus("lost")}>
                <XCircle className="mr-2 h-4 w-4" />
                Mark lost
              </Button>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleStatus("cancelled")}>
                <Ban className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          ) : null}
          <Button type="button" variant="ghost" disabled={loading} onClick={() => void handleStatus("delete")}>
            <Trash2 className="mr-2 h-4 w-4 text-red-600" />
            <span className="text-red-600">Delete</span>
          </Button>
        </div>

        {showWon ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-sm font-bold text-emerald-900">Won conversion</p>
            <label className="block text-xs font-semibold">
              Shipper name
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={shipperName} onChange={(e) => setShipperName(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold">
              Consignee name
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold">
              Commodity
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={commodity} onChange={(e) => setCommodity(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <Button type="button" disabled={loading} onClick={() => void confirmWon()}>
                Confirm Won
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowWon(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {showPreview && quote ? (
        <QuotePreviewModal quote={quote} onClose={() => setShowPreview(false)} />
      ) : null}
    </>
  );
}
