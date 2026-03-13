import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { EngineStateDoc } from "../models.js";

export class EngineStateRepository {
  constructor(private readonly db: Firestore) {}

  docRef(instanceId: string) {
    return this.db.collection(COLLECTIONS.engineState).doc(instanceId);
  }

  /**
   * Захват лидера только если lease истёк. Записывает leaderHolderId.
   */
  async tryAcquireLeader(instanceId: string, holderId: string, leaseMs: number): Promise<boolean> {
    const ref = this.docRef(instanceId);
    const now = Date.now();
    const leaseUntil = Timestamp.fromMillis(now + leaseMs);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as EngineStateDoc | undefined;
      const existing = data?.leaderLeaseUntil != null ? data.leaderLeaseUntil.toMillis() : 0;
      if (existing > now) return false;
      tx.set(
        ref,
        {
          instanceId,
          leaderLeaseUntil: leaseUntil,
          leaderHolderId: holderId,
          updatedAt: FieldValue.serverTimestamp(),
        } as Record<string, unknown>,
        { merge: true }
      );
      return true;
    });
  }

  async get(instanceId: string): Promise<EngineStateDoc | null> {
    const s = await this.docRef(instanceId).get();
    return s.exists ? (s.data() as EngineStateDoc) : null;
  }

  /** Актуален ли lease и совпадает ли держатель. */
  async isStillLeader(instanceId: string, holderId: string): Promise<boolean> {
    const doc = await this.get(instanceId);
    if (!doc?.leaderLeaseUntil) return false;
    const now = Date.now();
    if (doc.leaderLeaseUntil.toMillis() <= now) return false;
    return doc.leaderHolderId === holderId;
  }

  async setLastBarCloseTime(instanceId: string, symbol: string, closeTime: number): Promise<void> {
    await this.docRef(instanceId).set(
      {
        [`lastBarCloseTime.${symbol}`]: closeTime,
        updatedAt: FieldValue.serverTimestamp(),
      } as Record<string, unknown>,
      { merge: true }
    );
  }

  async setEmergencyHalt(instanceId: string, halt: boolean): Promise<void> {
    await this.docRef(instanceId).set(
      { emergencyHalt: halt, updatedAt: FieldValue.serverTimestamp() } as Record<string, unknown>,
      { merge: true }
    );
  }

  /**
   * Продление только если мы всё ещё leaderHolderId (вторая реплика не перезапишет чужой lease).
   */
  async renewLeaderIfHolder(instanceId: string, holderId: string, leaseMs: number): Promise<boolean> {
    const ref = this.docRef(instanceId);
    const leaseUntil = Timestamp.fromMillis(Date.now() + leaseMs);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as EngineStateDoc | undefined;
      if (data?.leaderHolderId !== holderId) return false;
      tx.set(
        ref,
        {
          leaderLeaseUntil: leaseUntil,
          leaderHolderId: holderId,
          updatedAt: FieldValue.serverTimestamp(),
        } as Record<string, unknown>,
        { merge: true }
      );
      return true;
    });
  }
}
