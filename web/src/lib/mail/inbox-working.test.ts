import assert from "node:assert/strict";
import { activeWorker, agoText, markWorking, workingNote, WORKING_MINUTES } from "./inbox-working";

const NOW = 1_800_000_000_000;
const min = (n: number) => n * 60_000;
const shaheer = { username: "shaheer", name: "Shaheer", at: NOW - min(6) };

// Someone else is on it: shown. Me: not shown (it is my own mark). Nobody: null.
assert.deepEqual(activeWorker({ workingBy: shaheer }, "shashank", NOW), shaheer);
assert.equal(activeWorker({ workingBy: shaheer }, "Shaheer", NOW), null, "my own mark is never a warning");
assert.equal(activeWorker({}, "shashank", NOW), null);
assert.equal(activeWorker({ workingBy: null }, "shashank", NOW), null);

// A mark goes stale: an enquiry opened and forgotten is free again after 45 minutes.
assert.equal(activeWorker({ workingBy: { ...shaheer, at: NOW - min(WORKING_MINUTES - 1) } }, "shashank", NOW)?.username, "shaheer");
assert.equal(activeWorker({ workingBy: { ...shaheer, at: NOW - min(WORKING_MINUTES + 1) } }, "shashank", NOW), null);
assert.equal(activeWorker({ workingBy: { username: "", name: "", at: NOW } }, "shashank", NOW), null);

assert.equal(agoText(NOW - 20_000, NOW), "just now");
assert.equal(agoText(NOW - min(6), NOW), "6 min ago");
assert.equal(agoText(NOW - min(65), NOW), "1 h 5 min ago");
assert.equal(workingNote(shaheer, NOW), "Shaheer is quoting this (opened 6 min ago)");
assert.deepEqual(markWorking({ username: "shashank", displayName: "Shashank" }, NOW), { username: "shashank", name: "Shashank", at: NOW });
assert.equal(markWorking({ username: "ganny" }, NOW).name, "ganny");

console.log("inbox-working tests passed");
