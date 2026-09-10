import "dotenv/config";
import express from "express";

// Strict validation layer for the existing /weather route.
// It validates the location, verifies a live Open-Meteo forecast, and normalizes
// the legacy agricultural response so every dashboard field has a stable name.
const originalGet = express.application.get;
const GEO_TIMEOUT = 5000;
const WEATHER_TIMEOUT = 7000;

function validPlace(value) {
  const s = String(value ?? "").trim();
  return s.length >= 2 && s.length <= 100 && !/[\u0000-\u001f\u007f]/.test(s) && /[\p{L}\p{N}]/u.test(s);
}

function validCoords(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const n = finite(value);
    if (n !== null) return n;
  }
  return null;
}

function normalizeWeatherPayload(payload) {
  if (!payload || typeof payload !== "object" || payload.success === false) return payload;

  const out = { ...payload };
  const temp = firstFinite(out.temperature, out.temperature_2m);
  const humidity = firstFinite(out.humidity, out.relative_humidity_2m);
  const wind = firstFinite(out.windSpeed, out.wind_speed, out.wind_speed_10m);
  const gusts = firstFinite(out.wind_gusts, out.windGusts, out.wind_gusts_10m);
  const rain = firstFinite(out.precipitation, out.rain, out.precipitation_current) ?? 0;
  const uv = firstFinite(out.uv_index, out.uvIndex);

  if (out.temperature == null && temp !== null) out.temperature = temp;
  if (out.humidity == null && humidity !== null) out.humidity = humidity;
  if (out.windSpeed == null && wind !== null) out.windSpeed = wind;
  if (out.wind_gusts == null && gusts !== null) out.wind_gusts = gusts;
  if (out.windGusts == null && gusts !== null) out.windGusts = gusts;
  if (out.precipitation == null) out.precipitation = rain;
  if (out.uv_index == null && uv !== null) out.uv_index = uv;
  if (out.uvIndex == null && uv !== null) out.uvIndex = uv;

  const daily = Array.isArray(out.daily_forecast) ? out.daily_forecast : (Array.isArray(out.forecast) ? out.forecast : []);
  const hourly = Array.isArray(out.hourly_forecast) ? out.hourly_forecast : (Array.isArray(out.hourly) ? out.hourly : []);
  if (!Array.isArray(out.daily_forecast)) out.daily_forecast = daily;
  if (!Array.isArray(out.hourly_forecast)) out.hourly_forecast = hourly;
  if (!Array.isArray(out.forecast) && daily.length) out.forecast = daily;

  const et0 = firstFinite(out.et0_evapotranspiration, out.et0, daily[0]?.et0, daily[0]?.et0_fao_evapotranspiration);
  if (out.et0_evapotranspiration == null && et0 !== null) out.et0_evapotranspiration = et0;

  let score = finite(out.spray_score);
  if (score === null) {
    score = 100;
    if (wind !== null) {
      if (wind >= 15) score -= 35;
      else if (wind >= 11) score -= 15;
    }
    if (rain > 0.2) score -= rain >= 1.5 ? 35 : 20;
    if (humidity !== null && humidity < 35) score -= 15;
    if (temp !== null && temp > 34) score -= 20;
    score = Math.max(10, Math.min(100, score));
  }
  out.spray_score = Math.round(score);

  const safe = score >= 75;
  const caution = score >= 50 && score < 75;
  if (!out.spray_badge) out.spray_badge = safe ? "🟢 Safe for Pesticide & Foliar Fertigation" : caution ? "🟡 Caution: Marginal Spray Conditions" : "🔴 Hold Spraying (Adverse Microclimate)";
  if (!out.spray_status) out.spray_status = safe ? "Optimal Spray Window" : caution ? "Spray with Caution (Use Coarse Droplets)" : "Cease Foliar Applications";
  if (!out.spray_safety) out.spray_safety = safe ? "SAFE" : caution ? "CAUTION" : "UNSAFE";
  if (!Array.isArray(out.spray_reasons)) out.spray_reasons = out.spray_reason ? [String(out.spray_reason)] : [];
  if (!out.spray_reason) out.spray_reason = out.spray_reasons.join(". ") || (safe ? "Wind, rain and temperature are within the configured spray limits." : "Current weather conditions are not suitable for spraying.");
  if (!out.spray_window) out.spray_window = safe ? "6:00 AM - 9:30 AM & 4:30 PM - 7:00 PM" : "Wait for wind < 14 km/h and dry conditions";

  const precipitation = rain;
  if (out.irrigation_advice == null) {
    if (precipitation > 5) out.irrigation_advice = `Precipitation of ${precipitation} mm recorded. Suspend irrigation to avoid waterlogging.`;
    else if (et0 !== null && et0 >= 5) out.irrigation_advice = `High daily ET0 (${et0.toFixed(1)} mm/day). Schedule irrigation in the early morning to reduce evaporative loss.`;
    else if (et0 !== null) out.irrigation_advice = `Standard ET0 (${et0.toFixed(1)} mm/day). Maintain the normal crop irrigation schedule.`;
    else out.irrigation_advice = "Irrigation advice is unavailable because ET0 data was not returned by the weather provider.";
  }

  if (!out.fungal_risk_index) {
    if (humidity !== null && temp !== null && humidity > 78 && temp >= 17 && temp <= 27) out.fungal_risk_index = "Elevated (High Inoculum Pressure)";
    else if (humidity !== null && temp !== null && humidity > 68 && temp >= 22) out.fungal_risk_index = "Moderate";
    else out.fungal_risk_index = "Low";
  }
  if (!out.fungal_advice) {
    out.fungal_advice = out.fungal_risk_index === "Low" ? "Microclimate is relatively stable. Continue regular crop scouting." : "Humidity and temperature favor disease development. Increase canopy scouting and avoid prolonged leaf wetness.";
  }

  if (out.city == null) out.city = out.address || "Selected location";
  if (out.source == null) out.source = "Open-Meteo";
  if (out.live == null) out.live = true;
  out.normalized_at = new Date().toISOString();
  return out;
}

