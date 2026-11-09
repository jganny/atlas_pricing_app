/**
 * The checking brain for automatic tariff reading. Pure functions, no Firebase and no AI: given two independent
 * reads of the same circular (and the rates already on file), decide what can be applied by itself and what must be
 * held back. A rate is applied only when both reads agree AND it looks normal; anything else is held and the old rate
 * stays in use. Nobody has to approve anything.
 */

/** Per-kg weight breaks in order, then the flat minimum. The per-kg ones must not go UP as the weight grows. */
const PER_KG_BREAKS = ["minus45", "plus45", "plus100", "plus300", "plus500", "plus1000"];
const ALL_BREAKS = ["min", ...PER_KG_BREAKS];

/** Two reads agree on a number when they are within half a percent (or both empty). */
const AGREE_TOLERANCE = 0.005;
/** A rate that moves more than this against what is on file is held (a fuel-like jump, or a misread digit). */
const MAX_JUMP = 0.4;

const rowKey = (r) =>
  [r.carrierCode, r.origin, r.destination, r.currency, ...(r.rateClass && String(r.rateClass).toUpperCase() !== "GCR" ? [r.rateClass] : [])]
    .map((x) => String(x || "").trim().toUpperCase())
    .join("|");

const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

function sameNumber(a, b) {
  const x = num(a);
  const y = num(b);
  if (x === null && y === null) return true;
  if (x === null || y === null) return false;
  return Math.abs(x - y) <= AGREE_TOLERANCE * Math.max(Math.abs(x), Math.abs(y), 1e-9);
}

/** Problems that make a row implausible on its own, in plain words. Empty list = looks normal. */
function rowProblems(row) {
  const out = [];
  const present = ALL_BREAKS.filter((b) => num(row.breaks?.[b]) !== null);
  if (!present.length) out.push("No rates could be read.");
  for (const b of present) if (num(row.breaks[b]) <= 0) out.push(`The ${b} rate is zero or negative.`);
  if (!/^[A-Z]{3}$/.test(String(row.currency || ""))) out.push("The currency is missing.");
  if (!/^[A-Z0-9]{2}$/.test(String(row.carrierCode || ""))) out.push("The airline code is missing.");
  if (!row.origin || !row.destination) out.push("The route is incomplete.");
  const perKg = PER_KG_BREAKS.map((b) => ({ b, v: num(row.breaks?.[b]) })).filter((x) => x.v !== null);
  for (let i = 1; i < perKg.length; i++) {
    if (perKg[i].v > perKg[i - 1].v * 1.001) {
      out.push(`The ${perKg[i].b} rate (${perKg[i].v}) is higher than ${perKg[i - 1].b} (${perKg[i - 1].v}); rates should not rise with weight.`);
      break;
    }
  }
  return out;
}

/** What changed against the rates on file: [] if nothing, and the biggest relative move. */
function changesAgainst(row, old) {
  const changes = [];
  let biggest = 0;
  for (const b of ALL_BREAKS) {
    const n = num(row.breaks?.[b]);
    const o = num(old?.breaks?.[b]);
    if (n === null || o === null || n === o) continue;
    const move = (n - o) / o;
    biggest = Math.max(biggest, Math.abs(move));
    changes.push({ break: b, from: o, to: n, move });
  }
  return { changes, biggest };
}

/**
 * readA / readB: arrays of rows from two independent reads. onFile: rows already stored (any order).
 * Returns { apply, hold, unchanged }.
 *  apply: rows both reads agree on that look normal (with `changes` against what was on file)
 *  hold:  { row, reasons[] } rows to keep OUT, with plain-words reasons, so the admin can be alerted
 *  unchanged: rows identical to what is on file (nothing to do)
 */
function decide(readA, readB, onFile = []) {
  const byKeyB = new Map(readB.map((r) => [rowKey(r), r]));
  const stored = new Map(onFile.map((r) => [rowKey(r), r]));
  const apply = [];
  const hold = [];
  const unchanged = [];
  const seen = new Set();

  for (const a of readA) {
    const key = rowKey(a);
    seen.add(key);
    const b = byKeyB.get(key);
    const reasons = [];
    if (!b) {
      reasons.push("The second read did not find this route.");
    } else {
      const differing = ALL_BREAKS.filter((br) => !sameNumber(a.breaks?.[br], b.breaks?.[br]));
      if (differing.length) {
        reasons.push(`The two reads disagree on ${differing.map((br) => `${br} (${num(a.breaks?.[br]) ?? "blank"} vs ${num(b.breaks?.[br]) ?? "blank"})`).join(", ")}.`);
      }
    }
    reasons.push(...rowProblems(a));
    const old = stored.get(key);
    const { changes, biggest } = changesAgainst(a, old);
    if (old && biggest > MAX_JUMP) {
      reasons.push(`A rate moved by ${Math.round(biggest * 100)}% against the rates on file, which is more than normal.`);
    }
    if (reasons.length) {
      hold.push({ row: a, reasons });
    } else if (old && !changes.length) {
      unchanged.push(a);
    } else {
      apply.push({ ...a, changes });
    }
  }
  // A route only the second read found is held too: one read alone is never enough.
  for (const [key, b] of byKeyB) {
    if (!seen.has(key)) hold.push({ row: b, reasons: ["The first read did not find this route."] });
  }
  return { apply, hold, unchanged };
}

module.exports = { PER_KG_BREAKS, ALL_BREAKS, AGREE_TOLERANCE, MAX_JUMP, rowKey, sameNumber, rowProblems, changesAgainst, decide };
