"use client";

import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useLiveData } from "@/lib/api";
import { SAMPLE_TARIFFS } from "@/lib/carriers/board-sample";
import type { BoardTariff, BreakKey } from "@/lib/carriers/board";
import { getFirebaseApp, getFirebaseDb } from "./client";

const KEYS: BreakKey[] = ["min", "minus45", "plus45", "plus100", "plus300", "plus500", "plus1000"];

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function mapTariff(d: Record<string, unknown>): BoardTariff {
  const raw = (d.breaks ?? {}) as Record<string, unknown>;
  const breaks: BoardTariff["breaks"] = {};
  for (const k of KEYS) breaks[k] = num(raw[k]);
  return {
    carrierCode: String(d.carrierCode ?? "").toUpperCase(),
    origin: String(d.origin ?? "").toUpperCase(),
    destination: String(d.destination ?? "").toUpperCase(),
    currency: String(d.currency ?? "").toUpperCase(),
    validFrom: String(d.validFrom ?? ""),
    validTo: String(d.validTo ?? ""),
    rateKind: String(d.rateKind ?? "unknown"),
    breaks,
    notes: String(d.notes ?? ""),
    updatedAt: num(d.updatedAt) ?? 0,
    sourceFile: String(d.sourceFile ?? ""),
  };
}

/** Every airline's saved rate for one lane (any signed-in user can read these). */
export async function fetchLaneTariffs(origin: string, destination: string): Promise<BoardTariff[]> {
  const o = origin.trim().toUpperCase();
  const d = destination.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(o) || !/^[A-Z]{3}$/.test(d)) return [];
  if (!useLiveData) return SAMPLE_TARIFFS.filter((t) => t.origin === o && t.destination === d);
  const snap = await getDocs(query(collection(getFirebaseDb(), "carrierTariffs"), where("origin", "==", o), where("destination", "==", d), limit(100)));
  return snap.docs.map((x) => mapTariff(x.data()));
}

/** Every saved airline route (for browsing a whole tariff). Capped; a lane search is the way to reach one route quickly. */
export async function fetchAllTariffs(): Promise<BoardTariff[]> {
  if (!useLiveData) return SAMPLE_TARIFFS;
  const snap = await getDocs(query(collection(getFirebaseDb(), "carrierTariffs"), limit(4000)));
  return snap.docs.map((x) => mapTariff(x.data()));
}

export interface CarrierReadSummary {
  circularId: string;
  title: string;
  carrier: string;
  at: number;
  applied: number;
  held: number;
  unchanged: number;
  publishedToAirDesk: number;
  /** reading = in progress; read = done; skipped = not started (and why); failed = ran into a problem (and why). */
  status: "reading" | "read" | "skipped" | "failed";
  /** rates = an airline tariff read into the Carrier board; digest = a plain-words summary of any other circular. */
  kind: "rates" | "digest";
  reason: string;
  auto: boolean;
  uploadedBy: string;
  points: number;
  charges: number;
}

function mapRead(id: string, d: Record<string, unknown>): CarrierReadSummary {
  const st = d.status;
  return {
    circularId: id,
    title: String(d.title ?? ""),
    carrier: String(d.carrier ?? ""),
    at: num(d.at) ?? 0,
    applied: num(d.applied) ?? 0,
    held: num(d.held) ?? 0,
    unchanged: num(d.unchanged) ?? 0,
    publishedToAirDesk: num(d.publishedToAirDesk) ?? 0,
    status: st === "reading" || st === "skipped" || st === "failed" ? st : "read",
    kind: d.kind === "digest" ? "digest" : "rates",
    reason: String(d.reason ?? ""),
    auto: d.auto === true,
    uploadedBy: String(d.uploadedBy ?? ""),
    points: num(d.points) ?? 0,
    charges: num(d.charges) ?? 0,
  };
}

/** What the reader did with each circular (newest first). */
export async function fetchCarrierReads(): Promise<CarrierReadSummary[]> {
  if (!useLiveData) return [];
  const snap = await getDocs(query(collection(getFirebaseDb(), "carrierReads"), limit(200)));
  return snap.docs.map((x) => mapRead(x.id, x.data())).sort((a, b) => b.at - a.at);
}

/** Live: every circular's read status, so each row on the Circulars page shows it as it changes. Returns the unsubscribe. */
export function subscribeCarrierReads(onData: (reads: CarrierReadSummary[]) => void): () => void {
  if (!useLiveData) return () => undefined;
  return onSnapshot(
    query(collection(getFirebaseDb(), "carrierReads"), limit(300)),
    (snap) => onData(snap.docs.map((x) => mapRead(x.id, x.data()))),
    () => undefined,
  );
}

