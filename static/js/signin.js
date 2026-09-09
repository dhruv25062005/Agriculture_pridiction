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
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("✅ signin.js initialized");

const signinForm = document.getElementById("signin-form");
const loginFeedback = document.getElementById("login-feedback");
const googleBtns = document.querySelectorAll(".google-btn, #google-signin-btn, #google-signup-btn");

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

export async function syncUserProfile(user, additionalData = {}) {
  const currentDB = db || getFirebaseDB();
  if (!currentDB || !user) return;

  const userRef = doc(currentDB, "users", user.uid);
  let existing = null;
  try {
    existing = await getDoc(userRef);
  } catch (error) {
    console.warn("Could not read existing user profile:", error.message);
  }

  const profile = {
    userId: user.uid,
    email: user.email || "",
    displayName: user.displayName || additionalData.displayName || "Smart Farmer",
    preferredLanguage: additionalData.preferredLanguage || "en",
    updatedAt: new Date().toISOString()
  };

  // Firestore rules require createdAt to remain unchanged on updates.
  if (!existing?.exists()) profile.createdAt = new Date().toISOString();

  await setDoc(userRef, profile, { merge: true });
}

// Securely exchange a Firebase ID token for the server session.
export async function establishServerSession(user, provider) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/set_session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken, provider })
  });

  if (!response.ok) {
    let message = "Unable to establish a secure server session.";
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (_) {}
    throw new Error(message);
  }
  return response.json();
}

// Compatibility bridge for the existing signup.js. It injects a real Firebase
// ID token into legacy /set_session calls; no client-supplied UID is trusted.
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
      await firebaseReady;
      const currentAuth = auth || getFirebaseAuth();
      if (!currentAuth) throw new Error("Firebase Authentication is not configured. Check the Firebase environment variables.");

      const userCredential = await signInWithEmailAndPassword(currentAuth, email, password);
      await syncUserProfile(userCredential.user);
      await establishServerSession(userCredential.user, "password");

      showLoginMessage("success", "✅ Welcome back! Entering your agricultural dashboard...");
      window.location.href = "/signedin";
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
        showLoginMessage("error", "⚠️ Firebase configuration is invalid. Check FIREBASE_API_KEY and the Firebase project settings.");
      } else {
        showLoginMessage("error", `⚠️ ${String(error.message || "Authentication failed").replace("Firebase:", "").trim()}`);
      }
    }
  });
}

const handleGoogleSignIn = async () => {
  console.log("🚀 Google Sign-In initiated");
  clearLoginMessage();

  try {
    await firebaseReady;
    const currentAuth = auth || getFirebaseAuth();
    if (!currentAuth) throw new Error("Firebase Authentication is not configured. Check the Firebase environment variables.");

    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(currentAuth, provider);
    const user = result.user;

    await syncUserProfile(user);
    await establishServerSession(user, "google");
    window.location.href = "/signedin";
  } catch (error) {
    console.warn("Google sign-in failed:", error.code || error.message);
    const errCode = error.code || "";
    if (errCode === "auth/popup-closed-by-user") {
      showLoginMessage("info", "Google sign-in was cancelled.");
    } else if (errCode === "auth/popup-blocked") {
      showLoginMessage("error", "⚠️ Your browser blocked the Google sign-in popup. Allow popups for this site and try again.");
    } else if (errCode === "auth/unauthorized-domain") {
      showLoginMessage("error", "⚠️ This site's domain is not authorized in Firebase Authentication settings.");
    } else {
      showLoginMessage("error", `⚠️ ${String(error.message || "Google sign-in failed").replace("Firebase:", "").trim()}`);
    }
  }
};

googleBtns.forEach(btn => btn.addEventListener("click", handleGoogleSignIn));
