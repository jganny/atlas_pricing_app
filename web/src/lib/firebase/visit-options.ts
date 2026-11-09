"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, increment, setDoc, serverTimestamp } from "firebase/firestore";
import { useLiveData } from "@/lib/api";
import { getFirebaseDb } from "./client";
import { configFromQuestions, applyConfig, suggestionId, type VisitConfig, type VisitQuestion, type VisitQuestionId, type VisitSuggestion } from "@/lib/sales/visit-report";

/**
 * The visit report's option lists (edited by the admin) and the "something else" answers people typed.
 *   salesVisitConfig/options        { questions: VisitConfig, updatedAt, updatedBy }   read: any signed-in user, write: admin
 *   salesVisitSuggestions/{id}      { question, text, count, by[] }                    create/update: any signed-in user, read/delete: admin
 * Without the live database (demo) the changes live in memory for the session.
 */

let memoryConfig: VisitConfig | null = null;
let memorySuggestions: VisitSuggestion[] = [
  { id: "scope__customs-audit", question: "scope", text: "Customs audit", count: 4, by: ["priya", "arun"] },
  { id: "commodity__solar-panels", question: "commodity", text: "Solar panels", count: 3, by: ["priya"] },
  { id: "purpose__document-pickup", question: "purpose", text: "Document pickup", count: 2, by: ["kavya"] },
];

export async function fetchVisitConfig(): Promise<VisitConfig | null> {
  if (!useLiveData) return memoryConfig;
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "salesVisitConfig", "options"));
    const data = snap.exists() ? (snap.data() as { questions?: VisitConfig }) : null;
    return data?.questions ?? null;
  } catch {
    return null; // the defaults are always good enough to ask the questions
  }
}

export async function saveVisitConfig(questions: VisitQuestion[], by: string): Promise<void> {
  const config = configFromQuestions(questions);
  if (!useLiveData) {
    memoryConfig = config;
    return;
  }
  await setDoc(doc(getFirebaseDb(), "salesVisitConfig", "options"), { questions: config, updatedAt: serverTimestamp(), updatedBy: by });
}

export async function fetchVisitSuggestions(): Promise<VisitSuggestion[]> {
  if (!useLiveData) return [...memorySuggestions];
  const snap = await getDocs(collection(getFirebaseDb(), "salesVisitSuggestions"));
  return snap.docs
    .map((d) => {
      const v = d.data() as Partial<VisitSuggestion>;
      return { id: d.id, question: String(v.question ?? "") as VisitQuestionId, text: String(v.text ?? ""), count: Number(v.count ?? 1), by: (v as { lastBy?: string }).lastBy ? [String((v as { lastBy?: string }).lastBy)] : [] };
    })
    .filter((s) => s.text && s.question)
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

/** One person typed something under "something else": count it (same words, same question = one suggestion). */
export async function addVisitSuggestions(items: Array<{ question: VisitQuestionId; text: string }>, by: string): Promise<void> {
  const who = by.trim().toLowerCase();
  for (const it of items) {
    const id = suggestionId(it.question, it.text);
    if (!useLiveData) {
      const hit = memorySuggestions.find((s) => s.id === id);
      if (hit) {
        hit.count += 1;
        if (who && !hit.by.includes(who)) hit.by.push(who);
      } else memorySuggestions.push({ id, question: it.question, text: it.text.trim(), count: 1, by: who ? [who] : [] });
      continue;
    }
    // Only the count and the question's own words are written; the names of who typed it are for the admin to see.
    await setDoc(doc(getFirebaseDb(), "salesVisitSuggestions", id), { question: it.question, text: it.text.trim(), count: increment(1), lastBy: who, at: serverTimestamp() }, { merge: true });
  }
}

export async function removeVisitSuggestion(id: string): Promise<void> {
  if (!useLiveData) {
    memorySuggestions = memorySuggestions.filter((s) => s.id !== id);
    return;
  }
  await deleteDoc(doc(getFirebaseDb(), "salesVisitSuggestions", id));
}

export { applyConfig };
