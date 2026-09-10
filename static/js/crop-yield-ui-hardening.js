/* Climate recommendation UI: strict response validation and complete, non-undefined output. */
(() => {
  const V = "2026-09-10-crop-ui-v3";
  if (window.__KISAN_CROP_UI__ === V) return;
  window.__KISAN_CROP_UI__ = V;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[m] || m));
  const num = (v, fallback = null) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const text = (v, fallback = "Not available") => String(v ?? "").trim() || fallback;

  async function recommendCrop() {
    const out = document.getElementById("cropResult");
    const temp = num(document.getElementById("cropTempInput")?.value);
    const rain = num(document.getElementById("cropRainInput")?.value);
    const btn = document.getElementById("t-recBtn");
    if (!out) return;
    if (temp === null || rain === null || temp < -10 || temp > 55 || rain < 0 || rain > 3000) {
      out.innerHTML = "<div style='color:#fecaca'>Enter temperature (-10 to 55°C) and seasonal rainfall (0 to 3000 mm).</div>";
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = "Analyzing…"; }
    out.innerHTML = "<div style='opacity:.75'>Comparing crops against the climate profile…</div>";
    try {
      const r = await fetch("/recommend_crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ temp, rainfall: rain })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success !== true) throw Error(d.error || `Crop recommendation failed (${r.status}).`);

      const crop = text(d.crop || d.recommendation, "No crop recommendation");
      const score = num(d.score, 0);
      const tempFit = num(d.temperature_fit, 0);
      const rainFit = num(d.rainfall_fit, 0);
      const season = text(d.season);
      const water = text(d.water_requirement);
      const label = text(d.suitability_label, "Climate screening");
      const alternatives = Array.isArray(d.alternatives) ? d.alternatives : [];
      const alt = alternatives.map(x => {
        const s = num(x?.score, 0);
        return `<span style="display:inline-block;padding:5px 9px;margin:2px;border-radius:10px;background:rgba(255,255,255,.07)">${esc(text(x?.crop,"Unknown crop"))} · ${s}/100</span>`;
      }).join("");

      out.innerHTML = `<div style="padding:14px;border-radius:12px;border:1px solid rgba(52,211,153,.4);background:rgba(16,185,129,.08)">
        <div style="font-size:1.2rem;font-weight:700;color:var(--accent-green)">${esc(crop)}</div>
        <div style="margin-top:6px">Climate suitability: <b>${score}/100</b> · ${esc(label)}</div>
        <div style="margin-top:7px">🌡️ Temperature fit: <b>${tempFit}/100</b></div>
        <div style="margin-top:4px">🌧️ Rainfall fit: <b>${rainFit}/100</b></div>
        <div style="margin-top:5px">🌱 Typical season: <b>${esc(season)}</b></div>
        <div style="margin-top:4px">💧 Water demand: <b>${esc(water)}</b></div>
        ${alt ? `<div style="margin-top:9px;font-size:.84rem;opacity:.85">Other suitable crops:</div><div>${alt}</div>` : ""}
        <div style="margin-top:9px;font-size:.75rem;opacity:.68">${esc(text(d.note,"Climate screening only; this does not account for soil, cultivar, irrigation, sowing date, pests or markets."))}</div>
      </div>`;
    } catch (e) {
      out.innerHTML = `<div style='color:#fecaca'>${esc(e.message || "Unable to recommend a crop.")}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Recommend Crop"; }
    }
  }
  window.recommendCrop = recommendCrop;
})();
