import assert from "node:assert/strict";
import { canViewOwned, visibleToUser } from "./sales-access";

// Regular rep: sees only their own records, plus ownerless (legacy) ones —
// never a colleague's.
assert.equal(canViewOwned("shashank", "member", "shashank"), true);
assert.equal(canViewOwned("shashank", "member", "kavya"), false, "must not see a colleague's record");
assert.equal(canViewOwned("shashank", "member", undefined), true, "ownerless/legacy record stays visible");
assert.equal(canViewOwned("shashank", "member", ""), true, "empty-string owner treated the same as ownerless");

// Case/whitespace-insensitive owner match.
assert.equal(canViewOwned("Shashank", "member", "  shashank  "), true);

// Admin sees everything regardless of owner.
assert.equal(canViewOwned("ganny", "admin", "kavya"), true);
assert.equal(canViewOwned("manager", "manager", "kavya"), true);

// No signed-in user sees nothing.
assert.equal(canViewOwned(undefined, "member", "kavya"), false);

// Array filter: a rep's team-wide leads array collapses to their own +
// ownerless ones only; an admin's stays the full list.
const rows = [
  { id: "1", owner: "shashank" },
  { id: "2", owner: "kavya" },
  { id: "3", owner: undefined },
  { id: "4", owner: "shashank" },
];
assert.deepEqual(
  visibleToUser(rows, "shashank", "member").map((r) => r.id),
  ["1", "3", "4"],
  "rep sees only their own rows plus the ownerless one",
);
assert.deepEqual(
  visibleToUser(rows, "ganny", "admin").map((r) => r.id),
  ["1", "2", "3", "4"],
  "admin sees every row",
);

console.log("sales-access.test.ts: all assertions passed");
