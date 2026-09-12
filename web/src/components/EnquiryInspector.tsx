"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronsUpDown,
  Copy,
  Eye,
  Pencil,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";
import type { EnquiryRecord, SavedQuote } from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui";
import { PortalDropdown } from "@/components/PortalDropdown";
import { CommodityCombobox } from "@/components/CommodityCombobox";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import {
  convertQuoteToWon,
  deleteQuoteById,
  fetchQuoteById,
  setQuoteStatus,
} from "@/lib/firebase/quote-lifecycle";
import { isAmendmentGrantActive, requestAmendment } from "@/lib/firebase/amendments";
import { pushNrsAlert, pushNrsFollowUp } from "@/lib/quotes/nrs-alerts";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import { deskPathForQuote } from "@/lib/quotes/desk-loader";
import { useLiveData } from "@/lib/api";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/components/Toast";
import { formatQuoteGp, formatQuoteSell } from "@/lib/quotes/money";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { getLocalQuote } from "@/lib/quotes/local-enquiries";

function stubQuoteFromEnquiry(row: EnquiryRecord): SavedQuote {
  return {
    id: row.id,
    customer: row.customer,
    creator: row.creator,
    status: row.status === "won" ? "converted" : row.status === "open" ? "quoted" : row.status,
    type: row.mode,
    amount: row.grandTotal || 0,
    currency: row.currency || "USD",
    route: row.destination ? `${row.origin} → ${row.destination}` : row.origin,
    details: {
      airline: row.carrier,
      origin: row.origin,
      destination: row.destination,
      type: row.mode,
    },
  };
}

