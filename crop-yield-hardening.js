import express from "express";
import { predictYieldModel, MODEL_INFO } from "./models/yield-model-enhanced.js";

const originalPost = express.application.post;
const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;

// Transparent climate-screening profiles. These are broad suitability ranges,
// not guaranteed agronomic requirements. Soil, cultivar, irrigation and sowing
// date must still be considered before planting.
const profiles = [
  ["Wheat", [15, 24], [350, 550], "Rabi", "Moderate"],
  ["Rice", [24, 30], [900, 1400], "Kharif", "High"],
  ["Maize", [20, 30], [500, 800], "Kharif/Summer", "Moderate"],
  ["Tomato", [20, 28], [400, 700], "Rabi/Summer", "Moderate"],
  ["Potato", [15, 23], [450, 700], "Rabi", "Moderate"],
  ["Cotton", [21, 32], [500, 900], "Kharif", "Moderate"],
  ["Soybean", [20, 30], [450, 700], "Kharif", "Moderate"],
  ["Chickpea", [18, 26], [300, 500], "Rabi", "Low"],
  ["Mustard", [10, 25], [300, 500], "Rabi", "Low"],
  ["Groundnut", [24, 30], [500, 1000], "Kharif/Summer", "Moderate"],
  ["Sorghum (Jowar)", [20, 32], [400, 700], "Kharif/Rabi", "Low-Moderate"],
  ["Pearl millet (Bajra)", [25, 35], [250, 500], "Kharif", "Low"],
  ["Pigeon pea (Arhar)", [20, 30], [600, 1000], "Kharif", "Moderate"],
  ["Lentil", [18, 25], [300, 500], "Rabi", "Low"],
  ["Onion", [13, 25], [350, 700], "Rabi/Kharif", "Moderate"],
  ["Sugarcane", [20, 32], [1000, 2000], "Long duration", "Very high"],
  ["Banana", [20, 35], [1000, 2500], "Whole year", "High"],
  ["Chilli", [20, 30], [500, 1000], "Kharif/Rabi", "Moderate"],
  ["Sesame", [25, 35], [400, 700], "Kharif", "Low"],
  ["Sunflower", [20, 30], [400, 700], "Rabi/Kharif", "Moderate"]
];

function fit(value, range) {
  const mid = (range[0] + range[1]) / 2;
  const half = Math.max((range[1] - range[0]) / 2, 0.1);
  const distance = Math.abs(value - mid);
  const normalized = distance / half;
  if (normalized <= 1) return Math.round(100 - 20 * normalized * normalized);
  return Math.max(0, Math.round(80 * Math.exp(-(normalized - 1) * 1.25)));
}

function cropRecommendation(req, res) {
  const temp = num(req.body?.temp ?? req.body?.temperature, NaN);
  const rainfall = num(req.body?.rainfall ?? req.body?.seasonal_rainfall, NaN);

  if (!Number.isFinite(temp) || temp < -10 || temp > 55) {
    return res.status(400).json({ success: false, error: "Temperature must be between -10°C and 55°C." });
  }
  if (!Number.isFinite(rainfall) || rainfall < 0 || rainfall > 3000) {
    return res.status(400).json({ success: false, error: "Seasonal rainfall must be between 0 and 3000 mm." });
  }

  const ranked = profiles.map(([crop, temperatureRange, rainfallRange, season, waterRequirement]) => {
    const temperatureFit = fit(temp, temperatureRange);
    const rainfallFit = fit(rainfall, rainfallRange);
    return {
      crop,
      score: Math.round(temperatureFit * 0.45 + rainfallFit * 0.55),
      season,
      water_requirement: waterRequirement,
      temperature_fit: temperatureFit,
      rainfall_fit: rainfallFit,
      temperature_range_c: temperatureRange,
      rainfall_range_mm: rainfallRange
    };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const strongMatch = best.score >= 55;
  return res.json({
    success: true,
    crop: strongMatch ? best.crop : "No strong climate match",
    recommendation: strongMatch ? best.crop : "No strong climate match",
    score: best.score,
    suitability_label: best.score >= 80 ? "Favorable" : best.score >= 65 ? "Moderately favorable" : best.score >= 55 ? "Marginal" : "Poor fit",
    temperature_fit: best.temperature_fit,
    rainfall_fit: best.rainfall_fit,
    season: best.season,
    water_requirement: best.water_requirement,
    recommended_temperature_range_c: best.temperature_range_c,
    recommended_rainfall_range_mm: best.rainfall_range_mm,
    recommendation_confidence: "Climate screening only",
    alternatives: ranked.slice(1, 5),
    inputs_used: { temperature_c: temp, seasonal_rainfall_mm: rainfall },
    note: "Climate screening only. It does not use soil pH/type, irrigation availability, cultivar, sowing date, pests, disease pressure or market price. Confirm the recommendation with local agricultural guidance before planting."
  });
}

function trainedYield(req, res) {
  try {
    const p = req.body || {};
    const result = predictYieldModel({
      state: p.state,
      crop: p.crop,
      season: p.season,
      year: p.year ?? new Date().getFullYear(),
      area: p.area ?? p.area_ha,
      rainfall: p.rainfall ?? p.annual_rainfall ?? p.Annual_Rainfall,
      fertilizer: p.fertilizer ?? p.Fertilizer,
      pesticide: p.pesticide ?? p.Pesticide
    });
    return res.json({
      ...result,
      forecast_type: "historical_data_model",
      confidence_note: "Held-out test metrics describe the original historical model; they are not a guarantee of farm yield."
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error?.message || "Unable to calculate yield." });
  }
}

express.application.post = function(route, ...handlers) {
  if (route === "/recommend_crop") return originalPost.call(this, route, cropRecommendation);
  if (route === "/predict_yield") return originalPost.call(this, route, trainedYield);
  return originalPost.call(this, route, ...handlers);
};
