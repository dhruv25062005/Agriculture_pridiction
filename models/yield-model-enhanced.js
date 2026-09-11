import fs from "fs";
import { predictYieldModel as basePredict, MODEL_INFO as BASE_INFO, SUPPORTED_CROPS, SUPPORTED_STATES, SUPPORTED_SEASONS } from "./yield-model-safe.js";

const ACRE_TO_HA = 0.40468564224;
const ARTIFACT_URL = new URL("./yield-model-artifact.json", import.meta.url);
let ARTIFACT = null;
try { if (fs.existsSync(ARTIFACT_URL)) ARTIFACT = JSON.parse(fs.readFileSync(ARTIFACT_URL, "utf8")); } catch { ARTIFACT = null; }

const YIELD_BOUNDS = {
  Arecanut:[0.2,5],"Arhar/Tur":[0.2,3],Bajra:[0.2,5],Banana:[5,100],Barley:[0.5,8],"Black pepper":[0.1,5],
  Cardamom:[0.05,3],Cashewnut:[0.1,3],"Castor seed":[0.2,4],Coconut:[1,20],Coriander:[0.2,3],"Cotton(lint)":[0.2,5],
  "Cowpea(Lobia)":[0.2,4],"Dry chillies":[0.2,8],Garlic:[1,20],Ginger:[1,40],Gram:[0.2,4],Grapes:[5,50],Groundnut:[0.3,6],
  "Guar seed":[0.2,3],"Horse-gram":[0.2,3],Jowar:[0.2,5],Jute:[1,8],Khesari:[0.2,3],Lentil:[0.2,3],Linseed:[0.2,3],
  Maize:[0.5,15],Mango:[1,20],Masoor:[0.2,3],Mesta:[1,10],Moong:[0.2,3],"Moong(Green Gram)":[0.2,3],Moth:[0.2,3],Mustard:[0.2,5],
  "Niger seed":[0.1,3],"Oilseeds total":[0.2,4],Onion:[2,70],"Other Rabi pulses":[0.2,3],"Other Cereals":[0.2,5],
  "Other Kharif pulses":[0.2,4],"Other Summer Pulses":[0.2,4],"Peas & beans (Pulses)":[0.3,8],Potato:[3,60],Ragi:[0.2,5],
  "Rapeseed &Mustard":[0.2,5],Rice:[0.5,12],Rubber:[0.3,5],Safflower:[0.1,3],Sannhamp:[0.2,8],Sesamum:[0.1,2.5],
  "Small millets":[0.2,4],Soyabean:[0.3,5],Sugarcane:[20,160],Sunflower:[0.2,5],"Sweet potato":[3,40],Tapioca:[5,60],
  Tobacco:[0.3,5],Tomato:[5,100],Turmeric:[2,40],Urad:[0.2,3],Wheat:[0.5,8],"other oilseeds":[0.1,4]
};

export const MODEL_INFO = ARTIFACT ? {
  type: ARTIFACT.algorithm,
  target: ARTIFACT.target,
  training_rows: ARTIFACT.trainingRows,
  validation_rows: ARTIFACT.validationRows,
  test_rows: ARTIFACT.testRows,
  training_year_range: ARTIFACT.source.datasetPeriod,
  production_excluded: true,
  model_features_used: ["Crop","State","Season","Year","Annual_Rainfall","Fertilizer/ha","Pesticide/ha"],
  area_role: "used only to convert fertilizer and pesticide totals to per-hectare rates; it is not a direct yield multiplier",
  validation_status: "chronological train 1997–2017, validation 2018–2019, temporal test 2020",
  test_metrics: ARTIFACT.metrics.temporalTest,
  validation_metrics: ARTIFACT.metrics.validation,
  version: ARTIFACT.version,
  source: ARTIFACT.source.url
} : {
  type: "Leakage-safe historical baseline + sanity layer (training artifact unavailable)",
  target: BASE_INFO.target,
  training_rows: BASE_INFO.training_rows,
  test_rows: BASE_INFO.test_rows,
  training_year_range: BASE_INFO.training_year_range,
  production_excluded: true,
  model_features_used: ["Crop","State","Season"],
  area_role: "production calculation only; never a yield multiplier",
  validation_status: "safe fallback; temporal artifact not available in this runtime",
  test_metrics: BASE_INFO.test_metrics,
  version: "2026-09-11-yield-fallback-v1"
};

