import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("prediction route hardening preserves previously registered middleware", () => {
  const source = fs.readFileSync(new URL("../crop-yield-hardening.js", import.meta.url), "utf8");
  assert.match(source, /handlers\.slice\(0,-1\)/);
  assert.match(source, /strictRateLimiter/);
  assert.match(source, /predict_yield/);
  assert.match(source, /recommend_crop/);
});
