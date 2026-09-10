import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { getFirebaseAdminAuth } from "./config/security.js";

const COOKIE = "agri_session";
const history = new Map();
const observedApps = new WeakSet();
const DASHBOARD_BINDING_SRC = "/static/js/dashboard-bindings.js?v=20260910";
const DASHBOARD_BINDING_TAG = `<script src="${DASHBOARD_BINDING_SRC}" defer></script>`;

function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true", sameSite: "lax", path: "/" });
  res.setHeader("Cache-Control", "no-store");
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || "");
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return part.slice(i + 1).trim(); }
  }
  return "";
}

async function verifyDashboardSession(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  try {
    const decoded = await (await getFirebaseAdminAuth()).verifySessionCookie(token, true);
    return decoded?.uid ? decoded : null;
  } catch {
    return null;
  }
}

async function resolveLocation(req) {
  const lat = Number(req.query?.lat), lon = Number(req.query?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return { lat, lon, name: req.query?.city || req.query?.place || "Selected location" };
  const name = String(req.query?.city || req.query?.place || "").trim();
  if (!name) throw Object.assign(new Error("Provide a city/place or valid latitude and longitude."), { status: 400 });
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
  if (!r.ok) throw Object.assign(new Error("Weather location lookup failed."), { status: 503 });
  const data = await r.json(), x = data?.results?.[0];
  if (!x || !Number.isFinite(Number(x.latitude)) || !Number.isFinite(Number(x.longitude))) throw Object.assign(new Error("Location not found. Please enter a valid city."), { status: 400 });
  return { lat: Number(x.latitude), lon: Number(x.longitude), name: [x.name, x.admin1, x.country].filter(Boolean).join(", ") };
}

async function weather(req, res) {
  try {
    const loc = await resolveLocation(req);
    const params = new URLSearchParams({ latitude: String(loc.lat), longitude: String(loc.lon), timezone: "auto", current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,surface_pressure,uv_index", hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,uv_index", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max", forecast_days: "7" });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!r.ok) throw Object.assign(new Error("Weather provider is unavailable."), { status: 503 });
    const data = await r.json();
    if (!data?.current || !Array.isArray(data?.daily?.time)) throw Object.assign(new Error("Weather provider returned incomplete data."), { status: 503 });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ city: loc.name, address: loc.name, latitude: loc.lat, longitude: loc.lon, temperature: data.current.temperature_2m, apparent_temperature: data.current.apparent_temperature, humidity: data.current.relative_humidity_2m, precipitation: data.current.precipitation, weather_code: data.current.weather_code, windSpeed: data.current.wind_speed_10m, windGusts: data.current.wind_gusts_10m, pressure: data.current.surface_pressure, uvIndex: data.current.uv_index, timezone: data.timezone, forecast: data.daily, hourly: data.hourly, source: "Open-Meteo", live: true, fetched_at: new Date().toISOString() });
  } catch (e) {
    return res.status(Number(e?.status) || 503).json({ success: false, error: e?.message || "Weather is temporarily unavailable. No synthetic fallback is used." });
  }
}

async function sendDashboard(req, res) {
  const session = await verifyDashboardSession(req);
  if (!session) return res.redirect("/signin");
  try {
    const file = await fs.readFile(path.join(process.cwd(), "templates", "signedin.html"), "utf8");
    // Always replace any previous binding tag. This makes every deployment use
    // the newest rescue script and prevents stale browser/CDN HTML from
    // pointing at an old JavaScript asset.
    const withoutBindings = file.replace(/<script\s+src=["']\/static\/js\/dashboard-bindings\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi, "");
    const html = withoutBindings.replace(/<\/head>/i, `${DASHBOARD_BINDING_TAG}\n</head>`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.type("html").send(html);
  } catch (err) {
    console.error("Dashboard render failed:", err.message);
    res.status(500).send("Dashboard could not be loaded.");
  }
}

function observer(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = payload => {
    try {
      if (req.path === "/predict" && req.session?.user?.uid && payload?.success) {
        const uid = req.session.user.uid;
        const list = history.get(uid) || [];
        list.unshift({ ...payload });
        history.set(uid, list.slice(0, 50));
      }
    } catch {}
    return originalJson(payload);
  };
  next();
}

const originalUse = express.application.use;
express.application.use = function(route, ...handlers) {
  if (typeof route === "function" && handlers.length === 0 && route !== observer && !observedApps.has(this)) {
    observedApps.add(this);
    originalUse.call(this, observer);
  }
  return originalUse.call(this, route, ...handlers);
};

const originalGet = express.application.get;
express.application.get = function(route, ...handlers) {
  if (route === "/signedin") return this.route(route).get(sendDashboard);
  if (route === "/weather") return originalGet.call(this, route, weather);
  if (route === "/scan_history") return originalGet.call(this, route, (req, res) => {
    const uid = req.session?.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: "Authentication required." });
    res.setHeader("Cache-Control", "no-store");
    const scans = history.get(uid) || [];
    return res.json({ success: true, total: scans.length, scans });
  });
  return originalGet.call(this, route, ...handlers);
};

const originalPost = express.application.post;
express.application.post = function(route, ...handlers) {
  if (route === "/signout" || route === "/logout") return originalPost.call(this, route, (req, res) => { clearSession(res); history.delete(req.session?.user?.uid); res.json({ success: true }); });
  if (route === "/scan_history/delete") return originalPost.call(this, route, (req, res) => { const uid=req.session?.user?.uid; if(!uid)return res.status(401).json({success:false,error:"Authentication required."}); history.delete(uid); res.json({success:true}); });
  return originalPost.call(this, route, ...handlers);
};
