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

admin.initializeApp();

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
