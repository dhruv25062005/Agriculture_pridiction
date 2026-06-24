console.log("✅ signout.js loaded");

document.addEventListener("DOMContentLoaded", () => {
    const signoutBtn = document.getElementById("signout-button");

    if (signoutBtn) {
        signoutBtn.addEventListener("click", () => {
            console.log("🚪 Sign out clicked");
            window.location.href = "/signout";
        });
    } else {
        console.log("❌ Button not found");
    }
});