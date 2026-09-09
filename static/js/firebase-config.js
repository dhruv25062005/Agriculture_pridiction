/* Firebase browser configuration */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let app = null;
let auth = null;
let db = null;

export const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write"
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path: path || null,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email
      })) || []
    }
  };
  console.warn("Firestore Notice: ", JSON.stringify(errInfo));
  return errInfo;
}

export async function testConnection() {
  if (!db) return;
  try {
    const probePromise = getDocFromServer(doc(db, "test", "connection"));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Probe timeout")), 4000)
    );
    await Promise.race([probePromise, timeoutPromise]);
    console.log("✅ Firestore connection validated");
  } catch (error) {
    console.log("ℹ️ Firestore connection probe did not return a readable test document.");
  }
}

async function initFirebase() {
  try {
    const response = await fetch("/firebase_config", { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`Firebase configuration endpoint returned HTTP ${response.status}`);
    }

    const cfg = await response.json();
    const required = ["apiKey", "authDomain", "projectId", "appId"];
    const missing = required.filter(key => !cfg?.[key]);
    if (missing.length) {
      throw new Error(`Firebase configuration is incomplete: ${missing.join(", ")}`);
    }

    app = initializeApp(cfg);
    auth = getAuth(app);

    const dbId = cfg.firestoreDatabaseId || "(default)";
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true
      }, dbId);
    } catch (fsInitErr) {
      db = getFirestore(app, dbId);
    }

    console.log("✅ Firebase Authentication & Cloud Firestore initialized");
    testConnection().catch(() => {});
    return { app, auth, db };
  } catch (err) {
    app = null;
    auth = null;
    db = null;
    console.error("❌ Firebase initialization failed:", err.message);
    return { app: null, auth: null, db: null, error: err };
  }
}

const firebaseReady = initFirebase();

export function getFirebaseAuth() {
  return auth;
}

export function getFirebaseDB() {
  return db;
}

export {
  app,
  auth,
  db,
  firebaseReady,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc
};
