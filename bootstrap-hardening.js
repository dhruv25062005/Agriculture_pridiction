// Single entry-point bootstrap for production environments that start with `node server.js`.
// Keeping the hardening imports here means Render/other hosts cannot accidentally skip
// the route/UI fixes by using a custom start command.
import "./app-hardening.js";
import "./disease-hardening.js";
import "./disease-fast.js";
import "./weather-hardening.js";
import "./runtime-fixes.js";
import "./crop-yield-hardening.js";
