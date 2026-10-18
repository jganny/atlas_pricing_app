"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  clearIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig, firebaseDatabaseId } from "@/lib/env";
import { loadRuntimeFirebaseConfig } from "@/lib/firebase/runtime-config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function resolvedFirebaseConfig() {
  if (typeof window !== "undefined") {
    const runtime = loadRuntimeFirebaseConfig();
    if (runtime) {
      return {
        apiKey: runtime.apiKey,
        authDomain: runtime.authDomain || firebaseConfig.authDomain,
        projectId: runtime.projectId,
        storageBucket: runtime.storageBucket || firebaseConfig.storageBucket,
        messagingSenderId: runtime.messagingSenderId || firebaseConfig.messagingSenderId,
        appId: runtime.appId || firebaseConfig.appId,
        measurementId: firebaseConfig.measurementId,
      };
    }
  }
  return firebaseConfig;
}

function resolvedDatabaseId() {
  if (typeof window !== "undefined") {
    const runtime = loadRuntimeFirebaseConfig();
    if (runtime?.databaseId) return runtime.databaseId;
  }
  return firebaseDatabaseId;
}

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(resolvedFirebaseConfig());
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

/**
 * Firestore with an on-device copy (IndexedDB) so the team chat — and anything else already
 * read — still opens offline, and messages written offline are sent when the connection returns.
 * If the browser can't do that (private window, old browser) it quietly falls back to online-only.
 */
export function getFirebaseDb(): Firestore {
  if (!db) {
    const id = resolvedDatabaseId();
    const database = id && id !== "(default)" ? id : undefined;
    try {
      db = initializeFirestore(
        getFirebaseApp(),
        { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
        database,
      );
    } catch {
      db = database ? getFirestore(getFirebaseApp(), database) : getFirestore(getFirebaseApp());
    }
  }
  return db;
}

/**
 * Removes the on-device copy of the database. Called when someone signs out so the next person
 * on a shared computer can't see what was cached. The page must be reloaded afterwards.
 */
export async function wipeLocalFirestoreCache(): Promise<void> {
  if (!db) return;
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    /* nothing cached, or the browser doesn't allow it — nothing to wipe */
  }
}
