import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { getFirebaseAdminAuth } from "./config/security.js";

const COOKIE = "agri_session";
const history = new Map();
const observedApps = new WeakSet();
const DASHBOARD_BINDING_SRC = "/static/js/dashboard-bindings.js?v=20260910-crop-yield-1";
const DASHBOARD_BINDING_TAG = `<script src="${DASHBOARD_BINDING_SRC}" defer></script>`;
const DISABLED_SW = `// KisanAI service worker disabled for compatibility.\nconst KISANAI_SW_VERSION = "disabled-2026-09-10-v1";\nself.addEventListener("install", event => event.waitUntil(self.skipWaiting()));\nself.addEventListener("activate", event => event.waitUntil(self.clients.claim()));\n`;

function clearSession(res) { res.clearCookie(COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true", sameSite: "lax", path: "/" }); res.setHeader("Cache-Control", "no-store"); }
function readCookie(req, name) { const header = String(req.headers.cookie || ""); for (const part of header.split(";")) { const i = part.indexOf("="); if (i < 0 || part.slice(0, i).trim() !== name) continue; try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return part.slice(i + 1).trim(); } } return ""; }
async function verifyDashboardSession(req) { const token = readCookie(req, COOKIE); if (!token) return null; try { const decoded = await (await getFirebaseAdminAuth()).verifySessionCookie(token, true); return decoded?.uid ? decoded : null; } catch { return null; } }
async function sendDashboard(req, res) {
  const session = await verifyDashboardSession(req); if (!session) return res.redirect("/signin");
  try {
    const file = await fs.readFile(path.join(process.cwd(), "templates", "signedin.html"), "utf8");
    const normalized = file.replaceAll("https://www.gstatic.com/firebasejs/10.8.0/", "https://www.gstatic.com/firebasejs/12.18.0/");
    const withoutBindings = normalized.replace(/<script\s+src=["']\/static\/js\/dashboard-bindings\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi, "");
    const html = withoutBindings.replace(/<\/head>/i, `${DASHBOARD_BINDING_TAG}\n</head>`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"); res.setHeader("Pragma", "no-cache"); res.setHeader("Expires", "0"); res.setHeader("Surrogate-Control", "no-store"); res.type("html").send(html);
  } catch (err) { console.error("Dashboard render failed:", err.message); res.status(500).send("Dashboard could not be loaded."); }
}
function observer(req, res, next) { const originalJson = res.json.bind(res); res.json = payload => { try { if (req.path === "/predict" && req.session?.user?.uid && payload?.success) { const uid = req.session.user.uid; const list = history.get(uid) || []; list.unshift({ ...payload }); history.set(uid, list.slice(0, 50)); } } catch {} return originalJson(payload); }; next(); }
const originalUse = express.application.use;
express.application.use = function(route, ...handlers) { if (typeof route === "function" && handlers.length === 0 && route !== observer && !observedApps.has(this)) { observedApps.add(this); originalUse.call(this, observer); } return originalUse.call(this, route, ...handlers); };
const originalGet = express.application.get;
express.application.get = function(route, ...handlers) {
  if (route === "/sw.js") return originalGet.call(this, route, (_req, res) => { res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"); res.setHeader("Pragma", "no-cache"); res.type("application/javascript").send(DISABLED_SW); });
  if (route === "/signedin") return this.route(route).get(sendDashboard);
  if (route === "/scan_history") return originalGet.call(this, route, (req, res) => { const uid = req.session?.user?.uid; if (!uid) return res.status(401).json({ success: false, error: "Authentication required." }); res.setHeader("Cache-Control", "no-store"); const scans = history.get(uid) || []; return res.json({ success: true, total: scans.length, scans }); });
  return originalGet.call(this, route, ...handlers);
};
const originalPost = express.application.post;
express.application.post = function(route, ...handlers) {
  if (route === "/signout" || route === "/logout") return originalPost.call(this, route, (req, res) => { clearSession(res); history.delete(req.session?.user?.uid); res.json({ success: true }); });
  if (route === "/scan_history/delete") return originalPost.call(this, route, (req, res) => { const uid = req.session?.user?.uid; if (!uid) return res.status(401).json({ success: false, error: "Authentication required." }); const id = String(req.body?.id || "").trim(); const list = history.get(uid) || []; if (!id) { history.delete(uid); return res.json({ success: true, deleted: "all" }); } const next = list.filter(item => String(item?.id || "") !== id); history.set(uid, next); return res.json({ success: true, deleted: next.length !== list.length ? id : null }); });
  return originalPost.call(this, route, ...handlers);
};
