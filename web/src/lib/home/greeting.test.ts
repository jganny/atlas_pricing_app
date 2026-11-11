import assert from "node:assert/strict";
import { homeDateLine, homeGreeting } from "./greeting";

const zone = "Asia/Kolkata";
assert.equal(homeGreeting(Date.parse("2026-11-12T08:15:00+05:30"), zone), "Good morning");
assert.equal(homeGreeting(Date.parse("2026-11-12T14:00:00+05:30"), zone), "Good afternoon");
assert.equal(homeGreeting(Date.parse("2026-11-12T19:40:00+05:30"), zone), "Good evening");
assert.equal(homeGreeting(Date.parse("2026-11-12T00:12:00+05:30"), zone), "Good evening");
assert.equal(homeDateLine(Date.parse("2026-11-12T00:06:00+05:30"), zone), "Thursday, 12 November 2026");

console.log("home greeting tests passed");
