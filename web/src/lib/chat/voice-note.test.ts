import assert from "node:assert/strict";
import { formatDuration, isVoiceNote, MAX_VOICE_SECONDS, pickVoiceFormat, voiceFileName, voiceSecondsFromName } from "./voice-note";
import { safeFileName } from "./chat-logic";

assert.deepEqual(pickVoiceFormat((m) => m === "audio/mp4"), { mime: "audio/mp4", ext: "m4a" });
assert.deepEqual(pickVoiceFormat(() => true), { mime: "audio/webm;codecs=opus", ext: "webm" });
assert.equal(pickVoiceFormat(() => false), null);

assert.equal(formatDuration(0), "0:00");
assert.equal(formatDuration(65.4), "1:05");
assert.equal(voiceFileName(42, "webm"), "Voice note 0m42s.webm");
assert.equal(voiceFileName(125, "m4a"), "Voice note 2m05s.m4a");
assert.equal(voiceFileName(0, "webm"), "Voice note 0m01s.webm");

// The name must survive the storage-path clean-up unchanged, or the length would be lost on upload.
for (const s of [1, 42, 120]) assert.equal(safeFileName(voiceFileName(s, "webm")), voiceFileName(s, "webm"));

assert.equal(voiceSecondsFromName("Voice note 2m05s.m4a"), 125);
assert.equal(voiceSecondsFromName("Quote.pdf"), null);
assert.ok(isVoiceNote("Voice note 0m42s.webm"));
assert.ok(!isVoiceNote("My voice note.webm"));
assert.equal(MAX_VOICE_SECONDS, 120);

console.log("voice notes: format choice, names and lengths");
