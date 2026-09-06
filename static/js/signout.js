import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("✅ signout.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const signoutBtns = document.querySelectorAll("#signout-button, #t-logout, .logout-btn-nav");

  signoutBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("🚪 Sign out clicked");
      if (auth && auth.currentUser) {
        try {
          await signOut(auth);
          console.log("✅ Signed out from Firebase Auth");
        } catch (err) {
          console.warn("Signout error:", err);
        }
      }
      window.location.href = "/signout";
    });
  });
});
