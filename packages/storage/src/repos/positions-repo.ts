import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { PositionDoc } from "../models.js";

export class PositionsRepository {
  constructor(private readonly db: Firestore) {}

  docRef(userId: string, symbol: string) {
    return this.db.collection(COLLECTIONS.positions).doc(`${userId}_${symbol}`);
  }

  async upsert(userId: string, symbol: string, data: Partial<PositionDoc>): Promise<void> {
    await this.docRef(userId, symbol).set(data as PositionDoc, { merge: true });
  }
}
