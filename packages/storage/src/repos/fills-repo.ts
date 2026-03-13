import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { FillDoc } from "../models.js";

export class FillsRepository {
  constructor(private readonly db: Firestore) {}

  /** doc id: без '/' (Firestore); стабильный id для paper (exchangeOrderId+tradeId уникальны в рамках user). */
  docId(userId: string, exchangeOrderId: number, tradeId: number): string {
    const safeUser = userId.replace(/\//g, "_").slice(0, 80);
    return `${safeUser}_${String(exchangeOrderId)}_${String(tradeId)}`;
  }

  docRef(id: string) {
    return this.db.collection(COLLECTIONS.fills).doc(id);
  }

  async upsertFill(id: string, data: FillDoc): Promise<void> {
    await this.docRef(id).set(data, { merge: true });
  }

  /** Paper fill без Timestamp снаружи (engine). */
  async appendPaperFill(p: {
    userId: string;
    orderClientId: string;
    exchangeOrderId: number;
    symbol: string;
    tradeId: number;
    price: string;
    qty: string;
    quoteQty: string;
    isBuyer: boolean;
  }): Promise<void> {
    const id = this.docId(p.userId, p.exchangeOrderId, p.tradeId);
    const doc: FillDoc = {
      ...p,
      commission: "0",
      commissionAsset: "USDT",
      time: Timestamp.now(),
    };
    await this.upsertFill(id, doc);
  }

  /** Сумма BUY минус SELL по символу (paper reconciliation). */
  async netFilledQty(userId: string, symbol: string): Promise<number> {
    const snap = await this.db.collection(COLLECTIONS.fills).where("userId", "==", userId).get();
    let buy = 0;
    let sell = 0;
    for (const d of snap.docs) {
      const f = d.data() as FillDoc;
      if (f.symbol !== symbol) continue;
      const q = Number(f.qty);
      if (f.isBuyer) buy += q;
      else sell += q;
    }
    return buy - sell;
  }
}
