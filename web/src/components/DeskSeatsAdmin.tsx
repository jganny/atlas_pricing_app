"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import {
  DESK_SEATS,
  listOccupants,
  occupantLoginForSeat,
  personDisplayName,
  removeOccupant,
  upsertOccupant,
  type DeskSeatId,
} from "@/lib/auth/desk-seats";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";

/**
 * Seats stay (Air Nom, Sea Nom, NRS, Free Hand). Occupants are people who can change.
 */
export function DeskSeatsAdmin() {
  const [tick, setTick] = useState(0);
  const occupants = useMemo(() => {
    void tick;
    return listOccupants();
  }, [tick]);
  const [drafts, setDrafts] = useState<Record<string, { loginId: string; personName: string }>>({});

  const pending = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("atlas_pending_users") || "[]") as Array<{
        username: string;
        displayName?: string;
      }>;
    } catch {
      return [];
    }
  }, [tick]);

  function refresh() {
    setTick((n) => n + 1);
  }

  return (
    <Card>
      <h2 className="mb-1 font-bold text-[var(--color-atlas-navy)]">Desk seats</h2>
      <p className="mb-4 text-xs text-[var(--color-text-muted)]">
        Seat names never change. Assign or remove the person sitting in Air Nom, Sea Nom, NRS, or
        Free Hand. Named logins (Goutham, …) keep their own username and password.
      </p>
      <ul className="space-y-3">
        {DESK_SEATS.map((seat) => {
          const occ = occupants.find((o) => o.seatId === seat.id);
          const login = occ?.loginId || occupantLoginForSeat(seat.id);
          const draft = drafts[seat.id] ?? {
            loginId: login,
            personName: occ?.personName || personDisplayName(login),
          };
          return (
            <li
              key={seat.id}
              className="rounded-xl border border-[var(--color-border)] bg-slate-50/80 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                    {seat.label}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">{seat.blurb}</div>
                </div>
                <Badge tone={occ ? "success" : "neutral"}>
                  {occ ? `Occupied · ${occ.personName}` : "Default occupant"}
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Person login id</Label>
                  <Input
                    value={draft.loginId}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [seat.id]: { ...draft, loginId: e.target.value },
                      }))
                    }
                    placeholder="goutham"
                  />
                </div>
                <div>
                  <Label>Person name</Label>
                  <Input
                    value={draft.personName}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [seat.id]: { ...draft, personName: e.target.value },
                      }))
                    }
                    placeholder="Goutham"
                  />
                </div>
              </div>
              {pending.length > 0 ? (
                <div className="mt-2">
                  <Label>From pending signups</Label>
                  <Select
                    value=""
                    onChange={(e) => {
                      const u = e.target.value;
                      if (!u) return;
                      const p = pending.find((x) => x.username === u);
                      setDrafts((d) => ({
                        ...d,
                        [seat.id]: {
                          loginId: u,
                          personName: p?.displayName || u,
                        },
                      }));
                    }}
                  >
                    <option value="">Assign pending user…</option>
                    {pending.map((p) => (
                      <option key={p.username} value={p.username}>
                        {p.displayName || p.username} ({p.username})
                      </option>
                    ))}
                    {Object.keys(TEAM_ROLES).map((id) => (
                      <option key={`role-${id}`} value={id}>
                        {TEAM_ROLES[id].name} ({id})
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const loginId = draft.loginId.trim().toLowerCase();
                    if (!loginId) {
                      toast("Login id required", "error");
                      return;
                    }
                    upsertOccupant({
                      seatId: seat.id as DeskSeatId,
                      loginId,
                      personName: draft.personName.trim() || loginId,
                    });
                    toast(`${seat.label} → ${draft.personName || loginId}`, "success");
                    refresh();
                  }}
                >
                  Assign occupant
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    removeOccupant(seat.id);
                    toast(`${seat.label} restored to default`, "success");
                    refresh();
                  }}
                >
                  Clear to default
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
