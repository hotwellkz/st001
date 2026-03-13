/**
 * Cloud Functions 2nd gen — только доверенные действия. Проверка admin claim.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

initializeApp();
const db = getFirestore();

const ENGINE_DOC = "engineState";
const INSTANCE_ID = "singleton";

async function requireAdmin(request: { auth?: { uid: string } | null }): Promise<string> {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const user = await getAuth().getUser(request.auth.uid);
  if (user.customClaims?.["admin"] !== true) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  return request.auth.uid;
}

async function audit(actorUid: string, action: string, detail: Record<string, unknown>): Promise<void> {
  await db.collection("auditLog").add({
    actorUid,
    action,
    detail,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export const adminSetKillSwitch = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const halt = request.data?.halt === true;
  await db
    .collection(ENGINE_DOC)
    .doc(INSTANCE_ID)
    .set(
      { emergencyHalt: halt, updatedAt: FieldValue.serverTimestamp(), instanceId: INSTANCE_ID },
      { merge: true }
    );
  await audit(uid, "setKillSwitch", { halt });
  return { ok: true, emergencyHalt: halt };
});

export const adminSetTradingMode = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const mode = request.data?.mode as string;
  if (mode !== "paper" && mode !== "live") {
    throw new HttpsError("invalid-argument", "mode must be paper|live");
  }
  if (mode === "live") {
    const ack = request.data?.ackLive === true;
    if (!ack) {
      throw new HttpsError(
        "failed-precondition",
        "Live requires ackLive:true and LIVE_TRADING_ENABLED on engine"
      );
    }
  }
  await db.collection("users").doc(uid).set(
    {
      tradingMode: mode,
      liveAcknowledgedAt: mode === "live" ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await audit(uid, "setTradingMode", { mode });
  return { ok: true, mode };
});

export const adminSaveStrategyConfig = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const name = String(request.data?.name ?? "default");
  const paramsJson = String(request.data?.paramsJson ?? "{}");
  const id = request.data?.id as string | undefined;
  const ref = id
    ? db.collection("strategyConfigs").doc(id)
    : db.collection("strategyConfigs").doc();
  await ref.set({
    userId: uid,
    name,
    timeframe: "4h",
    paramsJson,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await audit(uid, "saveStrategyConfig", { id: ref.id });
  return { ok: true, id: ref.id };
});

export const adminSaveUniverse = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const name = String(request.data?.name ?? "default");
  const symbols = request.data?.symbols as string[];
  if (!Array.isArray(symbols)) throw new HttpsError("invalid-argument", "symbols array required");
  await db.collection("symbolsUniverse").doc(name).set({
    name,
    symbols,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await audit(uid, "saveUniverse", { name, count: symbols.length });
  return { ok: true };
});

export const adminBootstrapFirstAdmin = onCall(async (request) => {
  const secret = process.env["BOOTSTRAP_ADMIN_SECRET"];
  if (!secret || request.data?.secret !== secret) {
    throw new HttpsError("permission-denied", "Invalid bootstrap");
  }
  const email = String(request.data?.email ?? "");
  if (!email) throw new HttpsError("invalid-argument", "email required");
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { admin: true });
  return { ok: true, uid: user.uid };
});
