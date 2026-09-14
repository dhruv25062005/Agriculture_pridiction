
import "dotenv/config";
import express from "express";

/*
 * Weather Hardening Layer
 *
 * Purpose:
 * 1. Validate weather requests.
 * 2. Resolve city/place names to coordinates.
 * 3. Verify that the weather provider is responding.
 * 4. Normalize weather responses.
 * 5. Add agricultural weather indicators.
 * 6. Cache geocoding and weather verification requests.
 *
 * This file does NOT replace the existing /weather route.
 */

const originalGet = express.application.get;

/* ----------------------------- CONFIGURATION ----------------------------- */

const GEO_TIMEOUT = Number(process.env.WEATHER_GEO_TIMEOUT_MS) > 0
  ? Number(process.env.WEATHER_GEO_TIMEOUT_MS)
  : 6000;

const WEATHER_TIMEOUT = Number(process.env.WEATHER_TIMEOUT_MS) > 0
  ? Number(process.env.WEATHER_TIMEOUT_MS)
  : 10000;

const RETRIES = Number(process.env.WEATHER_RETRIES) >= 0
  ? Math.min(Number(process.env.WEATHER_RETRIES), 2)
  : 1;

const GEO_CACHE_TTL = Number(process.env.WEATHER_GEO_CACHE_TTL_MS) > 0
  ? Number(process.env.WEATHER_GEO_CACHE_TTL_MS)
  : 60 * 60 * 1000;

const WEATHER_CACHE_TTL = Number(process.env.WEATHER_CACHE_TTL_MS) > 0
  ? Number(process.env.WEATHER_CACHE_TTL_MS)
  : 2 * 60 * 1000;

const MAX_CACHE_SIZE = 250;

/* ------------------------------- CACHES --------------------------------- */

const geocodeCache = new Map();
const weatherCache = new Map();

/* ------------------------------- HELPERS -------------------------------- */

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function firstFinite() {
  for (const value of arguments) {
    const number = toFiniteNumber(value);

    if (number !== null) {
      return number;
    }
  }

  return null;
}

function validCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function validPlace(value) {
  const place = String(value == null ? "" : value).trim();

  if (place.length < 2 || place.length > 100) {
    return false;
  }

  if (/[\u0000-\u001f\u007f]/.test(place)) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(place);
}

function normalizePlaceKey(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function coordinatesKey(latitude, longitude) {
  return (
    Number(latitude).toFixed(4) +
    "," +
    Number(longitude).toFixed(4)
  );
}

function sleep(milliseconds) {
  return new Promise(function resolveSleep(resolve) {
    setTimeout(resolve, milliseconds);
  });
}

/* ------------------------------- CACHE ---------------------------------- */

function cacheGet(cache, key, ttl) {
  const item = cache.get(key);

  if (!item) {
    return null;
  }

  if (Date.now() - item.timestamp > ttl) {
    cache.delete(key);
    return null;
  }

  /*
   * Refresh insertion order so frequently used entries stay recent.
   */
  cache.delete(key);
  cache.set(key, item);

  return item.value;
}

function cacheSet(cache, key, value) {
  cache.delete(key);

  cache.set(key, {
    value: value,
    timestamp: Date.now()
  });

  while (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;

    if (firstKey === undefined) {
      break;
    }

    cache.delete(firstKey);
  }
}

/* --------------------------- HTTP REQUESTS ------------------------------ */

async function fetchJson(url, timeout) {
  let lastError = null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();

    const timer = setTimeout(function abortRequest() {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.ok) {
        return await response.json();
      }

      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;

      const error = new Error(
        "Weather provider returned HTTP " + response.status
      );

      error.status = response.status;

      if (!retryable || attempt >= RETRIES) {
        throw error;
      }

      lastError = error;
      await sleep(250 * (attempt + 1));
    } catch (error) {
      clearTimeout(timer);

      if (error && error.name === "AbortError") {
        lastError = new Error(
          "Weather provider request timed out after " +
          timeout +
          " ms"
        );
      } else {
        lastError = error;
      }

      if (attempt >= RETRIES) {
        throw lastError;
      }

      await sleep(250 * (attempt + 1));
    }
  }

  throw lastError || new Error("Weather request failed");
}