function installResponseNormalizer(req, res) {
  if (res.__weatherNormalizerInstalled) return;
  res.__weatherNormalizerInstalled = true;
  const originalJson = res.json.bind(res);
  res.json = payload => originalJson(normalizeWeatherPayload(payload));
}

async function resolvePlace(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(GEO_TIMEOUT) });
  if (!response.ok) throw new Error(`Geocoding service returned HTTP ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  if (!results.length) return null;
  const top = results[0];
  const lat = Number(top.latitude);
  const lon = Number(top.longitude);
  if (!validCoords(lat, lon)) return null;
  const parts = [top.name, top.admin1, top.country].filter((v, i, a) => v && a.indexOf(v) === i);
  return { lat, lon, name: parts.join(", ") };
}

async function verifyLiveForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    timezone: "auto", forecast_days: "7"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(WEATHER_TIMEOUT) });
  if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}`);
  const data = await response.json();
  if (data?.error || !data?.current || !Array.isArray(data?.daily?.time) || !data.daily.time.length) throw new Error(data?.reason || "Weather service returned incomplete forecast data");
  return data;
}

async function weatherGuard(req, res, next) {
  installResponseNormalizer(req, res);
  try {
    const hasLat = req.query.lat !== undefined;
    const hasLon = req.query.lon !== undefined;
    if (hasLat || hasLon) {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (!validCoords(lat, lon)) return res.status(400).json({ success: false, error: "Invalid coordinates. Latitude must be -90..90 and longitude -180..180." });
      await verifyLiveForecast(lat, lon);
      return next();
    }

    const city = String(req.query.city || req.query.place || "").trim();
    if (!validPlace(city)) return res.status(400).json({ success: false, error: "Enter a valid city, district, town or village name." });
    const resolved = await resolvePlace(city);
    if (!resolved) return res.status(404).json({ success: false, error: `Location "${city}" was not found. Please enter a real city, district, town or village.` });
    req.query.lat = String(resolved.lat);
    req.query.lon = String(resolved.lon);
    req.query.place = resolved.name;
    await verifyLiveForecast(resolved.lat, resolved.lon);
    return next();
  } catch (error) {
    console.error("Weather validation error:", error.message);
    return res.status(502).json({ success: false, error: "Live weather data is temporarily unavailable. Please try again." });
  }
}

express.application.get = function patchedWeatherGet(route, ...handlers) {
  if (route === "/weather") return originalGet.call(this, route, weatherGuard, ...handlers);
  return originalGet.call(this, route, ...handlers);
};

// Prevent the dashboard's legacy loadWeather() helper from converting an empty search into a default city.
const originalSendFile = express.response.sendFile;
express.response.sendFile = function patchedSendFile(filePath, ...args) {
  if (!String(filePath).endsWith("/templates/signedin.html") && !String(filePath).endsWith("\\templates\\signedin.html")) return originalSendFile.call(this, filePath, ...args);
  import("node:fs/promises").then(({ readFile }) => readFile(filePath, "utf8")).then(html => {
    const injected = `<script>(function(){window.addEventListener('DOMContentLoaded',function(){const original=window.loadWeather;if(typeof original!=='function')return;window.loadWeather=function(cityParam,force){const input=document.getElementById('weatherCityInput');const city=String(cityParam??(input?input.value:'' )).trim();if(!city){const box=document.getElementById('weatherDisplayBox');if(box)box.innerHTML='<div style="padding:20px;text-align:center;color:#cbd5e1">📍 Please enter your farm location first.</div>';return Promise.resolve(null);}return original(city,force);};});})();</script>`;
    return this.send(html.replace(/<\/body>/i, injected + "</body>"));
  }).catch(err => {
    const callback = typeof args.at(-1) === "function" ? args.at(-1) : null;
    if (callback) return callback(err);
    return this.status(500).send("Unable to load dashboard");
  });
};
