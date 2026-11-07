import assert from "node:assert/strict";
import { buildTiles, railBadges, type AdminSignals } from "./signals";
import type { AiSummaryView } from "@/lib/ai/ai-usage-view";

const ganny = { isAdmin: true, isGanny: true, live: true };
const manager = { isAdmin: true, isGanny: false, live: true };
const NOW = Date.UTC(2026, 10, 7, 12, 0);

const aiBase: AiSummaryView = {
  months: [{ month: "2026-11", total: { calls: 5, input: 100, output: 20, web: 0, costUsd: 6.4 }, features: [], models: [], days: [] }],
  countingSince: 1,
  totalUsd: 6.4,
  status: { outOfCredit: false, since: null, lastFeature: "" },
  billing: { balanceUsd: 50, asOf: 1, lowAtUsd: 10, inrPerUsd: 90, estimateUsd: 42.8, spentSinceUsd: 7.2, alertedAt: null },
  defaults: { lowAtUsd: 10, inrPerUsd: 90 },
};
const sig = (over: Partial<AdminSignals> = {}): AdminSignals => ({
  ai: aiBase,
  resets: { count: 2, oldestAt: NOW - 3600_000 },
  errors: { week: 3, day: 1 },
  staff: { joined: 12, invited: 3, total: 15 },
  ...over,
});

// the four tiles for the main administrator
const tiles = buildTiles(sig(), ganny, NOW);
assert.deepEqual(tiles.map((t) => t.id), ["ai-credit-and-cost", "password-reset-queue", "error-monitor", "chat-only-staff"]);
const ai = tiles[0];
assert.deepEqual([ai.value, ai.pill, ai.tone], ["$42.80", "Healthy", "ok"]);
assert.match(ai.sub, /\$6\.40 spent in November 2026/);
assert.ok(ai.bar! > 0.85 && ai.bar! < 0.86);
assert.deepEqual([tiles[1].value, tiles[1].pill, tiles[1].tone, tiles[1].sub], ["2", "Waiting", "warn", "Oldest request is from today"]);
assert.deepEqual([tiles[2].value, tiles[2].tone, tiles[2].sub], ["3", "warn", "1 reported in the last 24 hours"]);
assert.deepEqual([tiles[3].value, tiles[3].sub], ["12 of 15", "3 invite links not opened yet"]);
assert.equal(tiles[3].bar, 0.8);

// AI states: low, out, no balance typed yet
const low = buildTiles(sig({ ai: { ...aiBase, billing: { ...aiBase.billing!, estimateUsd: 8.6 } } }), ganny, NOW)[0];
assert.deepEqual([low.pill, low.tone, low.value], ["Running low", "warn", "$8.60"]);
const out = buildTiles(sig({ ai: { ...aiBase, status: { outOfCredit: true, since: 5, lastFeature: "vertexChat" } } }), ganny, NOW)[0];
assert.deepEqual([out.pill, out.tone, out.value, out.bar], ["Out of credit", "bad", "$0.00", 0]);
const none = buildTiles(sig({ ai: { ...aiBase, billing: null } }), ganny, NOW)[0];
assert.deepEqual([none.value, none.tone, none.pill], ["Not set", "mute", "Balance needed"]);
const noMonth = buildTiles(sig({ ai: { ...aiBase, months: [] } }), ganny, NOW)[0];
assert.match(noMonth.sub, /Counting starts/);
// an estimate below zero never shows as a negative amount
assert.equal(buildTiles(sig({ ai: { ...aiBase, billing: { ...aiBase.billing!, estimateUsd: -3 } } }), ganny, NOW)[0].value, "$0.00");

// quiet states
const quiet = buildTiles(sig({ resets: { count: 0, oldestAt: null }, errors: { week: 0, day: 0 }, staff: { joined: 15, invited: 0, total: 15 } }), ganny, NOW);
assert.deepEqual([quiet[1].pill, quiet[1].tone, quiet[1].sub], ["None waiting", "ok", "Nothing to process"]);
assert.deepEqual([quiet[2].pill, quiet[2].tone], ["None this week", "ok"]);
assert.deepEqual([quiet[3].tone, quiet[3].sub], ["ok", "Everyone has joined"]);
assert.equal(buildTiles(sig({ staff: { joined: 0, invited: 0, total: 0 } }), ganny, NOW)[3].tone, "mute");
assert.equal(buildTiles(sig({ staff: { joined: 1, invited: 1, total: 1 } }), ganny, NOW)[3].sub, "1 invite link not opened yet");

// a tile shows only for what the person may open, and only once its number has arrived
assert.deepEqual(buildTiles(sig(), manager, NOW).map((t) => t.id), ["password-reset-queue", "error-monitor"]);
assert.deepEqual(buildTiles(sig({ ai: undefined, staff: undefined, errors: undefined }), ganny, NOW).map((t) => t.id), ["password-reset-queue"]);
assert.deepEqual(buildTiles(sig({ ai: null, staff: null, errors: null }), ganny, NOW).map((t) => t.id), ["password-reset-queue"]);
assert.equal(buildTiles(sig(), { isAdmin: false, isGanny: false, live: true }, NOW).length, 0);

// older requests read in days
assert.equal(buildTiles(sig({ resets: { count: 1, oldestAt: NOW - 3 * 86_400_000 } }), ganny, NOW)[1].sub, "Oldest request is from 3 days ago");
assert.equal(buildTiles(sig({ resets: { count: 1, oldestAt: NOW - 86_400_000 } }), ganny, NOW)[1].sub, "Oldest request is from yesterday");

// counters beside sections
const b = railBadges(sig());
assert.deepEqual(b["password-reset-queue"], { text: "2", tone: "warn" });
assert.deepEqual(b["error-monitor"], { text: "3", tone: "bad" });
assert.equal(b["ai-credit-and-cost"], undefined);
assert.deepEqual(railBadges(sig({ ai: { ...aiBase, status: { outOfCredit: true, since: 1, lastFeature: "" } } }))["ai-credit-and-cost"], { text: "!", tone: "bad" });
assert.deepEqual(railBadges(sig({ ai: { ...aiBase, billing: { ...aiBase.billing!, estimateUsd: 5 } } }))["ai-credit-and-cost"], { text: "!", tone: "warn" });
assert.deepEqual(railBadges(sig({ resets: { count: 0, oldestAt: null }, errors: { week: 0, day: 0 }, ai: null })), {});

console.log("admin signals tests passed");
