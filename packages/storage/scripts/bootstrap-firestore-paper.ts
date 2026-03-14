/**
 * Инициализация Firestore под paper-engine.
 * Запуск: pnpm --filter @pkg/storage run firestore:bootstrap
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const instanceId = process.env["ENGINE_INSTANCE_ID"] ?? "default";

if (!process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS=/path/to-sa.json");
  process.exit(1);
}

if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main(): Promise<void> {
  const past = Timestamp.fromMillis(0);
  await db
    .collection("engineState")
    .doc(instanceId)
    .set(
      {
        instanceId,
        emergencyHalt: false,
        leaderLeaseUntil: past,
        lastBarCloseTime: {},
        updatedAt: FieldValue.serverTimestamp(),
      } as Record<string, unknown>,
      { merge: true }
    );
  console.log(`engineState/${instanceId} OK`);

  await db.collection("logs").add({
    level: "info",
    service: "bootstrap",
    message: "firestore_paper_bootstrap",
    contextJson: JSON.stringify({ instanceId }),
    time: FieldValue.serverTimestamp(),
  });
  console.log("logs bootstrap OK");
  console.log("Индексы: firebase deploy --only firestore:indexes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
