import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { SymbolsUniverseDoc } from "../models.js";

export class SymbolsUniverseRepository {
  constructor(private readonly db: Firestore) {}

  docRef(id: string) {
    return this.db.collection(COLLECTIONS.symbolsUniverse).doc(id);
  }

  async get(id: string): Promise<SymbolsUniverseDoc | null> {
    const s = await this.docRef(id).get();
    return s.exists ? (s.data() as SymbolsUniverseDoc) : null;
  }

  async set(id: string, data: SymbolsUniverseDoc): Promise<void> {
    await this.docRef(id).set(data);
  }
}
