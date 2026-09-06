/* firebase-config.js */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
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

const staticConfig = {
  projectId: "agriculture-e0418",
  appId: "1:312855717764:web:de5fe4b5c7ed01cfc25fd1",
  apiKey: "AIzaSyBl-5RAER1M79gcDo9W-ylHlz2KNufsllU",
  authDomain: "agriculture-e0418.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-agriculturepridi-19ab2f13-4ebd-42d7-aaf0-74a8af5164fb",
  storageBucket: "agriculture-e0418.firebasestorage.app",
  messagingSenderId: "312855717764"
};

export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("✅ Firestore connection validated");
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client offline notice.");
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

  const finalConfig = (cfg && cfg.apiKey && !cfg.apiKey.includes("your")) ? cfg : staticConfig;

  try {
    app = initializeApp(finalConfig);
    auth = getAuth(app);
    db = getFirestore(app, finalConfig.firestoreDatabaseId || "ai-studio-agriculturepridi-19ab2f13-4ebd-42d7-aaf0-74a8af5164fb");
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


