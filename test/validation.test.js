import test from "node:test";
import assert from "node:assert/strict";
import { validateGeminiResponse, validateFileUpload } from "../middleware/validation.js";

test("Gemini validation rejects incomplete model output", () => {
  assert.equal(validateGeminiResponse(null), false);
  assert.equal(validateGeminiResponse({ plant: "Tomato" }), false);
  assert.equal(validateGeminiResponse({ plant: "Tomato", disease: "Healthy", severity: "Healthy", cause: "None" }), true);
});

test("file validation rejects extension/content mismatch", async () => {
  const req = {
    file: {
      originalname: "leaf.png",
      mimetype: "image/png",
      size: 3,
      buffer: Buffer.from([0xff, 0xd8, 0xff])
    }
  };
  let status = 0;
  let body;
  let nextCalled = false;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; } };
  validateFileUpload(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(status, 400);
  assert.match(body.error, /extension/i);
});
