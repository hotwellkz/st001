import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { OrderDoc } from "../models.js";

/**
 * Ордера индексируем по clientOrderId (doc id) для быстрой дедупликации и сверки.
 */
export class OrdersRepository {
  constructor(private readonly db: Firestore) {}

  docRef(clientOrderId: string) {
    return this.db.collection(COLLECTIONS.orders).doc(clientOrderId);
  }

  async upsert(clientOrderId: string, data: Partial<OrderDoc>): Promise<void> {
    await this.docRef(clientOrderId).set(
      { ...data, updatedAt: FieldValue.serverTimestamp() } as Record<string, unknown>,
      { merge: true }
    );
  }

  async get(clientOrderId: string): Promise<OrderDoc | null> {
    const s = await this.docRef(clientOrderId).get();
    return s.exists ? (s.data() as OrderDoc) : null;
  }
}
