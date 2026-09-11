import {
  auth,
  db,
  doc,
  setDoc,
  getDoc,
  firebaseReady,
  getFirebaseAuth,
  getFirebaseDB
} from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

console.log("✅ signin.js initialized");

const signinForm = document.getElementById("signin-form");
const loginFeedback = document.getElementById("login-feedback");
const googleBtns = document.querySelectorAll(".google-btn, #google-signin-btn, #google-signup-btn");
const AUTH_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function disableGuestAccess() {
  document.querySelectorAll(".guest-btn").forEach((btn) => {
    btn.disabled = true;
    btn.removeAttribute("onclick");
    btn.style.display = "none";
  });
  window.continueAsGuest = function () {
    showLoginMessage("error", "Please sign in with Google or email/password. Guest access is disabled.");
  };
}

disableGuestAccess();

function showLoginMessage(type, message, actionHtml = "") {
  if (!loginFeedback) return;
  loginFeedback.className = `auth-feedback ${type}`;
  loginFeedback.innerHTML = `<div>${message}</div>${actionHtml ? `<div>${actionHtml}</div>` : ""}`;
  loginFeedback.style.display = "block";
}

function clearLoginMessage() {
  if (loginFeedback) {
    loginFeedback.className = "auth-feedback";
    loginFeedback.innerHTML = "";
    loginFeedback.style.display = "none";
  }
}

document.getElementById("signin-email")?.addEventListener("input", clearLoginMessage);
document.getElementById("signin-password")?.addEventListener("input", clearLoginMessage);

// Firestore is optional application data storage. Authentication must never
// depend on it because a Firebase project can legitimately have no Firestore
// database. In particular, do not call getDoc/setDoc from the login flow.
export async function syncUserProfile(user, additionalData = {}) {
  const currentDB = db || getFirebaseDB();
  if (!currentDB || !user) return false;

  // Only persist a profile when Firestore has explicitly been confirmed by
  // the application. This flag is intentionally opt-in so a missing/default
  // database cannot generate background retry traffic during authentication.
  if (window.__AGRI_FIRESTORE_READY__ !== true) return false;

  try {
    const userRef = doc(currentDB, "users", user.uid);
    const now = new Date().toISOString();
    const existing = await withTimeout(getDoc(userRef), 5000, "Firestore profile read timed out");
    const profile = {
      userId: user.uid,
      email: user.email || "",
      displayName: user.displayName || additionalData.displayName || "Smart Farmer",
      preferredLanguage: additionalData.preferredLanguage || "en",
      updatedAt: now
    };
    if (!existing?.exists()) profile.createdAt = now;
    await withTimeout(setDoc(userRef, profile, { merge: true }), 5000, "Firestore profile write timed out");
    return true;
  } catch (error) {
    console.warn("Firestore profile sync skipped:", error.message);
    return false;
  }
}

export async function establishServerSession(user, provider) {
  if (!user) throw new Error("No authenticated Firebase user was returned.");

  const idToken = await withTimeout(
    user.getIdToken(true),
    AUTH_TIMEOUT_MS,
    "Firebase token request timed out. Please try again."
  );
  if (!idToken) throw new Error("Firebase did not provide an ID token.");

  const response = await withTimeout(
    fetch("/set_session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ idToken, provider })
    }),
    AUTH_TIMEOUT_MS,
    "Server authentication timed out. Please try again."
  );

  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok || data.success !== true || data.user?.firebaseVerified !== true) {
    throw new Error(data.error || `Server rejected authentication (HTTP ${response.status}).`);
  }
  return data;
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  try {
    const requestUrl = typeof input === "string" ? input : input.url;
    const pathname = new URL(requestUrl, window.location.href).pathname;
    if (pathname === "/set_session" && auth?.currentUser && init?.body) {
      let payload;
      try { payload = JSON.parse(init.body); } catch (_) { payload = {}; }
      if (!payload.idToken) {
        payload.idToken = await auth.currentUser.getIdToken(true);
        init = { ...init, body: JSON.stringify(payload) };
      }
    }
  } catch (error) {
    console.warn("Session token injection failed:", error.message);
  }
  return originalFetch(input, init);
};

