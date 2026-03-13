import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
};

export const app = initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");

export const callSetKillSwitch = httpsCallable(functions, "adminSetKillSwitch");
export const callSetTradingMode = httpsCallable(functions, "adminSetTradingMode");
export const callSaveStrategy = httpsCallable(functions, "adminSaveStrategyConfig");
export const callSaveUniverse = httpsCallable(functions, "adminSaveUniverse");