/* --------------------------- AGRICULTURE -------------------------------- */

function calculateSprayScore(weather) {
  let score = 100;

  const wind = toFiniteNumber(weather.windSpeed);
  const gusts = toFiniteNumber(weather.windGusts);
  const rain = firstFinite(
    weather.precipitation,
    weather.rain,
    weather.precipitation_current
  );
  const humidity = toFiniteNumber(weather.humidity);
  const temperature = toFiniteNumber(weather.temperature);

  const actualRain = rain === null ? 0 : rain;

  if (wind !== null) {
    if (wind >= 15) {
      score -= 35;
    } else if (wind >= 11) {
      score -= 15;
    }
  }

  if (gusts !== null && gusts >= 25) {
    score -= 15;
  }

  if (actualRain >= 1.5) {
    score -= 35;
  } else if (actualRain > 0.2) {
    score -= 20;
  }

  if (humidity !== null && humidity < 35) {
    score -= 15;
  }

  if (temperature !== null && temperature > 34) {
    score -= 20;
  }

  return Math.max(10, Math.min(100, Math.round(score)));
}

function getSprayCategory(score) {
  if (score >= 75) {
    return "SAFE";
  }

  if (score >= 50) {
    return "CAUTION";
  }

  return "UNSAFE";
}

function buildSprayReasons(weather, score) {
  const reasons = [];

  const wind = toFiniteNumber(weather.windSpeed);
  const gusts = toFiniteNumber(weather.windGusts);
  const rain = firstFinite(
    weather.precipitation,
    weather.rain,
    weather.precipitation_current
  );
  const humidity = toFiniteNumber(weather.humidity);
  const temperature = toFiniteNumber(weather.temperature);

  if (wind !== null && wind >= 11) {
    reasons.push(
      "Wind speed is elevated at " +
      wind.toFixed(1) +
      " km/h."
    );
  }

  if (gusts !== null && gusts >= 25) {
    reasons.push(
      "Wind gusts may cause spray drift."
    );
  }

  if (rain !== null && rain > 0.2) {
    reasons.push(
      "Recent precipitation may reduce foliar application effectiveness."
    );
  }

  if (humidity !== null && humidity < 35) {
    reasons.push(
      "Low humidity may increase evaporation."
    );
  }

  if (temperature !== null && temperature > 34) {
    reasons.push(
      "High temperature can increase crop and spray stress."
    );
  }

  if (reasons.length === 0) {
    if (score >= 75) {
      reasons.push(
        "Wind, rainfall, humidity and temperature are within the configured spray limits."
      );
    } else {
      reasons.push(
        "Current weather conditions require caution before spraying."
      );
    }
  }

  return reasons;
}

function buildIrrigationAdvice(weather, et0) {
  const rain = firstFinite(
    weather.precipitation,
    weather.rain,
    weather.precipitation_current
  );

  if (rain !== null && rain > 5) {
    return (
      "Precipitation of " +
      rain.toFixed(1) +
      " mm was reported. Consider reducing or suspending irrigation to avoid waterlogging."
    );
  }

  if (et0 !== null && et0 >= 5) {
    return (
      "High daily ET0 (" +
      et0.toFixed(1) +
      " mm/day). Consider early-morning irrigation to reduce evaporative losses."
    );
  }

  if (et0 !== null) {
    return (
      "Daily ET0 is " +
      et0.toFixed(1) +
      " mm/day. Maintain the normal irrigation schedule while monitoring soil moisture."
    );
  }

  return (
    "Irrigation advice is unavailable because ET0 data was not returned by the weather provider."
  );
}

function calculateFungalRisk(weather) {
  const humidity = toFiniteNumber(weather.humidity);
  const temperature = toFiniteNumber(weather.temperature);

  if (
    humidity !== null &&
    temperature !== null &&
    humidity > 78 &&
    temperature >= 17 &&
    temperature <= 27
  ) {
    return "Elevated";
  }

  if (
    humidity !== null &&
    temperature !== null &&
    humidity > 68 &&
    temperature >= 22
  ) {
    return "Moderate";
  }

  return "Low";
}

