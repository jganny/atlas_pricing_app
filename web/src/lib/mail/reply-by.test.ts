import assert from "node:assert/strict";
import { officeCloseAfter, offsetFromDateHeader, parseClientDeadline, replyBy, senderZone, timeLeftText, urgencyOf } from "./reply-by";

const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

// The Date header gives the sender's exact offset.
assert.equal(offsetFromDateHeader("Tue, 11 Nov 2026 17:31:00 +0900"), 540);
assert.equal(offsetFromDateHeader("Tue, 11 Nov 2026 12:35:00 -0500 (EST)"), -300);
assert.equal(offsetFromDateHeader("Tue, 11 Nov 2026 14:05:00 +0530"), 330);
assert.equal(offsetFromDateHeader("garbage"), null);

// The sender's clock: header first, then country, then India.
assert.equal(senderZone({ from: "Takeshi <t@example.co.jp>" }).abbr, "JST");
assert.equal(senderZone({ from: "x@example.com" }).abbr, "IST", "no country: India");
assert.equal(senderZone({ from: "x@example.com", senderTzMin: 420 }).abbr, "ICT");
assert.equal(senderZone({ from: "x@example.com", senderTzMin: 195 }).abbr, "UTC+3:15");
assert.equal(senderZone({ from: "a@b.de", senderTzMin: 60 }).city, "Germany");

// Office closing: 18:00 local. Tokyo closes before Bangkok, before India, whatever the arrival time.
const arrived = utc(2026, 11, 11, 8, 35); // 14:05 India, 17:35 Tokyo, 15:35 Bangkok
assert.equal(officeCloseAfter(arrived, 540), utc(2026, 11, 11, 9, 0), "Tokyo 18:00 JST = 09:00 UTC");
assert.equal(officeCloseAfter(arrived, 420), utc(2026, 11, 11, 11, 0), "Bangkok 18:00");
assert.equal(officeCloseAfter(arrived, 330), utc(2026, 11, 11, 12, 30), "India 18:00");
assert.ok(officeCloseAfter(arrived, 540) < officeCloseAfter(arrived, 420) && officeCloseAfter(arrived, 420) < officeCloseAfter(arrived, 330), "Japan, then Thailand, then India");
// After closing: the next working day. Friday evening in Tokyo: Monday (Sunday is closed; Saturday is not skipped).
assert.equal(officeCloseAfter(utc(2026, 11, 11, 10, 0), 540), utc(2026, 11, 12, 9, 0), "already past 18:00 in Tokyo: tomorrow");
assert.equal(officeCloseAfter(utc(2026, 11, 14, 10, 0), 540), utc(2026, 11, 16, 9, 0), "Saturday evening: Sunday is closed, so Monday");

// A client's own deadline.
const india = 330;
const rx = utc(2026, 11, 11, 8, 35); // 14:05 IST
assert.equal(parseClientDeadline("Please quote by 3 pm IST", rx, india)?.at, utc(2026, 11, 11, 9, 30));
assert.equal(parseClientDeadline("Need rates before 15:00 JST please", rx, india)?.at, utc(2026, 11, 12, 6, 0), "15:00 JST today is already past, so the next one is tomorrow");
assert.equal(parseClientDeadline("revert within 2 hours", rx, india)?.at, rx + 2 * 3_600_000);
assert.equal(parseClientDeadline("quote within 30 mins asap", rx, india)?.at, rx + 30 * 60_000);
assert.equal(parseClientDeadline("by 5pm", rx, india)?.at, utc(2026, 11, 11, 11, 30), "no zone given: the sender's own clock");
assert.equal(parseClientDeadline("by 10 am", rx, india)?.at, utc(2026, 11, 12, 4, 30), "a time already past today means tomorrow");
// Things that are not deadlines.
assert.equal(parseClientDeadline("cargo goes by sea, 3 pallets", rx, india), null);
assert.equal(parseClientDeadline("shipping by 3 pallets", rx, india), null, "a number without a clock is not a time");
assert.equal(parseClientDeadline("within 5 days", rx, india), null);
assert.equal(parseClientDeadline("pack within 2 hours of pickup", rx, india), null, "needs quote or rate wording");
assert.equal(parseClientDeadline("by 25:99", rx, india), null);

// Reply-by for an item: client deadline beats the office closing time.
const tokyo = { from: "Takeshi <t@example.co.jp>", subject: "Air BOM to NRT 220 kg", bodyPreview: "Please quote.", receivedAt: new Date(arrived).toISOString() };
const a = replyBy(tokyo, arrived);
assert.deepEqual([a.basis, a.basisLabel, a.localText], ["office", "Tokyo closes", "18:00 JST"]);
const dubai = { from: "Omar <o@example.ae>", subject: "By 3 pm IST please: LCL Chennai to Dubai", bodyPreview: "", receivedAt: new Date(arrived).toISOString() };
const b = replyBy(dubai, arrived);
assert.deepEqual([b.basis, b.basisLabel], ["client", "Client deadline"]);
assert.equal(b.at, utc(2026, 11, 11, 9, 30));
assert.ok(a.at < b.at, "Tokyo closes (09:00 UTC) before the Dubai client's 3 pm IST (09:30 UTC)");

// Urgency and wording.
assert.equal(urgencyOf(arrived - 1, arrived), "past");
assert.equal(urgencyOf(arrived + 25 * 60_000, arrived), "soon");
assert.equal(urgencyOf(arrived + 61 * 60_000, arrived), "ok");
assert.equal(timeLeftText(arrived + 25 * 60_000, arrived), "25 min");
assert.equal(timeLeftText(arrived + 85 * 60_000, arrived), "1 h 25 min");
assert.equal(timeLeftText(arrived + 120 * 60_000, arrived), "2 h");
assert.equal(timeLeftText(arrived - 125 * 60_000, arrived), "2 h 05 min late");
assert.equal(timeLeftText(arrived + 3 * 24 * 3_600_000, arrived), "3 d");

console.log("reply-by tests passed");
