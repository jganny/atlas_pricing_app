import assert from "node:assert/strict";
import { groupErrors, withinHours, type ClientErrorRecord } from "./error-groups";

const rec = (p: Partial<ClientErrorRecord>): ClientErrorRecord => ({
  id: "x", atIso: "2026-09-21T10:00:00.000Z", actor: "ravi", fingerprint: "f1", message: "boom", stack: "", componentStack: "",
  source: "boundary", path: "/app/air/", version: "0.3.52-test-app", userAgent: "", ...p,
});

const groups = groupErrors([
  rec({ id: "1", atIso: "2026-09-21T10:00:00.000Z", actor: "ravi" }),
  rec({ id: "2", atIso: "2026-09-21T11:00:00.000Z", actor: "asha", version: "0.3.53-test-app", path: "/app/sea/" }),
  rec({ id: "3", atIso: "2026-09-21T12:00:00.000Z", fingerprint: "f2", message: "other" }),
  rec({ id: "4", atIso: "2026-09-21T09:00:00.000Z", actor: "ravi" }),
]);
assert.equal(groups.length, 2);
assert.equal(groups[0]!.fingerprint, "f2"); // most recently seen first
const f1 = groups.find((g) => g.fingerprint === "f1")!;
assert.equal(f1.count, 3);
assert.equal(f1.firstSeen, "2026-09-21T09:00:00.000Z");
assert.equal(f1.lastSeen, "2026-09-21T11:00:00.000Z");
assert.deepEqual(f1.users.sort(), ["asha", "ravi"]);
assert.deepEqual(f1.versions.sort(), ["0.3.52-test-app", "0.3.53-test-app"]);
assert.deepEqual(f1.ids.sort(), ["1", "2", "4"]);

const now = Date.parse("2026-09-21T12:00:00.000Z");
assert.equal(withinHours([rec({ atIso: "2026-09-21T11:30:00.000Z" }), rec({ atIso: "2026-09-20T11:00:00.000Z" })], 24, now).length, 1);
assert.deepEqual(groupErrors([]), []);

console.log("error-groups.test.ts: all assertions passed");
