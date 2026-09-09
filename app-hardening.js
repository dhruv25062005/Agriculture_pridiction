import path from "node:path";
import crypto from "node:crypto";
import express from "express";

if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === "production" || process.env.RENDER === "true") {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
}

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

const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
function cropKey(v) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (!raw || raw === "agricultural crops" || raw === "crop") return null;
  return Object.keys(CROP_PROFILES).find(k => raw.includes(k)) || null;
}
function rangeScore(v, range, tolerance) {
  if (v >= range[0] && v <= range[1]) return 100;
  const distance = v < range[0] ? range[0] - v : v - range[1];
  return clamp(100 - (distance / tolerance) * 100, 0, 100);
}

function forecast(body = {}, sessionUser = {}) {
  const temp = clamp(num(body.temp, 25), -10, 55);
  const humidity = clamp(num(body.humidity, 65), 0, 100);
  const rainfall = clamp(num(body.rainfall, 100), 0, 3000);
  const key = cropKey(body.crop) || cropKey(sessionUser.crop) || cropKey(sessionUser.primaryCrop);
  const p = key ? CROP_PROFILES[key] : null;

  if (!p) {
    const score = Math.round(rangeScore(temp, [18, 32], 15) * 0.4 + rangeScore(humidity, [45, 80], 35) * 0.25 + rangeScore(rainfall, [300, 900], 900) * 0.35);
    return { success: true, crop: "General crop", forecast_type: "environmental_suitability", yield_index: score, confidence: 45, confidence_note: "Indicative only. Select a crop for crop-specific ranges; this is not a validated yield forecast.", productivity_rating: score >= 80 ? "Favorable conditions" : score >= 60 ? "Moderately favorable" : "Stress conditions", limiting_factor: temp > 35 ? "High temperature stress" : temp < 12 ? "Low temperature stress" : humidity > 85 ? "Excess humidity and disease pressure" : rainfall > 1600 ? "Excess rainfall / waterlogging risk" : rainfall < 250 ? "Low seasonal rainfall" : "No single severe environmental constraint", fungal_blight_risk: humidity >= 85 && temp >= 18 && temp <= 30 ? "High" : humidity >= 75 ? "Moderate" : "Low", inputs_used: { temperature_c: temp, relative_humidity_pct: humidity, seasonal_rainfall_mm: rainfall }, agronomic_recommendations: [humidity >= 80 ? "Increase canopy scouting and avoid unnecessary overhead irrigation." : "Maintain balanced irrigation and inspect soil moisture before watering.", rainfall < 250 ? "Plan supplemental irrigation according to soil moisture and crop stage." : rainfall > 1200 ? "Check drainage and watch for waterlogging after heavy rain." : "Maintain normal irrigation while checking root-zone moisture.", "Use crop-stage and soil observations before fertilizer or pesticide decisions."] };
  }

  const ts = rangeScore(temp, p.temp, 12);
  const hs = rangeScore(humidity, p.humidity, 30);
  const rs = rangeScore(rainfall, p.rain, Math.max(250, p.rain[1] - p.rain[0]));
  let score = Math.round(ts * 0.4 + hs * 0.2 + rs * 0.4);
  if (temp > 38) score -= 10;
  if (temp < 8) score -= 8;
  if (humidity > 92) score -= 8;
  if (rainfall > p.rain[1] * 1.5) score -= 8;
  score = clamp(score, 0, 100);

  let limiting = "Environmental conditions are within a generally suitable range.";
  if (temp < p.temp[0]) limiting = `Temperature is below the preferred range (${p.temp[0]}–${p.temp[1]}°C).`;
  else if (temp > p.temp[1]) limiting = `Temperature is above the preferred range (${p.temp[0]}–${p.temp[1]}°C).`;
  else if (rainfall < p.rain[0]) limiting = `Seasonal rainfall is below the preferred range (${p.rain[0]}–${p.rain[1]} mm).`;
  else if (rainfall > p.rain[1]) limiting = `Seasonal rainfall is above the preferred range (${p.rain[0]}–${p.rain[1]} mm).`;
  else if (humidity < p.humidity[0]) limiting = "Low relative humidity may increase atmospheric water demand.";
  else if (humidity > p.humidity[1]) limiting = "High humidity increases disease pressure and canopy wetness risk.";

  const disease = humidity > 88 && temp >= 18 && temp <= 30 ? "High" : humidity > 75 ? "Moderate" : "Low";
  return { success: true, crop: p.label, season: p.season, forecast_type: "crop_specific_environmental_suitability", yield_index: score, confidence: 65, confidence_note: "Indicative suitability score, not a measured yield prediction. Soil, cultivar, crop stage, irrigation, nutrients and historical yield data are not included.", productivity_rating: score >= 80 ? "Favorable conditions" : score >= 60 ? "Moderately favorable" : "Stress conditions", limiting_factor: limiting, fungal_blight_risk: disease, inputs_used: { temperature_c: temp, relative_humidity_pct: humidity, seasonal_rainfall_mm: rainfall }, preferred_ranges: { temperature_c: p.temp, relative_humidity_pct: p.humidity, seasonal_rainfall_mm: p.rain }, agronomic_recommendations: [temp > p.temp[1] ? "Use heat-management practices such as timely irrigation where appropriate." : temp < p.temp[0] ? "Protect the crop from cold stress and avoid unnecessary irrigation during cold periods." : "Temperature is suitable; continue monitoring crop stage and soil moisture.", rainfall < p.rain[0] ? "Supplement rainfall with irrigation based on root-zone soil moisture and crop stage." : rainfall > p.rain[1] ? "Check field drainage and avoid irrigation until the root zone has adequately drained." : "Rainfall is broadly suitable; adjust irrigation using soil moisture rather than a fixed schedule.", disease === "High" ? "Scout frequently for leaf spots, mildew and blight; use locally approved controls only when needed." : "Continue routine pest and disease scouting, especially after prolonged leaf wetness."] };
}

