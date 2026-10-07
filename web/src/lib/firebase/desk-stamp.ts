import { doc, getDoc } from "firebase/firestore";
import { currentDeskSeatId, quoteDeskSeatId, type DeskSeatId } from "@/lib/auth/desk-seats";
import { getFirebaseDb } from "./client";

/**
 * Which desk a saved quote belongs to. A new quote takes the desk its creator
 * sits in right now. Re-saving an existing quote keeps the desk it already
 * had, so someone who has since moved to another desk can't pull an old
 * quote across with them. Non-desk logins (individual sales…) get no stamp
 * and stay with the person who made them.
 */
export async function deskSeatForSave(
  quoteId: string | undefined,
  creator: string,
): Promise<{ deskSeat?: DeskSeatId }> {
  if (quoteId) {
    try {
      const snap = await getDoc(doc(getFirebaseDb(), "quotes", quoteId));
      if (snap.exists()) {
        const d = snap.data() as { deskSeat?: string; creator?: string };
        const seat = quoteDeskSeatId({ deskSeat: d.deskSeat, creator: d.creator });
        return seat ? { deskSeat: seat } : {};
      }
    } catch {
      /* offline / unreadable — fall through to the creator's current desk */
    }
  }
  const seat = currentDeskSeatId(creator);
  return seat ? { deskSeat: seat } : {};
}
