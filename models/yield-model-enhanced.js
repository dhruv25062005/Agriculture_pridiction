// Enhanced historical yield model.
// Starts from the leakage-safe crop/state/season baseline and applies a
// bounded residual correction learned from Year, Area, rainfall, fertilizer
// and pesticide. Production is never used as an input.
import { predictYieldModel as basePredict, MODEL_INFO as BASE_INFO } from "./yield-model-safe.js";

const NUMERIC = {
  mean: [7.60816114, 9.21782823, 7.11897713, 13.68135835, 7.64206659],
  std:  [0.00390958, 2.94737130, 0.52482297, 2.99196104, 2.80563817],
  coef: [0.08732306, 0.09957552, -0.03984865, -0.11086269, 0.09597349],
  intercept: 0.01835822
};

export const MODEL_INFO = {
  type: "Hybrid historical baseline (crop/state/season + numeric residual)",
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
    z += NUMERIC.coef[i] * ((values[i] - NUMERIC.mean[i]) / NUMERIC.std[i]);
  }
  return Math.max(-0.65, Math.min(0.65, z));
}

export function predictYieldModel(input) {
  const base = basePredict(input);
  const correction = residual(input);
  const baseYield = Number(base.yield_tpha);
  const yield_tpha = Math.max(0, Math.expm1(Math.log1p(baseYield) + correction));
  return {
    ...base,
    yield_tpha: Number(yield_tpha.toFixed(3)),
    model: MODEL_INFO.type,
    model_test_metrics: MODEL_INFO.test_metrics,
    inputs_used: {
      ...base.inputs_used,
      numeric_features_used: MODEL_INFO.numeric_features
    },
    note: "Historical-data estimate using crop/state/season history plus a bounded correction from all supplied numeric inputs. Production is excluded to prevent target leakage. Test metrics describe the held-out dataset and are not a guarantee of farm yield."
  };
}
