import { readFileSync } from "fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main(): Promise<void> {
  const path = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  const id = process.env["ENGINE_INSTANCE_ID"] ?? "default";
  if (!path) throw new Error("GOOGLE_APPLICATION_CREDENTIALS");
  const k = JSON.parse(readFileSync(path, "utf8"));
  if (!getApps().length) initializeApp({ credential: cert(k) });
  const db = getFirestore();

  const d = await db.collection("engineState").doc(id).get();
  console.log("engineState/" + id + " exists:", d.exists);
  if (d.exists) {
    const x = d.data()!;
    console.log("leaderHolderId:", x["leaderHolderId"]);
    console.log("emergencyHalt:", x["emergencyHalt"]);
    console.log("lastBarCloseTime keys:", Object.keys(x["lastBarCloseTime"] ?? {}));
  }

  try {
    await db
      .collection("fills")
      .where("userId", "==", "system")
      .where("symbol", "==", "BTCUSDT")
      .limit(1)
      .get();
    console.log("fills index (userId+symbol): OK");
  } catch (e) {
    console.log("fills index: FAIL", String((e as Error).message));
  }

  const logs = await db.collection("logs").orderBy("time", "desc").limit(3).get();
  console.log("recent logs count:", logs.size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
