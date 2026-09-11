// Enhanced historical yield model.
// Production is excluded because Yield is derived from Production / Area.
// This layer keeps the trained historical signal but prevents known data/unit
// anomalies from being shown as physically implausible farm yields.
import { predictYieldModel as basePredict, MODEL_INFO as BASE_INFO } from "./yield-model-safe.js";

const NUMERIC = {
  mean: [7.60816114, 9.21782823, 7.11897713, 13.68135835, 7.64206659],
  std:  [0.00390958, 2.94737130, 0.52482297, 2.99196104, 2.80563817],
  coef: [0.08732306, 0.09957552, -0.03984865, -0.11086269, 0.09597349],
  intercept: 0.01835822
};

// The source data contains known unit/outlier problems (most notably Coconut).
// These are conservative display guards, not claims of a crop's maximum yield.
// Values are tonnes/hectare and are intentionally broad enough for field data.
const YIELD_BOUNDS = {
  Arecanut:[0.2,5], "Arhar/Tur":[0.2,3], Bajra:[0.2,5], Banana:[5,100], Barley:[0.5,8],
  "Black pepper":[0.1,5], Cardamom:[0.05,3], Cashewnut:[0.1,3], "Castor seed":[0.2,4],
  Coconut:[1,20], Coriander:[0.2,3], "Cotton(lint)":[0.2,5], "Cowpea(Lobia)":[0.2,4],
  "Dry chillies":[0.2,8], Garlic:[1,20], Ginger:[1,40], Gram:[0.2,4], Grapes:[5,50],
  Groundnut:[0.3,6], "Guar seed":[0.2,3], "Horse-gram":[0.2,3], Jowar:[0.2,5], Jute:[1,8],
  Khesari:[0.2,3], Lentil:[0.2,3], Linseed:[0.2,3], Maize:[0.5,15], Mango:[1,20], Masoor:[0.2,3],
  Mesta:[1,10], Moong:[0.2,3], "Moong(Green Gram)":[0.2,3], Moth:[0.2,3], Mustard:[0.2,5],
  "Niger seed":[0.1,3], "Oilseeds total":[0.2,4], Onion:[2,70], "Other Rabi pulses":[0.2,3],
  "Other Cereals":[0.2,5], "Other Kharif pulses":[0.2,4], "Other Summer Pulses":[0.2,4],
  "Peas & beans (Pulses)":[0.3,8], Potato:[3,60], Ragi:[0.2,5], "Rapeseed &Mustard":[0.2,5],
  Rice:[0.5,12], Rubber:[0.3,5], Safflower:[0.1,3], Sannhamp:[0.2,8], Sesamum:[0.1,2.5],
  "Small millets":[0.2,4], Soyabean:[0.3,5], Sugarcane:[20,160], Sunflower:[0.2,5],
  "Sweet potato":[3,40], Tapioca:[5,60], Tobacco:[0.3,5], Tomato:[5,100], Turmeric:[2,40],
  Urad:[0.2,3], Wheat:[0.5,8], "other oilseeds":[0.1,4]
};

const CROP_ALIASES = {
  "Other  Rabi pulses":"Other Rabi pulses",
  "Other  Kharif pulses":"Other Kharif pulses",
  "Other Summer Pulses":"Other Summer Pulses"
};

export const MODEL_INFO = {
  type: "Hybrid historical baseline with bounded residual + agronomic sanity guard",
  target: BASE_INFO.target,
  training_rows: BASE_INFO.training_rows,
  test_rows: BASE_INFO.test_rows,
  production_excluded: true,
  numeric_features: ["Year", "Area", "Annual_Rainfall", "Fertilizer", "Pesticide"],
  test_metrics: {
    mae_tpha: 35.488052,
    rmse_tpha: 428.038149,
    r2: 0.794108,
    median_absolute_error_tpha: 0.479503
  }
};

function residual(input) {
  const values = [input.year, input.area, input.rainfall, input.fertilizer, input.pesticide]
    .map(v => Math.log1p(Number(v)));
  let z = NUMERIC.intercept;
  for (let i = 0; i < values.length; i++) {
    // Limit extrapolation so an extreme farm input cannot dominate the model.
    const standardized = (values[i] - NUMERIC.mean[i]) / NUMERIC.std[i];
    z += NUMERIC.coef[i] * Math.max(-3, Math.min(3, standardized));
  }
  return Math.max(-0.65, Math.min(0.65, z));
}

export function predictYieldModel(input) {
  const normalized = { ...input, crop: CROP_ALIASES[String(input.crop ?? "").trim()] ?? String(input.crop ?? "").trim() };
  const base = basePredict(normalized);
  const correction = residual(normalized);
  const baseYield = Number(base.yield_tpha);
  let predicted = Math.max(0, Math.expm1(Math.log1p(baseYield) + correction));
  const bounds = YIELD_BOUNDS[normalized.crop];
  let sanity_adjusted = false;
  if (bounds) {
    const bounded = Math.min(bounds[1], Math.max(bounds[0], predicted));
    sanity_adjusted = Math.abs(bounded - predicted) > 1e-9;
    predicted = bounded;
  }
  const yield_tpha = Number(predicted.toFixed(3));
  return {
    ...base,
    yield_tpha,
    model: MODEL_INFO.type,
    model_test_metrics: MODEL_INFO.test_metrics,
    sanity_adjusted,
    plausible_range_tpha: bounds ? { min: bounds[0], max: bounds[1] } : null,
    inputs_used: {
      ...base.inputs_used,
      crop: normalized.crop,
      numeric_features_used: MODEL_INFO.numeric_features
    },
    note: "Historical-data estimate with bounded extrapolation and an agronomic sanity guard. The source dataset contains outliers/unit inconsistencies, so implausible values are constrained rather than presented as farm-ready measurements. Test metrics are from the original held-out model and are not a guarantee of farm yield."
  };
}
