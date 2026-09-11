/* Final runtime guard for crop recommendation and trained yield prediction. */
(() => {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>\"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const el = id => document.getElementById(id);

  async function recommendCrop() {
    const out = el("cropResult");
    const temp = n(el("cropTempInput")?.value), rainfall = n(el("cropRainInput")?.value);
    if (!out) return;
    if (temp === null || rainfall === null || temp < -10 || temp > 55 || rainfall < 0 || rainfall > 3000) {
      out.innerHTML = "<div style='color:#fecaca;padding:10px'>Enter valid temperature and seasonal rainfall.</div>"; return;
    }
    out.innerHTML = "<div style='padding:14px;color:#67e8f9'>Analyzing climate conditions…</div>";
    try {
      const r = await fetch("/recommend_crop", {method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"}, credentials:"same-origin", cache:"no-store", body:JSON.stringify({temp, rainfall})});
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success !== true) throw new Error(d.error || `Recommendation failed (${r.status})`);
      const alts = Array.isArray(d.alternatives) ? d.alternatives : [];
      out.innerHTML = `<div style="padding:14px;border-radius:12px;border:1px solid rgba(52,211,153,.4);background:rgba(16,185,129,.08)">
        <div style="font-size:1.2rem;font-weight:700;color:#34d399">${esc(d.crop || d.recommendation || "No strong climate match")}</div>
        <div style="margin-top:6px">Climate suitability: <b>${n(d.score) ?? "—"}/100</b> · ${esc(d.suitability_label || "Climate screening")}</div>
        <div style="margin-top:7px">🌡️ Temperature fit: <b>${n(d.temperature_fit) ?? "—"}/100</b></div>
        <div style="margin-top:4px">🌧️ Rainfall fit: <b>${n(d.rainfall_fit) ?? "—"}/100</b></div>
        <div style="margin-top:5px">🌱 Typical season: <b>${esc(d.season || "Not available")}</b></div>
        <div style="margin-top:4px">💧 Water demand: <b>${esc(d.water_requirement || "Not available")}</b></div>
        ${alts.length ? `<div style="margin-top:9px;font-size:.84rem">Other suitable crops:</div><div>${alts.slice(0,4).map(x=>`<span style="display:inline-block;padding:5px 9px;margin:2px;border-radius:10px;background:rgba(255,255,255,.07)">${esc(x.crop || "Unknown")} · ${n(x.score) ?? "—"}/100</span>`).join("")}</div>` : ""}
        <div style="margin-top:9px;font-size:.75rem;opacity:.7">${esc(d.note || "Climate screening only; soil, water, market and crop rotation are not included.")}</div>
      </div>`;
    } catch (e) { out.innerHTML = `<div style="color:#fecaca;padding:10px">${esc(e.message || "Unable to recommend a crop.")}</div>`; }
  }

  async function predictYield() {
    const out = el("yieldResult"); if (!out) return;
    const g = id => el(id)?.value;
    const state=g("yieldState"), crop=g("yieldCrop"), season=g("yieldSeason");
    const year=n(g("yieldYear")), area=n(g("yieldArea")), rainfall=n(g("yieldRainfallModel")), fertilizer=n(g("yieldFertilizerModel")), pesticide=n(g("yieldPesticideModel"));
    if (!state || !crop || !season || year===null || year<2000 || year>2100 || area===null || area<=0 || rainfall===null || rainfall<0 || fertilizer===null || fertilizer<0 || pesticide===null || pesticide<0) {
      out.innerHTML="<div style='color:#fecaca;padding:10px'>Please enter valid values in all yield fields.</div>"; return;
    }
    out.innerHTML="<div style='padding:14px;color:#67e8f9'>Calculating historical yield estimate…</div>";
    try {
      const r=await fetch("/predict_yield",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({state,crop,season,year,area,rainfall,fertilizer,pesticide})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok || d.success!==true || !Number.isFinite(Number(d.yield_tpha))) throw new Error(d.error || `Yield prediction failed (${r.status})`);
      const y=Number(d.yield_tpha);
      out.innerHTML=`<div style="padding:14px;border-radius:12px;border:1px solid rgba(52,211,153,.4);background:rgba(16,185,129,.08)"><div style="font-size:1.2rem;font-weight:700;color:#34d399">Estimated Yield: ${y.toFixed(3)} t/ha</div><div style="margin-top:7px">Estimated production: <b>${(y*area).toFixed(3)} tonnes</b> for ${area.toFixed(2)} ha</div><div style="margin-top:8px;font-size:.82rem;opacity:.82">${esc(d.model || "Historical yield model")}</div><div style="margin-top:7px;font-size:.76rem;opacity:.7">${esc(d.note || "Historical-data estimate; not a guaranteed farm yield.")}</div></div>`;
    } catch(e) { out.innerHTML=`<div style="color:#fecaca;padding:10px">${esc(e.message || "Unable to calculate yield.")}</div>`; }
  }

  window.recommendCrop = recommendCrop;
  window.predictYield = predictYield;
  window.__KISAN_PREDICTION_FORCE__ = "2026-09-11-v1";
})();
