import assert from "node:assert/strict";
import { groupHits, highlightParts, hitWho, type SearchHit } from "./search-view";

const hit = (over: Partial<SearchHit>): SearchHit => ({ mailbox: "pricing", folder: "inbox", uid: 1, messageId: "<a>", subject: "x", from: { email: "a@x.in", name: "A" }, to: [], date: 0, key: "", ...over });

const groups = groupHits([
  hit({ uid: 1, subject: "RE: AMD - LRD//463Kg", key: "amd - lrd//463kg", date: 300 }),
  hit({ uid: 2, folder: "sent", subject: "AMD - LRD//463Kg", key: "amd - lrd//463kg", date: 200, to: [{ email: "p@alg.in", name: "Prashant" }, { email: "q@x.com", name: "" }] }),
  hit({ uid: 3, subject: "Cotización aérea ticket #109196", key: "cotización aérea ticket #109196", date: 100 }),
  hit({ uid: 4, subject: "Hi", key: "hi", date: 400 }),
]);
assert.equal(groups.length, 3, "two mails with the same subject form one conversation");
assert.deepEqual(groups.map((g) => g.hits.length), [1, 2, 1].sort((a, b) => 0) && [1, 2, 1]);
assert.equal(groups[0].subject, "Hi", "newest conversation first");
assert.equal(groups[1].hits[0].uid, 1, "newest mail first inside a conversation");
assert.equal(hitWho(groups[1].hits[1]), "Sent to Prashant +1");
assert.equal(hitWho(hit({ from: { email: "z@y.com", name: "" } })), "z@y.com");

const parts = highlightParts("Quote for AMD to LRD", ["amd", "lrd"]);
assert.deepEqual(parts.filter((p) => p.hit).map((p) => p.text), ["AMD", "LRD"]);
assert.equal(parts.map((p) => p.text).join(""), "Quote for AMD to LRD");
assert.deepEqual(highlightParts("nothing", []), [{ text: "nothing", hit: false }]);
console.log("search-view tests passed");
