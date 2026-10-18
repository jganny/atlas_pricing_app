import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_FILE_BYTES, MAX_TEXT, NOTICE_BODY, RETENTION_DAYS } from "./chat-logic";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
const storage = fs.readFileSync(path.join(root, "storage.rules"), "utf8");
const retention = fs.readFileSync(path.join(root, "functions/chat-retention.js"), "utf8");

// The same number of days everywhere: the app, the notice, the server job, the rules' comments.
assert.match(retention, new RegExp(`RETENTION_DAYS = ${RETENTION_DAYS};`), "server job uses the same retention as the app");
assert.match(NOTICE_BODY, new RegExp(`${RETENTION_DAYS} days`));
assert.match(rules, new RegExp(`${RETENTION_DAYS} days after they were sent`));
assert.match(storage, new RegExp(`${MAX_FILE_BYTES / 1024 / 1024} \\* 1024 \\* 1024`), "storage allows the same file size as the app");
assert.match(rules, new RegExp(`text.size\\(\\) <= ${MAX_TEXT}`), "rules allow the same message length as the app");

// Chat data is closed to the app for hard deletes and cannot be reached by unsigned users.
const chatBlock = rules.slice(rules.indexOf("Team chat"), rules.indexOf("match /chatAudit"));
assert.match(chatBlock, /match \/messages\/\{messageId\}[\s\S]*allow delete: if false;/, "messages cannot be hard-deleted from the app");
assert.equal(/allow (read|write)[^;]*:\s*if true/.test(chatBlock), false, "no open access");
assert.match(rules, /match \/chatAudit[\s\S]*allow update, delete: if false;/, "the review log cannot be edited or erased");
assert.match(rules, /chatLogin\(\) in room\.get\('memberLogins'/, "rooms are limited to their members");

// What people are told: work records, kept 100 days, reviewable by administrators.
assert.match(NOTICE_BODY, /administrators may review/);
console.log("chat contract tests passed");