function fungalAdvice(risk) {
  if (risk === "Elevated") {
    return (
      "Humidity and temperature strongly favor fungal disease development. Increase crop scouting and avoid prolonged leaf wetness."
    );
  }

  if (risk === "Moderate") {
    return (
      "Weather conditions may support fungal disease development. Monitor crop canopy and leaf wetness closely."
    );
  }

  return (
    "Current temperature and humidity conditions indicate comparatively lower fungal disease pressure. Continue regular crop scouting."
  );
}

/* -------------------------- NORMALIZATION ------------------------------- */

function normalizeWeatherPayload(payload, liveVerified) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.success === false
  ) {
    return payload;
  }

  const output = Object.assign({}, payload);

  const temperature = firstFinite(
    output.temperature,
    output.temperature_2m
  );

  const humidity = firstFinite(
    output.humidity,
    output.relative_humidity_2m
  );

  const windSpeed = firstFinite(
    output.windSpeed,
    output.wind_speed,
    output.wind_speed_10m
  );

  const windGusts = firstFinite(
    output.wind_gusts,
    output.windGusts,
    output.wind_gusts_10m
  );

  const precipitation = firstFinite(
    output.precipitation,
    output.rain,
    output.precipitation_current
  );

  const uvIndex = firstFinite(
    output.uv_index,
    output.uvIndex
  );

  if (output.temperature == null && temperature !== null) {
    output.temperature = temperature;
  }

  if (output.humidity == null && humidity !== null) {
    output.humidity = humidity;
  }

  if (output.windSpeed == null && windSpeed !== null) {
    output.windSpeed = windSpeed;
  }

  if (output.wind_gusts == null && windGusts !== null) {
    output.wind_gusts = windGusts;
  }

  if (output.windGusts == null && windGusts !== null) {
    output.windGusts = windGusts;
  }

  if (output.precipitation == null) {
    output.precipitation =
      precipitation === null ? 0 : precipitation;
  }

  if (output.uv_index == null && uvIndex !== null) {
    output.uv_index = uvIndex;
  }

  if (output.uvIndex == null && uvIndex !== null) {
    output.uvIndex = uvIndex;
  }

  const daily = Array.isArray(output.daily_forecast)
    ? output.daily_forecast
    : Array.isArray(output.forecast)
      ? output.forecast
      : [];

  const hourly = Array.isArray(output.hourly_forecast)
    ? output.hourly_forecast
    : Array.isArray(output.hourly)
      ? output.hourly
      : [];

  if (!Array.isArray(output.daily_forecast)) {
    output.daily_forecast = daily;
  }

  if (!Array.isArray(output.hourly_forecast)) {
    output.hourly_forecast = hourly;
  }

  if (!Array.isArray(output.forecast) && daily.length > 0) {
    output.forecast = daily;
  }

  const firstDay =
    daily.length > 0 && daily[0]
      ? daily[0]
      : null;

  const et0 = firstFinite(
    output.et0_evapotranspiration,
    output.et0,
    firstDay && firstDay.et0,
    firstDay && firstDay.et0_fao_evapotranspiration
  );

  if (
    output.et0_evapotranspiration == null &&
    et0 !== null
  ) {
    output.et0_evapotranspiration = et0;
  }

  const agriculturalWeather = {
    temperature: temperature,
    humidity: humidity,
    windSpeed: windSpeed,
    windGusts: windGusts,
    precipitation: precipitation
  };

  const sprayScore =
    toFiniteNumber(output.spray_score) === null
      ? calculateSprayScore(agriculturalWeather)
      : Math.max(
        0,
        Math.min(
          100,
          Math.round(Number(output.spray_score))
        )
      );

  output.spray_score = sprayScore;

  const sprayCategory = getSprayCategory(sprayScore);

  if (!output.spray_safety) {
    output.spray_safety = sprayCategory;
  }

  if (!output.spray_badge) {
    if (sprayCategory === "SAFE") {
      output.spray_badge =
        "🟢 Safe for Pesticide & Foliar Fertigation";
    } else if (sprayCategory === "CAUTION") {
      output.spray_badge =
        "🟡 Caution: Marginal Spray Conditions";
    } else {
      output.spray_badge =
        "🔴 Hold Spraying (Adverse Microclimate)";
    }
  }

  if (!output.spray_status) {
    if (sprayCategory === "SAFE") {
      output.spray_status = "Optimal Spray Window";
    } else if (sprayCategory === "CAUTION") {
      output.spray_status =
        "Spray with Caution";
    } else {
      output.spray_status =
        "Cease Foliar Applications";
    }
  }

  if (!Array.isArray(output.spray_reasons)) {
    output.spray_reasons =
      buildSprayReasons(
        agriculturalWeather,
        sprayScore
      );
  }

  if (!output.spray_reason) {
    output.spray_reason =
      output.spray_reasons.join(" ");
  }

  if (!output.spray_window) {
    if (sprayCategory === "SAFE") {
      output.spray_window =
        "6:00 AM - 9:30 AM and 4:30 PM - 7:00 PM";
    } else {
      output.spray_window =
        "Wait for lower wind and dry conditions.";
    }
  }

  if (output.irrigation_advice == null) {
    output.irrigation_advice =
      buildIrrigationAdvice(
        agriculturalWeather,
        et0
      );
  }

  if (!output.fungal_risk_index) {
    output.fungal_risk_index =
      calculateFungalRisk(
        agriculturalWeather
      );
  }

  if (!output.fungal_advice) {
    output.fungal_advice =
      fungalAdvice(
        output.fungal_risk_index
      );
  }

  if (output.city == null) {
    output.city =
      output.address ||
      output.place ||
      "Selected location";
  }

  if (
    output.source == null &&
    liveVerified === true
  ) {
    output.source = "Open-Meteo";
  }

  /*
   * Only mark the response live when this middleware actually
   * verified the provider.
   */
  output.live =
    liveVerified === true ||
    output.live === true;

  output.normalized_at =
    new Date().toISOString();

  return output;
}

