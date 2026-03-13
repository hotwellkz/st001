import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { StrategyConfigDoc } from "../models.js";

export class StrategyConfigsRepository {
  constructor(private readonly db: Firestore) {}

  collection(userId: string) {
    return this.db.collection(COLLECTIONS.strategyConfigs).where("userId", "==", userId);
  }

  async listByUser(userId: string): Promise<Array<{ id: string; data: StrategyConfigDoc }>> {
    const q = await this.collection(userId).get();
    return q.docs.map((d) => ({ id: d.id, data: d.data() as StrategyConfigDoc }));
  }

  docRef(id: string) {
    return this.db.collection(COLLECTIONS.strategyConfigs).doc(id);
  }

  async save(id: string, data: StrategyConfigDoc): Promise<void> {
    await this.docRef(id).set(data);
  }
}
