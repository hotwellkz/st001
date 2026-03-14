/** Usage: ENGINE_INSTANCE_ID=... GOOGLE_APPLICATION_CREDENTIALS=... npx tsx set-engine-halt.ts true|false */
import { readFileSync } from "fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const halt = process.argv[2] === "true";
const path = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
const iid = process.env["ENGINE_INSTANCE_ID"] ?? "default";
if (!path) throw new Error("GOOGLE_APPLICATION_CREDENTIALS");
const k = JSON.parse(readFileSync(path, "utf8"));
if (!getApps().length) initializeApp({ credential: cert(k) });
const db = getFirestore();
await db.collection("engineState").doc(iid).set(
  { emergencyHalt: halt, updatedAt: FieldValue.serverTimestamp() },
  { merge: true }
);
console.log("emergencyHalt set to", halt, "for", iid);
