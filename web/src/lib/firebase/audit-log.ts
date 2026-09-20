"use client";

import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useLiveData } from "@/lib/api";
import { appVersion } from "@/lib/env";
import { useAuthStore } from "@/store/auth";
import { getFirebaseDb } from "./client";
import { clip, summarizeChanges, type AuditAction, type AuditEntity, type FieldChange } from "@/lib/audit/audit-entry";

export interface AuditInput {
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  /** Human label — company, quote ref, seat name… */
  entityLabel?: string;
  summary?: string;
  changes?: Record<string, FieldChange>;
}

export interface AuditRecord {
  id: string;
  atIso: string;
  actor: string;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes?: Record<string, FieldChange>;
  app: string;
  version: string;
}

/**
 * Append-only record of who did what. Fire-and-forget by design: a logging
 * problem must never block or fail the user's real action. firestore.rules
 * pins `actor` to the signed-in user and `at` to server time, and forbids
 * update/delete, so entries can't be forged, back-dated or edited.
 */
export function logAudit(input: AuditInput): void {
  try {
    const user = useAuthStore.getState().user;
    if (!useLiveData || !user?.username) return;
    const summary = clip(input.summary || (input.changes ? summarizeChanges(input.changes) : ""));
    void addDoc(collection(getFirebaseDb(), "auditLog"), {
      at: serverTimestamp(),
      atIso: new Date().toISOString(),
      actor: user.username.toLowerCase(),
      actorRole: String(user.role || ""),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: clip(input.entityLabel, 120),
      summary,
      ...(input.changes && Object.keys(input.changes).length ? { changes: input.changes } : {}),
      app: "test-app",
      version: appVersion,
    }).catch((e: unknown) => console.warn("audit log write failed:", e instanceof Error ? e.message : e));
  } catch (e) {
    console.warn("audit log skipped:", e instanceof Error ? e.message : e);
  }
}

export async function fetchAuditLog(max = 300): Promise<AuditRecord[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), "auditLog"), orderBy("atIso", "desc"), limit(max)));
  return snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      atIso: String(x.atIso ?? ""),
      actor: String(x.actor ?? ""),
      actorRole: String(x.actorRole ?? ""),
      action: x.action as AuditAction,
      entityType: x.entityType as AuditEntity,
      entityId: String(x.entityId ?? ""),
      entityLabel: String(x.entityLabel ?? ""),
      summary: String(x.summary ?? ""),
      changes: x.changes as Record<string, FieldChange> | undefined,
      app: String(x.app ?? ""),
      version: String(x.version ?? ""),
    };
  });
}
