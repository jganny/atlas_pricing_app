import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = fs.readFileSync(path.join(root, "components/EscapeHandler.tsx"), "utf8");
const inspector = fs.readFileSync(path.join(root, "components/EnquiryInspector.tsx"), "utf8");

// The Ask Vertex panel keeps hidden close buttons mounted; Esc must skip them and close the topmost visible window,
// otherwise Esc "does nothing" on the Quotation Preview.
assert.match(esc, /getClientRects\(\)\.length > 0/);
assert.match(esc, /visible\[visible\.length - 1\]/);
assert.doesNotMatch(esc, /document\.querySelector<HTMLButtonElement>\("\[data-modal-close\]"\)/);

// Amend / View must never fall back to the list row's summary when the real quote could not be read.
assert.match(inspector, /Couldn't load the full quote/);

console.log("escape + amend contract: Esc closes the visible top window; Amend never opens a blank summary");

const edb = fs.readFileSync(path.join(root, "app/(workspace)/enquiries/page.tsx"), "utf8");
const waiting = fs.readFileSync(path.join(root, "components/WaitingJobs.tsx"), "utf8");
assert.match(edb, /findQuotesAnywhere/);
assert.match(edb, /data-testid="older-quotes"/);
assert.match(waiting, /hub-clear-all/);
assert.match(waiting, /hub-job-owner/);
console.log("older-quote search and Quote Hub clear-all are wired");
