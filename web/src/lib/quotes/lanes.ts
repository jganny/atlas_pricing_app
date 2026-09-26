export type QuoteLane = {
  id: string;
  origin: string;
  destination: string;
};

export function airportCode(value: string): string {
  return value.split(/[—–\-]/)[0]?.trim().split(" ")[0]?.trim() || value.trim();
}

export function laneRouteLabel(lane: Pick<QuoteLane, "origin" | "destination">, index: number): string {
  const o = airportCode(lane.origin);
  const d = airportCode(lane.destination);
  if (o && d) return `Lane ${index + 1} · ${o} → ${d}`;
  return `Lane ${index + 1}`;
}

/**
 * Same "Lane N · origin → destination" label, but for desks whose lane fields
 * are free text (a ZIP/place string, e.g. Transport) rather than an airport
 * code — `airportCode()` keeps only the first word of a value, which would
 * silently drop the city name from a "560001 Bangalore"-style field.
 */
export function plainLaneLabel(lane: Pick<QuoteLane, "origin" | "destination">, index: number): string {
  const o = lane.origin.trim();
  const d = lane.destination.trim();
  if (o && d) return `Lane ${index + 1} · ${o} → ${d}`;
  return `Lane ${index + 1}`;
}

export function allLanesRoute(lanes: QuoteLane[]): string {
  const parts = lanes
    .map((l) => {
      const o = airportCode(l.origin);
      const d = airportCode(l.destination);
      return o && d ? `${o} → ${d}` : "";
    })
    .filter(Boolean);
  return parts.join(" · ") || "—";
}

/**
 * When a second lane is added, any existing item with no lane of its own
 * (laneId falsy — it predates lanes existing at all) would otherwise match
 * EVERY lane's filter (see optionsOnLane below: `!item.laneId` is true for
 * all of them), so it silently appears to "belong" to the new lane too.
 * Call this right before adding a lane, so the new lane starts genuinely
 * empty instead of inheriting the first lane's cards.
 */
export function stampOntoFirstLane<T extends { laneId?: string }>(
  items: T[],
  firstLaneId: string,
): T[] {
  if (!firstLaneId) return items;
  return items.map((item) => (item.laneId ? item : { ...item, laneId: firstLaneId }));
}

export function optionsOnLane<T extends { laneId?: string }>(
  items: T[],
  laneId: string | undefined,
  fallbackLaneId: string,
): T[] {
  const id = laneId || fallbackLaneId;
  return items.filter((item) => !item.laneId || item.laneId === id);
}

export function selectWithinLane<T extends { id: string; laneId?: string; selected: boolean }>(
  items: T[],
  id: string,
  fallbackLaneId: string,
): T[] {
  const target = items.find((x) => x.id === id);
  const lane = target?.laneId || fallbackLaneId;
  return items.map((x) => {
    const same = (x.laneId || fallbackLaneId) === lane;
    if (!same) return x;
    return { ...x, selected: x.id === id };
  });
}

export function quotedOnLane<T extends { selected: boolean; laneId?: string }>(
  items: T[],
  laneId: string | undefined,
  fallbackLaneId: string,
): T | undefined {
  const opts = optionsOnLane(items, laneId, fallbackLaneId);
  return opts.find((o) => o.selected) ?? opts[0];
}

export function usableLanes(lanes: QuoteLane[]): QuoteLane[] {
  return lanes.filter((l) => l.origin.trim() && l.destination.trim());
}

export type QuotedLaneRow = {
  laneId: string;
  laneLabel: string;
  origin: string;
  destination: string;
  airline: string;
  amount: number;
  validity: string;
  routing: string;
  tt: string;
};

export function quotedLaneRows<
  T extends {
    id: string;
    name: string;
    selected: boolean;
    laneId?: string;
    validity?: string;
    routing?: string;
    tt?: string;
  },
>(
  lanes: QuoteLane[],
  items: T[],
  amountOf: (item: T) => number,
): QuotedLaneRow[] {
  const fallback = lanes[0]?.id || "";
  return lanes.map((lane, i) => {
    const quoted = quotedOnLane(items, lane.id, fallback);
    return {
      laneId: lane.id,
      laneLabel: laneRouteLabel(lane, i),
      origin: lane.origin,
      destination: lane.destination,
      airline: quoted?.name || "",
      amount: quoted ? amountOf(quoted) : 0,
      validity: quoted?.validity || "",
      routing: quoted?.routing || "",
      tt: quoted?.tt || "",
    };
  });
}
