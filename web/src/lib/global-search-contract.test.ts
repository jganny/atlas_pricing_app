import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const src = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(src, p), "utf8");

const shell = read("components/AppShell.tsx");
const gs = read("components/GlobalSearch.tsx");
const home = read("app/(workspace)/page.tsx");

// The magnifier is in both top bars: the dark phone bar and the desktop bar.
assert.match(shell, /<GlobalSearch variant="phone" \/>/);
assert.match(shell, /<GlobalSearch variant="desk" \/>/);

// It opens on click or "/", but never while typing in a box, and not on the Admin page, which has its own search for settings.
assert.match(gs, /e\.key !== "\/"/);
assert.match(gs, /getElementById\("admin-search"\)/);
assert.match(read("components/admin/AdminSearch.tsx"), /id="admin-search"/);

// It closes when a result is picked, on click-away, and on Esc; Esc is handled here only while open, so Esc on a closed search still leaves the page.
assert.match(gs, /onBlur=\{\(\) => window\.setTimeout\(close/);
assert.match(gs, /e\.key === "Escape" && open/);
assert.match(gs, /e\.preventDefault\(\);\s*close\(\);/);

// A quote request still hands over to the desk filled in, exactly as the old Start here bar did.
assert.match(gs, /askPrefill\(typed, it\)/);
assert.match(gs, /storeSmartQuotePrefill\(prefill\)/);
assert.match(gs, /\?smart=1/);

// Settings are only searched for administrators.
assert.match(gs, /isAdmin \? visibleSections/);

// Home: no start box; the Air desk, Sea desk and Inbox shortcuts are for phones only (a computer has them in the left menu).
assert.doesNotMatch(home, /HomeStartBox/);
assert.match(home, /className="flex flex-wrap gap-2 md:hidden" data-testid="home-phone-shortcuts"/);

// The help button still has its own Ask Vertex bar, so nothing else that used it broke.
assert.match(read("components/HelpFab.tsx"), /VertexAskBar/);

console.log("global search contract ok");
