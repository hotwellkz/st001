import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { AlertDoc, LogDoc } from "../models.js";

export class LogsRepository {
  constructor(private readonly db: Firestore) {}

  async append(log: Omit<LogDoc, "time">): Promise<void> {
    await this.db.collection(COLLECTIONS.logs).add({
      ...log,
      time: FieldValue.serverTimestamp(),
    });
  }
}

export class AlertsRepository {
  constructor(private readonly db: Firestore) {}

  async create(alert: Omit<AlertDoc, "createdAt">): Promise<string> {
    const ref = await this.db.collection(COLLECTIONS.alerts).add({
      ...alert,
      createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async markDelivered(id: string): Promise<void> {
    await this.db.collection(COLLECTIONS.alerts).doc(id).update({
      deliveredAt: FieldValue.serverTimestamp(),
    });
  }
}
