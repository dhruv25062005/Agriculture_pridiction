/* KisanAI dashboard rescue bindings.
 * This file is intentionally self-contained so it can be loaded even when
 * the legacy inline dashboard script was skipped by an older/stale page.
 */
(function () {
  "use strict";

  const names = [
    "switchScannerMode", "toggleSunlightMode", "toggleProfileDropdown", "closeProfileDropdown",
    "calculatePlotFertilizer", "loadWeather", "recommendCrop", "predictYield", "calculateFarmProfit",
    "useMyLocation", "refreshCurrentWeather", "quickSelectCity", "syncNutrientInput", "loadScanJournal",
    "sendAgronomistMessage", "askQuickPrompt", "toggleTorch", "toggleFreezeLiveStream",
    "toggleAutoLiveScan", "performLiveFrameAnalysis", "openCamera", "captureImage", "flipLiveCamera",
    "changeLanguage", "saveProfileChanges", "toggleEditProfileDrawer", "syncGpsToProfile",
    "copyFarmerUid", "fetchFarmerProfile"
  ];

  // If the legacy inline script ran, expose its functions explicitly.
  for (const name of names) {
    try {
      if (typeof window[name] !== "function" && typeof globalThis[name] === "function") {
        window[name] = globalThis[name];
      }
    } catch (_) {}
  }

  function byId(id) { return document.getElementById(id); }

  if (typeof window.toggleSunlightMode !== "function") {
    window.toggleSunlightMode = function () {
      document.body.classList.toggle("theme-sunlight");
      const label = byId("themeToggleLabel");
      if (label) label.textContent = document.body.classList.contains("theme-sunlight") ? "Dark Mode" : "Sunlight Mode";
    };
  }

  if (typeof window.switchScannerMode !== "function") {
    window.switchScannerMode = function (mode) {
      const live = String(mode).toLowerCase() === "live";
      const uploadPanel = byId("photoUploadPanel");
      const livePanel = byId("liveScannerPanel");
      const uploadTab = byId("tabUploadMode");
      const liveTab = byId("tabLiveMode");
      if (uploadPanel) uploadPanel.style.display = live ? "none" : "block";
      if (livePanel) livePanel.style.display = live ? "block" : "none";
      uploadTab?.classList.toggle("active", !live);
      liveTab?.classList.toggle("active", live);
    };
  }

  if (typeof window.toggleProfileDropdown !== "function") {
    window.toggleProfileDropdown = function (event) {
      event?.stopPropagation?.();
      const section = byId("userProfileSection");
      if (!section) return;
      section.classList.toggle("open");
      try { window.fetchFarmerProfile?.(); } catch (_) {}
    };
  }

  if (typeof window.closeProfileDropdown !== "function") {
    window.closeProfileDropdown = function () {
      byId("userProfileSection")?.classList.remove("open");
    };
  }

  // Last-resort handlers. Normally the legacy implementations are available;
  // these prevent ReferenceError crashes on stale/partially-loaded documents.
  function unavailable(name) {
    return function () {
      console.warn("KisanAI dashboard handler unavailable:", name);
      const message = `The ${name} feature is still loading. Please refresh the dashboard once.`;
      const el = byId("errorMessage") || byId("statusMessage") || byId("toast");
      if (el) { el.textContent = message; el.style.display = "block"; }
    };
  }

  for (const name of names) {
    if (typeof window[name] !== "function") window[name] = unavailable(name);
  }

  window.__KISAN_DASHBOARD_BINDINGS__ = "2026-09-10-rescue-4";
})();
