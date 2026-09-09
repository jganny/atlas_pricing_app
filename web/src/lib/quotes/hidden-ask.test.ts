import assert from "node:assert/strict";
import {
  hideQuoteFromAsk,
  isQuoteHiddenFromAsk,
  listHiddenQuoteIds,
} from "./hidden-ask";

const g = globalThis as { localStorage?: Storage };
const mem = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, v);
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  get length() {
    return mem.size;
  },
};

hideQuoteFromAsk("Q1");
hideQuoteFromAsk("Q1");
assert.equal(isQuoteHiddenFromAsk("Q1"), true);
assert.equal(listHiddenQuoteIds().filter((id) => id === "Q1").length, 1);
assert.equal(isQuoteHiddenFromAsk("Q2"), false);

console.log("hidden-ask tests passed");
