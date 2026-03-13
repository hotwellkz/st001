import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { IdempotencyKeyDoc } from "../models.js";

/**
 * Запись ключа идемпотентности: create только если не существует (transaction).
 */
export class IdempotencyRepository {
  constructor(private readonly db: Firestore) {}

  docRef(key: string) {
    return this.db.collection(COLLECTIONS.idempotencyKeys).doc(key);
  }

  /**
   * @returns true если ключ впервые зарезервирован
   */
  async tryReserve(key: string, metadata?: Record<string, string>): Promise<boolean> {
    const ref = this.docRef(key);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, {
        key,
        createdAt: FieldValue.serverTimestamp(),
        outcome: "reserved",
        metadata: metadata ?? {},
      } as IdempotencyKeyDoc);
      return true;
    });
  }

  async complete(key: string): Promise<void> {
    await this.docRef(key).set(
      { outcome: "completed", key, updatedAt: FieldValue.serverTimestamp() } as Record<string, unknown>,
      { merge: true }
    );
  }

  async fail(key: string): Promise<void> {
    await this.docRef(key).set(
      { outcome: "failed", key, updatedAt: FieldValue.serverTimestamp() } as Record<string, unknown>,
      { merge: true }
    );
  }
}