function predictYield(req, res) { try { return res.json(forecast(req.body, req.session?.user)); } catch (e) { console.error("Yield forecast error:", e); return res.status(400).json({ success: false, error: "Invalid forecast inputs." }); } }
function recommendCrop(req, res) {
  const temp = clamp(num(req.body?.temp, 25), -10, 55), rainfall = clamp(num(req.body?.rainfall, 100), 0, 3000);
  const ranked = Object.entries(CROP_PROFILES).map(([key, p]) => ({ key, crop: p.label, score: Math.round(rangeScore(temp, p.temp, 12) * 0.45 + rangeScore(rainfall, p.rain, Math.max(250, p.rain[1] - p.rain[0])) * 0.55) })).sort((a, b) => b.score - a.score);
  return res.json({ success: true, recommendation: ranked[0].crop, score: ranked[0].score, alternatives: ranked.slice(0, 3), inputs_used: { temperature_c: temp, seasonal_rainfall_mm: rainfall }, note: "Climate-based recommendation only; soil, market, water availability and crop rotation should also be considered." });
}
function aiStats(_req, res) { return res.json({ success: true, accuracy: null, validation_status: "not_validated", model_type: "rule_based_environmental_suitability", message: "No validated historical yield dataset is connected, so an accuracy percentage is not claimed." }); }
function signedIn(req, res) { if (!req.session?.user?.uid && !req.session?.user?.email) return res.redirect("/signin.html"); return res.sendFile(path.join(process.cwd(), "templates", "signedin.html")); }

express.application.post = function(route, ...handlers) {
  if (route === "/predict_yield") return originalPost.call(this, route, predictYield);
  if (route === "/recommend_crop") return originalPost.call(this, route, recommendCrop);
  return originalPost.call(this, route, ...handlers);
};
express.application.get = function(route, ...handlers) {
  if (route === "/ai_stats") return originalGet.call(this, route, aiStats);
  if (route === "/signedin") return originalGet.call(this, route, signedIn);
  return originalGet.call(this, route, ...handlers);
};
