import test from "node:test";
import assert from "node:assert/strict";
import { sessionSecurityOptions } from "../config/security.js";

test("session cookies are HttpOnly and have a bounded lifetime", () => {
  assert.equal(sessionSecurityOptions.httpOnly, true);
  assert.equal(sessionSecurityOptions.maxAge, 5 * 24 * 60 * 60 * 1000);
  assert.equal(sessionSecurityOptions.path, "/");
  assert.ok(["lax", "strict", "none"].includes(sessionSecurityOptions.sameSite));
});
