import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("✅ signin.js loaded (modal)");

const signinForm = document.getElementById("signin-form");
const googleBtn = document.getElementById("google-signin-btn");

/* ---------------- EMAIL + PASSWORD LOGIN ---------------- */

signinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  console.log("🚀 Sign In clicked");

  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;

  if (!auth) {
    alert("Firebase not initialized. Refresh page.");
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then(userCredential => {
      console.log("✅ Login success (email)");

      return fetch("/set_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          provider: "password"
        })
      });
    })
    .then(() => {
      window.location.href = "/signedin";
    })
    .catch(error => {
      console.error("❌ Login error:", error);
      alert(error.message);
    });
});

/* ---------------- GOOGLE SIGN-IN ---------------- */

googleBtn.addEventListener("click", async () => {
  console.log("🚀 Google Sign-In clicked");

  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log("✅ Login success (Google)");

    await fetch("/set_session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photo: user.photoURL,
        provider: "google"
      })
    });

    window.location.href = "/signedin";

  } catch (error) {
    console.error("❌ Google login error:", error);
    alert(error.message);
  }
});
