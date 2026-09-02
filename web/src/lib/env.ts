export const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE !== "false";

export const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-next";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "vertex-35d95.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "vertex-35d95",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "vertex-35d95.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "185189133669",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:185189133669:web:e24a34f1ef33061e60458c",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-BD2BQBRPZM",
};

export const firebaseDatabaseId =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID?.trim() || "(default)";

export const hasFirebaseConfig = Boolean(firebaseConfig.apiKey);
