"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
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

export function getFirebaseDb(): Firestore {
  if (!db) {
    const id = resolvedDatabaseId();
    db =
      id && id !== "(default)"
        ? getFirestore(getFirebaseApp(), id)
        : getFirestore(getFirebaseApp());
  }
  return db;
}
