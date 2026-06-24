/* signedin.js */
window.onload = () => {
    // Retrieve user info from session storage
    const userJson = sessionStorage.getItem('user');

    if (userJson) {
        const user = JSON.parse(userJson);

        // OPTIONAL: show user email if element exists
        const info = document.getElementById('user-info');
        if (info) {
            info.innerText = `Signed in as: ${user.email}`;
        }

        // ✅ Redirect to Agriculture Dashboard
        window.location.href = "/signedin";

    } else {
        // ❌ Not logged in → go back to sign-in
        window.location.href = "/signin";
    }
};
