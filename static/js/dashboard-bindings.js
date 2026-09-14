/* KisanAI dashboard bindings + live scanner reliability layer. */
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

  const byId = (id) => document.getElementById(id);

  // Recover handlers exposed by other scripts without overwriting them.
  for (const name of names) {
    try {
      if (
        typeof window[name] !== "function" &&
        typeof globalThis[name] === "function"
      ) {
        window[name] = globalThis[name];
      }
    } catch (_) {
      // Ignore cross-script initialization timing errors.
    }
  }

  if (typeof window.toggleSunlightMode !== "function") {
    window.toggleSunlightMode = function () {
      document.body.classList.toggle("theme-sunlight");

      const label = byId("themeToggleLabel");

      if (label) {
        label.textContent = document.body.classList.contains("theme-sunlight")
          ? "Dark Mode"
          : "Sunlight Mode";
      }
    };
  }

  if (typeof window.toggleProfileDropdown !== "function") {
    window.toggleProfileDropdown = function (event) {
      event?.stopPropagation?.();

      byId("userProfileSection")?.classList.toggle("open");

      try {
        window.fetchFarmerProfile?.();
      } catch (_) {
        // Profile loading is optional here.
      }
    };
  }

  if (typeof window.closeProfileDropdown !== "function") {
    window.closeProfileDropdown = () => {
      byId("userProfileSection")?.classList.remove("open");
    };
  }

  function unavailable(name) {
    return function () {
      console.warn("KisanAI dashboard handler unavailable:", name);

      const el =
        byId("errorMessage") ||
        byId("statusMessage") ||
        byId("toast");

      if (el) {
        el.textContent = `${name} is still loading. Please refresh once.`;
        el.style.display = "block";
      }
    };
  }

  /*
   * IMPORTANT:
   * Do not install the generic fallback for recommendCrop/predictYield.
   * Their compatibility implementations are installed below.
   */
  const canonicalHandlers = new Set([
    "recommendCrop",
    "predictYield"
  ]);

  for (const name of names) {
    if (canonicalHandlers.has(name)) continue;

    if (typeof window[name] !== "function") {
      window[name] = unavailable(name);
    }
  }

  // =========================================================
  // CLIMATE CROP RECOMMENDATION + YIELD — canonical client API
  // =========================================================

  /*
   * These handlers are compatibility fallbacks.
   * Newer hardening scripts remain authoritative whenever
   * they have already installed a real handler.
   */

  const finite = (value, fallback = null) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const text = (value, fallback = "Not available") => {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return fallback;
    }

    return String(value);
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const responseObject = async (response) => {
    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      // Convert non-JSON responses into a useful error below.
    }

    if (!data || typeof data !== "object") {
      throw new Error(
        `Server returned ${response.status || "an invalid"} response.`
      );
    }

    if (!response.ok || (data.success === false && data.error)) {
      throw new Error(
        text(data.error, `Request failed (${response.status})`)
      );
    }

    return data;
  };

  function renderCropRecommendation(data) {
    const box = byId("cropResult");

    if (!box) return;

    const crop = text(
      data.crop ||
      data.recommendation ||
      data.recommended_crop,
      "No crop recommendation"
    );

    const season = text(
      data.season || data.season_name,
      "Climate-based"
    );

    const score = finite(
      data.score ??
      data.suitability_score ??
      data.recommendation_score
    );

    const expected = text(
      data.expected_yield ||
      data.yield ||
      data.yield_estimate,
      "Not estimated"
    );

    const water = text(
      data.water_requirement ||
      data.water_need,
      "Not specified"
    );

    const confidence = text(
      data.recommendation_confidence ||
      data.confidence_level,
      score == null
        ? "Indicative"
        : score >= 80
          ? "High"
          : score >= 60
            ? "Moderate"
            : "Low"
    );

    const alternatives = Array.isArray(data.alternatives)
      ? data.alternatives
      : [];

    const altHtml = alternatives
      .slice(0, 3)
      .map((item) => {
        const label =
          typeof item === "string"
            ? item
            : item?.crop || item?.name || "";

        const itemScore =
          typeof item === "object" && item !== null
            ? finite(
              item.score ??
              item.suitability_score
            )
            : null;

        return label
          ? `<span style="display:inline-block;padding:4px 8px;border-radius:10px;background:rgba(255,255,255,.07);margin:2px;font-size:.75rem;">${escapeHtml(label)}${itemScore != null
            ? ` • ${itemScore}/100`
            : ""
          }</span>`
          : "";
      })
      .join("");

    box.innerHTML = `
      <div style="background:rgba(0,230,118,.12);border:1px solid var(--accent-green);padding:16px;border-radius:14px;color:#fff;">

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">

          <div>
            <div style="font-size:.8rem;color:#a7f3d0;text-transform:uppercase;letter-spacing:.5px;font-weight:700;">
              Recommended Crop
            </div>

            <div style="font-size:1.3rem;font-weight:800;color:var(--accent-green);margin-top:2px;">
              ${escapeHtml(crop)}
            </div>
          </div>

          <span style="background:rgba(0,230,118,.2);border:1px solid var(--accent-green);color:#fff;font-size:.75rem;padding:3px 10px;border-radius:12px;font-weight:600;">
            ${escapeHtml(season)}
          </span>

        </div>

        <div style="margin-top:10px;font-size:.85rem;color:#cbd5e1;display:flex;flex-direction:column;gap:5px;">

          ${score != null
        ? `<div>🎯 <b>Climate Suitability:</b> ${score}/100</div>`
        : ""
      }

          <div>
            📈 <b>Expected Yield:</b>
            ${escapeHtml(expected)}
          </div>

          <div>
            💧 <b>Water Need:</b>
            ${escapeHtml(water)}
          </div>

          <div>
            🔎 <b>Recommendation Confidence:</b>
            ${escapeHtml(confidence)}
          </div>

        </div>

        ${altHtml
        ? `
              <div style="margin-top:10px;">
                <span style="font-size:.76rem;color:#94a3b8;">
                  Other suitable crops:
                </span>

                <div>${altHtml}</div>
              </div>
            `
        : ""
      }

        <div style="margin-top:10px;font-size:.76rem;color:#94a3b8;">
          ${escapeHtml(
        text(
          data.note || data.message,
          "Climate suitability only; soil, cultivar, irrigation capacity and market factors are not included."
        )
      )}
        </div>

      </div>
    `;
  }

  async function recommendCropCanonical() {
    const box = byId("cropResult");

    const temp = finite(
      byId("cropTempInput")?.value
    );

    const rainfall = finite(
      byId("cropRainInput")?.value
    );

    if (temp == null || rainfall == null) {
      if (box) {
        box.innerHTML = `
          <div style="color:#fbbf24;padding:10px;">
            Please enter valid temperature and rainfall values.
          </div>
        `;
      }

      return;
    }

    if (box) {
      box.innerHTML = `
        <div style="padding:14px;color:var(--accent-cyan);text-align:center;">
          ⏳ Analyzing climate conditions...
        </div>
      `;
    }

    try {
      const response = await fetch(
        "/recommend_crop?_schema=20260910",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },

          credentials: "same-origin",
          cache: "no-store",

          body: JSON.stringify({
            temp,
            rainfall
          })
        }
      );

      const data = await responseObject(response);

      renderCropRecommendation(data);

      console.info(
        "[KisanAI] crop recommendation response:",
        data
      );
    } catch (error) {
      console.error(
        "[KisanAI] crop recommendation failed:",
        error
      );

      if (box) {
        box.innerHTML = `
          <div style="color:#ef4444;padding:10px;">
            ${escapeHtml(
          error.message ||
          "Recommendation service unavailable."
        )}
          </div>
        `;
      }
    }
  }

  function renderYield(data) {
    const box = byId("yieldResult");

    if (!box) return;

    const index = finite(
      data.yield_index ??
      data.yieldScore ??
      data.productivity_index
    );

    const rating = text(
      data.productivity_rating ||
      data.rating,
      index == null
        ? "Indicative"
        : index >= 80
          ? "Favorable"
          : index >= 60
            ? "Moderately favorable"
            : "Needs attention"
    );

    const limiting = text(
      data.limiting_factor ||
      data.limitingFactor,
      "No single limiting factor identified."
    );

    const fungal = text(
      data.fungal_blight_risk ||
      data.fungal_risk,
      "Not assessed"
    );

    const recommendations = Array.isArray(
      data.agronomic_recommendations
    )
      ? data.agronomic_recommendations
      : [];

    const recHtml = recommendations
      .map(
        (item) =>
          `<li>${escapeHtml(item)}</li>`
      )
      .join("");

    const color =
      index == null
        ? "#94a3b8"
        : index >= 80
          ? "var(--accent-green)"
          : index >= 60
            ? "var(--accent-cyan)"
            : "#fbbf24";

    box.innerHTML = `
      <div class="yield-gauge-card">

        <div class="yield-score-header">

          <div>

            <div style="font-size:.8rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">
              Environmental Suitability
            </div>

            <div class="yield-score-big" style="color:${color};">
              ${index == null ? "—" : index}

              <span style="font-size:1.1rem;color:#94a3b8;font-weight:400;">
                / 100
              </span>
            </div>

          </div>

          <div style="text-align:right;">

            <span style="font-size:.75rem;background:rgba(255,255,255,.08);padding:4px 10px;border-radius:12px;color:#fff;font-weight:600;display:inline-block;">
              ${escapeHtml(rating)}
            </span>

            <div style="font-size:.75rem;color:#94a3b8;margin-top:4px;">
              ${escapeHtml(
      text(
        data.potential_growth_index,
        "Climate suitability index"
      )
    )}
            </div>

          </div>

        </div>

        <div style="background:rgba(0,0,0,.3);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:.82rem;color:#e2e8f0;line-height:1.5;">

          <div style="color:var(--accent-cyan);font-weight:700;margin-bottom:2px;">
            🔬 Limiting Factor:
          </div>

          ${escapeHtml(limiting)}

        </div>

        <div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:.82rem;color:#fde68a;line-height:1.5;">

          <b>🦠 Blight & Mildew Pressure:</b>
          ${escapeHtml(fungal)}

        </div>

        ${recHtml
        ? `
              <div style="font-size:.82rem;color:#cbd5e1;margin-top:8px;">

                <b style="color:#fff;">
                  📋 Recommended Crop Management:
                </b>

                <ul style="margin:4px 0 0 16px;padding:0;line-height:1.5;">
                  ${recHtml}
                </ul>

              </div>
            `
        : ""
      }

        <div style="font-size:.72rem;color:#94a3b8;margin-top:10px;">
          ${escapeHtml(
        text(
          data.confidence_note,
          "Indicative environmental suitability; this is not a validated yield forecast."
        )
      )}
        </div>

      </div>
    `;
  }

  async function predictYieldCanonical() {
    const box = byId("yieldResult");

    const humidity = finite(
      byId("yieldHumidityInput")?.value
    );

    const rainfall = finite(
      byId("yieldRainInput")?.value
    );

    if (humidity == null || rainfall == null) {
      if (box) {
        box.innerHTML = `
          <div style="color:#fbbf24;padding:10px;">
            Please enter valid humidity and rainfall values.
          </div>
        `;
      }

      return;
    }

    if (box) {
      box.innerHTML = `
        <div style="padding:14px;color:var(--accent-cyan);text-align:center;">
          ⏳ Computing environmental suitability...
        </div>
      `;
    }

    try {
      const response = await fetch(
        "/predict_yield?_schema=20260910",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },

          credentials: "same-origin",
          cache: "no-store",

          body: JSON.stringify({
            humidity,
            rainfall,
            temp: 25,
            crop: "Agricultural Crops"
          })
        }
      );

      const data = await responseObject(response);

      renderYield(data);

      console.info(
        "[KisanAI] yield response:",
        data
      );
    } catch (error) {
      console.error(
        "[KisanAI] yield calculation failed:",
        error
      );

      if (box) {
        box.innerHTML = `
          <div style="color:#ef4444;padding:10px;">
            ${escapeHtml(
          error.message ||
          "Yield service unavailable."
        )}
          </div>
        `;
      }
    }
  }

  // Install compatibility handlers only when newer handlers
  // are not already present.
  if (typeof window.recommendCrop !== "function") {
    window.recommendCrop = recommendCropCanonical;
  }

  if (typeof window.predictYield !== "function") {
    window.predictYield = predictYieldCanonical;
  }

  // =========================================================
  // LIVE DISEASE SCANNER
  // =========================================================

  let liveStream = null;
  let liveFacing = "environment";
  let liveBusy = false;
  let liveFrozen = false;
  let liveTimer = null;
  let torchOn = false;
  let liveScanGeneration = 0;

  const MIN_SCAN_INTERVAL = 15000;

  let lastScanStartedAt = 0;

  function liveStatus(message, state) {
    const element = byId("hudStatusText");
    const dot = byId("hudBlinkDot");

    if (element) {
      element.innerText = message;
    }

    if (dot) {
      dot.style.background =
        state === "error"
          ? "#ef4444"
          : state === "busy"
            ? "#f59e0b"
            : "#00e676";
    }
  }

  function stopTracks() {
    if (liveStream) {
      for (const track of liveStream.getTracks()) {
        track.stop();
      }

      liveStream = null;
    }

    const video = byId("liveCameraVideo");

    if (video) {
      video.srcObject = null;
    }
  }

  function stopAuto() {
    if (liveTimer) {
      clearInterval(liveTimer);
    }

    liveTimer = null;
    liveBusy = false;
    liveScanGeneration += 1;

    const check = byId("chkAutoScan");

    if (check) {
      check.checked = false;
    }
  }

  async function startLiveCameraStream() {
    const video = byId("liveCameraVideo");

    if (!video) {
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      liveStatus(
        "Camera is not supported by this browser",
        "error"
      );

      return false;
    }

    stopAuto();
    stopTracks();

    liveFrozen = false;
    torchOn = false;

    try {
      liveStatus(
        "Activating camera...",
        "busy"
      );

      liveStream =
        await navigator.mediaDevices.getUserMedia({
          audio: false,

          video: {
            facingMode: {
              ideal: liveFacing
            },

            width: {
              ideal: 1280,
              max: 1920
            },

            height: {
              ideal: 720,
              max: 1080
            }
          }
        });

      video.srcObject = liveStream;
      video.muted = true;
      video.playsInline = true;

      await video.play();

      liveStatus(
        "Camera ready • center the crop leaf",
        "ok"
      );

      return true;
    } catch (error) {
      console.warn(
        "Live camera error:",
        error
      );

      const message =
        error?.name === "NotAllowedError"
          ? "Camera permission denied • allow camera access"
          : error?.name === "NotReadableError"
            ? "Camera is busy • close other camera apps"
            : "Unable to start camera";

      liveStatus(message, "error");

      return false;
    }
  }

  function stopLiveCameraStream() {
    stopAuto();
    stopTracks();

    liveFrozen = false;
    torchOn = false;

    liveStatus(
      "Live scanner stopped",
      "ok"
    );
  }

  async function flipLiveCamera() {
    liveFacing =
      liveFacing === "environment"
        ? "user"
        : "environment";

    await startLiveCameraStream();
  }

  async function toggleTorch() {
    const track =
      liveStream?.getVideoTracks?.()[0];

    if (!track) {
      return showToastNoticeSafe(
        "Start the live camera first."
      );
    }

    try {
      const capabilities =
        track.getCapabilities?.() || {};

      if (!capabilities.torch) {
        return showToastNoticeSafe(
          "Torch is not available on this camera."
        );
      }

      torchOn = !torchOn;

      await track.applyConstraints({
        advanced: [
          {
            torch: torchOn
          }
        ]
      });

      const button = byId("btnTorch");

      if (button) {
        button.innerText = torchOn
          ? "💡 Light ON"
          : "💡 Torch";
      }
    } catch (error) {
      console.warn(
        "Torch error:",
        error
      );

      showToastNoticeSafe(
        "Torch control is not supported by this device/browser."
      );
    }
  }

  function toggleFreezeLiveStream() {
    const video = byId("liveCameraVideo");

    if (!video || !liveStream) {
      return;
    }

    liveFrozen = !liveFrozen;

    if (liveFrozen) {
      video.pause();

      liveStatus(
        "Frame frozen • press Resume to continue",
        "busy"
      );

      const button = byId("btnFreeze");

      if (button) {
        button.innerText = "▶️ Resume";
      }
    } else {
      video.play().catch(() => { });

      liveStatus(
        "Live camera active • ready to scan",
        "ok"
      );

      const button = byId("btnFreeze");

      if (button) {
        button.innerText = "⏸️ Freeze";
      }
    }
  }

  function makeLiveFrame(video) {
    if (
      !video ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return null;
    }

    const maxWidth = 640;

    const scale = Math.min(
      1,
      maxWidth / video.videoWidth
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = Math.max(
      1,
      Math.round(video.videoWidth * scale)
    );

    canvas.height = Math.max(
      1,
      Math.round(video.videoHeight * scale)
    );

    const context =
      canvas.getContext("2d", {
        alpha: false
      });

    if (!context) {
      return null;
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        resolve,
        "image/jpeg",
        0.68
      );
    });
  }

  async function performLiveFrameAnalysis() {
    const video =
      byId("liveCameraVideo");

    const card =
      byId("liveDiagnosisCard");

    const button =
      byId("btnLiveInstantScan");

    if (
      !video ||
      !liveStream ||
      liveFrozen ||
      liveBusy ||
      !video.videoWidth
    ) {
      return null;
    }

    const elapsed =
      Date.now() - lastScanStartedAt;

    if (elapsed < MIN_SCAN_INTERVAL) {
      liveStatus(
        `⏳ Scan limit: wait ${Math.ceil(
          (MIN_SCAN_INTERVAL - elapsed) / 1000
        )}s (5 RPM quota)`,
        "busy"
      );

      return null;
    }

    liveBusy = true;
    lastScanStartedAt = Date.now();

    const generation =
      liveScanGeneration;

    if (button) {
      button.disabled = true;
    }

    liveStatus(
      "🔬 Inspecting crop...",
      "busy"
    );

    try {
      const blob =
        await makeLiveFrame(video);

      if (
        !blob ||
        generation !== liveScanGeneration
      ) {
        return null;
      }

      const file = new File(
        [blob],
        "live-field-specimen.jpg",
        {
          type: "image/jpeg"
        }
      );

      const form = new FormData();

      form.append(
        "image",
        file
      );

      form.append(
        "method",
        byId("treatmentMethodSelect")?.value ||
        "Chemical"
      );

      form.append(
        "lang",
        window.currentLanguage || "en"
      );

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          12000
        );

      let response;

      try {
        response = await fetch(
          "/predict",
          {
            method: "POST",
            body: form,
            signal: controller.signal,
            cache: "no-store"
          }
        );
      } finally {
        clearTimeout(timeout);
      }

      let data = null;

      try {
        data = await response.json();
      } catch (_) {
        // Handled by empty-response check.
      }

      if (!data) {
        throw new Error(
          "Empty diagnosis response"
        );
      }

      if (data.is_plant === false) {
        window.latestDiagnosisData =
          data;

        liveStatus(
          `⚠️ No plant detected • ${data.detected_subject ||
          "aim at a crop leaf"
          }`,
          "busy"
        );

        if (
          card &&
          typeof window.generateDiagnosisCardMarkup ===
          "function"
        ) {
          card.innerHTML =
            window.generateDiagnosisCardMarkup(
              data,
              "live"
            );
        }

        return data;
      }

      if (!data.success) {
        const message =
          data.error ||
          "AI could not identify this frame";

        liveStatus(
          message.length > 75
            ? `${message.slice(0, 72)}...`
            : message,
          "error"
        );

        return data;
      }

      window.latestDiagnosisData =
        data;

      const insect =
        data.is_insect_caused ||
        String(data.category || "").includes(
          "Insect"
        );

      liveStatus(
        `✅ ${insect
          ? "🐛 Pest"
          : "🌿 Diagnosis"
        }: ${data.disease || "Detected"
        } • ${data.severity || ""
        }`,
        "ok"
      );

      if (
        card &&
        typeof window.generateDiagnosisCardMarkup ===
        "function"
      ) {
        card.innerHTML =
          window.generateDiagnosisCardMarkup(
            data,
            "live"
          );
      }

      if (
        typeof window.saveDiagnosisToFirestore ===
        "function"
      ) {
        window.saveDiagnosisToFirestore(
          data
        ).catch((error) => {
          console.warn(
            "Live history save note:",
            error
          );
        });
      }

      return data;
    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        liveStatus(
          "Scan timed out • hold the leaf steady and retry",
          "error"
        );
      } else if (
        error?.message === "Failed to fetch"
      ) {
        liveStatus(
          "Network connection lost • retry when online",
          "error"
        );
      } else {
        console.warn(
          "Live scan error:",
          error
        );

        liveStatus(
          "Scan failed • hold camera steady and retry",
          "error"
        );
      }

      return null;
    } finally {
      liveBusy = false;

      if (button) {
        button.disabled = false;
      }
    }
  }

  function toggleAutoLiveScan(enabled) {
    if (liveTimer) {
      clearInterval(liveTimer);
    }

    liveTimer = null;
    liveScanGeneration += 1;

    const check =
      byId("chkAutoScan");

    if (check) {
      check.checked = !!enabled;
    }

    if (!enabled) {
      liveBusy = false;

      if (liveStream) {
        liveStatus(
          "Live camera active • ready to scan",
          "ok"
        );
      }

      return;
    }

    if (!liveStream) {
      if (check) {
        check.checked = false;
      }

      liveStatus(
        "Start the camera before Auto-Scan",
        "error"
      );

      return;
    }

    liveStatus(
      "🔁 Auto-Scan active • one scan every 15s",
      "ok"
    );

    performLiveFrameAnalysis();

    liveTimer = setInterval(() => {
      if (
        !liveBusy &&
        !liveFrozen &&
        liveStream
      ) {
        performLiveFrameAnalysis();
      }
    }, MIN_SCAN_INTERVAL);
  }

  function switchScannerMode(mode) {
    const live =
      String(mode).toLowerCase() === "live";

    byId("tabUploadMode")
      ?.classList.toggle(
        "active",
        !live
      );

    byId("tabLiveMode")
      ?.classList.toggle(
        "active",
        live
      );

    byId("photoUploadPanel")
      ?.classList.toggle(
        "hidden",
        live
      );

    byId("liveScannerPanel")
      ?.classList.toggle(
        "hidden",
        !live
      );

    if (live) {
      startLiveCameraStream();
    } else {
      stopLiveCameraStream();
    }
  }

  function showToastNoticeSafe(message) {
    try {
      if (
        typeof window.showToastNotice ===
        "function"
      ) {
        return window.showToastNotice(
          message
        );
      }
    } catch (_) {
      // Fall back to console.
    }

    console.warn(message);
  }

  // Expose live scanner handlers.
  window.startLiveCameraStream =
    startLiveCameraStream;

  window.stopLiveCameraStream =
    stopLiveCameraStream;

  window.switchScannerMode =
    switchScannerMode;

  window.flipLiveCamera =
    flipLiveCamera;

  window.toggleTorch =
    toggleTorch;

  window.toggleFreezeLiveStream =
    toggleFreezeLiveStream;

  window.performLiveFrameAnalysis =
    performLiveFrameAnalysis;

  window.toggleAutoLiveScan =
    toggleAutoLiveScan;

  window.__KISAN_DASHBOARD_BINDINGS__ =
    "2026-09-11-crop-yield-handler-guard";
})();