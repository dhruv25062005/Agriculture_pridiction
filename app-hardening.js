import path from "node:path";
import express from "express";

const originalPost = express.application.post;
const originalGet = express.application.get;

const CROP_PROFILES = {
  wheat: { label: "Wheat", temp: [15, 24], humidity: [45, 70], rain: [350, 550], season: "Rabi" },
  rice: { label: "Rice", temp: [24, 30], humidity: [70, 90], rain: [900, 1400], season: "Kharif" },
  maize: { label: "Maize", temp: [20, 30], humidity: [50, 75], rain: [500, 800], season: "Kharif/Rabi" },
  tomato: { label: "Tomato", temp: [20, 28], humidity: [55, 75], rain: [400, 700], season: "Year-round with suitable climate" },
  potato: { label: "Potato", temp: [15, 23], humidity: [60, 80], rain: [450, 700], season: "Rabi" },
  cotton: { label: "Cotton", temp: [21, 32], humidity: [50, 70], rain: [500, 900], season: "Kharif" },
  pepper: { label: "Chilli/Pepper", temp: [21, 30], humidity: [60, 80], rain: [600, 1000], season: "Kharif/Year-round" },
  sugarcane: { label: "Sugarcane", temp: [20, 32], humidity: [60, 80], rain: [1000, 1500], season: "Year-round" },
  soybean: { label: "Soybean", temp: [20, 30], humidity: [55, 75], rain: [450, 700], season: "Kharif" }
};

function cleanNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "agricultural crops" || raw === "crop") return null;
  const key = Object.keys(CROP_PROFILES).find(k => raw.includes(k));
  return key || null;
}

function rangeScore(value, [low, high], tolerance) {
  if (value >= low && value <= high) return 100;
  const distance = value < low ? low - value : value - high;
  return clamp(100 - (distance / tolerance) * 100, 0, 100);
}

function calculateForecast(body = {}) {
  const temp = clamp(cleanNumber(body.temp, 25), -10, 55);
  const humidity = clamp(cleanNumber(body.humidity, 65), 0, 100);
  const rainfall = clamp(cleanNumber(body.rainfall, 100), 0, 3000);
  const cropKey = normalizeCrop(body.crop);
  const profile = cropKey ? CROP_PROFILES[cropKey] : null;

  if (!profile) {
    const heat = rangeScore(temp, [18, 32], 15);
    const moisture = rangeScore(humidity, [45, 80], 35);
    const rain = rangeScore(rainfall, [300, 900], 900);
    const score = Math.round(heat * 0.4 + moisture * 0.25 + rain * 0.35);
    return {
      success: true,
      crop: "General crop",
      forecast_type: "environmental_suitability",
      yield_index: score,
      confidence: 45,
      confidence_note: "Low confidence: select a crop and provide crop-specific conditions for a more useful estimate.",
      productivity_rating: score >= 80 ? "Favorable conditions" : score >= 60 ? "Moderately favorable" : "Stress conditions",
      limiting_factor: temp > 35 ? "High temperature stress" : temp < 12 ? "Low temperature stress" : humidity > 85 ? "Excess humidity and disease pressure" : rainfall > 1600 ? "Excess rainfall / waterlogging risk" : rainfall < 250 ? "Low seasonal rainfall" : "No single severe environmental constraint",
      fungal_blight_risk: humidity >= 85 && temp >= 18 && temp <= 30 ? "High" : humidity >= 75 ? "Moderate" : "Low",
      inputs_used: { temperature_c: temp, relative_humidity_pct: humidity, seasonal_rainfall_mm: rainfall },
      agronomic_recommendations: [
        humidity >= 80 ? "Increase canopy scouting and avoid unnecessary overhead irrigation." : "Maintain balanced irrigation and inspect soil moisture before watering.",
        rainfall < 250 ? "Plan supplemental irrigation according to soil moisture and crop stage." : rainfall > 1200 ? "Check drainage and watch for waterlogging after heavy rain." : "Maintain normal irrigation while checking root-zone moisture.",
        "Use crop-stage and soil observations before making fertilizer or pesticide decisions."
      ]
    };
  }

  const tempScore = rangeScore(temp, profile.temp, 12);
  const humidityScore = rangeScore(humidity, profile.humidity, 30);
  const rainScore = rangeScore(rainfall, profile.rain, Math.max(250, profile.rain[1] - profile.rain[0]));
  let score = Math.round(tempScore * 0.4 + humidityScore * 0.2 + rainScore * 0.4);

  if (temp > 38) score -= 10;
  if (temp < 8) score -= 8;
  if (humidity > 92) score -= 8;
  if (rainfall > profile.rain[1] * 1.5) score -= 8;
  score = clamp(score, 0, 100);

  let limiting = "Environmental conditions are within a generally suitable range.";
  if (temp < profile.temp[0]) limiting = `Temperature is below the preferred range (${profile.temp[0]}–${profile.temp[1]}°C).`;
  else if (temp > profile.temp[1]) limiting = `Temperature is above the preferred range (${profile.temp[0]}–${profile.temp[1]}°C).`;
  else if (rainfall < profile.rain[0]) limiting = `Seasonal rainfall is below the preferred range (${profile.rain[0]}–${profile.rain[1]} mm).`;
  else if (rainfall > profile.rain[1]) limiting = `Seasonal rainfall is above the preferred range (${profile.rain[0]}–${profile.rain[1]} mm).`;
  else if (humidity < profile.humidity[0]) limiting = "Low relative humidity may increase atmospheric water demand.";
  else if (humidity > profile.humidity[1]) limiting = "High humidity increases disease pressure and canopy wetness risk.";

  const disease = humidity > 88 && temp >= 18 && temp <= 30 ? "High" : humidity > 75 ? "Moderate" : "Low";
  return {
    success: true,
    crop: profile.label,
    season: profile.season,
    forecast_type: "crop_specific_environmental_suitability",
    yield_index: score,
    confidence: 65,
    confidence_note: "Indicative suitability score, not a measured yield prediction. Confidence is limited because soil, cultivar, crop stage, irrigation, nutrients and historical yield data are not included.",
    productivity_rating: score >= 80 ? "Favorable conditions" : score >= 60 ? "Moderately favorable" : "Stress conditions",
    limiting_factor: limiting,
    fungal_blight_risk: disease,
    inputs_used: { temperature_c: temp, relative_humidity_pct: humidity, seasonal_rainfall_mm: rainfall },
    preferred_ranges: { temperature_c: profile.temp, relative_humidity_pct: profile.humidity, seasonal_rainfall_mm: profile.rain },
    agronomic_recommendations: [
      temp > profile.temp[1] ? "Use heat-management practices such as timely irrigation and shade where agronomically appropriate." : temp < profile.temp[0] ? "Protect the crop from cold stress and avoid unnecessary irrigation during cold periods." : "Temperature is suitable; continue monitoring crop stage and soil moisture.",
      rainfall < profile.rain[0] ? "Supplement rainfall with irrigation based on root-zone soil moisture and crop stage." : rainfall > profile.rain[1] ? "Check field drainage and avoid irrigation until the root zone has adequately drained." : "Rainfall is broadly suitable; adjust irrigation using soil moisture rather than a fixed schedule.",
      disease === "High" ? "Scout frequently for leaf spots, mildew and blight; use locally approved controls only when needed." : "Continue routine pest and disease scouting, especially after prolonged leaf wetness."
    ]
  };
}