/**
 * Live: the reads of circulars THIS person uploaded. onChange is called for each change after the first load, so the person is told the
 * moment a read starts, finishes, waits or fails (and never re-told about old ones).
 */
export function subscribeMyCarrierReads(username: string, onChange: (read: CarrierReadSummary) => void): () => void {
  if (!useLiveData || !username) return () => undefined;
  let first = true;
  const known = new Map<string, string>();
  return onSnapshot(
    query(collection(getFirebaseDb(), "carrierReads"), where("uploadedBy", "==", username), limit(30)),
    (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === "removed") return;
        const r = mapRead(ch.doc.id, ch.doc.data());
        const key = `${r.status}:${r.at}`;
        const before = known.get(r.circularId);
        known.set(r.circularId, key);
        if (!first && before !== key) onChange(r);
      });
      first = false;
    },
    () => undefined,
  );
}

export interface CircularDigest {
  kind: string;
  company: string;
  effectiveFrom: string;
  validTo: string;
  appliesTo: string;
  summary: string[];
  charges: Array<{ name: string; amount: number | null; currency: string; unit: string; appliesTo: string; note: string }>;
  deadlines: string[];
}

/** The plain-words summary the reader wrote for one circular, or null. */
export async function fetchDigest(circularId: string): Promise<CircularDigest | null> {
  if (!useLiveData) return null;
  const snap = await getDoc(doc(getFirebaseDb(), "circularDigests", circularId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    kind: String(d.kind ?? "other"),
    company: String(d.company ?? ""),
    effectiveFrom: String(d.effectiveFrom ?? ""),
    validTo: String(d.validTo ?? ""),
    appliesTo: String(d.appliesTo ?? ""),
    summary: Array.isArray(d.summary) ? d.summary.map(String) : [],
    charges: Array.isArray(d.charges) ? (d.charges as CircularDigest["charges"]) : [],
    deadlines: Array.isArray(d.deadlines) ? d.deadlines.map(String) : [],
  };
}

export interface AutoReadSettings {
  enabled: boolean;
  monthlyCapUsd: number;
}

/** Auto-read on/off and the monthly limit. Before the admin saves anything it is on, with a $3 limit. */
export async function fetchAutoReadSettings(): Promise<AutoReadSettings> {
  const fallback = { enabled: true, monthlyCapUsd: 3 };
  if (!useLiveData) return fallback;
  const snap = await getDoc(doc(getFirebaseDb(), "carrierReadSettings", "auto"));
  if (!snap.exists()) return fallback;
  const d = snap.data();
  return { enabled: d.enabled !== false, monthlyCapUsd: num(d.monthlyCapUsd) ?? 3 };
}

/** Admin only (the server checks). */
export async function saveAutoReadSettings(input: AutoReadSettings): Promise<void> {
  await httpsCallable<AutoReadSettings, { ok: boolean }>(getFunctions(getFirebaseApp()), "carrierAutoReadSave")(input);
}

export interface OpenHold {
  circularId: string;
  carrier: string;
  title: string;
  rows: Array<{ route: string; reasons: string[] }>;
}

export async function fetchOpenHolds(): Promise<OpenHold[]> {
  if (!useLiveData) return [];
  const snap = await getDocs(query(collection(getFirebaseDb(), "carrierTariffHolds"), where("status", "==", "open"), limit(50)));
  return snap.docs.map((x) => {
    const d = x.data();
    return { circularId: x.id, carrier: String(d.carrier ?? ""), title: String(d.title ?? ""), rows: Array.isArray(d.rows) ? (d.rows as OpenHold["rows"]) : [] };
  });
}

export interface ReadResult {
  applied: number;
  held: number;
  unchanged: number;
  publishedToAirDesk?: number;
  dryRun: boolean;
  usage: { input: number; output: number };
  holdDetails: Array<{ route: string; reasons: string[] }>;
}

/** Admin only (the server checks): read one airline circular. dryRun reads and checks but saves nothing. */
export async function readCarrierCircular(circularId: string, dryRun: boolean): Promise<ReadResult> {
  const call = httpsCallable<{ circularId: string; dryRun: boolean }, ReadResult>(getFunctions(getFirebaseApp()), "readCarrierCircular", { timeout: 900_000 });
  return (await call({ circularId, dryRun })).data;
}
