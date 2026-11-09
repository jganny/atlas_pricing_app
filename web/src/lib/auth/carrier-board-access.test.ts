import assert from "node:assert/strict";
import { allowedRoutesForUser, canAccessRoute, routeIdFromPath } from "./rbac";

// The Carrier Board is open to every Pricing app user, whatever their desk: nobody has to ask for it.
for (const who of ["ganny", "shashank", "shaheer", "cathrina", "kavya", "pricing", "someone-new"]) {
  assert.ok(canAccessRoute(who, undefined, "carrier-board"), `${who} can open the Carrier Board`);
}
// A Vertex Chat-only login reaches chat and nothing else.
assert.deepEqual(allowedRoutesForUser("chatperson", "chat"), ["chat"]);
assert.equal(routeIdFromPath("/carrier-board"), "carrier-board");
assert.equal(routeIdFromPath("/carrier-board/"), "carrier-board");
assert.equal(routeIdFromPath("/carriers"), "directory", "the airline directory keeps its own route");
console.log("carrier board access ok");
