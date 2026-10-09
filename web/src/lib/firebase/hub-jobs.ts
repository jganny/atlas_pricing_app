"use client";

import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ExtractionError } from "@/lib/ai/circular-extraction";
import type { HubDocument, HubJob, HubJobStatus } from "@/lib/hub/types";
import { getFirebaseApp, getFirebaseDb } from "./client";

const COLLECTION = "quoteHubJobs";

/** Firestore rejects `undefined`, so drop it before saving. */
const clean = <T extends object>(row: T): T => JSON.parse(JSON.stringify(row)) as T;

export function subscribeHubJobs(onData: (jobs: HubJob[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), COLLECTION),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as HubJob), id: d.id }))),
    (err) => onError?.(err),
  );
}

export async function saveHubJob(job: HubJob): Promise<void> {
  await setDoc(doc(getFirebaseDb(), COLLECTION, job.id), clean(job));
}

export async function setHubJobStatus(id: string, status: HubJobStatus): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), COLLECTION, id), { status });
}

export async function deleteHubJob(id: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), COLLECTION, id));
}

/** Sends one job's documents to be read. Returns the raw reading; the caller tidies it. */
export async function readDocuments(
  documents: HubDocument[],
  ctx: { ownDomains: string[]; headerSender?: { name: string; email: string } },
): Promise<unknown> {
  const call = httpsCallable<
    { documents: HubDocument[]; ownDomains: string[]; headerSender?: { name: string; email: string } },
    { extraction: unknown }
  >(getFunctions(getFirebaseApp(), "us-central1"), "extractShipmentFromDocuments");
  try {
    const res = await call({ documents, ownDomains: ctx.ownDomains, headerSender: ctx.headerSender });
    return res.data.extraction;
  } catch (e) {
    const code = String((e as { code?: string }).code || "");
    if (code.includes("unauthenticated")) throw new ExtractionError("Sign in to read documents.", "signin");
    if (code.includes("failed-precondition")) throw new ExtractionError("Reading documents isn't set up yet — ask an admin.", "not-configured");
    if (code.includes("unavailable") || code.includes("internal")) throw new ExtractionError("Reading documents is temporarily unavailable — try again shortly.", "unavailable");
    throw new ExtractionError(e instanceof Error ? e.message : "Something went wrong reading those documents.", "other");
  }
}
