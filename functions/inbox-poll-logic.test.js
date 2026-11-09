const assert = require("node:assert/strict");
const P = require("./inbox-poll-logic");

// only mail newer than the cursor, oldest first, capped
assert.deepEqual(P.nextUids([5, 3, 9, 7], 4, 10), [5, 7, 9]);
assert.deepEqual(P.nextUids([5, 3, 9, 7], 4, 2), [5, 7], "a backlog is taken oldest first, a few at a time");
assert.deepEqual(P.nextUids([5, 3, 9, 7], 0, 2, true), [7, 9], "the very first run takes the latest few");
// the server answers "*" with the last message even when nothing is new: it is not read again
assert.deepEqual(P.nextUids([100], 100, 10), []);
assert.deepEqual(P.nextUids([1551415, "1551416", 1551416, null, "x", 2.5], 1551414, 10), [1551415, 1551416], "bad entries and repeats are dropped");
assert.deepEqual(P.nextUids(undefined, 5, 3), []);
// the cursor only moves forward
assert.equal(P.nextCursor(100, [101, 105], null, false), 105);
assert.equal(P.nextCursor(100, [], null, false), 100);
assert.equal(P.nextCursor(undefined, [7, 9], 500, true), 500, "first run: jump to the newest message");
assert.equal(P.nextCursor(undefined, [7, 9], null, true), 9);
assert.equal(P.nextCursor(undefined, [], null, true), null);
console.log("inbox poll logic ok");