/* ------------------------- RESPONSE PATCH ------------------------------- */

function installResponseNormalizer(res) {
  if (res.__weatherNormalizerInstalled) {
    return;
  }

  res.__weatherNormalizerInstalled = true;

  const originalJson =
    res.json.bind(res);

  res.json = function normalizedJson(payload) {
    const liveVerified =
      Boolean(res.locals.weatherLiveVerified);

    return originalJson(
      normalizeWeatherPayload(
        payload,
        liveVerified
      )
    );
  };
}

/* -------------------------- GEOCODING ----------------------------------- */

async function resolvePlace(query) {
  const key = normalizePlaceKey(query);

  if (!key) {
    return null;
  }

  const cached = cacheGet(
    geocodeCache,
    key,
    GEO_CACHE_TTL
  );

  if (cached) {
    return cached;
  }

  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    "?name=" +
    encodeURIComponent(query) +
    "&count=5" +
    "&language=en" +
    "&format=json";

  const data = await fetchJson(
    url,
    GEO_TIMEOUT
  );

  const results =
    Array.isArray(data && data.results)
      ? data.results
      : [];

  if (results.length === 0) {
    return null;
  }

  let selected = null;

  for (const result of results) {
    const latitude =
      Number(result.latitude);

    const longitude =
      Number(result.longitude);

    if (
      validCoordinates(
        latitude,
        longitude
      )
    ) {
      selected = {
        latitude: latitude,
        longitude: longitude,
        result: result
      };

      break;
    }
  }

  if (!selected) {
    return null;
  }

  const result = selected.result;

  const parts = [
    result.name,
    result.admin1,
    result.country
  ].filter(function validPart(value) {
    return Boolean(value);
  });

  const resolved = {
    lat: selected.latitude,
    lon: selected.longitude,
    name: parts.join(", ")
  };

  cacheSet(
    geocodeCache,
    key,
    resolved
  );

  return resolved;
}

/* ------------------------- WEATHER VERIFY ------------------------------- */

