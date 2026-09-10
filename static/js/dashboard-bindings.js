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

  /*
   * Predict API bridge:
   * The dashboard already knows how to render a structured non-plant response,
   * but the legacy code treated every non-2xx response as a generic network
   * error before it could read that JSON. Keep the real server status for all
   * other endpoints, while normalizing only /predict 422/503 responses so the
   * existing UI can display the actual reason returned by the server.
   * A short client cooldown also prevents auto-scan from hammering Gemini when
   * the provider is temporarily unavailable.
   */
  try {
    if (!window.__KISAN_PREDICT_FETCH_BRIDGE__) {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async function (input, init) {
        const rawUrl = typeof input === "string" ? input : (input?.url || "");
        let pathname = "";
        try { pathname = new URL(rawUrl, window.location.href).pathname; } catch (_) {}

        if (pathname === "/predict" && !window.__KISAN_PREDICT_COOLDOWN_UNTIL__) {
          const response = await nativeFetch(input, init);
          if ((response.status === 422 || response.status === 503) && !response.bodyUsed) {
            let payload = null;
            try { payload = await response.clone().json(); } catch (_) {}
            if (payload && typeof payload === "object") {
              if (response.status === 503) {
                window.__KISAN_PREDICT_COOLDOWN_UNTIL__ = Date.now() + 30000;
              }
              return new Response(JSON.stringify(payload), {
                status: 200,
                headers: { "Content-Type": "application/json" }
              });
            }
          }
          return response;
        }

        if (pathname === "/predict" && window.__KISAN_PREDICT_COOLDOWN_UNTIL__) {
          const until = Number(window.__KISAN_PREDICT_COOLDOWN_UNTIL__) || 0;
          if (Date.now() < until) {
            return new Response(JSON.stringify({
              success: false,
              error: "Plant diagnosis is temporarily unavailable. Please wait a few seconds and try again."
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          delete window.__KISAN_PREDICT_COOLDOWN_UNTIL__;
        }

        return nativeFetch(input, init);
      };
      window.__KISAN_PREDICT_FETCH_BRIDGE__ = "2026-09-10-predict-bridge-1";
    }
  } catch (_) {}

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

  window.__KISAN_DASHBOARD_BINDINGS__ = "2026-09-10-rescue-3";
})();
