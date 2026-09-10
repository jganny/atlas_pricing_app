import assert from "node:assert/strict";
import {
  RELOAD_GUARD_KEY,
  SEEN_VERSION_KEY,
  bannerVisibleAfterLoad,
  beginRefreshReload,
} from "./app-update";

function memoryKV(initial: Record<string, string> = {}) {
  const mem = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    snapshot: () => Object.fromEntries(mem),
  };
}

{
  const local = memoryKV();
  const session = memoryKV();
  assert.equal(bannerVisibleAfterLoad("0.3.20-test-app", local, session), true);
}

{
  const local = memoryKV({ [SEEN_VERSION_KEY]: "0.3.20-test-app" });
  const session = memoryKV();
  assert.equal(bannerVisibleAfterLoad("0.3.20-test-app", local, session), false);
}

{
  const local = memoryKV({ [SEEN_VERSION_KEY]: "0.3.19-test-app" });
  const session = memoryKV({ [RELOAD_GUARD_KEY]: "0.3.19-test-app" });
  assert.equal(bannerVisibleAfterLoad("0.3.18-test-app", local, session), false);
  assert.equal(local.snapshot()[SEEN_VERSION_KEY], "0.3.18-test-app");
  assert.equal(session.snapshot()[RELOAD_GUARD_KEY], "0.3.18-test-app");
}

{
  const local = memoryKV();
  const session = memoryKV();
  assert.equal(beginRefreshReload("0.3.20-test-app", local, session), true);
  assert.equal(local.snapshot()[SEEN_VERSION_KEY], "0.3.20-test-app");
  assert.equal(session.snapshot()[RELOAD_GUARD_KEY], "0.3.20-test-app");
  assert.equal(beginRefreshReload("0.3.20-test-app", local, session), false);
}

{
  const local = memoryKV({ [SEEN_VERSION_KEY]: "0.3.19-test-app" });
  const session = memoryKV({ [RELOAD_GUARD_KEY]: "0.3.19-test-app" });
  assert.equal(bannerVisibleAfterLoad("0.3.20-test-app", local, session), false);
  assert.equal(beginRefreshReload("0.3.20-test-app", local, session), false);
}

console.log("app-update tests passed");
