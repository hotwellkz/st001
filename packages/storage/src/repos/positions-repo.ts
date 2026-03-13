import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { PositionDoc } from "../models.js";

export class PositionsRepository {
  constructor(private readonly db: Firestore) {}

  docRef(userId: string, symbol: string) {
    return this.db.collection(COLLECTIONS.positions).doc(`${userId}_${symbol}`);
  }

  async upsert(userId: string, symbol: string, data: Partial<PositionDoc>): Promise<void> {
    await this.docRef(userId, symbol).set(
      { ...data, updatedAt: FieldValue.serverTimestamp() } as Record<string, unknown>,
      { merge: true }
    );
  }

  /** Восстановление позиций после рестарта (paper, ненулевой qty). */
  async listOpenPaperPositions(userId: string): Promise<PositionDoc[]> {
    const snap = await this.db.collection(COLLECTIONS.positions).where("userId", "==", userId).get();
    const out: PositionDoc[] = [];
    for (const d of snap.docs) {
      const row = d.data() as PositionDoc;
      if (row.source !== "paper") continue;
      const q = Number(row.quantity);
      if (Number.isFinite(q) && q > 1e-12) out.push(row);
    }
    return out;
  }
}
