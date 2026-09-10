/* KisanAI dashboard bindings + live scanner reliability layer. */
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

  const byId = id => document.getElementById(id);

  // Preserve working legacy dashboard functions, with safe fallbacks.
  for (const name of names) {
    try {
      if (typeof window[name] !== "function" && typeof globalThis[name] === "function") {
        window[name] = globalThis[name];
      }
    } catch (_) {}
  }

  if (typeof window.toggleSunlightMode !== "function") {
    window.toggleSunlightMode = function () {
      document.body.classList.toggle("theme-sunlight");
      const label = byId("themeToggleLabel");
      if (label) label.textContent = document.body.classList.contains("theme-sunlight") ? "Dark Mode" : "Sunlight Mode";
    };
  }

  if (typeof window.toggleProfileDropdown !== "function") {
    window.toggleProfileDropdown = function (event) {
      event?.stopPropagation?.();
      byId("userProfileSection")?.classList.toggle("open");
      try { window.fetchFarmerProfile?.(); } catch (_) {}
    };
  }
  if (typeof window.closeProfileDropdown !== "function") {
    window.closeProfileDropdown = () => byId("userProfileSection")?.classList.remove("open");
  }

  function unavailable(name) {
    return function () {
      console.warn("KisanAI dashboard handler unavailable:", name);
      const el = byId("errorMessage") || byId("statusMessage") || byId("toast");
      if (el) { el.textContent = `${name} is still loading. Please refresh once.`; el.style.display = "block"; }
    };
  }
  for (const name of names) if (typeof window[name] !== "function") window[name] = unavailable(name);

  /* =========================================================
     LIVE DISEASE SCANNER — reliable browser implementation
     ========================================================= */
  let liveStream = null;
  let liveFacing = "environment";
  let liveBusy = false;
  let liveFrozen = false;
  let liveTimer = null;
  let torchOn = false;
  let liveScanGeneration = 0;

  function liveStatus(text, state) {
    const el = byId("hudStatusText");
    const dot = byId("hudBlinkDot");
    if (el) el.innerText = text;
    if (dot) dot.style.background = state === "error" ? "#ef4444" : state === "busy" ? "#f59e0b" : "#00e676";
  }

  function stopTracks() {
    if (liveStream) {
      for (const track of liveStream.getTracks()) track.stop();
      liveStream = null;
    }
    const video = byId("liveCameraVideo");
    if (video) video.srcObject = null;
  }

  function stopAuto() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = null;
    liveBusy = false;
    liveScanGeneration++;
    const check = byId("chkAutoScan");
    if (check) check.checked = false;
  }

  async function startLiveCameraStream() {
    const video = byId("liveCameraVideo");
    if (!video) return false;
    if (!navigator.mediaDevices?.getUserMedia) {
      liveStatus("Camera is not supported by this browser", "error");
      return false;
    }

    stopAuto();
    stopTracks();
    liveFrozen = false;
    torchOn = false;

    try {
      liveStatus("Activating camera...", "busy");
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: liveFacing },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      };
      liveStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = liveStream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      liveStatus("Camera ready • center the crop leaf", "ok");
      return true;
    } catch (err) {
      console.warn("Live camera error:", err);
      const msg = err?.name === "NotAllowedError" ? "Camera permission denied • allow camera access" :
        err?.name === "NotReadableError" ? "Camera is busy • close other camera apps" :
        "Unable to start camera";
      liveStatus(msg, "error");
      return false;
    }
  }

  function stopLiveCameraStream() {
    stopAuto();
    stopTracks();
    liveFrozen = false;
    torchOn = false;
    liveStatus("Live scanner stopped", "ok");
  }

  async function flipLiveCamera() {
    liveFacing = liveFacing === "environment" ? "user" : "environment";
    await startLiveCameraStream();
  }

  async function toggleTorch() {
    const track = liveStream?.getVideoTracks?.()[0];
    if (!track) return showToastNoticeSafe("Start the live camera first.");
    try {
      const caps = track.getCapabilities?.() || {};
      if (!caps.torch) return showToastNoticeSafe("Torch is not available on this camera.");
      torchOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      const btn = byId("btnTorch");
      if (btn) btn.innerText = torchOn ? "💡 Light ON" : "💡 Torch";
    } catch (err) {
      console.warn("Torch error:", err);
      showToastNoticeSafe("Torch control is not supported by this device/browser.");
    }
  }

  function toggleFreezeLiveStream() {
    const video = byId("liveCameraVideo");
    if (!video || !liveStream) return;
    liveFrozen = !liveFrozen;
    if (liveFrozen) {
      video.pause();
      liveStatus("Frame frozen • press Resume to continue", "busy");
      const btn = byId("btnFreeze"); if (btn) btn.innerText = "▶️ Resume";
    } else {
      video.play().catch(() => {});
      liveStatus("Live camera active • ready to scan", "ok");
      const btn = byId("btnFreeze"); if (btn) btn.innerText = "⏸️ Freeze";
    }
  }

  function makeLiveFrame(video) {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.72));
  }

  async function performLiveFrameAnalysis() {
    const video = byId("liveCameraVideo");
    const card = byId("liveDiagnosisCard");
    const button = byId("btnLiveInstantScan");
    if (!video || !liveStream || liveFrozen || liveBusy || !video.videoWidth) return null;

    liveBusy = true;
    const generation = liveScanGeneration;
    if (button) button.disabled = true;
    liveStatus("🔬 Inspecting crop...", "busy");

    try {
      const blob = await makeLiveFrame(video);
      if (!blob || generation !== liveScanGeneration) return null;

      const file = new File([blob], "live-field-specimen.jpg", { type: "image/jpeg" });
      const form = new FormData();
      form.append("image", file);
      form.append("method", byId("treatmentMethodSelect")?.value || "Chemical");
      form.append("lang", window.currentLanguage || "en");

      // A live scan is intentionally small and single-shot. No optical color
      // rejection is done in the browser; Gemini is responsible for plant detection.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 14000);
      let response;
      try {
        response = await fetch("/predict", { method: "POST", body: form, signal: controller.signal, cache: "no-store" });
      } finally {
        clearTimeout(timeout);
      }

      let data = null;
      try { data = await response.json(); } catch (_) {}
      if (!data) throw new Error("Empty diagnosis response");

      if (data.is_plant === false) {
        window.latestDiagnosisData = data;
        liveStatus(`⚠️ No plant detected • ${data.detected_subject || "aim at a crop leaf"}`, "busy");
        if (card && typeof window.generateDiagnosisCardMarkup === "function") {
          card.innerHTML = window.generateDiagnosisCardMarkup(data, "live");
        }
        return data;
      }

      if (!data.success) {
        const message = data.error || "AI could not identify this frame";
        liveStatus(message.length > 70 ? message.slice(0, 67) + "..." : message, "error");
        return data;
      }

      window.latestDiagnosisData = data;
      const insect = data.is_insect_caused || String(data.category || "").includes("Insect");
      liveStatus(`✅ ${insect ? "🐛 Pest" : "🌿 Diagnosis"}: ${data.disease || "Detected"} • ${data.severity || ""}`, "ok");
      if (card && typeof window.generateDiagnosisCardMarkup === "function") {
        card.innerHTML = window.generateDiagnosisCardMarkup(data, "live");
      }

      if (typeof window.saveDiagnosisToFirestore === "function") {
        window.saveDiagnosisToFirestore(data).catch(err => console.warn("Live history save note:", err));
      }
      return data;
    } catch (err) {
      if (err?.name === "AbortError") {
        liveStatus("Scan timed out • hold the leaf steady and retry", "error");
      } else if (err?.message === "Failed to fetch") {
        liveStatus("Network connection lost • retrying", "error");
      } else {
        console.warn("Live scan error:", err);
        liveStatus("Scan failed • hold camera steady and retry", "error");
      }
      return null;
    } finally {
      liveBusy = false;
      if (button) button.disabled = false;
    }
  }

  function toggleAutoLiveScan(enabled) {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = null;
    liveScanGeneration++;
    const check = byId("chkAutoScan");
    if (check) check.checked = !!enabled;

    if (!enabled) {
      liveBusy = false;
      if (liveStream) liveStatus("Live camera active • ready to scan", "ok");
      return;
    }

    if (!liveStream) {
      if (check) check.checked = false;
      liveStatus("Start the camera before Auto-Scan", "error");
      return;
    }

    // 6 seconds keeps Gemini traffic controlled while still feeling live.
    liveStatus("🔁 Auto-Scan active • checking every 6s", "ok");
    performLiveFrameAnalysis();
    liveTimer = setInterval(() => {
      if (!liveBusy && !liveFrozen && liveStream) performLiveFrameAnalysis();
    }, 6000);
  }

  function switchScannerMode(mode) {
    const live = String(mode).toLowerCase() === "live";
    byId("tabUploadMode")?.classList.toggle("active", !live);
    byId("tabLiveMode")?.classList.toggle("active", live);
    byId("photoUploadPanel")?.classList.toggle("hidden", live);
    byId("liveScannerPanel")?.classList.toggle("hidden", !live);
    if (live) startLiveCameraStream(); else stopLiveCameraStream();
  }

  function showToastNoticeSafe(msg) {
    try {
      if (typeof window.showToastNotice === "function") return window.showToastNotice(msg);
    } catch (_) {}
    console.warn(msg);
  }

  // These are deliberately assigned unconditionally so the reliable live layer
  // replaces the old implementation even when signedin.html contains stale code.
  window.startLiveCameraStream = startLiveCameraStream;
  window.stopLiveCameraStream = stopLiveCameraStream;
  window.switchScannerMode = switchScannerMode;
  window.flipLiveCamera = flipLiveCamera;
  window.toggleTorch = toggleTorch;
  window.toggleFreezeLiveStream = toggleFreezeLiveStream;
  window.performLiveFrameAnalysis = performLiveFrameAnalysis;
  window.toggleAutoLiveScan = toggleAutoLiveScan;

  window.__KISAN_DASHBOARD_BINDINGS__ = "2026-09-10-live-rescue-5";
})();
