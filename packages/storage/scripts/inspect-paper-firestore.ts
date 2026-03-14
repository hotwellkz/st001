/** Снимок коллекций paper-run. ENV: GOOGLE_APPLICATION_CREDENTIALS, ENGINE_INSTANCE_ID */
import { readFileSync } from "fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main(): Promise<void> {
  const path = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  const iid = process.env["ENGINE_INSTANCE_ID"] ?? "default";
  if (!path) throw new Error("GOOGLE_APPLICATION_CREDENTIALS");
  const k = JSON.parse(readFileSync(path, "utf8"));
  if (!getApps().length) initializeApp({ credential: cert(k) });
  const db = getFirestore();

  const es = await db.collection("engineState").doc(iid).get();
  console.log("=== engineState/" + iid + " ===");
  if (!es.exists) console.log("MISSING");
  else {
    const d = es.data()!;
    const lease = d["leaderLeaseUntil"] as { toMillis?: () => number } | undefined;
    console.log("leaderHolderId:", d["leaderHolderId"]);
    console.log("leaderLeaseUntil_ms:", lease?.toMillis?.() ?? d["leaderLeaseUntil"]);
    console.log("emergencyHalt:", d["emergencyHalt"]);
    console.log("lastBarCloseTime:", JSON.stringify(d["lastBarCloseTime"] ?? {}));
  }

  for (const col of ["logs", "positions", "orders", "fills", "idempotencyKeys"]) {
    const snap = await db.collection(col).limit(200).get();
    console.log("=== " + col + " (sample up to 200 docs) === count:", snap.size);
    if (col === "logs" && snap.size > 0) {
      const last = snap.docs[snap.size - 1];
      console.log("  last sample message:", (last.data() as { message?: string }).message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
