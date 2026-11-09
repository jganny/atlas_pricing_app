"use client";

import { collection, getDocs, limit, query, where } from "firebase/firestore";
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
}

/** What the reader did with each circular (newest first). */
export async function fetchCarrierReads(): Promise<CarrierReadSummary[]> {
  if (!useLiveData) return [];
  const snap = await getDocs(query(collection(getFirebaseDb(), "carrierReads"), limit(200)));
  return snap.docs
    .map((x) => {
      const d = x.data();
      return {
        circularId: x.id,
        title: String(d.title ?? ""),
        carrier: String(d.carrier ?? ""),
        at: num(d.at) ?? 0,
        applied: num(d.applied) ?? 0,
        held: num(d.held) ?? 0,
        unchanged: num(d.unchanged) ?? 0,
        publishedToAirDesk: num(d.publishedToAirDesk) ?? 0,
      };
    })
    .sort((a, b) => b.at - a.at);
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