if (signinForm) {
  signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearLoginMessage();

    const submitBtn = signinForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "Sign In";
    const email = document.getElementById("signin-email")?.value?.trim();
    const password = document.getElementById("signin-password")?.value;

    if (!email || !password) {
      showLoginMessage("error", "⚠️ Please provide both your email address and password.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing In...";
    }

    try {
      await withTimeout(firebaseReady, AUTH_TIMEOUT_MS, "Firebase initialization timed out. Please refresh and try again.");
      const currentAuth = auth || getFirebaseAuth();
      if (!currentAuth) throw new Error("Firebase Authentication is not configured.");

      const userCredential = await withTimeout(
        signInWithEmailAndPassword(currentAuth, email, password),
        AUTH_TIMEOUT_MS,
        "Firebase sign-in timed out. Please check your connection and try again."
      );

      // Firestore is deliberately excluded from authentication.
      await establishServerSession(userCredential.user, "password");
      window.location.replace("/signedin");
    } catch (error) {
      console.warn("Login failed:", error.code || error.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }

      const errCode = error.code || "";
      if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(errCode)) {
        showLoginMessage("error", "⚠️ Invalid email or password.");
      } else if (errCode === "auth/too-many-requests") {
        showLoginMessage("error", "⚠️ Too many attempts. Please wait a few minutes and try again.");
      } else if (["auth/invalid-api-key", "auth/api-key-not-valid"].includes(errCode)) {
        showLoginMessage("error", "⚠️ Firebase configuration is invalid. Check the Firebase project settings.");
      } else {
        showLoginMessage("error", `⚠️ ${String(error.message || "Authentication failed").replace("Firebase:", "").trim()}`);
      }
    }
  });
}

const handleGoogleSignIn = async () => {
  console.log("🚀 Google Sign-In initiated");
  clearLoginMessage();

  const googleButton = document.querySelector("#google-signin-btn") || document.querySelector(".google-btn");
  if (googleButton) googleButton.disabled = true;

  try {
    await withTimeout(firebaseReady, AUTH_TIMEOUT_MS, "Firebase initialization timed out. Please refresh and try again.");
    const currentAuth = auth || getFirebaseAuth();
    if (!currentAuth) throw new Error("Firebase Authentication is not configured.");

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await withTimeout(
      signInWithPopup(currentAuth, provider),
      60000,
      "Google sign-in timed out. Please try again."
    );
    const user = result.user;

    // Firestore is deliberately excluded from authentication.
    await establishServerSession(user, "google");
    window.location.replace("/signedin");
  } catch (error) {
    console.warn("Google sign-in failed:", error.code || error.message);
    const errCode = error.code || "";
    if (errCode === "auth/popup-closed-by-user") {
      showLoginMessage("info", "Google sign-in was cancelled.");
    } else if (errCode === "auth/popup-blocked") {
      showLoginMessage("error", "⚠️ Your browser blocked the Google popup. Allow popups for this site and try again.");
    } else if (errCode === "auth/unauthorized-domain") {
      showLoginMessage("error", "⚠️ This domain is not authorized in Firebase Authentication. Add your exact Render domain under Authentication → Settings → Authorized domains.");
    } else if (errCode === "auth/operation-not-allowed") {
      showLoginMessage("error", "⚠️ Google Sign-In is disabled in Firebase Authentication. Enable the Google provider in Firebase Console.");
    } else if (errCode === "auth/account-exists-with-different-credential") {
      showLoginMessage("error", "⚠️ This email already has an account with a different sign-in method. Sign in using that method first.");
    } else {
      showLoginMessage("error", `⚠️ ${String(error.message || "Google sign-in failed").replace("Firebase:", "").trim()}`);
    }
  } finally {
    if (googleButton) googleButton.disabled = false;
  }
};

googleBtns.forEach((btn) => {
  btn.addEventListener("click", handleGoogleSignIn);
});
