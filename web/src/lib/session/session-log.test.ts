import assert from "node:assert/strict";
import { ACTIVE_WINDOW_MS, ActivityClock, IDLE_GAP_MS, TICK_MS, clock, dayRows, flagsFor, formatHM, istDay, outputByPersonDay, outputTotal, toCsv, type SessionRow } from "./session-log";

const T0 = Date.parse("2026-10-20T04:00:00Z"); // 09:30 IST
const MIN = 60_000;

// An open tab nobody touches earns nothing after the 2-minute window
{
  const c = new ActivityClock(T0);
  c.interaction(T0);
  for (let t = T0; t < T0 + 30 * MIN; t += TICK_MS) c.tick(t + TICK_MS, true);
  const snap = c.snapshot(T0 + 30 * MIN);
  assert.ok(snap.activeSec <= ACTIVE_WINDOW_MS / 1000 + TICK_MS / 1000, `idle tab credited ${snap.activeSec}s`);
  assert.ok(snap.idleMin >= 20, "a long untouched stretch is reported as idle even before the next click");
}
// Steady use counts in full
{
  const c = new ActivityClock(T0);
  for (let t = T0; t < T0 + 10 * MIN; t += TICK_MS) {
    c.interaction(t);
    c.tick(t + TICK_MS, true);
  }
  assert.equal(c.snapshot(T0 + 10 * MIN).activeSec, 600);
  assert.equal(c.snapshot(T0 + 10 * MIN).idleMin, 0);
}
// A tab that is not on screen earns nothing; a sleeping laptop is not credited
{
  const c = new ActivityClock(T0);
  c.interaction(T0);
  c.tick(T0 + TICK_MS, false);
  assert.equal(c.snapshot(T0 + TICK_MS).activeSec, 0);
  c.interaction(T0 + 5 * 3600_000);
  c.tick(T0 + 5 * 3600_000 + TICK_MS, true); // woke up 5 hours later
  assert.ok(c.snapshot(T0 + 5 * 3600_000 + TICK_MS).activeSec <= 2 * TICK_MS / 1000, "sleep time is capped");
}
// Back to work after a long gap records one idle stretch
{
  const c = new ActivityClock(T0);
  c.interaction(T0 + IDLE_GAP_MS + 5 * MIN);
  const s = c.snapshot(T0 + IDLE_GAP_MS + 5 * MIN);
  assert.equal(s.longestIdleMin, 15);
  assert.equal(s.idleMin, 15);
}

// Output from the audit log, per person per India day
const audit = [
  { actor: "Sunil", action: "quote.save", atIso: "2026-10-20T05:00:00Z" },
  { actor: "sunil", action: "quote.save", atIso: "2026-10-20T06:00:00Z" },
  { actor: "sunil", action: "quote.update", atIso: "2026-10-20T06:30:00Z" },
  { actor: "sunil", action: "lead.visit", atIso: "2026-10-20T07:00:00Z" },
  { actor: "sunil", action: "lead.create", atIso: "2026-10-20T07:10:00Z" },
  { actor: "sunil", action: "lead.visit.delete", atIso: "2026-10-20T07:20:00Z" }, // a correction, not work
  { actor: "sunil", action: "seat.assign", atIso: "2026-10-20T07:30:00Z" }, // not sales work
  { actor: "ramesh", action: "quote.save", atIso: "2026-10-20T20:00:00Z" }, // 01:30 IST next day
];
const out = outputByPersonDay(audit);
assert.deepEqual(out.get("sunil|2026-10-20"), { quotes: 2, updates: 1, visits: 1, leads: 1 });
assert.equal(out.get("ramesh|2026-10-21")?.quotes, 1, "the day is the India day");
assert.equal(istDay(Date.parse("2026-10-20T20:00:00Z")), "2026-10-21");

// Daily rows and flags
const s = (o: Partial<SessionRow>): SessionRow => ({ id: "a", login: "sunil", startMs: T0, lastSeenMs: T0 + 8 * 60 * MIN, activeSec: 6 * 3600, idleMin: 0, longestIdleMin: 5, ...o });
const good = dayRows([s({ endMs: T0 + 8 * 60 * MIN })], out)[0];
assert.equal(good.signedOut, true);
assert.equal(good.spanMin, 480);
assert.equal(good.activeMin, 360);
assert.deepEqual(good.flags, [], "a busy day is not flagged");
const faking = dayRows([s({ login: "ramesh", activeSec: 20 * 60, longestIdleMin: 90 })], new Map())[0];
assert.deepEqual(faking.flags, ["Low activity", "Idle 1h+", "No output"]);
assert.equal(faking.signedOut, false, "closing the browser shows as last active");
assert.deepEqual(flagsFor({ spanMin: 60, activeMin: 0, longestIdleMin: 0, output: { quotes: 0, updates: 0, visits: 0, leads: 0 } }), [], "short sessions are not judged");
// Two sessions in one day are one row
const two = dayRows([s({ id: "1", startMs: T0, lastSeenMs: T0 + 2 * 60 * MIN, endMs: T0 + 2 * 60 * MIN, activeSec: 3600 }), s({ id: "2", startMs: T0 + 3 * 60 * MIN, lastSeenMs: T0 + 6 * 60 * MIN, activeSec: 7200 })], out);
assert.equal(two.length, 1);
assert.equal(two[0].sessions, 2);
assert.equal(two[0].activeMin, 180);
assert.equal(two[0].signedOut, false, "the last session decides");

// Display and CSV
assert.equal(clock(T0), "09:30");
assert.equal(formatHM(75), "1 h 15 m");
assert.equal(formatHM(9), "9 m");
const csv = toCsv([good, faking], (l) => l.toUpperCase());
assert.match(csv, /^"Person","Date"/);
assert.match(csv, /"SUNIL","2026-10-20","09:30","17:30","signed out","480","360"/);
assert.match(csv, /Low activity; Idle 1h\+; No output/);
assert.equal(outputTotal(good.output), 5);
console.log("session-log tests passed");
