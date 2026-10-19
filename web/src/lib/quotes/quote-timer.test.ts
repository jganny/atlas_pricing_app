import assert from "node:assert/strict";
import { formatSeconds, markQuoteStart, median, speedBy, takeQuoteSeconds } from "./quote-timer";

assert.equal(takeQuoteSeconds(), null, "nothing measured before a desk is opened");
markQuoteStart(1_000_000);
assert.equal(takeQuoteSeconds(1_000_000 + 42_400), 42);
assert.equal(takeQuoteSeconds(1_000_000 + 42_400 + 20_000), 20, "the next quote from the same page is timed from the last save");
markQuoteStart(0);
assert.equal(takeQuoteSeconds(5 * 3600 * 1000), null, "a tab left open for hours is not a quote time");

assert.equal(median([10, 50, 30]), 30);
assert.equal(median([10, 20, 30, 40]), 25);
assert.equal(median([]), 0);

const now = Date.parse("2026-10-20T10:00:00Z");
const day = (n: number) => new Date(now - n * 86_400_000).toISOString();
const rows = [
  { quoteSeconds: 25, deskSeat: "air-nom", createdAt: day(1) },
  { quoteSeconds: 95, deskSeat: "air-nom", createdAt: day(2) },
  { quoteSeconds: 180, deskSeat: "air-nom", createdAt: day(3) },
  { quoteSeconds: 60, deskSeat: "sea-nom", createdAt: day(1) },
  { deskSeat: "sea-nom", createdAt: day(1) }, // not measured
  { quoteSeconds: 10, deskSeat: "air-nom", createdAt: day(45) }, // too old
];
const r = speedBy(rows, (q) => q.deskSeat || "other", 30, now);
assert.deepEqual(r.map((x) => [x.key, x.count, x.medianSeconds, x.under30]), [["air-nom", 3, 95, 1], ["sea-nom", 1, 60, 0]]);
assert.equal(formatSeconds(42), "42 s");
assert.equal(formatSeconds(125), "2 min 5 s");
console.log("quote-timer tests passed");
