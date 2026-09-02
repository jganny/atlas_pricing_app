"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { AuthUser, UserRole } from "@/lib/types";
import { getFirebaseAuth, getFirebaseDb } from "./client";

const CANONICAL_DOMAIN = "atlaspricing.com";
const LEGACY_DOMAIN = "pricing.local";

function normalizeUsername(username: string): string {
  const user = username.toLowerCase().trim();
  return user === "admin" ? "ganny" : user;
}

function usernameFromEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.split("@")[0]?.toLowerCase() ?? "";
}

function mapRole(role: string | undefined): UserRole {
  const r = (role ?? "pricing").toLowerCase();
  if (r === "ganny" || r === "admin") return "ganny";
  if (r === "manager") return "manager";
  if (r === "sales") return "sales";
  return "pricing";
}

async function fetchUserProfile(username: string, email: string, uid: string): Promise<AuthUser> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "users", username));
  const data = snap.data();

  return {
    id: uid,
    username,
    email,
    displayName: (data?.fullName as string) || username,
    role: mapRole(data?.role as string | undefined),
  };
}

export async function firebaseLogin(username: string, password: string): Promise<AuthUser> {
  const auth = getFirebaseAuth();
  const normalized = normalizeUsername(username);
  const canonicalEmail = `${normalized}@${CANONICAL_DOMAIN}`;
  const legacyEmail = `${normalized}@${LEGACY_DOMAIN}`;

  let user: User;
  try {
    ({ user } = await signInWithEmailAndPassword(auth, canonicalEmail, password));
  } catch (primaryErr) {
    const code = (primaryErr as { code?: string }).code;
    if (
      code === "auth/user-not-found" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-email"
    ) {
      ({ user } = await signInWithEmailAndPassword(auth, legacyEmail, password));
    } else {
      throw new Error("Invalid username or password.");
    }
  }

  const usernameFromAuth = usernameFromEmail(user.email) || normalized;
  return fetchUserProfile(usernameFromAuth, user.email ?? canonicalEmail, user.uid);
}

export async function firebaseLogout(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function subscribeToAuthChanges(
  onUser: (user: AuthUser | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onAuthStateChanged(
    getFirebaseAuth(),
    async (firebaseUser) => {
      if (!firebaseUser) {
        onUser(null);
        return;
      }
      try {
        const username = usernameFromEmail(firebaseUser.email);
        if (!username) {
          onUser(null);
          return;
        }
        const profile = await fetchUserProfile(
          username,
          firebaseUser.email ?? `${username}@${CANONICAL_DOMAIN}`,
          firebaseUser.uid,
        );
        onUser(profile);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error("Failed to load profile"));
        onUser(null);
      }
    },
    (err) => onError?.(err),
  );
}
