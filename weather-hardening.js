import "dotenv/config";
import express from "express";

// Strict validation layer for the existing /weather route.
// It prevents blank/random locations and prevents the legacy route from
// silently falling back to Delhi/synthetic weather when the upstream API fails.
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
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(WEATHER_TIMEOUT) });
  if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}`);
  const data = await response.json();
  if (data?.error || !data?.current || !Array.isArray(data?.daily?.time) || !data.daily.time.length) {
    throw new Error(data?.reason || "Weather service returned incomplete forecast data");
  }
  return data;
}

async function weatherGuard(req, res, next) {
  try {
    const hasLat = req.query.lat !== undefined;
    const hasLon = req.query.lon !== undefined;
    if (hasLat || hasLon) {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (!validCoords(lat, lon)) {
        return res.status(400).json({ success: false, error: "Invalid coordinates. Latitude must be -90..90 and longitude -180..180." });
      }
      await verifyLiveForecast(lat, lon);
      return next();
    }

    const city = String(req.query.city || req.query.place || "").trim();
    if (!validPlace(city)) {
      return res.status(400).json({ success: false, error: "Enter a valid city, district, town or village name." });
    }

    const resolved = await resolvePlace(city);
    if (!resolved) {
      return res.status(404).json({ success: false, error: `Location "${city}" was not found. Please enter a real city, district, town or village.` });
    }

    // Feed verified coordinates to the legacy renderer so it cannot use its
    // default-city branch. The upstream check above prevents synthetic data
    // from being returned when the weather provider is unavailable.
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
  if (route === "/weather") {
    return originalGet.call(this, route, weatherGuard, ...handlers);
  }
  return originalGet.call(this, route, ...handlers);
};

// Prevent the dashboard's legacy loadWeather() helper from converting an empty
// search into a default city. The server remains the authoritative validator.
const originalSendFile = express.response.sendFile;
express.response.sendFile = function patchedSendFile(filePath, ...args) {
  if (!String(filePath).endsWith("/templates/signedin.html") && !String(filePath).endsWith("\\templates\\signedin.html")) {
    return originalSendFile.call(this, filePath, ...args);
  }
  import("node:fs/promises").then(({ readFile }) => readFile(filePath, "utf8")).then(html => {
    const injected = `<script>(function(){window.addEventListener('DOMContentLoaded',function(){const original=window.loadWeather;if(typeof original!=='function')return;window.loadWeather=function(cityParam,force){const input=document.getElementById('weatherCityInput');const city=String(cityParam??(input?input.value:'' )).trim();if(!city){const box=document.getElementById('weatherDisplayBox');if(box)box.innerHTML='<div style="padding:20px;text-align:center;color:#cbd5e1">📍 Please enter your farm location first.</div>';return Promise.resolve(null);}return original(city,force);};});})();</script>`;
    return this.send(html.replace(/<\/body>/i, injected + "</body>"));
  }).catch(err => {
    const callback = typeof args.at(-1) === "function" ? args.at(-1) : null;
    if (callback) return callback(err);
    return this.status(500).send("Unable to load dashboard");
  });
};
