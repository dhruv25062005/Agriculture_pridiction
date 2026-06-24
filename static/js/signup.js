import { auth } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("✅ signup.js loaded (modal)");

const signupForm = document.getElementById("signup-form");

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  console.log("🚀 Sign Up clicked");

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  if (!auth) {
    alert("Firebase not initialized. Refresh page.");
    return;
  }

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("✅ Signup successful! Please sign in.");
      document.getElementById("signup-modal").style.display = "none";
      document.getElementById("signin-modal").style.display = "flex";
    })
    .catch(error => {
      console.error("❌ Signup error:", error);
      alert(error.message);
    });
});
