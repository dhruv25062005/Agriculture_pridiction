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
  assert.ok(r.indicative_range_tpha.low < r.yield_tpha);
  assert.ok(r.indicative_range_tpha.high >= r.yield_tpha);
  assert.equal(r.confidence, "Low");
  assert.ok(r.model_inputs_used.includes("Crop"));
});

test("farm area does not directly change yield per hectare", () => {
  const base = {
    state: "Uttar Pradesh",
    crop: "Wheat",
    season: "Rabi",
    year: 2020,
    rainfall: 600,
    fertilizer: 100,
    pesticide: 10
  };
  const one = predictYieldModel({ ...base, area_acre: 1 });
  const two = predictYieldModel({ ...base, area_acre: 2 });
  assert.equal(one.yield_tpha, two.yield_tpha);
  assert.equal(one.inputs_used.area_acre, 1);
  assert.equal(two.inputs_used.area_acre, 2);
  assert.ok(two.estimated_production_tonnes > one.estimated_production_tonnes);
});

test("unsupported categories are rejected instead of falling back to a global average", () => {
  assert.throws(() => predictYieldModel({
    state: "Unknown State",
    crop: "Wheat",
    season: "Rabi",
    year: 2020,
    area_acre: 1,
    rainfall: 600,
    fertilizer: 100,
    pesticide: 10
  }), /Unsupported state/);
});
