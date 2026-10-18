import assert from "node:assert/strict";
import { channelsToSync } from "./people";
import type { ChatRoom } from "./types";

const r = (o: Partial<ChatRoom>): ChatRoom => ({ id: "desk_nrs", kind: "channel", name: "NRS", audience: "list", memberLogins: ["a"], createdBy: "system", createdAt: 1, ...o });

assert.equal(channelsToSync([r({})], [r({})]).length, 0, "unchanged channels are left alone");
assert.equal(channelsToSync([], [r({})]).length, 1, "missing channel is created");
assert.equal(channelsToSync([r({})], [r({ memberLogins: ["b"] })]).length, 1, "new person in the seat");
assert.equal(channelsToSync([r({ memberLogins: ["b", "a"] })], [r({ memberLogins: ["a", "b"] })]).length, 0, "order does not matter");
console.log("chat people tests passed");
