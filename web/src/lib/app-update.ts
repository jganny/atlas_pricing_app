/** localStorage: last version the user acknowledged via Refresh now. */
export const SEEN_VERSION_KEY = "atlas_seen_app_version";
/** sessionStorage: this tab already ran a Refresh-now reload. */
export const RELOAD_GUARD_KEY = "atlas_reload_guard";

type KV = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function persistSeen(appVersion: string, local: KV) {
  local.setItem(SEEN_VERSION_KEY, appVersion);
}

/**
 * After a Refresh-now click, Safari + skipWaiting/clients.claim can reload the
 * tab again. If a reload already ran in this tab, accept the landed build and
 * do not show the banner (or reload) again.
 */
export function bannerVisibleAfterLoad(appVersion: string, local: KV, session: KV): boolean {
  try {
    const guard = session.getItem(RELOAD_GUARD_KEY);
    if (guard) {
      persistSeen(appVersion, local);
      session.setItem(RELOAD_GUARD_KEY, appVersion);
      return false;
    }
    return local.getItem(SEEN_VERSION_KEY) !== appVersion;
  } catch {
    return true;
  }
}

/** @returns false if this tab already refreshed onto this version — skip another reload. */
export function beginRefreshReload(appVersion: string, local: KV, session: KV): boolean {
  try {
    if (session.getItem(RELOAD_GUARD_KEY) === appVersion) {
      persistSeen(appVersion, local);
      return false;
    }
    persistSeen(appVersion, local);
    session.setItem(RELOAD_GUARD_KEY, appVersion);
    return true;
  } catch {
    return true;
  }
}
