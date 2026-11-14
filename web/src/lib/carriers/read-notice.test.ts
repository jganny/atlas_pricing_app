import assert from "node:assert/strict";
import { noticeFor, noticeInterruptsWork, statusLine, type ReadLike } from "./read-notice";

const base: ReadLike = { status: "read", kind: "rates", title: "EK_BLR rev", reason: "", applied: 132, held: 9, points: 0, charges: 0 };

assert.deepEqual(noticeFor({ ...base, status: "reading" }).tone, "info");
assert.match(noticeFor({ ...base, status: "reading" }).text, /Reading .EK_BLR rev. now/);
const done = noticeFor(base);
assert.equal(done.tone, "success");
assert.match(done.text, /132 saved, 9 held for checking and still on their old rate/);
assert.doesNotMatch(noticeFor({ ...base, held: 0 }).text, /held/);
const bad = noticeFor({ ...base, status: "failed", reason: "Only PDF and Excel circulars can be read automatically." });
assert.equal(bad.tone, "error", "a problem is shown as an error straight away");
assert.match(bad.text, /Could not read .EK_BLR rev.: Only PDF and Excel/);
assert.match(bad.text, /file is saved/);
assert.match(noticeFor({ ...base, status: "failed", reason: "" }).text, /did not finish/);
const wait = noticeFor({ ...base, status: "skipped", reason: "The limit would be passed." });
assert.equal(wait.tone, "info");
assert.match(wait.text, /not read yet: The limit would be passed\./);
assert.match(noticeFor({ ...base, kind: "digest" }).text, /What it says/);
assert.match(noticeFor({ ...base, title: "" }).text, /^Rates from Your circular/);

assert.equal(noticeInterruptsWork(noticeFor({ ...base, status: "reading" })), false);
assert.equal(noticeInterruptsWork(noticeFor(base)), false);
assert.equal(noticeInterruptsWork(noticeFor({ ...base, status: "skipped", reason: "limit" })), false);
assert.equal(noticeInterruptsWork(noticeFor({ ...base, status: "failed", reason: "bad file" })), true);

assert.equal(statusLine(undefined), null);
assert.equal(statusLine({ ...base, status: "reading" })?.text, "Reading\u2026 a few minutes");
assert.equal(statusLine(base)?.text, "Rates read: 132 saved, 9 held for checking");
assert.equal(statusLine({ ...base, kind: "digest" })?.text, "Read");
assert.equal(statusLine({ ...base, status: "failed", reason: "Nothing useful could be written from this file." })?.tone, "error");
console.log("read notices ok");
