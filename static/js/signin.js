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

export async function syncUserProfile(user, additionalData = {}) {
  const currentDB = db || getFirebaseDB();
  if (!currentDB || !user) throw new Error("Firebase Firestore is not initialized.");

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

  if (!existing?.exists()) profile.createdAt = new Date().toISOString();
  await setDoc(userRef, profile, { merge: true });
}

export async function establishServerSession(user, provider) {
  if (!user) throw new Error("No authenticated Firebase user was returned.");
  const idToken = await user.getIdToken(true);
  if (!idToken) throw new Error("Firebase did not provide an ID token.");

  const response = await fetch("/set_session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken, provider })
  });

  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok || data.success !== true || data.user?.firebaseVerified !== true) {
    throw new Error(data.error || "Server rejected the Firebase authentication session.");
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
      await firebaseReady;
      const currentAuth = auth || getFirebaseAuth();
      if (!currentAuth) throw new Error("Firebase Authentication is not configured.");

      const userCredential = await signInWithEmailAndPassword(currentAuth, email, password);
      await syncUserProfile(userCredential.user);
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
    await firebaseReady;
    const currentAuth = auth || getFirebaseAuth();
    if (!currentAuth) throw new Error("Firebase Authentication is not configured.");

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(currentAuth, provider);
    const user = result.user;

    await syncUserProfile(user);
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
