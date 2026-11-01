import assert from "node:assert/strict";
import { cleanStatus, fitWithin, isAcceptablePhoto, MAX_PHOTO_CHARS, MAX_STATUS_CHARS, STATUS_PRESETS } from "./profile";

assert.equal(cleanStatus("  In   a\nmeeting  "), "In a meeting");
assert.equal(cleanStatus(""), "");
assert.equal(cleanStatus("x".repeat(200)).length, MAX_STATUS_CHARS);
assert.ok(STATUS_PRESETS.every((s) => cleanStatus(s) === s && s.length <= MAX_STATUS_CHARS));

assert.deepEqual(fitWithin(1000, 500, 100), { width: 100, height: 50 });
assert.deepEqual(fitWithin(50, 40, 100), { width: 50, height: 40 });
assert.deepEqual(fitWithin(0, 40, 100), { width: 0, height: 0 });

assert.ok(isAcceptablePhoto("data:image/jpeg;base64,AAAA"));
assert.ok(!isAcceptablePhoto("data:image/png;base64,AAAA"));
assert.ok(!isAcceptablePhoto("data:image/jpeg;base64," + "A".repeat(MAX_PHOTO_CHARS)));
assert.ok(!isAcceptablePhoto("https://example.com/me.jpg"));

console.log("chat profile: status clean-up, photo size limits");

// The database rules and the app must agree on the limits.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const rules = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../../firestore.rules"), "utf8");
assert.match(rules, new RegExp(`match /chatProfiles/\\{login\\}`));
assert.ok(rules.includes(`.size() <= ${MAX_PHOTO_CHARS}`), "photo limit in rules");
assert.ok(rules.includes(`.size() <= ${MAX_STATUS_CHARS}`), "status limit in rules");
console.log("chat profile: rules and app limits match");
