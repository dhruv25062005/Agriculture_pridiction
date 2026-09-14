/* 
 * Crop Recommendation UI
 * Version: 2026-09-14-crop-ui-v8
 *
 * Features:
 * - Climate-based crop ranking
 * - Temperature + rainfall compatibility
 * - Drought-aware scoring
 * - Excess-rainfall penalty
 * - Extreme-temperature penalty
 * - Crop resilience weighting
 * - Minimum viability protection
 * - Stable deterministic ranking
 * - Server result validation
 * - Local fallback when API fails
 * - Optimized DOM access and rendering
 */

(() => {
  "use strict";

  const VERSION = "2026-09-14-crop-ui-v8";

  if (window.__KISAN_CROP_UI__ === VERSION) {
    return;
  }

  window.__KISAN_CROP_UI__ = VERSION;

  /* =========================================================
     Utilities
  ========================================================= */

  const $ = (id) => document.getElementById(id);

  const escapeHtml = (value) => {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return map[char] || char;
    });
  };

  const toNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  };

  const safeText = (value, fallback = "") => {
    const result = String(value ?? "").trim();

    return result || fallback;
  };

  const clamp = (value, min = 0, max = 100) => {
    return Math.min(max, Math.max(min, value));
  };

  const round = (value) => {
    return Math.round(value);
  };

  /* =========================================================
     Crop profiles
     
     temp:
       preferred temperature range in °C

     rain:
       preferred seasonal rainfall range in mm

     season:
       normal growing season

     water:
       relative water requirement

     resilience:
       drought resilience

     extremeHeat:
       ability to tolerate heat

     excessRain:
       tolerance to excessive rainfall
  ========================================================= */

  const CROP_PROFILES = Object.freeze([
    {
      crop: "Pearl millet (Bajra)",
      temp: [25, 35],
      rain: [200, 500],
      season: "Kharif/Summer",
      water: "Low",
      resilience: 1.00,
      extremeHeat: 0.95,
      excessRain: 0.55
    },

    {
      crop: "Sorghum (Jowar)",
      temp: [20, 32],
      rain: [250, 600],
      season: "Kharif/Rabi",
      water: "Low-Moderate",
      resilience: 0.90,
      extremeHeat: 0.85,
      excessRain: 0.60
    },

    {
      crop: "Chickpea",
      temp: [18, 26],
      rain: [300, 500],
      season: "Rabi",
      water: "Low",
      resilience: 0.85,
      extremeHeat: 0.45,
      excessRain: 0.45
    },

    {
      crop: "Mustard",
      temp: [10, 25],
      rain: [300, 500],
      season: "Rabi",
      water: "Low",
      resilience: 0.80,
      extremeHeat: 0.40,
      excessRain: 0.45
    },

    {
      crop: "Wheat",
      temp: [15, 24],
      rain: [350, 550],
      season: "Rabi",
      water: "Moderate",
      resilience: 0.55,
      extremeHeat: 0.35,
      excessRain: 0.45
    },

    {
      crop: "Rice",
      temp: [24, 30],
      rain: [900, 1400],
      season: "Kharif",
      water: "High",
      resilience: 0.20,
      extremeHeat: 0.70,
      excessRain: 0.90
    },

    {
      crop: "Maize",
      temp: [20, 30],
      rain: [500, 800],
      season: "Kharif/Summer",
      water: "Moderate",
      resilience: 0.55,
      extremeHeat: 0.65,
      excessRain: 0.60
    },

    {
      crop: "Tomato",
      temp: [18, 28],
      rain: [400, 700],
      season: "Rabi/Summer",
      water: "Moderate",
      resilience: 0.35,
      extremeHeat: 0.40,
      excessRain: 0.40
    },

    {
      crop: "Potato",
      temp: [15, 23],
      rain: [450, 700],
      season: "Rabi",
      water: "Moderate",
      resilience: 0.35,
      extremeHeat: 0.25,
      excessRain: 0.40
    },

    {
      crop: "Cotton",
      temp: [21, 32],
      rain: [500, 900],
      season: "Kharif",
      water: "Moderate",
      resilience: 0.60,
      extremeHeat: 0.75,
      excessRain: 0.65
    },

    {
      crop: "Soybean",
      temp: [20, 30],
      rain: [450, 700],
      season: "Kharif",
      water: "Moderate",
      resilience: 0.50,
      extremeHeat: 0.60,
      excessRain: 0.60
    },

    {
      crop: "Groundnut",
      temp: [24, 30],
      rain: [500, 1000],
      season: "Kharif/Summer",
      water: "Moderate",
      resilience: 0.65,
      extremeHeat: 0.80,
      excessRain: 0.55
    },

    {
      crop: "Pigeon pea (Arhar)",
      temp: [20, 30],
      rain: [600, 1000],
      season: "Kharif",
      water: "Moderate",
      resilience: 0.75,
      extremeHeat: 0.80,
      excessRain: 0.60
    },

    {
      crop: "Lentil",
      temp: [18, 25],
      rain: [300, 500],
      season: "Rabi",
      water: "Low",
      resilience: 0.80,
      extremeHeat: 0.40,
      excessRain: 0.45
    },

    {
      crop: "Onion",
      temp: [13, 25],
      rain: [350, 700],
      season: "Rabi/Kharif",
      water: "Moderate",
      resilience: 0.40,
      extremeHeat: 0.45,
      excessRain: 0.45
    },

    {
      crop: "Sugarcane",
      temp: [20, 32],
      rain: [1000, 2000],
      season: "Long duration",
      water: "Very high",
      resilience: 0.20,
      extremeHeat: 0.75,
      excessRain: 0.75
    },

    {
      crop: "Banana",
      temp: [20, 35],
      rain: [1000, 2500],
      season: "Whole year",
      water: "High",
      resilience: 0.20,
      extremeHeat: 0.85,
      excessRain: 0.80
    },

    {
      crop: "Chilli",
      temp: [20, 30],
      rain: [500, 1000],
      season: "Kharif/Rabi",
      water: "Moderate",
      resilience: 0.45,
      extremeHeat: 0.55,
      excessRain: 0.45
    },

    {
      crop: "Sesame",
      temp: [25, 35],
      rain: [400, 700],
      season: "Kharif",
      water: "Low",
      resilience: 0.90,
      extremeHeat: 0.90,
      excessRain: 0.40
    },

    {
      crop: "Sunflower",
      temp: [20, 30],
      rain: [400, 700],
      season: "Rabi/Kharif",
      water: "Moderate",
      resilience: 0.65,
      extremeHeat: 0.70,
      excessRain: 0.50
    }
  ]);

  /* =========================================================
     Climate calculations
  ========================================================= */

  /*
   * Calculates compatibility with a preferred range.
   *
   * 100 = ideal
   * 80-99 = very good
   * 60-79 = acceptable
   * 40-59 = weak
   * <40 = poor
   */
  function rangeFit(value, range) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const min = range[0];
    const max = range[1];

    if (value >= min && value <= max) {
      const midpoint = (min + max) / 2;
      const halfRange = Math.max((max - min) / 2, 0.1);

      const distance = Math.abs(value - midpoint) / halfRange;

      return clamp(
        100 - (20 * distance * distance)
      );
    }

    /*
     * Outside preferred range.
     * Do not immediately give zero because some crops
     * can survive outside their optimal climate.
     */
    if (value < min) {
      const distance = min - value;
      const width = Math.max(max - min, 1);

      return clamp(
        80 * Math.exp(-(distance / width) * 1.35)
      );
    }

    const distance = value - max;
    const width = Math.max(max - min, 1);

    return clamp(
      80 * Math.exp(-(distance / width) * 1.35)
    );
  }

  /*
   * Rainfall score.
   *
   * Important difference from the old implementation:
   * drought resilience helps a crop, but it cannot completely
   * hide a severe rainfall mismatch.
   */
  function rainfallFit(rainfall, profile) {
    const [minRain, maxRain] = profile.rain;

    const base = rangeFit(rainfall, profile.rain);

    /* Severe drought */
    if (rainfall < minRain) {
      const deficit = (minRain - rainfall) / Math.max(minRain, 1);

      /*
       * Maximum resilience bonus is deliberately limited.
       * A drought-resistant crop should rank higher,
       * but extremely low rainfall should still hurt.
       */
      const resilienceBonus =
        profile.resilience *
        Math.min(deficit, 1) *
        12;

      const droughtPenalty =
        Math.min(deficit, 1.5) * 12;

      return clamp(
        base + resilienceBonus - droughtPenalty
      );
    }

    /* Excess rainfall */
    if (rainfall > maxRain) {
      const excess =
        (rainfall - maxRain) / Math.max(maxRain, 1);

      const excessTolerance =
        profile.excessRain * Math.min(excess, 1) * 8;

      const excessPenalty =
        Math.min(excess, 1.5) * 10;

      return clamp(
        base + excessTolerance - excessPenalty
      );
    }

    return clamp(base);
  }

  /*
   * Heat stress score.
   *
   * This prevents a crop from receiving a high overall
   * score simply because rainfall happens to be suitable.
   */
  function heatStressFit(temp, profile) {
    const [minTemp, maxTemp] = profile.temp;

    if (temp <= maxTemp) {
      return 100;
    }

    const excess =
      temp - maxTemp;

    /*
     * Crop-specific heat tolerance.
     */
    const tolerance =
      2 + (profile.extremeHeat * 5);

    if (excess <= tolerance) {
      return clamp(
        100 - (excess / tolerance) * 20
      );
    }

    const severity =
      (excess - tolerance) / 10;

    return clamp(
      80 - (severity * 45 * (1 - profile.extremeHeat))
    );
  }

  /*
   * Cold stress score.
   */
  function coldStressFit(temp, profile) {
    const [minTemp] = profile.temp;

    if (temp >= minTemp) {
      return 100;
    }

    const deficit = minTemp - temp;

    const tolerance = 2;

    if (deficit <= tolerance) {
      return 90;
    }

    return clamp(
      90 - ((deficit - tolerance) * 12)
    );
  }

  /*
   * Overall temperature score.
   *
   * Combines preferred range with heat/cold stress.
   */
  function temperatureFit(temp, profile) {
    const base = rangeFit(temp, profile.temp);

    const heat = heatStressFit(temp, profile);
    const cold = coldStressFit(temp, profile);

    return clamp(
      base * 0.60 +
      heat * 0.25 +
      cold * 0.15
    );
  }

  /*
   * Detect climate stress.
   */
  function climateStress(temp, rainfall) {
    const drought =
      rainfall < 350;

    const severeDrought =
      rainfall < 200;

    const extremeHeat =
      temp >= 38;

    const extremeCold =
      temp <= 10;

    const excessRain =
      rainfall >= 1500;

    return {
      drought,
      severeDrought,
      extremeHeat,
      extremeCold,
      excessRain
    };
  }

  /* =========================================================
     Dynamic scoring
  ========================================================= */

  function calculateCropScore(temp, rainfall, profile) {
    const stress = climateStress(temp, rainfall);

    const tempScore =
      temperatureFit(temp, profile);

    const rainScore =
      rainfallFit(rainfall, profile);

    /*
     * Base weighting.
     *
     * Rainfall gets slightly more importance because
     * water availability is a major crop suitability factor.
     */
    let temperatureWeight = 0.45;
    let rainfallWeight = 0.55;

    /*
     * During drought, prioritize rainfall compatibility
     * and drought resilience.
     */
    if (stress.drought) {
      temperatureWeight = 0.40;
      rainfallWeight = 0.60;
    }

    /*
     * During extreme heat, temperature becomes more important.
     */
    if (stress.extremeHeat) {
      temperatureWeight += 0.08;
      rainfallWeight -= 0.08;
    }

    const climateScore =
      tempScore * temperatureWeight +
      rainScore * rainfallWeight;

    /*
     * Resilience adjustment.
     *
     * Only applied meaningfully during drought.
     */
    let resilienceBonus = 0;

    if (stress.drought) {
      resilienceBonus =
        profile.resilience *
        (stress.severeDrought ? 8 : 5);
    }

    /*
     * Extreme heat tolerance.
     */
    let heatBonus = 0;

    if (stress.extremeHeat) {
      heatBonus =
        profile.extremeHeat * 5;
    }

    /*
     * Avoid allowing bonuses to overpower
     * actual climate compatibility.
     */
    const rawScore =
      climateScore +
      resilienceBonus +
      heatBonus;

    /*
     * Severe climate mismatch protection.
     *
     * A crop should not receive a high score when both
     * temperature and rainfall are poor.
     */
    const minimumFit =
      Math.min(tempScore, rainScore);

    let score = rawScore;

    if (minimumFit < 30) {
      score *= 0.65;
    } else if (minimumFit < 45) {
      score *= 0.82;
    }

    /*
     * Very severe drought.
     *
     * Water-intensive crops should be penalized.
     */
    if (stress.severeDrought) {
      if (
        profile.water === "High" ||
        profile.water === "Very high"
      ) {
        score -= 12;
      }

      if (profile.water === "Moderate") {
        score -= 5;
      }
    }

    /*
     * Clamp final score.
     */
    score = clamp(score);

    return {
      crop: profile.crop,
      score: round(score),

      temperature_fit: round(clamp(tempScore)),
      rainfall_fit: round(clamp(rainScore)),

      season: profile.season,
      water_requirement: profile.water,
      resilience:
        profile.resilience >= 0.8
          ? "high"
          : profile.resilience >= 0.5
            ? "moderate"
            : "low",

      temperature_range_c: [...profile.temp],
      rainfall_range_mm: [...profile.rain],

      stress
    };
  }

  /* =========================================================
     Ranking
  ========================================================= */

  function rankCrops(temp, rainfall) {
    return CROP_PROFILES
      .map((profile, index) => {
        const result =
          calculateCropScore(
            temp,
            rainfall,
            profile
          );

        /*
         * Stable secondary sorting:
         *
         * 1. Overall score
         * 2. Temperature fit
         * 3. Rainfall fit
         * 4. Original profile order
         */
        return {
          ...result,
          _index: index
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (
          b.temperature_fit !==
          a.temperature_fit
        ) {
          return (
            b.temperature_fit -
            a.temperature_fit
          );
        }

        if (
          b.rainfall_fit !==
          a.rainfall_fit
        ) {
          return (
            b.rainfall_fit -
            a.rainfall_fit
          );
        }

        return a._index - b._index;
      })
      .map(({ _index, ...crop }) => crop);
  }

  /* =========================================================
     Labels
  ========================================================= */

  function suitabilityLabel(score) {
    if (score >= 85) {
      return "Highly favorable";
    }

    if (score >= 75) {
      return "Favorable";
    }

    if (score >= 65) {
      return "Good climate fit";
    }

    if (score >= 50) {
      return "Marginal — management may be needed";
    }

    if (score >= 35) {
      return "Limited climate fit";
    }

    return "Poor climate fit";
  }

  function confidenceLabel(best, alternatives) {
    if (!best) {
      return "Low";
    }

    const second =
      alternatives?.[0]?.score ?? 0;

    const gap =
      best.score - second;

    if (
      best.score >= 80 &&
      gap >= 8
    ) {
      return "High";
    }

    if (
      best.score >= 65 &&
      gap >= 4
    ) {
      return "Moderate";
    }

    return "Low";
  }

  /* =========================================================
     Recommendation explanation
  ========================================================= */

  function generateReason(result, temp, rainfall) {
    const reasons = [];

    const [
      minTemp,
      maxTemp
    ] = result.temperature_range_c;

    const [
      minRain,
      maxRain
    ] = result.rainfall_range_mm;

    if (temp < minTemp) {
      reasons.push(
        `temperature is ${round(minTemp - temp)}°C below its preferred lower range`
      );
    } else if (temp > maxTemp) {
      reasons.push(
        `temperature is ${round(temp - maxTemp)}°C above its preferred upper range`
      );
    } else {
      reasons.push(
        "temperature is within its preferred range"
      );
    }

    if (rainfall < minRain) {
      reasons.push(
        `rainfall is about ${round(minRain - rainfall)} mm below its typical lower range`
      );
    } else if (rainfall > maxRain) {
      reasons.push(
        `rainfall is about ${round(rainfall - maxRain)} mm above its typical upper range`
      );
    } else {
      reasons.push(
        "rainfall is within its preferred range"
      );
    }

    if (
      rainfall < minRain &&
      result.resilience === "high"
    ) {
      reasons.push(
        "its higher drought resilience improves its ranking"
      );
    }

    return `${result.crop} ranks highest because ${reasons.join(
      ", "
    )}.`;
  }

  /* =========================================================
     Stress warning
  ========================================================= */

  function generateWarning(temp, rainfall, best) {
    const warnings = [];

    if (rainfall < 200) {
      warnings.push(
        "Severe rainfall deficit: irrigation or moisture conservation may be essential."
      );
    } else if (rainfall < 350) {
      warnings.push(
        "Low rainfall: prioritize drought-tolerant crops and efficient water management."
      );
    }

    if (temp >= 40) {
      warnings.push(
        "Extreme heat conditions: heat-tolerant varieties and irrigation management may be required."
      );
    } else if (temp >= 35) {
      warnings.push(
        "High temperature conditions may cause heat stress in sensitive crops."
      );
    }

    if (rainfall >= 1500) {
      warnings.push(
        "Very high rainfall: drainage and waterlogging tolerance should be considered."
      );
    }

    if (
      best &&
      best.score < 50
    ) {
      warnings.push(
        "No screened crop has a strong climate match for these conditions."
      );
    }

    return warnings;
  }

  /* =========================================================
     Server response validation
  ========================================================= */

  function isValidServerResponse(data) {
    if (
      !data ||
      typeof data !== "object"
    ) {
      return false;
    }

    if (data.success !== true) {
      return false;
    }

    const score =
      toNumber(data.score);

    const tempFit =
      toNumber(data.temperature_fit);

    const rainFit =
      toNumber(data.rainfall_fit);

    if (
      score === null ||
      tempFit === null ||
      rainFit === null
    ) {
      return false;
    }

    if (
      score < 0 ||
      score > 100 ||
      tempFit < 0 ||
      tempFit > 100 ||
      rainFit < 0 ||
      rainFit > 100
    ) {
      return false;
    }

    if (
      typeof data.season !== "string" ||
      typeof data.water_requirement !== "string"
    ) {
      return false;
    }

    return true;
  }

  /* =========================================================
     Rendering
  ========================================================= */

  function renderRecommendation(
    data,
    source,
    temp,
    rainfall
  ) {
    const output = $("cropResult");

    if (!output) {
      return;
    }

    const score =
      toNumber(data.score);

    const crop =
      safeText(
        data.crop ||
        data.recommendation,
        "Best available crop"
      );

    const temperatureFitValue =
      toNumber(data.temperature_fit);

    const rainfallFitValue =
      toNumber(data.rainfall_fit);

    const season =
      safeText(
        data.season,
        "Not available"
      );

    const water =
      safeText(
        data.water_requirement,
        "Not available"
      );

    const label =
      safeText(
        data.suitability_label,
        suitabilityLabel(
          score ?? 0
        )
      );

    const alternatives =
      Array.isArray(data.alternatives)
        ? data.alternatives
        : [];

    const confidence =
      confidenceLabel(
        data,
        alternatives
      );

    const reason =
      safeText(
        data.note,
        generateReason(
          data,
          temp,
          rainfall
        )
      );

    const warnings =
      generateWarning(
        temp,
        rainfall,
        data
      );

    const alternativeHtml =
      alternatives
        .slice(0, 4)
        .map((item) => {
          const itemCrop =
            safeText(
              item?.crop,
              "Unknown crop"
            );

          const itemScore =
            toNumber(item?.score);

          return `
            <span
              style="
                display:inline-block;
                padding:6px 10px;
                margin:3px;
                border-radius:10px;
                background:rgba(255,255,255,.07);
              "
            >
              ${escapeHtml(itemCrop)}
              · ${itemScore ?? "—"}/100
            </span>
          `;
        })
        .join("");

    const warningHtml =
      warnings.length
        ? `
          <div
            style="
              margin-top:10px;
              padding:9px 11px;
              border-radius:9px;
              background:rgba(245,158,11,.10);
              border:1px solid rgba(245,158,11,.25);
              font-size:.82rem;
            "
          >
            <b>Climate note:</b>
            ${warnings
          .map(
            (warning) =>
              `<div style="margin-top:4px">
                    ${escapeHtml(warning)}
                  </div>`
          )
          .join("")}
          </div>
        `
        : "";

    output.innerHTML = `
      <div
        style="
          padding:14px;
          border-radius:12px;
          border:1px solid rgba(52,211,153,.4);
          background:rgba(16,185,129,.08);
        "
      >

        <div
          style="
            font-size:1.2rem;
            font-weight:700;
            color:var(--accent-green);
          "
        >
          ${escapeHtml(crop)}
        </div>

        <div style="margin-top:6px">
          Climate suitability:
          <b>${score ?? "—"}/100</b>
          · ${escapeHtml(label)}
        </div>

        <div style="margin-top:7px">
          🌡️ Temperature fit:
          <b>${temperatureFitValue ?? "—"}/100</b>
        </div>

        <div style="margin-top:4px">
          🌧️ Rainfall fit:
          <b>${rainfallFitValue ?? "—"}/100</b>
        </div>

        <div style="margin-top:5px">
          🌱 Typical season:
          <b>${escapeHtml(season)}</b>
        </div>

        <div style="margin-top:4px">
          💧 Water demand:
          <b>${escapeHtml(water)}</b>
        </div>

        <div style="margin-top:4px">
          🎯 Recommendation confidence:
          <b>${escapeHtml(confidence)}</b>
        </div>

        ${alternativeHtml
        ? `
              <div
                style="
                  margin-top:10px;
                  font-size:.84rem;
                "
              >
                Other suitable crops:
              </div>

              <div>
                ${alternativeHtml}
              </div>
            `
        : ""
      }

        <div
          style="
            margin-top:10px;
            font-size:.82rem;
            opacity:.82;
            line-height:1.45;
          "
        >
          ${escapeHtml(reason)}
        </div>

        ${warningHtml}

      </div>
    `;
  }

  /* =========================================================
     Local fallback
  ========================================================= */

  function buildLocalRecommendation(
    temp,
    rainfall
  ) {
    const ranked =
      rankCrops(
        temp,
        rainfall
      );

    const best =
      ranked[0];

    return {
      crop: best.crop,
      score: best.score,

      suitability_label:
        suitabilityLabel(
          best.score
        ),

      temperature_fit:
        best.temperature_fit,

      rainfall_fit:
        best.rainfall_fit,

      season:
        best.season,

      water_requirement:
        best.water_requirement,

      resilience:
        best.resilience,

      temperature_range_c:
        best.temperature_range_c,

      rainfall_range_mm:
        best.rainfall_range_mm,

      alternatives:
        ranked.slice(1, 5),

      note:
        generateReason(
          best,
          temp,
          rainfall
        )
    };
  }

  /* =========================================================
     API request
  ========================================================= */

  async function requestServerRecommendation(
    temp,
    rainfall
  ) {
    const controller =
      new AbortController();

    /*
     * Prevent the UI from waiting indefinitely
     * for the server.
     */
    const timeout =
      window.setTimeout(
        () => controller.abort(),
        8000
      );

    try {
      const response =
        await fetch(
          "/recommend_crop",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Accept":
                "application/json"
            },

            credentials:
              "same-origin",

            cache:
              "no-store",

            signal:
              controller.signal,

            body:
              JSON.stringify({
                temp,
                rainfall
              })
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !isValidServerResponse(data)
      ) {
        return null;
      }

      return data;

    } finally {
      window.clearTimeout(
        timeout
      );
    }
  }

  /* =========================================================
     Main recommendation function
  ========================================================= */

  async function recommendCrop() {
    const output =
      $("cropResult");

    const temperatureInput =
      $("cropTempInput");

    const rainfallInput =
      $("cropRainInput");

    const button =
      $("t-recBtn");

    if (!output) {
      return;
    }

    const temp =
      toNumber(
        temperatureInput?.value
      );

    const rainfall =
      toNumber(
        rainfallInput?.value
      );

    /* ---------------------------------------------
       Input validation
    --------------------------------------------- */

    if (
      temp === null ||
      rainfall === null
    ) {
      output.innerHTML = `
        <div style="color:#fecaca">
          Enter both temperature and seasonal rainfall.
        </div>
      `;

      return;
    }

    if (
      temp < -10 ||
      temp > 55
    ) {
      output.innerHTML = `
        <div style="color:#fecaca">
          Temperature must be between -10°C and 55°C.
        </div>
      `;

      return;
    }

    if (
      rainfall < 0 ||
      rainfall > 3000
    ) {
      output.innerHTML = `
        <div style="color:#fecaca">
          Seasonal rainfall must be between 0 and 3000 mm.
        </div>
      `;

      return;
    }

    /* ---------------------------------------------
       Loading state
    --------------------------------------------- */

    if (button) {
      button.disabled = true;
      button.textContent =
        "Analyzing…";
    }

    output.innerHTML = `
      <div style="opacity:.75">
        Ranking crops using temperature,
        rainfall, drought resilience and
        climate stress...
      </div>
    `;

    try {
      /*
       * Prefer server recommendation.
       */
      const serverResult =
        await requestServerRecommendation(
          temp,
          rainfall
        );

      if (serverResult) {
        renderRecommendation(
          serverResult,
          "server climate ranking",
          temp,
          rainfall
        );

        return;
      }

      /*
       * Server response invalid/unavailable.
       * Use deterministic local model.
       */
      const localResult =
        buildLocalRecommendation(
          temp,
          rainfall
        );

      renderRecommendation(
        localResult,
        "local validated climate ranking",
        temp,
        rainfall
      );

    } catch (error) {
      /*
       * Network/server failure should never
       * break the crop recommendation UI.
       */
      const localResult =
        buildLocalRecommendation(
          temp,
          rainfall
        );

      renderRecommendation(
        localResult,
        "local validated climate ranking",
        temp,
        rainfall
      );

      /*
       * Log only in development/debugging.
       */
      if (
        window.location.hostname ===
        "localhost"
      ) {
        console.warn(
          "Crop recommendation API unavailable:",
          error
        );
      }

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          "Recommend Crop";
      }
    }
  }

  /* =========================================================
     Public API
  ========================================================= */

  window.recommendCrop =
    recommendCrop;

})();