import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const shell = read("components/AppShell.tsx");
const air = read("app/(workspace)/air/page.tsx");
const sea = read("app/(workspace)/sea/page.tsx");
const inbox = read("app/(workspace)/inbox/page.tsx");
const notice = read("components/CircularReadNotifier.tsx");
const nrs = read("hooks/use-nrs-live-alerts.ts");
const more = read("components/WorkspaceMore.tsx");

assert.doesNotMatch(shell, /atlas_won_followup_nudge_shown/);
assert.doesNotMatch(shell, /toast\(/);
assert.doesNotMatch(inbox, /Opening \$\{desk/);
assert.doesNotMatch(air, /Added \$\{res\.options\.length\} carrier/);
assert.doesNotMatch(sea, /Added \$\{res\.options\.length\} carrier/);
assert.match(air, /readyForPricedComparison\(p, "air"\)/);
assert.match(sea, /readyForPricedComparison\(p, "sea"\)/);
assert.match(notice, /noticeInterruptsWork/);
assert.doesNotMatch(nrs, /atlas_nrs_summary_shown/);
assert.match(more, /Install on this computer/);

console.log("quiet quote contract ok");
