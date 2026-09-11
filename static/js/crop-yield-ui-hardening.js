/* Final crop recommendation UI — strict response validation with deterministic climate fallback. */
(() => {
  "use strict";
  const VERSION="2026-09-11-crop-ui-v6";
  if(window.__KISAN_CROP_UI__===VERSION)return; window.__KISAN_CROP_UI__=VERSION;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]||m));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const text=(v,f)=>{const s=String(v??"").trim();return s||f;};
  const profiles=[
    ["Wheat",[15,24],[350,550],"Rabi","Moderate"],["Rice",[24,30],[900,1400],"Kharif","High"],["Maize",[20,30],[500,800],"Kharif/Summer","Moderate"],["Tomato",[20,28],[400,700],"Rabi/Summer","Moderate"],["Potato",[15,23],[450,700],"Rabi","Moderate"],["Cotton",[21,32],[500,900],"Kharif","Moderate"],["Soybean",[20,30],[450,700],"Kharif","Moderate"],["Chickpea",[18,26],[300,500],"Rabi","Low"],["Mustard",[10,25],[300,500],"Rabi","Low"],["Groundnut",[24,30],[500,1000],"Kharif/Summer","Moderate"],["Sorghum (Jowar)",[20,32],[400,700],"Kharif/Rabi","Low-Moderate"],["Pearl millet (Bajra)",[25,35],[250,500],"Kharif","Low"],["Pigeon pea (Arhar)",[20,30],[600,1000],"Kharif","Moderate"],["Lentil",[18,25],[300,500],"Rabi","Low"],["Onion",[13,25],[350,700],"Rabi/Kharif","Moderate"],["Sugarcane",[20,32],[1000,2000],"Long duration","Very high"],["Banana",[20,35],[1000,2500],"Whole year","High"],["Chilli",[20,30],[500,1000],"Kharif/Rabi","Moderate"],["Sesame",[25,35],[400,700],"Kharif","Low"],["Sunflower",[20,30],[400,700],"Rabi/Kharif","Moderate"]
  ];
  function fit(v,r){const mid=(r[0]+r[1])/2,half=Math.max((r[1]-r[0])/2,.1),z=Math.abs(v-mid)/half;return z<=1?Math.round(100-20*z*z):Math.max(0,Math.round(80*Math.exp(-(z-1)*1.25)));}
  function localRecommendation(temp,rain){
    return profiles.map(([crop,tr,rr,season,water])=>{const tf=fit(temp,tr),rf=fit(rain,rr);return {crop,score:Math.round(tf*.45+rf*.55),temperature_fit:tf,rainfall_fit:rf,season,water_requirement:water,temperature_range_c:tr,rainfall_range_mm:rr};}).sort((a,b)=>b.score-a.score);
  }
  function render(d,source){
    const out=document.getElementById("cropResult");if(!out)return;
    const crop=text(d.crop||d.recommendation,"No strong climate match"),score=num(d.score),tf=num(d.temperature_fit),rf=num(d.rainfall_fit),season=text(d.season,"Not available"),water=text(d.water_requirement,"Not available"),label=text(d.suitability_label,"Climate screening"),alts=Array.isArray(d.alternatives)?d.alternatives:[];
    const alt=alts.slice(0,4).map(x=>`<span style="display:inline-block;padding:5px 9px;margin:2px;border-radius:10px;background:rgba(255,255,255,.07)">${esc(text(x?.crop,"Unknown crop"))} · ${num(x?.score)??"—"}/100</span>`).join("");
    out.innerHTML=`<div style="padding:14px;border-radius:12px;border:1px solid rgba(52,211,153,.4);background:rgba(16,185,129,.08)"><div style="font-size:1.2rem;font-weight:700;color:var(--accent-green)">${esc(crop)}</div><div style="margin-top:6px">Climate suitability: <b>${score??"—"}/100</b> · ${esc(label)}</div><div style="margin-top:7px">🌡️ Temperature fit: <b>${tf??"—"}/100</b></div><div style="margin-top:4px">🌧️ Rainfall fit: <b>${rf??"—"}/100</b></div><div style="margin-top:5px">🌱 Typical season: <b>${esc(season)}</b></div><div style="margin-top:4px">💧 Water demand: <b>${esc(water)}</b></div>${alt?`<div style="margin-top:9px;font-size:.84rem">Other suitable crops:</div><div>${alt}</div>`:""}<div style="margin-top:9px;font-size:.75rem;opacity:.68">${esc(text(d.note,"Climate screening only; soil, cultivar, irrigation, sowing date, pests and markets are not included."))}</div><div style="margin-top:6px;font-size:.65rem;opacity:.45">Source: ${esc(source)}</div></div>`;
  }
  async function recommendCrop(){
    const out=document.getElementById("cropResult"),temp=num(document.getElementById("cropTempInput")?.value),rain=num(document.getElementById("cropRainInput")?.value),btn=document.getElementById("t-recBtn");if(!out)return;
    if(temp===null||rain===null||temp<-10||temp>55||rain<0||rain>3000){out.innerHTML="<div style='color:#fecaca'>Enter temperature (-10 to 55°C) and seasonal rainfall (0 to 3000 mm).</div>";return;}
    if(btn){btn.disabled=true;btn.textContent="Analyzing…";} out.innerHTML="<div style='opacity:.75'>Comparing crops against the climate profile…</div>";
    try{
      const r=await fetch("/recommend_crop",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({temp,rainfall:rain})}),d=await r.json().catch(()=>({}));
      const valid=r.ok&&d.success===true&&num(d.score)!==null&&num(d.temperature_fit)!==null&&num(d.rainfall_fit)!==null&&typeof d.season==="string"&&typeof d.water_requirement==="string";
      if(valid)render(d,"server API");else{const ranked=localRecommendation(temp,rain),best=ranked[0],strong=best.score>=55;render({crop:strong?best.crop:"No strong climate match",score:best.score,suitability_label:best.score>=80?"Favorable":best.score>=65?"Moderately favorable":best.score>=55?"Marginal":"Poor fit",temperature_fit:best.temperature_fit,rainfall_fit:best.rainfall_fit,season:best.season,water_requirement:best.water_requirement,alternatives:ranked.slice(1,5),note:"Climate screening only. Local validated fallback was used because the server returned a legacy/incomplete recommendation response."},"local validated climate model");}
    }catch(e){const ranked=localRecommendation(temp,rain),best=ranked[0],strong=best.score>=55;render({crop:strong?best.crop:"No strong climate match",score:best.score,suitability_label:best.score>=80?"Favorable":best.score>=65?"Moderately favorable":best.score>=55?"Marginal":"Poor fit",temperature_fit:best.temperature_fit,rainfall_fit:best.rainfall_fit,season:best.season,water_requirement:best.water_requirement,alternatives:ranked.slice(1,5),note:"Climate screening only. Local validated fallback was used because the recommendation service was unavailable."},"local validated climate model");}
    finally{if(btn){btn.disabled=false;btn.textContent="Recommend Crop";}}
  }
  window.recommendCrop=recommendCrop;
})();
