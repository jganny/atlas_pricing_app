import assert from "node:assert/strict";
import { activeWorker, agoText, markWorking, workingNote } from "./inbox-working";

const NOW = 1_800_000_000_000;
const min = (n: number) => n * 60_000;
const shaheer = { username: "shaheer", name: "Shaheer", at: NOW - min(6) };

// Someone else is on it: shown. Me: not shown (it is my own mark). Nobody: null.
assert.deepEqual(activeWorker({ workingBy: shaheer }, "shashank"), shaheer);
assert.equal(activeWorker({ workingBy: shaheer }, "Shaheer"), null, "my own mark is never a warning");
assert.equal(activeWorker({}, "shashank"), null);
assert.equal(activeWorker({ workingBy: null }, "shashank"), null);

// The mark never expires by itself: away from the desk, working from home or held up, the enquiry is still theirs.
assert.equal(activeWorker({ workingBy: { ...shaheer, at: NOW - min(60 * 5) } }, "shashank")?.username, "shaheer", "still theirs after 5 hours");
assert.equal(activeWorker({ workingBy: { ...shaheer, at: NOW - min(60 * 24 * 3) } }, "shashank")?.username, "shaheer", "and after 3 days");
assert.equal(activeWorker({ workingBy: { username: "", name: "", at: NOW } }, "shashank"), null);

assert.equal(agoText(NOW - 20_000, NOW), "just now");
assert.equal(agoText(NOW - min(6), NOW), "6 min ago");
assert.equal(agoText(NOW - min(65), NOW), "1 h 5 min ago");
assert.equal(agoText(NOW - min(60 * 26), NOW), "1 d 2 h ago");
assert.equal(workingNote(shaheer, NOW), "Shaheer is quoting this (opened 6 min ago)");
assert.deepEqual(markWorking({ username: "shashank", displayName: "Shashank" }, NOW), { username: "shashank", name: "Shashank", at: NOW });
assert.equal(markWorking({ username: "ganny" }, NOW).name, "ganny");

console.log("inbox-working tests passed");
