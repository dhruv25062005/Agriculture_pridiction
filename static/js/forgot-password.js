import {
  auth,
  firebaseReady,
  getFirebaseAuth
} from "./firebase-config.js";
import { sendPasswordResetEmail } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

console.log("✅ forgot-password.js initialized");

const forgotForm = document.getElementById("forgot-form");
const forgotFeedback = document.getElementById("forgot-feedback");

function showForgotMessage(type, message) {
  if (!forgotFeedback) return;
  forgotFeedback.className = `auth-feedback ${type}`;
  forgotFeedback.innerHTML = `<div>${message}</div>`;
  forgotFeedback.style.display = "block";
}

function clearForgotMessage() {
  if (forgotFeedback) {
    forgotFeedback.className = "auth-feedback";
    forgotFeedback.innerHTML = "";
    forgotFeedback.style.display = "none";
  }
}

document.getElementById("forgot-email")?.addEventListener("input", clearForgotMessage);

if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearForgotMessage();

    const email = document.getElementById("forgot-email")?.value?.trim();
    if (!email) {
      showForgotMessage("error", "⚠️ Please enter your registered email address.");
      return;
    }

    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    try {
      await firebaseReady;
      const currentAuth = auth || getFirebaseAuth();
      if (!currentAuth) throw new Error("Firebase Authentication is not configured.");
      await sendPasswordResetEmail(currentAuth, email);
      showForgotMessage("success", "✅ Password reset link has been dispatched to your email inbox.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
      }
      setTimeout(() => {
        if (typeof window.showLogin === "function") window.showLogin();
      }, 2500);
    } catch (error) {
      console.warn("Reset attempt notice:", error.code || error.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
      }

      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
        showForgotMessage("error", "⚠️ No farmer account was found with this email address.");
      } else if (error.code === "auth/invalid-email") {
        showForgotMessage("error", "⚠️ Please enter a valid email address.");
      } else if ((error.message || "").includes("Failed to fetch") || (error.message || "").includes("network")) {
        showForgotMessage("error", "⚠️ Network error. Please check your connection and try again.");
      } else {
        showForgotMessage("error", `⚠️ ${error.message?.replace("Firebase:", "").trim() || "Could not send reset email."}`);
      }
    }
  });
}
