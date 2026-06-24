/* firebase-config.js */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let app = null;
let auth = null;

const firebaseReady = fetch('/firebase_config')
  .then(response => response.json())
  .then(firebaseConfig => {
    console.log("🔥 Firebase Config Loaded:", firebaseConfig);

    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("your")) {
      throw new Error("❌ Invalid Firebase API Key");
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    console.log("✅ Firebase Initialized Successfully");
    return auth;
  })
  .catch(error => {
    console.error("❌ Firebase initialization failed:", error);
  });

export { app, auth, firebaseReady };
