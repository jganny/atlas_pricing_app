import assert from "node:assert/strict";
import { parseStaffList, suggestUsername, validUsername } from "./staff-list";

assert.equal(suggestUsername("Asha Menon"), "asha.menon");
assert.equal(suggestUsername("Anna Maria Kora"), "anna.kora");
assert.equal(suggestUsername("12 !!"), "");
assert.ok(validUsername("asha.menon") && !validUsername("Asha") && !validUsername("ab"));

const rows = parseStaffList("Asha Menon - Warehouse Chennai\nRavi Shetty, Customs Mumbai\n  \nLatha Nair (Accounts)\n1. Imran Qureshi\nAsha Menon");
assert.deepEqual(rows.map((r) => r.name), ["Asha Menon", "Ravi Shetty", "Latha Nair", "Imran Qureshi", "Asha Menon"]);
assert.deepEqual(rows.map((r) => r.team), ["Warehouse Chennai", "Customs Mumbai", "Accounts", "", ""]);
assert.deepEqual(rows.map((r) => r.username), ["asha.menon", "ravi.shetty", "latha.nair", "imran.qureshi", "asha.menon2"], "a clash gets a number");
assert.deepEqual(parseStaffList("Priya Raman", new Set(["priya.raman"])).map((r) => r.username), ["priya.raman2"], "existing logins are avoided");
console.log("staff list: names, teams, logins");
