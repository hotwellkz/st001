/**
 * Инициализация Firebase Admin (server-only). Credentials через GOOGLE_APPLICATION_CREDENTIALS или ADC.
 */

import { getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function getServerFirestore(): Firestore {
  let app: App;
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp({ credential: applicationDefault() });
  } else {
    const first = apps[0];
    if (!first) throw new Error("Firebase app missing");
    app = first;
  }
  return getFirestore(app);
}