export function EnquiryInspector({
  row,
  onClose,
}: {
  row: EnquiryRecord;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showWon, setShowWon] = useState(false);
  const [shipperName, setShipperName] = useState("");
  const [consigneeName, setConsigneeName] = useState("");
  const [commodity, setCommodity] = useState("");
  const [amdReason, setAmdReason] = useState("");
  const [showAmd, setShowAmd] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsBtnRef = useRef<HTMLButtonElement>(null);
  const admin = isAdminUser(user?.username, user?.role);

  async function loadFullQuote(): Promise<SavedQuote | null> {
    if (quote) return quote;
    setLoading(true);
    try {
      const q = (await fetchQuoteById(row.id)) ?? getLocalQuote(row.id) ?? stubQuoteFromEnquiry(row);
      setQuote(q);
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
    if (mode === "edit" && !admin) {
      const unlocked = isAmendmentGrantActive(q.id, user?.username || "");
      if (!unlocked && (q.status === "quoted" || q.status === "won" || row.status === "quoted" || row.status === "won")) {
        toast("Request amendment unlock — an admin must approve before you can amend.", "info");
        setShowAmd(true);
        return;
      }
    }
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
    if (!useLiveData && action !== "delete") {
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
    const previous = queryClient.getQueryData(queryKeys.enquiries);
    // Optimistic UI — flip status / drop row immediately
    queryClient.setQueryData(queryKeys.enquiries, (old: EnquiryRecord[] | undefined) => {
      if (!old) return old;
      if (action === "delete") return old.filter((e) => e.id !== row.id);
      return old.map((e) =>
        e.id === row.id
          ? { ...e, status: action === "lost" ? "lost" : "cancelled" }
          : e,
      );
    });
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
      queryClient.setQueryData(queryKeys.enquiries, previous);
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
      const full = quote ?? (await fetchQuoteById(row.id));
      if (full) setQuote(full);
      const buy = Number(
        full?.buyRate ?? full?.confirmedBuyRate ?? row.buyRate ?? row.buyTotal ?? 0,
      );
      const sell = Number(full?.amount ?? row.grandTotal ?? 0);
      if (!(buy > 0) || !(sell > 0)) {
        const err =
          "Buy rate and sell amount must both be greater than 0 before converting to Won.";
        setMsg(err);
        toast(err, "error");
        return;
      }

      await convertQuoteToWon(row.id, {
        shipperName: shipperName.trim() || undefined,
        consigneeName: consigneeName.trim() || undefined,
        commodity: commodity.trim() || undefined,
      });

      const ref = full ? getQuoteRefId(full) : row.ref;
      pushNrsFollowUp({
        quoteId: row.id,
        ref,
        customer: row.customer,
        buyRate: buy,
        sellRate: sell,
        shipper: shipperName.trim(),
        consignee: consigneeName.trim(),
        commodity: commodity.trim() || String(full?.commodity ?? ""),
      });
      pushNrsAlert(
        `NRS confirmation needed for ${ref} · ${row.customer}` +
          (shipperName.trim() ? ` · shipper ${shipperName.trim()}` : "") +
          (consigneeName.trim() ? ` · consignee ${consigneeName.trim()}` : "") +
          (commodity.trim() ? ` · ${commodity.trim()}` : ""),
        ref,
      );

      await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
      setShowWon(false);
      toast("Converted to Won. NRS follow-up queued for Cathrina.", "success");
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
            <dd className="text-right text-xs">
              {row.destination ? `${row.origin} → ${row.destination}` : row.origin || "—"}
            </dd>
          </div>
          {row.carrier ? (
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Quoted</dt>
              <dd className="max-w-[14rem] text-right text-xs font-semibold">{row.carrier}</dd>
            </div>
          ) : null}
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
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-muted)]">Sell</dt>
            <dd className="text-right font-bold leading-snug">{formatQuoteSell(row)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-muted)]">GP</dt>
            <dd
              className={`text-right font-bold leading-snug ${
                formatQuoteGp(row) === "—" ? "text-slate-400" : "text-emerald-700"
              }`}
            >
              {formatQuoteGp(row)}
            </dd>
          </div>
          {row.carrier ? (
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Carrier</dt>
              <dd>{row.carrier}</dd>
            </div>
          ) : null}
        </dl>

        {msg ? (
          <p className={`text-sm font-semibold ${msg.includes("failed") || msg.includes("Mock") ? "text-amber-800" : "text-emerald-800"}`}>
            {msg}
          </p>
        ) : null}

        <button
          type="button"
          ref={actionsBtnRef}
          data-testid="edb-actions-toggle"
          onClick={() => setActionsOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-slate-50 px-3 py-2.5 text-left hover:border-[var(--color-atlas-gold)]"
        >
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--color-atlas-navy)]">
            <ChevronsUpDown className="h-4 w-4" />
            Actions
          </span>
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
            {actionsOpen ? "Close" : "View, amend, won, delete…"}
          </span>
        </button>

        <PortalDropdown
          open={actionsOpen}
          anchorRef={actionsBtnRef}
          maxHeight={420}
          backdrop
          onDismiss={() => setActionsOpen(false)}
          testId="edb-actions-overlay"
        >
          <div className="grid gap-1 p-1.5">
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-start"
              disabled={loading}
              onClick={() => {
                setActionsOpen(false);
                void handleView();
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              View / Print
            </Button>
            {canAct ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => {
                    setActionsOpen(false);
                    void goToDesk("edit");
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Amend on desk
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => {
                    setActionsOpen(false);
                    setShowAmd(true);
                  }}
                >
                  Request amendment unlock
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => {
                    setActionsOpen(false);
                    void goToDesk("duplicate");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate to desk
                </Button>
                <Button
                  type="button"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => {
                    setActionsOpen(false);
                    void handleStatus("won");
                  }}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Convert to Won
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => {
                    setActionsOpen(false);
                    void handleStatus("lost");
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Mark lost
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => {
                    setActionsOpen(false);
                    void handleStatus("cancelled");
                  }}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              disabled={loading}
              onClick={() => {
                setActionsOpen(false);
                void handleStatus("delete");
              }}
            >
              <Trash2 className="mr-2 h-4 w-4 text-red-600" />
              <span className="text-red-600">Delete</span>
            </Button>
          </div>
        </PortalDropdown>

        {showAmd ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-sm font-bold text-amber-950">Request amendment unlock</p>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Reason (optional)"
              value={amdReason}
              onChange={(e) => setAmdReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={loading}
                onClick={() => {
                  void (async () => {
                    setLoading(true);
                    try {
                      await requestAmendment({
                        quoteId: row.id,
                        quoteRef: row.ref,
                        customer: row.customer,
                        requestedBy: user?.username || "desk",
                        reason: amdReason,
                      });
                      toast("Amendment request sent to admins", "success");
                      setShowAmd(false);
                      setAmdReason("");
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Request failed", "error");
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
              >
                Submit request
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowAmd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

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
            <CommodityCombobox
              label="Commodity (HSN)"
              value={commodity}
              onChange={setCommodity}
            />
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
