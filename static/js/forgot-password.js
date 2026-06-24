import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("✅ forgot-password.js loaded");

document.getElementById("forgot-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("forgot-email").value;

  if (!auth) {
    alert("Firebase not initialized");
    return;
  }

  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert("✅ Password reset link sent to your email");
      document.getElementById("forgot-modal").style.display = "none";
      document.getElementById("signin-modal").style.display = "flex";
    })
    .catch(error => {
      console.error("❌ Reset error:", error);
      alert(error.message);
    });
});
