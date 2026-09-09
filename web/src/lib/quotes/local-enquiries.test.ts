import assert from "node:assert/strict";
import {
  forgetLocalEnquiry,
  isDeletedQuoteId,
  listLocalEnquiries,
  mergeLocalEnquiries,
  rememberLocalEnquiry,
} from "./local-enquiries";
import type { EnquiryRecord } from "@/lib/types";

const mem = new Map<string, string>();
const sess = new Map<string, string>();
const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage };
function storage(map: Map<string, string>): Storage {
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}
g.localStorage = storage(mem);
g.sessionStorage = storage(sess);

function row(id: string, ref = id): EnquiryRecord {
  return {
    id,
    ref,
    customer: "ABC",
    origin: "BLR",
    destination: "GRU",
    mode: "air",
    status: "quoted",
    assignee: "Ganny",
    creator: "ganny",
    slaHoursOpen: 1,
    createdAt: "",
    grandTotal: 820,
    currency: "USD",
  } as EnquiryRecord;
}

rememberLocalEnquiry(row("AEABC0926IN86727"));
assert.equal(listLocalEnquiries().some((r) => r.id === "AEABC0926IN86727"), true);

forgetLocalEnquiry("AEABC0926IN86727");
assert.equal(isDeletedQuoteId("AEABC0926IN86727"), true);
assert.equal(listLocalEnquiries().some((r) => r.id === "AEABC0926IN86727"), false);

const merged = mergeLocalEnquiries([row("AEABC0926IN86727"), row("KEEP")]);
assert.equal(merged.some((r) => r.id === "AEABC0926IN86727"), false);
assert.equal(merged.some((r) => r.id === "KEEP"), true);

console.log("local-enquiries tests passed");
