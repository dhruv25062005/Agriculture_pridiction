import express from "express";

// Normalizes the crop/yield APIs to the schema expected by signedin.html.
// This layer is intentionally rule-based: it does not claim a validated yield prediction.
const originalPost = express.application.post;
const crops = {
  wheat: { label: "Wheat", temp: [15, 24], rain: [350, 550] },
  rice: { label: "Rice", temp: [24, 30], rain: [900, 1400] },
  maize: { label: "Maize", temp: [20, 30], rain: [500, 800] },
  tomato: { label: "Tomato", temp: [20, 28], rain: [400, 700] },
  potato: { label: "Potato", temp: [15, 23], rain: [450, 700] },
  cotton: { label: "Cotton", temp: [21, 32], rain: [500, 900] },
  soybean: { label: "Soybean", temp: [20, 30], rain: [450, 700] }
};
const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const scoreRange = (value, range, divisor) => value >= range[0] && value <= range[1]
  ? 100
  : clamp(100 - Math.abs(value - (value < range[0] ? range[0] : range[1])) / divisor * 100, 0, 100);

function cropRecommendation(req, res) {
  const temperature = clamp(num(req.body?.temp, 25), -10, 55);
  const rainfall = clamp(num(req.body?.rainfall, 100), 0, 3000);
  const ranked = Object.values(crops).map(crop => ({
    crop: crop.label,
    score: Math.round(scoreRange(temperature, crop.temp, 12) * 0.45 + scoreRange(rainfall, crop.rain, Math.max(250, crop.rain[1] - crop.rain[0])) * 0.55),
    temperature_range_c: crop.temp,
    rainfall_range_mm: crop.rain
  })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const confidence = best.score >= 80 ? "High" : best.score >= 60 ? "Moderate" : "Low";
  const cropKey = Object.keys(crops).find(k => crops[k].label === best.crop);
  const season = ["Wheat", "Potato"].includes(best.crop) ? "Cool season" : ["Rice", "Cotton", "Soybean"].includes(best.crop) ? "Warm/monsoon season" : "Warm season";
  return res.json({
    success: true,
    crop: best.crop,
    recommendation: best.crop,
    score: best.score,
    season,
    expected_yield: "Not estimated — climate suitability only",
    water_requirement: `Typical seasonal rainfall range: ${crops[cropKey].rain[0]}–${crops[cropKey].rain[1]} mm`,
    recommendation_confidence: confidence,
    alternatives: ranked.slice(1, 4),
    inputs_used: { temperature_c: temperature, seasonal_rainfall_mm: rainfall },
    note: "Climate-based recommendation only; soil, cultivar, irrigation capacity, market conditions and crop rotation are not included."
  });
}

function yieldIndex(req, res) {
  const temperature = clamp(num(req.body?.temp, 25), -10, 55);
  const rainfall = clamp(num(req.body?.rainfall, 120), 0, 3000);
  const humidity = clamp(num(req.body?.humidity, 65), 0, 100);
  const key = Object.keys(crops).find(k => String(req.body?.crop || "").toLowerCase().includes(k));
  const crop = key ? crops[key] : null;
  const temperatureScore = scoreRange(temperature, crop?.temp || [18, 32], crop ? 12 : 15);
  const rainfallScore = scoreRange(rainfall, crop?.rain || [300, 900], crop ? Math.max(250, crop.rain[1] - crop.rain[0]) : 900);
  const index = Math.round(temperatureScore * 0.45 + rainfallScore * 0.55);
  const rating = index >= 80 ? "Favorable" : index >= 60 ? "Moderately favorable" : "Needs attention";
  const limitingFactor = temperatureScore < rainfallScore
    ? `Temperature is the stronger limiting factor (${Math.round(temperatureScore)}/100 suitability).`
    : `Seasonal rainfall is the stronger limiting factor (${Math.round(rainfallScore)}/100 suitability).`;
  const fungalRisk = humidity >= 80 ? "Elevated humidity pressure" : humidity >= 70 ? "Moderate humidity pressure" : "Lower humidity pressure";
  const recommendations = [];
  if (temperatureScore < 80) recommendations.push("Prefer a crop/planting window closer to the recommended temperature range.");
  if (rainfallScore < 80) recommendations.push("Adjust irrigation or drainage according to the crop's water requirement and actual soil moisture.");
  if (humidity >= 80) recommendations.push("Increase canopy airflow and avoid unnecessary leaf wetness; inspect crops frequently for disease symptoms.");
  if (!recommendations.length) recommendations.push("Maintain balanced nutrition, irrigation and regular field scouting.");
  return res.json({
    success: true,
    crop: crop?.label || "General crop",
    forecast_type: "environmental_suitability",
    yield_index: index,
    productivity_rating: rating,
    potential_growth_index: `Climate suitability: ${index}/100`,
    limiting_factor: limitingFactor,
    fungal_blight_risk: fungalRisk,
    agronomic_recommendations: recommendations,
    confidence: null,
    confidence_note: "Indicative suitability score, not a validated yield prediction. Soil, cultivar, crop stage and historical yield are not included.",
    inputs_used: { temperature_c: temperature, seasonal_rainfall_mm: rainfall, relative_humidity_percent: humidity }
  });
}

express.application.post = function(route, ...handlers) {
  if (route === "/recommend_crop") return originalPost.call(this, route, cropRecommendation);
  if (route === "/predict_yield") return originalPost.call(this, route, yieldIndex);
  return originalPost.call(this, route, ...handlers);
};
