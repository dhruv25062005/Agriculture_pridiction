import {
  auth,
  firebaseReady,
  getFirebaseAuth
} from "./firebase-config.js";
import { syncUserProfile } from "./signin.js";
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

    await firebaseReady;
    const currentAuth = auth || getFirebaseAuth();

    if (!currentAuth) {
      console.warn("Operating with local farmer session");
      try {
        await fetch("/set_session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: "user-" + Date.now(),
            email: email,
            name: fullName,
            provider: "local"
          })
        });
        showSignupMessage("success", "✅ Account ready! Loading dashboard...");
        window.location.href = "/signedin";
      } catch (err) {
        window.location.href = "/signedin";
      }
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(currentAuth, email, password);
      console.log("✅ Signup successful:", userCredential.user.email);

      showSignupMessage("success", "✅ Account created successfully! Launching your smart farm...");
      await syncUserProfile(userCredential.user, { displayName: fullName });

      await fetch("/set_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: fullName,
          provider: "password"
        })
      });

      window.location.href = "/signedin";

    } catch (error) {
      console.warn("Signup attempt notice:", error.code || error.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }

      const errCode = error.code || "";
      const errMsg = error.message || "";

      if (errCode === "auth/email-already-in-use") {
        showSignupMessage("info", "🌱 An account with this email already exists. Redirecting to sign in...");
        const signinEmail = document.getElementById("signin-email");
        if (signinEmail) signinEmail.value = email;
        setTimeout(() => {
          if (typeof window.showLogin === "function") {
            window.showLogin();
          }
        }, 1200);
      } else if (errCode === "auth/weak-password") {
        showSignupMessage("error", "⚠️ Password is too weak. Please use at least 6 characters with mixed letters and numbers.");
      } else if (errCode === "auth/invalid-email") {
        showSignupMessage("error", "⚠️ Please enter a valid email address.");
      } else if (errMsg.includes("Failed to fetch") || errMsg.includes("network")) {
        showSignupMessage("info", "🌾 Network delay detected. Logging you in with offline farmer session...");
        try {
          await fetch("/set_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: "offline-" + Date.now(),
              email: email,
              name: fullName,
              provider: "offline"
            })
          });
          window.location.href = "/signedin";
        } catch (e) {
          window.location.href = "/signedin";
        }
      } else {
        showSignupMessage("error", `⚠️ ${errMsg.replace("Firebase:", "").trim()}`);
      }
    }
  });
}
