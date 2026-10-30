import assert from "node:assert/strict";
import { canQuickWon } from "./won-actions";

const row = (over: Record<string, unknown>) => ({ status: "quoted", deskSeat: "sea-nom", creator: "shaheer", ...over }) as Parameters<typeof canQuickWon>[0];

// Seat holders: Sea Nom (shaheer), Air Nom (shashank), Free Hand (kavya)
assert.equal(canQuickWon(row({}), "shaheer", false), true, "the Sea Nom desk can switch its own quote to Won");
assert.equal(canQuickWon(row({}), "kavya", false), false, "another desk cannot");
assert.equal(canQuickWon(row({}), "someone", true), true, "the admin can");
assert.equal(canQuickWon(row({ deskSeat: "freehand", creator: "kavya" }), "kavya", false), false, "only Air Nom and Sea Nom quotes get the switch");
assert.equal(canQuickWon(row({ deskSeat: "air-nom", creator: "shashank" }), "shashank", false), true);
assert.equal(canQuickWon(row({ status: "lost" }), "shaheer", false), false, "a lost quote has no switch");
assert.equal(canQuickWon(row({ status: "cancelled" }), "shaheer", true), false);
assert.equal(canQuickWon(row({ status: "won" }), "shaheer", false), true, "an already-won quote shows the switch on, so it can be switched back");
assert.equal(canQuickWon(row({ status: "open" }), "shaheer", false), true);
console.log("won-actions tests passed");
