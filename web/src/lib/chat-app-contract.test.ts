import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p: string) => fs.readFileSync(path.join(web, p), "utf8");
const readRoot = (p: string) => fs.readFileSync(path.join(web, "..", p), "utf8");

// The Vertex Chat build: own site at the root, own manifest/service worker/icons, chat only.
const manifest = JSON.parse(read("chat-app/manifest.webmanifest"));
assert.equal(manifest.name, "Vertex Chat");
assert.equal(manifest.scope, "/");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.display, "standalone");
for (const icon of manifest.icons) {
  assert.ok(fs.existsSync(path.join(web, "chat-app", icon.src.replace(/^\//, ""))), `missing icon ${icon.src}`);
  assert.ok(!icon.src.startsWith("/app/"), "chat icons must not point into the Pricing app");
}
assert.ok(fs.existsSync(path.join(web, "chat-app/apple-touch-icon.png")));

const sw = read("chat-app/sw.js");
assert.doesNotMatch(sw, /["'`]\/app[\/"'`]/, "the chat service worker must not use Pricing app paths");
assert.match(sw, /searchParams\.get\("room"\)/, "a notification opens the right chat");

const env = read(".env.chat");
assert.match(env, /NEXT_PUBLIC_CHAT_APP=true/);
assert.match(env, /NEXT_PUBLIC_MOCK_MODE=false/);
assert.doesNotMatch(env, /DEMO_MODE=true/);

assert.match(read("next.config.ts"), /isDemoBuild \|\| isChatApp \? "" : "\/app"/);
assert.match(read("src/app/(workspace)/layout.tsx"), /IS_CHAT_APP\) return <ChatAppShell/);
assert.match(read("src/components/Providers.tsx"), /IS_CHAT_APP \? null : <HelpFab/);

// The chat build must never be uploaded with the Pricing site, and has its own build script.
assert.match(readRoot("firebase.json"), /"app-chat"/);
assert.match(readRoot("scripts/build-chat.sh"), /\.env\.chat/);

// Voice notes are wired into the box and the message.
assert.match(read("src/components/chat/Composer.tsx"), /useVoiceRecorder/);
assert.match(read("src/components/chat/MessageItem.tsx"), /data-testid="voice-note"/);

console.log("chat app contract: own site, own manifest and worker, chat only; voice notes wired");

// Official use only: no self sign-up in the chat app.
const loginSrc = fs.readFileSync(path.join(web, "src/app/login/page.tsx"), "utf8");
assert.match(loginSrc, /IS_CHAT_APP \? "hidden"/);
