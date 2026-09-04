/** Runtime Firebase / Maps config override (admin paste) — mirrors legacy gl_firebase_config. */

const FB_KEY = "atlas_firebase_config_v1";
const GMAPS_KEY = "atlas_gmaps_key";

export type RuntimeFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseId?: string;
};

export function loadRuntimeFirebaseConfig(): RuntimeFirebaseConfig | null {
  try {
    const raw = localStorage.getItem(FB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RuntimeFirebaseConfig;
    if (!parsed?.apiKey || !parsed?.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRuntimeFirebaseConfig(cfg: RuntimeFirebaseConfig) {
  localStorage.setItem(FB_KEY, JSON.stringify(cfg));
}

export function clearRuntimeFirebaseConfig() {
  localStorage.removeItem(FB_KEY);
}

export function loadGmapsKey(): string {
  try {
    return localStorage.getItem(GMAPS_KEY) || "";
  } catch {
    return "";
  }
}

export function saveGmapsKey(key: string) {
  if (key.trim()) localStorage.setItem(GMAPS_KEY, key.trim());
  else localStorage.removeItem(GMAPS_KEY);
}

export function parseFirebaseConfigPaste(text: string): RuntimeFirebaseConfig {
  const trimmed = text.trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Allow pasted JS object literal without quotes on keys
    const jsonish = trimmed
      .replace(/^\s*const\s+\w+\s*=\s*/, "")
      .replace(/;$/, "")
      .replace(/(\w+)\s*:/g, '"$1":')
      .replace(/'/g, '"');
    obj = JSON.parse(jsonish) as Record<string, unknown>;
  }
  const apiKey = String(obj.apiKey || "");
  const projectId = String(obj.projectId || "");
  if (!apiKey || !projectId) throw new Error("apiKey and projectId are required");
  return {
    apiKey,
    authDomain: String(obj.authDomain || `${projectId}.firebaseapp.com`),
    projectId,
    storageBucket: obj.storageBucket ? String(obj.storageBucket) : undefined,
    messagingSenderId: obj.messagingSenderId ? String(obj.messagingSenderId) : undefined,
    appId: obj.appId ? String(obj.appId) : undefined,
    databaseId: obj.databaseId ? String(obj.databaseId) : undefined,
  };
}
