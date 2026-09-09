import {
  auth,
  firebaseReady,
  getFirebaseAuth
} from "./firebase-config.js";
import { syncUserProfile, establishServerSession } from "./signin.js";
import { createUserWithEmailAndPassword } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("✅ signup.js initialized");

const signupForm = document.getElementById("signup-form");
const signupFeedback = document.getElementById("signup-feedback");

function showSignupMessage(type, message) {
  if (!signupFeedback) return;
  signupFeedback.className = `auth-feedback ${type}`;
  signupFeedback.innerHTML = `<div>${message}</div>`;
  signupFeedback.style.display = "block";
}

function clearSignupMessage() {
  if (signupFeedback) {
    signupFeedback.className = "auth-feedback";
    signupFeedback.innerHTML = "";
    signupFeedback.style.display = "none";
  }
}

document.getElementById("signup-email")?.addEventListener("input", clearSignupMessage);
document.getElementById("signup-password")?.addEventListener("input", clearSignupMessage);

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearSignupMessage();

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "Create Account";

    const firstName = document.getElementById("signup-firstname")?.value?.trim() || "";
    const lastName = document.getElementById("signup-lastname")?.value?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim() || "Smart Farmer";
    const email = document.getElementById("signup-email")?.value?.trim();
    const password = document.getElementById("signup-password")?.value;

    if (!email || !password) {
      showSignupMessage("error", "⚠️ Please enter an email address and password.");
      return;
    }
    if (password.length < 6) {
      showSignupMessage("error", "⚠️ Password must be at least 6 characters long.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating Account...";
    }

    try {
      await firebaseReady;
      const currentAuth = auth || getFirebaseAuth();
      if (!currentAuth) throw new Error("Firebase Authentication is not configured. Check the Firebase environment variables.");

      const userCredential = await createUserWithEmailAndPassword(currentAuth, email, password);
      const user = userCredential.user;

      await syncUserProfile(user, { displayName: fullName });
      await establishServerSession(user, "password");

      showSignupMessage("success", "✅ Account created successfully! Launching your smart farm...");
      window.location.href = "/signedin";
    } catch (error) {
      console.warn("Signup failed:", error.code || error.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }

      const errCode = error.code || "";
      const errMsg = error.message || "";
      if (errCode === "auth/email-already-in-use") {
        showSignupMessage("info", "🌱 An account with this email already exists. Please sign in instead.");
      } else if (errCode === "auth/weak-password") {
        showSignupMessage("error", "⚠️ Password is too weak. Please use at least 6 characters.");
      } else if (errCode === "auth/invalid-email") {
        showSignupMessage("error", "⚠️ Please enter a valid email address.");
      } else if (errCode === "auth/operation-not-allowed") {
        showSignupMessage("error", "⚠️ Email/password authentication is disabled in Firebase. Enable it in Firebase Authentication.");
      } else {
        showSignupMessage("error", `⚠️ ${String(errMsg || "Account creation failed").replace("Firebase:", "").trim()}`);
      }
    }
  });
}
