"use client";

import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import type { DeskSeatId, SeatOccupant } from "@/lib/auth/desk-seats";
import { getFirebaseDb } from "./client";

/**
 * Shared "who sits in each desk seat" list. Saved quotes only ever store the
 * login id, so changing a name here never touches quote data.
 */
export function subscribeDeskSeats(
  onData: (rows: SeatOccupant[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), "deskSeats"),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>;
          return {
            seatId: (String(x.seatId || d.id) as DeskSeatId),
            loginId: String(x.loginId ?? ""),
            personName: String(x.personName ?? ""),
          };
        }).filter((o) => o.loginId),
      ),
    (err) => onError?.(err),
  );
}

export async function saveDeskSeat(occ: SeatOccupant, updatedBy: string): Promise<void> {
  await setDoc(doc(getFirebaseDb(), "deskSeats", occ.seatId), {
    seatId: occ.seatId,
    loginId: occ.loginId.toLowerCase(),
    personName: occ.personName,
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDeskSeat(seatId: DeskSeatId): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), "deskSeats", seatId));
}