function predictYieldRoute(req, res) {
  try {
    return res.json(calculateForecast(req.body));
  } catch (error) {
    console.error("Yield forecast error:", error);
    return res.status(400).json({ success: false, error: "Invalid forecast inputs." });
  }
}

function recommendCropRoute(req, res) {
  const body = req.body || {};
  const temp = clamp(cleanNumber(body.temp, 25), -10, 55);
  const rainfall = clamp(cleanNumber(body.rainfall, 100), 0, 3000);
  const ranked = Object.entries(CROP_PROFILES).map(([key, p]) => ({
    key,
    crop: p.label,
    score: Math.round(rangeScore(temp, p.temp, 12) * 0.45 + rangeScore(rainfall, p.rain, Math.max(250, p.rain[1] - p.rain[0])) * 0.55)
  })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return res.json({ success: true, recommendation: best.crop, score: best.score, alternatives: ranked.slice(0, 3), inputs_used: { temperature_c: temp, seasonal_rainfall_mm: rainfall }, note: "Recommendation is climate-based only; soil, market, water availability and crop rotation should also be considered." });
}

function aiStatsRoute(_req, res) {
  return res.json({ success: true, accuracy: null, validation_status: "not_validated", model_type: "rule_based_environmental_suitability", message: "No validated historical yield dataset is connected, so an accuracy percentage is not claimed." });
}

function protectedDashboardRoute(req, res) {
  if (!req.session?.user?.uid && !req.session?.user?.email) {
    return res.redirect("/signin.html");
  }
  return res.sendFile(path.join(process.cwd(), "templates", "signedin.html"));
}

express.application.post = function patchedPost(route, ...handlers) {
  if (route === "/predict_yield") return originalPost.call(this, route, predictYieldRoute);
  if (route === "/recommend_crop") return originalPost.call(this, route, recommendCropRoute);
  return originalPost.call(this, route, ...handlers);
};

express.application.get = function patchedGet(route, ...handlers) {
  if (route === "/ai_stats") return originalGet.call(this, route, aiStatsRoute);
  if (route === "/signedin") return originalGet.call(this, route, protectedDashboardRoute);
  return originalGet.call(this, route, ...handlers);
};
