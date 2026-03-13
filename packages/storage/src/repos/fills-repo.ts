import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { FillDoc } from "../models.js";

export class FillsRepository {
  constructor(private readonly db: Firestore) {}

  /** doc id: userId_exchangeOrderId_tradeId */
  docId(userId: string, exchangeOrderId: number, tradeId: number): string {
    return `${userId}_${String(exchangeOrderId)}_${String(tradeId)}`;
  }

  docRef(id: string) {
    return this.db.collection(COLLECTIONS.fills).doc(id);
  }

  async upsertFill(id: string, data: FillDoc): Promise<void> {
    await this.docRef(id).set(data, { merge: true });
  }
}
