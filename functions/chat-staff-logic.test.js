const assert = require("node:assert/strict");
const L = require("./chat-staff-logic");

assert.equal(L.suggestUsername("Asha Menon"), "asha.menon");
assert.equal(L.suggestUsername("  Imran   Qureshi "), "imran.qureshi");
assert.equal(L.suggestUsername("Priya"), "priya");
assert.equal(L.suggestUsername("Anna Maria Kora"), "anna.kora");
assert.equal(L.suggestUsername("12 !!"), "");
assert.ok(L.validUsername("asha.menon"));
assert.ok(!L.validUsername("ab"));
assert.ok(!L.validUsername("1asha"));
assert.ok(!L.validUsername("Asha"));
assert.ok(!L.validUsername("asha menon"));
assert.equal(L.cleanName("  Asha   Menon "), "Asha Menon");

const t = L.newInviteToken();
assert.ok(t.length >= 24);
assert.notEqual(t, L.newInviteToken());
assert.notEqual(L.hashToken(t), t);
assert.equal(L.hashToken(t), L.hashToken(t));

const now = 1_000_000;
assert.equal(L.inviteProblem({ used: false, expiresAt: now + 1 }, now), null);
assert.match(L.inviteProblem(null, now), /isn't valid/);
assert.match(L.inviteProblem({ used: true, expiresAt: now + 1 }, now), /already been used/);
assert.match(L.inviteProblem({ used: false, expiresAt: now - 1 }, now), /expired/);
assert.equal(L.inviteExpiry(now), now + 7 * 86_400_000);
assert.match(L.passwordProblem("short"), /at least 8/);
assert.equal(L.passwordProblem("longenough1"), null);

assert.equal(L.staffState({ disabled: true, joinedAt: 5 }), "off");
assert.equal(L.staffState({ joinedAt: 5 }), "joined");
assert.equal(L.staffState({ invitePending: true }), "invited");
assert.equal(L.staffState({}), "ready");

console.log("chat-staff logic ok");
