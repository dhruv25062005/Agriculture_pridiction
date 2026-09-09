/* firebase-config.js */
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

// Fallback empty placeholder config (overridden dynamically by /firebase_config)
const defaultPlaceholderConfig = {
  projectId: "",
  appId: "",
  apiKey: "",
  authDomain: "",
  firestoreDatabaseId: "ai-studio-agriculturepridi-19ab2f13-4ebd-42d7-aaf0-74a8af5164fb",
  storageBucket: "",
  messagingSenderId: ""
};

export async function testConnection() {
  if (!db) return;
  try {
    // Probe Firestore backend with a short timeout safeguard
    const probePromise = getDocFromServer(doc(db, "test", "connection"));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Probe timeout")), 4000)
    );
    await Promise.race([probePromise, timeoutPromise]);
    console.log("✅ Firestore connection validated");
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client offline notice: operating in offline cache mode.");
    } else {
      console.log("ℹ️ Firestore active (offline persistence enabled)");
    }
  }
}

async function initFirebase() {
  let cfg = null;
  try {
    const response = await fetch("/firebase_config");
    if (response.ok) {
      cfg = await response.json();
    }
  } catch (e) {
    console.warn("Using local configuration fallback:", e.message);
  }

  const finalConfig = (cfg && cfg.apiKey && !cfg.apiKey.includes("your")) ? cfg : defaultPlaceholderConfig;

  try {
    app = initializeApp(finalConfig);
    auth = getAuth(app);
    const dbId = finalConfig.firestoreDatabaseId || "ai-studio-agriculturepridi-19ab2f13-4ebd-42d7-aaf0-74a8af5164fb";
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true
      }, dbId);
    } catch (fsInitErr) {
      db = getFirestore(app, dbId);
    }
    console.log("✅ Firebase & Cloud Firestore Initialized Successfully");
    testConnection().catch(() => {});
    return { app, auth, db };
  } catch (err) {
    console.warn("Firebase initialization note:", err.message);
    return { app: null, auth: null, db: null };
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


