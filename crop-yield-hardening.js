import express from "express";
import { predictYieldModel, MODEL_INFO } from "./models/yield-model-enhanced.js";

const originalPost = express.application.post;
const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Simple, transparent climate profiles. This endpoint is a screening tool,
// not a soil/variety/market-aware agronomy model.
const profiles = [
  ["Wheat", [15, 24], [350, 550], "Cool season", "Moderate"],
  ["Rice", [24, 30], [900, 1400], "Warm/monsoon season", "High"],
  ["Maize", [20, 30], [500, 800], "Warm season", "Moderate"],
  ["Tomato", [20, 28], [400, 700], "Warm season", "Moderate"],
  ["Potato", [15, 23], [450, 700], "Cool season", "Moderate"],
  ["Cotton", [21, 32], [500, 900], "Warm/monsoon season", "Moderate"],
  ["Soybean", [20, 30], [450, 700], "Warm/monsoon season", "Moderate"],
  ["Chickpea", [18, 26], [300, 500], "Cool/dry season", "Low"],
  ["Mustard", [10, 25], [300, 500], "Cool season", "Low"],
  ["Groundnut", [24, 30], [500, 1000], "Warm season", "Moderate"]
];

function fit(value, range) {
  const mid = (range[0] + range[1]) / 2;
  const half = Math.max((range[1] - range[0]) / 2, 0.1);
  const distance = Math.abs(value - mid);
  if (distance <= half) return Math.round(100 - (distance / half) * 15);
  return Math.max(0, Math.round(85 - ((distance - half) / half) * 55));
}

function cropRecommendation(req, res) {
  const rawTemp = req.body?.temp ?? req.body?.temperature;
  const rawRain = req.body?.rainfall ?? req.body?.seasonal_rainfall;
  const temp = num(rawTemp, NaN);
  const rainfall = num(rawRain, NaN);

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
  return res.json({
    success: true,
    crop: best.crop,
    recommendation: best.crop,
    score: best.score,
    suitability_label: best.score >= 80 ? "Favorable" : best.score >= 65 ? "Moderately favorable" : best.score >= 50 ? "Marginal" : "Poor fit",
    temperature_fit: best.temperature_fit,
    rainfall_fit: best.rainfall_fit,
    season: best.season,
    water_requirement: best.water_requirement,
    recommendation_confidence: "Climate screening only",
    alternatives: ranked.slice(1, 4),
    inputs_used: { temperature_c: temp, seasonal_rainfall_mm: rainfall },
    note: "Climate screening only. Soil, cultivar, irrigation, sowing date, pests and market factors are not included."
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
      confidence_note: "Held-out test metrics are shown for transparency; they are not a guarantee of farm yield."
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error?.message || "Unable to calculate yield." });
  }
}

// Register deterministic replacements before the legacy handlers are added by server.js.
express.application.post = function(route, ...handlers) {
  if (route === "/recommend_crop") return originalPost.call(this, route, cropRecommendation);
  if (route === "/predict_yield") return originalPost.call(this, route, trainedYield);
  return originalPost.call(this, route, ...handlers);
};
