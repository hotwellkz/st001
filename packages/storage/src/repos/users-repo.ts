import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "../collections.js";
import type { UserDoc } from "../models.js";

export class UsersRepository {
  constructor(private readonly db: Firestore) {}

  docRef(uid: string) {
    return this.db.collection(COLLECTIONS.users).doc(uid);
  }

  async get(uid: string): Promise<UserDoc | null> {
    const snap = await this.docRef(uid).get();
    return snap.exists ? (snap.data() as UserDoc) : null;
  }

  async set(uid: string, data: Partial<UserDoc>, merge = true): Promise<void> {
    await this.docRef(uid).set(data as UserDoc, { merge });
  }
}
