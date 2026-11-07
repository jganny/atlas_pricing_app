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
assert.match(index, /exports\.aiBudgetsSave = aiUsage\.aiBudgetsSave/);
const usage = fn("ai-usage.js");
assert.match(usage, /api\.anthropic\.com\/v1\/messages/);
assert.match(usage, /globalThis\.fetch = /);

// A budget is checked BEFORE the AI call and refuses with a plain reason; a fault in the check lets the call through.
assert.match(usage, /const verdict = await budgetGuard\(feature\)/);
assert.match(usage, /return budgetResponse\(verdict\)/);
assert.match(usage, /allowing the call/);
// Ask Vertex costs money per question, so its defaults are the frugal ones: 10 a day each, the cheaper model, no web search unless asked.
const chatFn = fn("vertex-chat.js");
assert.match(chatFn, /DEFAULT_DAILY_LIMIT = 10;/);
assert.match(chatFn, /ADMIN_DAILY_LIMIT = 50;/);
assert.match(chatFn, /body\.mode === "deep" \? "deep" : "quick"/);
assert.match(chatFn, /const web = body\.web === true;/);
const chatScreen = read("src/components/VertexChat.tsx");
assert.match(chatScreen, /useState<"quick" \| "deep">\("quick"\)/);
assert.match(chatScreen, /const \[web, setWeb\] = useState\(false\)/);

// Only the main administrator can read or change it, and chat-only logins are refused.
assert.match(usage, /ganny@atlaspricing\.com|L\.ADMIN_EMAIL/);
assert.match(usage, /chatOnly === true/);
assert.equal((usage.match(/^\s+requireAdmin\(request\);/gm) ?? []).length, 3, "every admin function (summary, balance, budgets) checks the admin");

// The counting never gets a rule that lets a browser read or write it: no client rules for these collections.
const rules = fs.readFileSync(path.join(web, "..", "firestore.rules"), "utf8");
for (const c of ["aiUsage", "aiStatus", "aiBilling"]) assert.ok(!rules.includes(`match /${c}/`), `${c} must have no client rule`);

// The screen is shown to ganny only, in the live app: the rule lives in the Admin section list.
const sections = read("src/lib/admin/sections.ts");
assert.match(sections, /id: "ai-credit-and-cost"[^\n]*rule: "ganny-live"/);
assert.match(read("src/app/(workspace)/admin/page.tsx"), /case "ai-credit-and-cost":\s*return <AiUsageAdmin \/>/);

console.log("ai usage contract ok");