async function verifyLiveForecast(
  latitude,
  longitude
) {
  const key = coordinatesKey(
    latitude,
    longitude
  );

  const cached = cacheGet(
    weatherCache,
    key,
    WEATHER_CACHE_TTL
  );

  if (cached) {
    return cached;
  }

  const params =
    new URLSearchParams();

  params.set(
    "latitude",
    String(latitude)
  );

  params.set(
    "longitude",
    String(longitude)
  );

  params.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "wind_speed_10m",
      "wind_gusts_10m",
      "precipitation",
      "weather_code"
    ].join(",")
  );

  params.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "et0_fao_evapotranspiration"
    ].join(",")
  );

  params.set(
    "timezone",
    "auto"
  );

  params.set(
    "forecast_days",
    "7"
  );

  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    params.toString();

  const data = await fetchJson(
    url,
    WEATHER_TIMEOUT
  );

  if (
    !data ||
    data.error ||
    !data.current ||
    !data.daily ||
    !Array.isArray(data.daily.time) ||
    data.daily.time.length === 0
  ) {
    throw new Error(
      data && data.reason
        ? String(data.reason)
        : "Weather provider returned incomplete forecast data"
    );
  }

  cacheSet(
    weatherCache,
    key,
    data
  );

  return data;
}

/* ---------------------------- MIDDLEWARE -------------------------------- */

async function weatherGuard(
  req,
  res,
  next
) {
  installResponseNormalizer(res);

  try {
    const hasLat =
      req.query.lat !== undefined;

    const hasLon =
      req.query.lon !== undefined;

    /*
     * Coordinate request.
     */
    if (hasLat || hasLon) {
      const latitude =
        Number(req.query.lat);

      const longitude =
        Number(req.query.lon);

      if (
        !validCoordinates(
          latitude,
          longitude
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid coordinates. Latitude must be between -90 and 90 and longitude between -180 and 180."
        });
      }

      const weather =
        await verifyLiveForecast(
          latitude,
          longitude
        );

      req.weatherVerified =
        weather;

      req.weatherCoordinates = {
        lat: latitude,
        lon: longitude
      };

      res.locals.weatherLiveVerified =
        true;

      return next();
    }

    /*
     * City/place request.
     */
    const city = String(
      req.query.city ||
      req.query.place ||
      ""
    ).trim();

    if (!validPlace(city)) {
      return res.status(400).json({
        success: false,
        error:
          "Enter a valid city, district, town or village name."
      });
    }

    const resolved =
      await resolvePlace(city);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        error:
          "Location \"" +
          city +
          "\" was not found. Please enter a real city, district, town or village."
      });
    }

    /*
     * Preserve compatibility with the existing /weather route.
     */
    req.query.lat =
      String(resolved.lat);

    req.query.lon =
      String(resolved.lon);

    req.query.place =
      resolved.name;

    const weather =
      await verifyLiveForecast(
        resolved.lat,
        resolved.lon
      );

    req.weatherVerified =
      weather;

    req.weatherCoordinates = {
      lat: resolved.lat,
      lon: resolved.lon
    };

    req.weatherResolvedPlace =
      resolved;

    res.locals.weatherLiveVerified =
      true;

    return next();
  } catch (error) {
    console.error(
      "Weather validation error:",
      error && error.message
        ? error.message
        : error
    );

    return res.status(502).json({
      success: false,
      error:
        "Live weather data is temporarily unavailable. Please try again."
    });
  }
}

/* ------------------------- EXPRESS PATCH -------------------------------- */

/*
 * Only intercept the existing /weather route.
 * All other GET routes remain untouched.
 */
express.application.get =
  function patchedWeatherGet(
    route,
    ...handlers
  ) {
    if (route === "/weather") {
      return originalGet.call(
        this,
        route,
        weatherGuard,
        ...handlers
      );
    }

    return originalGet.call(
      this,
      route,
      ...handlers
    );
  };

/* ------------------------------ STATUS ---------------------------------- */

console.log(
  "[weather-hardening] Weather validation layer loaded."
);
console.log(
  "[weather-hardening] Geo timeout: " +
  GEO_TIMEOUT +
  " ms"
);
console.log(
  "[weather-hardening] Weather timeout: " +
  WEATHER_TIMEOUT +
  " ms"
);
console.log(
  "[weather-hardening] Retries: " +
  RETRIES
);

