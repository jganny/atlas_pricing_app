/**
 * Atlas Pricing App — Firebase Cloud Functions
 *
 * adminResetPassword: Callable HTTPS function that lets the admin
 * reset any user's Firebase Authentication password using the
 * Firebase Admin SDK. Only authenticated users with the "admin"
 * custom claim (or username === 'ganny') can invoke this.
 *
 * adminDeleteUser: Removes a Firebase Auth user account entirely,
 * used internally when re-creating an account with a new email domain.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

// Bound only to the global-location lookup function below. It is never sent to
// the browser or stored in quote data.
const geoapifyKey = defineSecret("GEOAPIFY_KEY");

// ─────────────────────────────────────────────────────────────────────────────
// searchGlobalLocation
//
// Authenticated, server-side lookup for worldwide postcode/city suggestions.
// Indian PIN codes remain a local browser directory and do not call this API.
// ─────────────────────────────────────────────────────────────────────────────
exports.searchGlobalLocation = functions
  .runWith({ secrets: [geoapifyKey] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
    }

    const query = typeof data?.query === "string" ? data.query.trim() : "";
    if (query.length < 3 || query.length > 120) {
      throw new functions.https.HttpsError("invalid-argument", "Enter 3 to 120 characters.");
    }

    const apiKey = geoapifyKey.value();
    if (!apiKey) {
      throw new functions.https.HttpsError("failed-precondition", "Global lookup is unavailable.");
    }

    try {
      const endpoint = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
      endpoint.searchParams.set("text", query);
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("limit", "8");
      endpoint.searchParams.set("apiKey", apiKey);

      const response = await fetch(endpoint);
      if (!response.ok) {
        functions.logger.warn("Geoapify location lookup failed", { status: response.status });
        throw new Error("Location provider unavailable");
      }

      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];
      return {
        results: results.slice(0, 8).map((item) => {
          const city = item.city || item.town || item.village || item.county || item.state || "";
          const country = item.country || "";
          return {
            label: item.formatted || [item.postcode, city, country].filter(Boolean).join(", "),
            postcode: item.postcode || "",
            city,
            country,
          };
        }).filter((item) => item.label),
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      functions.logger.warn("Global location lookup unavailable", { message: error.message });
      throw new functions.https.HttpsError(
        "unavailable",
        "Global suggestions are temporarily unavailable. You can enter the address manually."
      );
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: resolve a username to its Firebase Auth UID
// Tries @atlaspricing.com first, then @pricing.local (migration compat.)
// ─────────────────────────────────────────────────────────────────────────────
async function resolveUid(username) {
  const emails = [
    `${username}@atlaspricing.com`,
    `${username}@pricing.local`,
  ];
  for (const email of emails) {
    try {
      const record = await admin.auth().getUserByEmail(email);
      return { uid: record.uid, email: record.email };
    } catch (e) {
      // not found under this domain, try next
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// adminResetPassword
//
// Callable by the client via:
//   firebase.functions().httpsCallable("adminResetPassword")({ username, newPassword })
//
// Security:
//   • Caller must be authenticated (Firebase Auth session required)
//   • Caller's UID must belong to the "ganny" account (admin-only)
//
// Behaviour:
//   1. Verify caller is admin
//   2. Find target user's Firebase Auth record (either @atlaspricing.com or @pricing.local)
//   3. Update their password using Admin SDK
//   4. If account was under @pricing.local, migrate email to @atlaspricing.com
//   5. If no Firebase Auth account exists yet, create one under @atlaspricing.com
// ─────────────────────────────────────────────────────────────────────────────
exports.adminResetPassword = functions.https.onCall(async (data, context) => {
  // 1. Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in to reset passwords."
    );
  }

  // 2. Require admin (caller must be ganny)
  const callerEmail = context.auth.token.email || "";
  const callerUsername = callerEmail.split("@")[0].toLowerCase();
  if (callerUsername !== "ganny") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only the admin account can reset passwords."
    );
  }

  // 3. Validate inputs
  const { username, newPassword } = data;
  if (!username || typeof username !== "string" || username.trim() === "") {
    throw new functions.https.HttpsError("invalid-argument", "Username is required.");
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Password must be at least 6 characters."
    );
  }

  const targetUsername = username.trim().toLowerCase();
  const canonicalEmail = `${targetUsername}@atlaspricing.com`;

  try {
    // 4. Try to find the existing Firebase Auth account
    const existing = await resolveUid(targetUsername);

    if (existing) {
      // Update password
      await admin.auth().updateUser(existing.uid, { password: newPassword });

      // If they were on the old @pricing.local domain, migrate email too
      if (existing.email !== canonicalEmail) {
        try {
          await admin.auth().updateUser(existing.uid, { email: canonicalEmail });
          functions.logger.info(
            `Migrated ${existing.email} → ${canonicalEmail} for uid ${existing.uid}`
          );
        } catch (migErr) {
          // Non-fatal — password is already updated
          functions.logger.warn("Email migration skipped:", migErr.message);
        }
      }

      functions.logger.info(`Password reset successful for user: ${targetUsername}`);
      return {
        success: true,
        message: `Password for "${targetUsername}" has been reset successfully in Firebase Authentication.`,
      };
    } else {
      // No Firebase Auth account exists yet — create one
      await admin.auth().createUser({
        email: canonicalEmail,
        password: newPassword,
        displayName: targetUsername,
      });
      functions.logger.info(`Created new Firebase Auth account for: ${targetUsername}`);
      return {
        success: true,
        message: `Firebase Auth account created and password set for "${targetUsername}".`,
      };
    }
  } catch (err) {
    functions.logger.error("adminResetPassword error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// adminCreateUser
//
// Called during new user registration to create a Firebase Auth account
// without signing out the currently logged-in admin.
// The secondary-app approach on the client is fragile; this is more reliable.
//
// Callable: firebase.functions().httpsCallable("adminCreateUser")({ username, password })
// ─────────────────────────────────────────────────────────────────────────────
exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  // 1. Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }

  // 2. Require admin
  const callerEmail = context.auth.token.email || "";
  const callerUsername = callerEmail.split("@")[0].toLowerCase();
  if (callerUsername !== "ganny") {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }

  const { username, password, fullName } = data;
  if (!username || !password || password.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid username or password.");
  }

  const targetUsername = username.trim().toLowerCase();
  const email = `${targetUsername}@atlaspricing.com`;

  try {
    // Check if already exists
    const existing = await resolveUid(targetUsername);
    if (existing) {
      throw new functions.https.HttpsError(
        "already-exists",
        `A Firebase Auth account already exists for "${targetUsername}".`
      );
    }

    await admin.auth().createUser({
      email,
      password,
      displayName: fullName || targetUsername,
    });

    functions.logger.info(`Created Firebase Auth account: ${email}`);
    return { success: true, message: `Account created for "${targetUsername}".` };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    functions.logger.error("adminCreateUser error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Agency List — new agents (customer/agent company names) quoted or
// confirmed (WON) in the last 7 days, auto-compiled across Air/Sea/Transport/
// Warehouse and emailed every Thursday to the PAN-India branch office
// distribution list managed in-app under app_settings/agencyListRecipients.
// Read-only against "quotes" — never writes to a quote or touches pricing.
// ─────────────────────────────────────────────────────────────────────────────
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const AGENCY_LIST_NOISE_WORDS = new Set([
  "pvt", "ltd", "limited", "private", "inc", "llc", "llp", "logistics",
  "freight", "forwarding", "forwarders", "shipping", "cargo", "co", "company",
  "group", "india", "pte", "corp", "corporation", "services", "the", "and",
]);

function normalizeAgencyName(name) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

// Aggressively stripped form used only for similarity SCORING — the noise
// words are common enough that "ABC Logistics" and "ABC Logistics Pvt Ltd"
// should score as near-identical, but the un-stripped form is still what
// gets shown to a human or handed to the AI as the real company name.
function normalizeAgencyNameForScoring(name) {
  return normalizeAgencyName(name)
    .split(" ")
    .filter((w) => w && !AGENCY_LIST_NOISE_WORDS.has(w))
    .join(" ");
}

// Levenshtein-based similarity ratio in [0, 1] — 1 means identical strings.
function stringSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

const AGENCY_LIST_HIGH_THRESHOLD = 0.82; // score >= this -> confidently the same company
const AGENCY_LIST_LOW_THRESHOLD = 0.55; // score <= this -> confidently a different company
const AGENCY_LIST_MAX_AMBIGUOUS = 25; // safety cap on names sent to the AI per run

// Stage 1 of the dedup: free, instant, deterministic. Scores every
// candidate-new name against every previously-seen name (noise-word-
// stripped form) and buckets it as confidently new, confidently a
// duplicate, or genuinely ambiguous — only the ambiguous band costs an AI
// call. `candidateNorms`/`priorNorms` are lightly-normalized forms (case/
// punctuation only, corporate suffixes intact) from normalizeAgencyName().
function algorithmicDedupPrefilter(candidateNorms, priorNorms) {
  const priorScored = priorNorms.map((norm) => ({ norm, scoreForm: normalizeAgencyNameForScoring(norm) }));

  const confirmedNew = [];
  const confirmedDup = [];
  const ambiguous = [];

  candidateNorms.forEach((candidateNorm) => {
    const candidateScoreForm = normalizeAgencyNameForScoring(candidateNorm);
    let bestScore = 0;
    let bestMatchNorm = null;
    priorScored.forEach(({ norm, scoreForm }) => {
      const score = stringSimilarity(candidateScoreForm, scoreForm);
      if (score > bestScore) {
        bestScore = score;
        bestMatchNorm = norm;
      }
    });

    if (bestMatchNorm && bestScore >= AGENCY_LIST_HIGH_THRESHOLD) {
      confirmedDup.push(candidateNorm);
    } else if (!bestMatchNorm || bestScore <= AGENCY_LIST_LOW_THRESHOLD) {
      confirmedNew.push(candidateNorm);
    } else {
      ambiguous.push({ candidateNorm, matchNorm: bestMatchNorm, score: bestScore });
    }
  });

  return { confirmedNew, confirmedDup, ambiguous };
}

// Stage 2 of the dedup: only the genuinely ambiguous pairs, with their real
// (non-normalized) names, go to a single batched Claude call for a same-
// company judgment. Fails open on any error, timeout, cap-overflow, or
// malformed response — every affected pair is treated as "new" rather than
// silently dropped, since a false positive (one extra row to eyeball) is
// far cheaper than a false negative (a real new agent never reported).
async function resolveAmbiguousWithAI(pairs, apiKey) {
  if (!pairs.length) return [];

  const capped = pairs.slice(0, AGENCY_LIST_MAX_AMBIGUOUS);
  const overflow = pairs.length - capped.length;
  if (overflow > 0) {
    functions.logger.warn(
      `weeklyAgencyListEmail: ${overflow} ambiguous name(s) exceeded the AI batch cap and were treated as new.`
    );
  }

  const failOpen = () => capped.map((p) => ({ candidateNorm: p.candidateNorm, isSameCompany: false }));
  if (!apiKey) return failOpen();

  try {
    const prompt =
      "You are checking a freight-forwarding company's list of client/agent names for near-duplicates. " +
      'For each numbered pair below, decide whether "candidate" is the SAME real-world company as ' +
      '"existing" (e.g. a name variant, abbreviation, or an added/removed legal suffix), or a GENUINELY ' +
      "DIFFERENT company that merely shares similar words. Respond with ONLY a JSON array, one object per " +
      'pair in the same order, each shaped exactly as {"sameCompany": true|false}. No prose, no markdown, ' +
      "just the JSON array.\n\n" +
      capped.map((p, i) => `${i + 1}. candidate: "${p.candidateOriginal}" | existing: "${p.matchOriginal}"`).join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      functions.logger.warn("resolveAmbiguousWithAI: API request failed", { status: response.status });
      return failOpen();
    }

    const payload = await response.json();
    const text = payload?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return failOpen();

    const verdicts = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(verdicts) || verdicts.length !== capped.length) return failOpen();

    return capped.map((p, i) => ({
      candidateNorm: p.candidateNorm,
      isSameCompany: verdicts[i]?.sameCompany === true,
    }));
  } catch (err) {
    functions.logger.warn("resolveAmbiguousWithAI: falling back to fail-open", { message: err.message });
    return failOpen();
  }
}

// Reads the entire "quotes" collection — small enough today that the client
// itself does the same unfiltered load via a real-time listener — and
// returns the new-agent report for the last 7 days. Read-only.
async function buildAgencyListReport(apiKey) {
  const snap = await admin.firestore().collection("quotes").get();

  const now = Date.now();
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;

  const priorNormSet = new Set();
  const originalNameByNorm = new Map(); // first-seen original casing, any bucket
  const thisWeek = [];
  const thisWeekNormSet = new Set();

  snap.forEach((doc) => {
    const q = doc.data();
    const norm = normalizeAgencyName(q.customer);
    if (!norm) return;
    if (!originalNameByNorm.has(norm)) originalNameByNorm.set(norm, (q.customer || "").trim());

    // No timestamp at all (legacy pre-migration doc) — treat as known/prior,
    // never as new, so it can never produce a false "new agent" positive.
    if (!q.timestamp || q.timestamp < cutoff) {
      priorNormSet.add(norm);
      return;
    }

    // lost/cancelled isn't a meaningful "this agent is active" signal
    if (q.status === "lost" || q.status === "cancelled") return;

    thisWeek.push({
      customer: (q.customer || "").trim(),
      normCustomer: norm,
      type: q.type || "unknown",
      status: q.status,
      creator: q.creator || "",
      conversionDate: q.conversionDate || "",
      date: q.date || "",
    });
    thisWeekNormSet.add(norm);
  });

  const candidateNewNorms = [...thisWeekNormSet].filter((n) => !priorNormSet.has(n));
  const { confirmedNew, ambiguous } = algorithmicDedupPrefilter(candidateNewNorms, [...priorNormSet]);

  let aiResolved = [];
  if (ambiguous.length > 0) {
    const pairsWithNames = ambiguous.map((a) => ({
      candidateNorm: a.candidateNorm,
      candidateOriginal: originalNameByNorm.get(a.candidateNorm) || a.candidateNorm,
      matchOriginal: originalNameByNorm.get(a.matchNorm) || a.matchNorm,
    }));
    aiResolved = await resolveAmbiguousWithAI(pairsWithNames, apiKey);
  }

  const finalNewNorms = new Set([
    ...confirmedNew,
    ...aiResolved.filter((r) => !r.isSameCompany).map((r) => r.candidateNorm),
  ]);

  const newAgentRows = thisWeek.filter((r) => finalNewNorms.has(r.normCustomer));

  return {
    quotedRows: newAgentRows.filter((r) => r.status === "quoted"),
    wonRows: newAgentRows.filter((r) => r.status === "converted"),
    stats: {
      candidateCount: candidateNewNorms.length,
      ambiguousCount: ambiguous.length,
      aiCallMade: ambiguous.length > 0,
    },
  };
}

// Mirrors the app's own TEAM_ROLES display-name resolution (app-v4.js:
// `TEAM_ROLES[creator.toLowerCase()]?.name || creator`). Cloud Functions
// have no access to the client's live TEAM_ROLES object (which also merges
// in dynamically-added custom users at runtime), so this only covers the
// small fixed set of desk-role usernames; anyone else just shows their raw
// username, same as the client's own fallback when a name isn't found.
function resolveAgencyListCreatorName(creator) {
  const KNOWN = {
    ganny: "Pricing Team",
    shashank: "Air Nom",
    shaheer: "Sea Nomination",
    jaya: "Free Hand",
    cathrina: "NRS",
  };
  const key = (creator || "").toLowerCase();
  return KNOWN[key] || creator || "Unknown";
}

function agencyListEscapeHtml(str) {
  return (str || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAgencyListTable(rows, dateField) {
  if (!rows.length) {
    return '<p style="color:#64748b;font-size:13px;">None this week.</p>';
  }
  const body = rows.map((r) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${agencyListEscapeHtml(r.customer)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;">${agencyListEscapeHtml(r.type)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${agencyListEscapeHtml(resolveAgencyListCreatorName(r.creator))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${agencyListEscapeHtml(r[dateField] || "")}</td>
      </tr>`).join("");
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Arial,sans-serif;">
      <thead>
        <tr style="background:#eef0fa;">
          <th style="padding:6px 10px;text-align:left;color:#1b1c5c;">Agent / Customer</th>
          <th style="padding:6px 10px;text-align:left;color:#1b1c5c;">Module</th>
          <th style="padding:6px 10px;text-align:left;color:#1b1c5c;">Quoted / Won By</th>
          <th style="padding:6px 10px;text-align:left;color:#1b1c5c;">Date</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function buildAgencyListHtml(report) {
  return `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:640px;">
      <h2 style="color:#1b1c5c;font-size:18px;margin-bottom:4px;">Weekly Agency List — New Agents</h2>
      <p style="color:#64748b;font-size:12px;margin-top:0;">Auto-compiled for the week ending ${new Date().toISOString().slice(0, 10)}. New-agent detection is AI-assisted.</p>

      <h3 style="color:#1b1c5c;font-size:14px;margin-bottom:6px;">Confirmed / WON this week</h3>
      ${buildAgencyListTable(report.wonRows, "conversionDate")}

      <h3 style="color:#1b1c5c;font-size:14px;margin:16px 0 6px;">Quoted this week</h3>
      ${buildAgencyListTable(report.quotedRows, "date")}

      <p style="color:#94a3b8;font-size:11px;margin-top:20px;">
        ${report.stats.candidateCount} candidate name(s) checked, ${report.stats.ambiguousCount} required AI judgment.
        This is an automated report — reply to your usual pricing desk contact with any corrections.
      </p>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// weeklyAgencyListEmail
//
// Scheduled every Thursday 9:00 AM IST. Reads the recipient list from
// app_settings/agencyListRecipients (managed in-app by AIR NOM/SEA NOM/admin
// roles), builds the report, and writes one doc to the "mail" collection for
// the Trigger Email extension to actually send. Skips silently (logging why)
// if there are zero recipients configured or zero new agents this week.
// ─────────────────────────────────────────────────────────────────────────────
exports.weeklyAgencyListEmail = functions
  .runWith({ secrets: [anthropicApiKey] })
  .pubsub.schedule("0 9 * * 4")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const recipDoc = await admin.firestore().doc("app_settings/agencyListRecipients").get();
    const emails = recipDoc.exists ? recipDoc.data().emails || [] : [];
    if (!emails.length) {
      functions.logger.warn("weeklyAgencyListEmail: no recipients configured, skipping send.");
      return null;
    }

    const report = await buildAgencyListReport(anthropicApiKey.value());
    if (!report.quotedRows.length && !report.wonRows.length) {
      functions.logger.info("weeklyAgencyListEmail: no new agents this week, skipping send.");
      return null;
    }

    await admin.firestore().collection("mail").add({
      to: emails,
      message: {
        subject: `Weekly Agency List — New Agents (${new Date().toISOString().slice(0, 10)})`,
        html: buildAgencyListHtml(report),
      },
    });

    functions.logger.info("weeklyAgencyListEmail: sent", {
      recipientCount: emails.length,
      quotedCount: report.quotedRows.length,
      wonCount: report.wonRows.length,
      ...report.stats,
    });
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// triggerAgencyListNow
//
// Admin-only manual trigger for testing (same admin check as
// adminResetPassword). { dryRun: true }, the default, returns the generated
// report HTML/stats with ZERO side effects — powers the in-app "Preview
// This Week's Report" button. { dryRun: false } does a real send to
// whatever recipient list is currently configured, for a one-off test
// send before the first live Thursday run is trusted.
// ─────────────────────────────────────────────────────────────────────────────
exports.triggerAgencyListNow = functions
  .runWith({ secrets: [anthropicApiKey] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
    }
    const callerUsername = (context.auth.token.email || "").split("@")[0].toLowerCase();
    if (callerUsername !== "ganny") {
      throw new functions.https.HttpsError("permission-denied", "Admin only.");
    }

    const dryRun = data?.dryRun !== false;
    const report = await buildAgencyListReport(anthropicApiKey.value());
    const html = buildAgencyListHtml(report);

    if (dryRun) {
      return {
        dryRun: true,
        html,
        quotedCount: report.quotedRows.length,
        wonCount: report.wonRows.length,
        stats: report.stats,
      };
    }

    const recipDoc = await admin.firestore().doc("app_settings/agencyListRecipients").get();
    const emails = recipDoc.exists ? recipDoc.data().emails || [] : [];
    if (!emails.length) {
      throw new functions.https.HttpsError("failed-precondition", "No recipients configured.");
    }

    await admin.firestore().collection("mail").add({
      to: emails,
      message: { subject: "[TEST] Weekly Agency List — New Agents", html },
    });

    return {
      dryRun: false,
      sent: true,
      recipientCount: emails.length,
      quotedCount: report.quotedRows.length,
      wonCount: report.wonRows.length,
      stats: report.stats,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// atlasCopilot
//
// In-app AI assistant for navigation help, quote summaries, and email drafts.
// NEVER calculates rates or writes quote data — assistive responses only.
// Uses the same ANTHROPIC_API_KEY secret as the agency-list dedup pipeline.
// ─────────────────────────────────────────────────────────────────────────────
exports.atlasCopilot = functions
  .runWith({ secrets: [anthropicApiKey] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
    }

    const message = typeof data?.message === "string" ? data.message.trim() : "";
    if (!message || message.length > 4000) {
      throw new functions.https.HttpsError("invalid-argument", "Message must be 1–4000 characters.");
    }

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Atlas Copilot is not configured yet. Ask your admin to set ANTHROPIC_API_KEY."
      );
    }

    const workspace = typeof data?.workspace === "string" ? data.workspace.slice(0, 80) : "Dashboard";
    const role = typeof data?.role === "string" ? data.role.slice(0, 40) : "user";
    const quoteContext = data?.quoteContext && typeof data.quoteContext === "object"
      ? JSON.stringify(data.quoteContext).slice(0, 6000)
      : null;

    const systemPrompt =
      "You are Atlas Copilot inside Atlas Pricing — a freight-forwarding operational pricing workspace " +
      "(Air, Sea, Transportation, Warehousing desks; enquiry database; agent directory; circulars).\n\n" +
      "STRICT RULES — never break these:\n" +
      "1. NEVER calculate, estimate, or invent freight rates, chargeable weights, GP, surcharges, or currency amounts.\n" +
      "2. NEVER output data that should be saved as a quote. You assist; the desk calculators compute.\n" +
      "3. If asked for pricing, direct the user to the correct desk and explain which fields to complete.\n" +
      "4. You may: explain workflows, summarize read-only quote metadata supplied by the client, " +
      "draft follow-up emails, suggest navigation, and clarify freight terminology.\n" +
      "5. Be concise, professional, and operational — this is a live business tool.\n\n" +
      `Current user role: ${role}. Active workspace: ${workspace}.`;

    let userContent = message;
    if (quoteContext) {
      userContent += "\n\n--- READ-ONLY QUOTE CONTEXT (do not modify; summarize or explain only) ---\n" + quoteContext;
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!response.ok) {
        functions.logger.warn("atlasCopilot: API request failed", { status: response.status });
        throw new functions.https.HttpsError("unavailable", "Atlas Copilot is temporarily unavailable.");
      }

      const payload = await response.json();
      const reply = (payload?.content?.[0]?.text || "").trim();
      if (!reply) {
        throw new functions.https.HttpsError("internal", "Empty response from AI.");
      }

      return { reply };
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.warn("atlasCopilot error", { message: err.message });
      throw new functions.https.HttpsError("unavailable", "Atlas Copilot is temporarily unavailable.");
    }
  });

const inboxPoll = require("./inbox-poll");
exports.pollPricingInboxes = inboxPoll.pollPricingInboxes;
