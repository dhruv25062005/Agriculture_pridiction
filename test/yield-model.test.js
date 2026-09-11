import test from "node:test";
import assert from "node:assert/strict";
import { predictYieldModel } from "../models/yield-model-enhanced.js";

test("yield prediction accepts acres and returns tonnes per hectare", () => {
  const r = predictYieldModel({
    state: "Uttar Pradesh",
    crop: "Moong",
    season: "Rabi",
    year: 2026,
    area_acre: 1,
    rainfall: 800,
    fertilizer: 100,
    pesticide: 10
  });
  assert.equal(r.success, true);
  assert.ok(r.yield_tpha > 0);
  assert.equal(r.inputs_used.area_acre, 1);
  assert.ok(Math.abs(r.inputs_used.area_ha - 0.40468564224) < 1e-9);
  assert.ok(r.prediction_interval_tpha.low < r.yield_tpha);
  assert.ok(r.prediction_interval_tpha.high > r.yield_tpha);
});

test("farm area is not a direct yield multiplier when input intensity is unchanged", () => {
  const base = {
    state: "Uttar Pradesh",
    crop: "Wheat",
    season: "Rabi",
    year: 2026,
    rainfall: 600,
    pesticide: 10
  };
  const one = predictYieldModel({ ...base, area_acre: 1, fertilizer: 100, pesticide: 10 });
  const two = predictYieldModel({ ...base, area_acre: 2, fertilizer: 200, pesticide: 20 });
  assert.equal(one.yield_tpha, two.yield_tpha);
  assert.equal(one.inputs_used.area_acre, 1);
  assert.equal(two.inputs_used.area_acre, 2);
  assert.ok(Math.abs(one.inputs_used.fertilizer_kg_per_ha - two.inputs_used.fertilizer_kg_per_ha) < 1e-9);
  assert.ok(Math.abs(one.inputs_used.pesticide_kg_per_ha - two.inputs_used.pesticide_kg_per_ha) < 1e-9);
});
