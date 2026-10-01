import assert from "node:assert/strict";
import { cleanMessage, cleanStack, createLimiter, fingerprintOf, isIgnorableError, isStaleAssetError, normalizeForGrouping } from "./error-fingerprint";

// same bug, different build hashes / line numbers / users => same fingerprint
const stackA = "Error: Cannot read properties of undefined (reading 'id')\n    at t (https://vertex-35d95.web.app/app/_next/static/chunks/0a1b2c3d4e5f.js:1:23456)\n    at r (x.js:9:9)";
const stackB = "Error: Cannot read properties of undefined (reading 'id')\n    at t (https://vertex-35d95.web.app/app/_next/static/chunks/9f8e7d6c5b4a.js:7:1234)\n    at r (x.js:1:1)";
assert.equal(fingerprintOf("Cannot read properties of undefined (reading 'id')", stackA), fingerprintOf("Cannot read properties of undefined (reading 'id')", stackB));
// different bug => different fingerprint
assert.notEqual(fingerprintOf("Cannot read properties of undefined (reading 'id')", stackA), fingerprintOf("x is not a function", stackA));
// long ids in messages don't split groups
assert.equal(normalizeForGrouping("Quote 8f3a91c2d7 not found"), normalizeForGrouping("Quote 11aa22bb33 not found"));

// bounds
assert.equal(cleanMessage("x".repeat(2000)).length, 500);
assert.equal(cleanStack("y".repeat(9000)).length, 1800);
assert.equal(cleanMessage(new Error("boom")), "boom");
assert.equal(cleanMessage(undefined), "");

// noise vs real
assert.equal(isIgnorableError("ResizeObserver loop completed with undelivered notifications."), true);
assert.equal(isIgnorableError("Script error."), true);
assert.equal(isIgnorableError(""), true);
assert.equal(isIgnorableError("boom", "at x (chrome-extension://abc/content.js:1:1)"), true);
assert.equal(isIgnorableError("Minified React error #185"), false);
assert.equal(isIgnorableError("Cannot read properties of undefined"), false);

// stale-deploy errors
assert.equal(isStaleAssetError("ChunkLoadError: Loading chunk 123 failed."), true);
assert.equal(isStaleAssetError("Unexpected token '<'"), true);
assert.equal(isStaleAssetError("Failed to fetch dynamically imported module: https://x/y.js"), true);
assert.equal(isStaleAssetError("Maximum update depth exceeded"), false);

// limiter: per-fingerprint window and per-session cap
const mem = new Map<string, string>();
const allow = createLimiter({ get: (k) => mem.get(k) ?? null, set: (k, v) => void mem.set(k, v) }, { perSession: 3, perFingerprintMs: 1000 });
assert.equal(allow("a", 0), true);
assert.equal(allow("a", 500), false); // same error inside the window
assert.equal(allow("a", 1500), true); // window passed
assert.equal(allow("b", 1600), true); // 3rd report of the session
assert.equal(allow("c", 1700), false); // session cap reached
assert.equal(allow("d", 999999), false);

console.log("error-fingerprint.test.ts: all assertions passed");
