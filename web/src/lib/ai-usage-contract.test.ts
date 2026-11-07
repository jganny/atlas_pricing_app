import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const web = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(web, p), "utf8");
const fn = (p: string) => fs.readFileSync(path.join(web, "..", "functions", p), "utf8");

// Every AI call is counted: the counter is switched on in index.js and wraps the server's fetch once.
const index = fn("index.js");
assert.match(index, /require\("\.\/ai-usage"\)/);
assert.match(index, /aiUsage\.install\(\)/);
assert.match(index, /exports\.aiUsageSummary = aiUsage\.aiUsageSummary/);
assert.match(index, /exports\.aiBillingSave = aiUsage\.aiBillingSave/);
const usage = fn("ai-usage.js");
assert.match(usage, /api\.anthropic\.com\/v1\/messages/);
assert.match(usage, /globalThis\.fetch = /);

// Only the main administrator can read or change it, and chat-only logins are refused.
assert.match(usage, /ganny@atlaspricing\.com|L\.ADMIN_EMAIL/);
assert.match(usage, /chatOnly === true/);
assert.equal((usage.match(/^\s+requireAdmin\(request\);/gm) ?? []).length, 2, "both admin functions check the admin");

// The counting never gets a rule that lets a browser read or write it: no client rules for these collections.
const rules = fs.readFileSync(path.join(web, "..", "firestore.rules"), "utf8");
for (const c of ["aiUsage", "aiStatus", "aiBilling"]) assert.ok(!rules.includes(`match /${c}/`), `${c} must have no client rule`);

// The screen is shown to ganny only, in the live app: the rule lives in the Admin section list.
const sections = read("src/lib/admin/sections.ts");
assert.match(sections, /id: "ai-credit-and-cost"[^\n]*rule: "ganny-live"/);
assert.match(read("src/app/(workspace)/admin/page.tsx"), /case "ai-credit-and-cost":\s*return <AiUsageAdmin \/>/);

console.log("ai usage contract ok");
