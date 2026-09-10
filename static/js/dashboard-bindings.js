/*
 * Dashboard compatibility bindings.
 *
 * The dashboard keeps a large legacy inline script. If that script throws
 * during its boot sequence, JavaScript function declarations still exist but
 * the final window-binding block may never run. Inline onclick handlers then
 * report "... is not defined". This small external script runs afterwards and
 * safely restores the public handlers without changing the dashboard logic.
 */
(function () {
  "use strict";

  const names = [
    "switchScannerMode",
    "toggleSunlightMode",
    "toggleProfileDropdown",
    "closeProfileDropdown",
    "calculatePlotFertilizer",
    "loadWeather",
    "recommendCrop",
    "predictYield",
    "calculateFarmProfit",
    "useMyLocation",
    "refreshCurrentWeather",
    "quickSelectCity",
    "syncNutrientInput",
    "loadScanJournal",
    "sendAgronomistMessage",
    "askQuickPrompt",
    "toggleTorch",
    "toggleFreezeLiveStream",
    "toggleAutoLiveScan",
    "performLiveFrameAnalysis",
    "openCamera",
    "captureImage",
    "flipLiveCamera",
    "changeLanguage",
    "saveProfileChanges",
    "toggleEditProfileDrawer",
    "syncGpsToProfile",
    "copyFarmerUid",
    "fetchFarmerProfile"
  ];

  for (const name of names) {
    try {
      if (typeof window[name] !== "function" && typeof globalThis[name] === "function") {
        window[name] = globalThis[name];
      }
    } catch (_) {}
  }

  // Minimal fallbacks for the two purely UI controls. These are only used
  // when the legacy implementation is genuinely unavailable.
  if (typeof window.toggleSunlightMode !== "function") {
    window.toggleSunlightMode = function () {
      document.body.classList.toggle("theme-sunlight");
      const label = document.getElementById("themeToggleLabel");
      if (label) label.textContent = document.body.classList.contains("theme-sunlight") ? "Dark Mode" : "Sunlight Mode";
    };
  }

  if (typeof window.switchScannerMode !== "function") {
    window.switchScannerMode = function (mode) {
      const uploadTab = document.getElementById("tabUploadMode");
      const liveTab = document.getElementById("tabLiveMode");
      const uploadPanel = document.getElementById("photoUploadPanel");
      const livePanel = document.getElementById("liveScannerPanel");
      const live = String(mode).toLowerCase() === "live";
      if (uploadPanel) uploadPanel.style.display = live ? "none" : "block";
      if (livePanel) livePanel.style.display = live ? "block" : "none";
      uploadTab?.classList.toggle("active", !live);
      liveTab?.classList.toggle("active", live);
    };
  }

  if (typeof window.toggleProfileDropdown !== "function") {
    window.toggleProfileDropdown = function (event) {
      event?.stopPropagation?.();
      const section = document.getElementById("userProfileSection");
      if (!section) return;
      section.classList.toggle("open");
      try { window.fetchFarmerProfile?.(); } catch (_) {}
    };
  }

  if (typeof window.closeProfileDropdown !== "function") {
    window.closeProfileDropdown = function () {
      document.getElementById("userProfileSection")?.classList.remove("open");
    };
  }

  // Expose a diagnostic marker so a deployed dashboard can be verified from
  // DevTools without exposing credentials or user data.
  window.__KISAN_DASHBOARD_BINDINGS__ = "2026-09-10";
})();