function toHa(input) {
  const acre = Number(input.area_acre);
  if (Number.isFinite(acre) && acre > 0) return acre * ACRE_TO_HA;
  const ha = Number(input.area_ha ?? input.area);
  if (Number.isFinite(ha) && ha > 0) return ha;
  throw new Error("Area must be greater than zero.");
}

function validate(input) {
  const crop = String(input.crop ?? "").trim();
  const state = String(input.state ?? "").trim();
  const season = String(input.season ?? "").trim();
  const year = Number(input.year);
  const rainfall = Number(input.rainfall);
  const fertilizer = Number(input.fertilizer);
  const pesticide = Number(input.pesticide);
  if (!SUPPORTED_STATES.includes(state)) throw new Error(`Unsupported state: ${state || "missing"}.`);
  if (!SUPPORTED_CROPS.includes(crop)) throw new Error(`Unsupported crop: ${crop || "missing"}.`);
  if (!SUPPORTED_SEASONS.includes(season)) throw new Error(`Unsupported season: ${season || "missing"}.`);
  if (!Number.isInteger(year) || year < 1997 || year > 2100) throw new Error("Year must be an integer from 1997 to 2100.");
  if (!Number.isFinite(rainfall) || rainfall < 0 || rainfall > 10000) throw new Error("Annual rainfall must be between 0 and 10000 mm.");
  if (!Number.isFinite(fertilizer) || fertilizer < 0 || fertilizer > 100000000) throw new Error("Fertilizer must be between 0 and 100000000 kg.");
  if (!Number.isFinite(pesticide) || pesticide < 0 || pesticide > 10000000) throw new Error("Pesticide must be between 0 and 10000000 kg.");
  return { crop, state, season, year, rainfall, fertilizer, pesticide };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function artifactVector(p, areaHa) {
  const a = ARTIFACT;
  const x = [1];
  for (const c of a.categories.crops) x.push(c === p.crop ? 1 : 0);
  for (const s of a.categories.states) x.push(s === p.state ? 1 : 0);
  for (const s of a.categories.seasons) x.push(s === p.season ? 1 : 0);
  const year = (p.year - a.year.mean) / a.year.sd;
  x.push(year, year * year);
  const rates = { rainfall: p.rainfall, fertilizerPerHa: p.fertilizer / areaHa, pesticidePerHa: p.pesticide / areaHa };
  for (const key of ["rainfall", "fertilizerPerHa", "pesticidePerHa"]) {
    const z = (Math.log1p(Math.max(0, rates[key])) - a.numeric[key].mean) / a.numeric[key].sd;
    x.push(z, z * z);
  }
  for (const c of a.categories.crops) x.push(p.crop === c ? year : 0);
  return { x, rates };
}

function predictTemporal(p, areaHa) {
  const { x, rates } = artifactVector(p, areaHa);
  let logYield = 0;
  for (let i = 0; i < x.length; i++) logYield += x[i] * ARTIFACT.weights[i];
  let predicted = Math.max(0, Math.expm1(logYield));
  const bounds = YIELD_BOUNDS[p.crop];
  const raw = predicted;
  if (bounds) predicted = clamp(predicted, bounds[0], bounds[1]);
  const warnings = [];
  for (const key of ["rainfall", "fertilizerPerHa", "pesticidePerHa"]) {
    const range = ARTIFACT.numeric[key];
    if (rates[key] < range.min || rates[key] > range.max) warnings.push(`${key} is outside the model's training range.`);
  }
  if (p.year > ARTIFACT.source.datasetPeriod[1]) warnings.push(`Year ${p.year} is outside the historical dataset (${ARTIFACT.source.datasetPeriod[0]}–${ARTIFACT.source.datasetPeriod[1]}). The model extrapolates cautiously and should not be treated as a guaranteed future forecast.`);
  const halfWidth = Math.max(ARTIFACT.metrics.temporalTest.medianAbsoluteErrorTpha, predicted * 0.35);
  const low = Number(Math.max(0, predicted - halfWidth).toFixed(3));
  const high = Number((bounds ? Math.min(bounds[1], predicted + halfWidth) : predicted + halfWidth).toFixed(3));
  const historical = p.year <= ARTIFACT.source.datasetPeriod[1];
  return {
    predicted: Number(predicted.toFixed(3)),
    low,
    high,
    warnings,
    sanity_adjusted: Math.abs(raw - predicted) > 1e-9,
    confidence: historical && warnings.length === 0 ? "Medium" : "Low",
    rates
  };
}

export function predictYieldModel(input) {
  const p = validate(input);
  const areaHa = toHa(input);
  let predicted;
  let low;
  let high;
  let warnings = [];
  let confidence;
  let sanityAdjusted = false;
  let uncertaintyMethod;
  let modelType = MODEL_INFO.type;
  let metrics = MODEL_INFO.test_metrics;
  let modelInputs = MODEL_INFO.model_features_used;
  let contextInputs = [];
  let source = null;

  if (ARTIFACT) {
    const result = predictTemporal(p, areaHa);
    predicted = result.predicted; low = result.low; high = result.high; warnings = result.warnings;
    confidence = result.confidence; sanityAdjusted = result.sanity_adjusted; metrics = ARTIFACT.metrics.temporalTest;
    uncertaintyMethod = "Indicative range anchored to the held-out 2020 temporal-test median absolute error; not a calibrated prediction interval.";
    source = ARTIFACT.source.url;
  } else {
    const base = basePredict({ state:p.state, crop:p.crop, season:p.season, year:p.year, area:1, rainfall:p.rainfall, fertilizer:p.fertilizer, pesticide:p.pesticide });
    predicted = Number(base.yield_tpha);
    const bounds = YIELD_BOUNDS[p.crop];
    if (bounds) { const bounded = clamp(predicted, bounds[0], bounds[1]); sanityAdjusted = Math.abs(bounded - predicted) > 1e-9; predicted = bounded; }
    predicted = Number(Math.max(0, predicted).toFixed(3));
    const halfWidth = Math.max(Number(BASE_INFO.test_metrics.median_absolute_error_tpha) || 0.439, predicted * 0.35);
    low = Number(Math.max(0, predicted - halfWidth).toFixed(3));
    high = Number((YIELD_BOUNDS[p.crop] ? Math.min(YIELD_BOUNDS[p.crop][1], predicted + halfWidth) : predicted + halfWidth).toFixed(3));
    confidence = p.year <= BASE_INFO.training_year_range[1] ? "Low" : "Very Low";
    warnings = ["The trained temporal artifact is unavailable, so the safe historical baseline is being used.", "Do not interpret this fallback as a production-grade forecast."];
    uncertaintyMethod = "Heuristic fallback band; not a calibrated prediction interval.";
    contextInputs = ["Annual_Rainfall","Fertilizer","Pesticide"];
  }

  return {
    success:true,
    yield_tpha:predicted,
    yield_tpa:Number((predicted * ACRE_TO_HA).toFixed(3)),
    estimated_production_tonnes:Number((predicted * areaHa).toFixed(3)),
    unit:"tonnes/hectare",
    model:modelType,
    model_version:MODEL_INFO.version,
    confidence,
    confidence_reason: confidence === "Medium" ? "The request is inside the historical data domain and the model passed chronological validation." : "The request includes extrapolation or a non-production fallback, so confidence is reduced.",
    indicative_range_tpha:{low,high},
    uncertainty_method:uncertaintyMethod,
    model_test_metrics:metrics,
    validation_status:MODEL_INFO.validation_status,
    sanity_adjusted:sanityAdjusted,
    plausible_range_tpha:YIELD_BOUNDS[p.crop] ? {min:YIELD_BOUNDS[p.crop][0],max:YIELD_BOUNDS[p.crop][1]} : null,
    leakage_safe:true,
    inputs_used:{state:p.state,crop:p.crop,season:p.season,year:p.year,area_acre:Number((areaHa / ACRE_TO_HA).toFixed(4)),area_ha:Number(areaHa.toFixed(4)),annual_rainfall_mm:p.rainfall,fertilizer_kg:p.fertilizer,pesticide_kg:p.pesticide},
    model_inputs_used:modelInputs,
    context_only_inputs:contextInputs,
    source_dataset:source,
    note:`Chronologically validated historical yield estimate. ${warnings.join(" ")}`
  };
}
