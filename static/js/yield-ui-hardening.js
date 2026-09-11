/* Historical yield UI — acre-based input and optimized yield model contract. */
(() => {
  "use strict";
  const VERSION = "2026-09-11-trained-yield-v8";
  if (window.__KISAN_TRAINED_YIELD__ === VERSION) return;
  window.__KISAN_TRAINED_YIELD__ = VERSION;

  const ACRE_TO_HA = 0.40468564224;
  const esc = s => String(s ?? "").replace(/[&<>\"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const states = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];
  const crops = ["Arecanut","Arhar/Tur","Bajra","Banana","Barley","Black pepper","Cardamom","Cashewnut","Castor seed","Coconut","Coriander","Cotton(lint)","Cowpea(Lobia)","Dry chillies","Garlic","Ginger","Gram","Grapes","Groundnut","Guar seed","Horse-gram","Jowar","Jute","Khesari","Lentil","Linseed","Maize","Mango","Masoor","Mesta","Moong","Moong(Green Gram)","Moth","Mustard","Niger seed","Oilseeds total","Onion","Other Rabi pulses","Other Cereals","Other Kharif pulses","Other Summer Pulses","Peas & beans (Pulses)","Potato","Ragi","Rapeseed &Mustard","Rice","Rubber","Safflower","Sannhamp","Sesamum","Small millets","Soyabean","Sugarcane","Sunflower","Sweet potato","Tapioca","Tobacco","Tomato","Turmeric","Urad","Wheat","other oilseeds"];
  const seasons = ["Autumn","Kharif","Rabi","Summer","Whole Year","Winter"];
  const cropBase = {"Arecanut":1.3,"Arhar/Tur":0.879565,"Bajra":1.057671,"Banana":25.3638255,"Barley":1.5710715,"Black pepper":0.45,"Cardamom":0.103809,"Cashewnut":0.466667,"Castor seed":0.605556,"Coconut":9101.813684,"Coriander":0.591244,"Cotton(lint)":1.3,"Cowpea(Lobia)":0.7667595,"Dry chillies":1,"Garlic":4.181104,"Ginger":6.0103125,"Gram":0.904375,"Grapes":23.292771,"Groundnut":1.183043,"Guar seed":0.812642,"Horse-gram":0.5,"Jowar":1.012727,"Jute":8.500625,"Khesari":0.8310415,"Lentil":0.931455,"Linseed":0.459473,"Maize":2.102917,"Mango":6.921642,"Masoor":0.76,"Mesta":5.77622,"Moong":0.6989835,"Moong(Green Gram)":0.5688865,"Moth":0.535,"Mustard":1.454839,"Niger seed":0.364091,"Oilseeds total":1.293545,"Onion":11.09362,"Other Rabi pulses":0.764667,"Other Cereals":0.7929715,"Other Kharif pulses":0.7325555,"Other Summer Pulses":0.426364,"Peas & beans (Pulses)":0.987,"Potato":10.6943705,"Ragi":0.992667,"Rapeseed &Mustard":0.781111,"Rice":2.1825,"Rubber":1.544829,"Safflower":0.5795,"Sannhamp":0.404857,"Sesamum":0.472,"Small millets":0.783684,"Soyabean":1.0371875,"Sugarcane":58.61248,"Sunflower":0.987567,"Sweet potato":8.514545,"Tapioca":13.003333,"Tobacco":1.266156,"Tomato":23.480618,"Turmeric":3.106209,"Urad":0.618889,"Wheat":1.8925715,"other oilseeds":0.7611435};
  const stateBase = {"Andhra Pradesh":1.408779,"Arunachal Pradesh":1.499583,"Assam":0.878119,"Bihar":1.094706,"Chhattisgarh":0.546667,"Delhi":2.780342,"Goa":1.840043,"Gujarat":1.501572,"Haryana":1.3146015,"Himachal Pradesh":0.778571,"Jammu and Kashmir":0.6688395,"Jharkhand":1.01,"Karnataka":0.952174,"Kerala":1.505,"Madhya Pradesh":0.996667,"Maharashtra":0.798152,"Manipur":1.180187,"Meghalaya":1.53,"Mizoram":1.32,"Nagaland":1.0625,"Odisha":0.758106,"Puducherry":1.8,"Punjab":1.329412,"Rajasthan":1.331498,"Sikkim":0.984352,"Tamil Nadu":1.717698,"Telangana":1.584091,"Tripura":0.880038,"Uttar Pradesh":1.142879,"Uttarakhand":0.955455,"West Bengal":1.121667};
  const seasonBase = {"Autumn":1.088571,"Kharif":0.9829715,"Rabi":0.956829,"Summer":1.350294,"Whole Year":5.556364,"Winter":9.838815};
  const globalBase = 1.098091;
  const profiles = {"Moong":[350,750,["Kharif","Summer"],60],"Moong(Green Gram)":[350,750,["Kharif","Summer"],60],"Urad":[350,750,["Kharif","Summer"],60],"Wheat":[350,650,["Rabi"],140],"Rice":[900,1400,["Kharif","Rabi","Summer"],160],"Maize":[500,800,["Kharif","Rabi","Summer"],140],"Bajra":[250,600,["Kharif","Summer"],120],"Jowar":[300,700,["Kharif","Rabi","Summer"],100],"Gram":[300,550,["Rabi"],80],"Lentil":[300,500,["Rabi"],70],"Mustard":[300,500,["Rabi"],80],"Potato":[400,800,["Rabi","Winter"],150],"Tomato":[400,800,["Rabi","Kharif","Summer"],140],"Onion":[350,700,["Rabi","Kharif"],120],"Groundnut":[500,1000,["Kharif","Summer","Whole Year"],100],"Soyabean":[500,900,["Kharif"],100],"Cotton(lint)":[500,1000,["Kharif"],160],"Sugarcane":[1000,2000,["Whole Year"],250],"Turmeric":[1000,2000,["Kharif","Whole Year"],120],"Banana":[1000,2500,["Whole Year"],200],"Ginger":[1000,2500,["Whole Year"],150],"Garlic":[350,700,["Rabi"],120],"Coriander":[400,800,["Rabi","Whole Year"],80],"Sunflower":[400,800,["Kharif","Rabi"],100],"Sesamum":[400,700,["Kharif","Rabi"],60],"Ragi":[400,800,["Kharif","Rabi","Summer"],80]};
  const finite = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const opts = a => a.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function install(){
    const out=document.getElementById("yieldResult"); if(!out)return false;
    document.getElementById("t-yieldTitle")?.replaceChildren(document.createTextNode("📈 Historical Crop Yield Estimate"));
    const old=out.parentElement; if(!old)return false;
    old.querySelectorAll("#trainedYieldInputs,#yieldModelButton").forEach(x=>x.remove());
    ["yieldHumidityInput","yieldRainInput"].forEach(id=>document.getElementById(id)?.closest(".form-group")?.remove());
    old.querySelectorAll("button[onclick=\"predictYield()\"]").forEach(x=>x.remove());
    const box=document.createElement("div"); box.id="trainedYieldInputs"; box.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0";
    box.innerHTML=`<div class="form-group"><label>State</label><select id="yieldState"><option value="">Select state</option>${opts(states)}</select></div><div class="form-group"><label>Crop</label><select id="yieldCrop"><option value="">Select crop</option>${opts(crops)}</select></div><div class="form-group"><label>Season</label><select id="yieldSeason"><option value="">Select season</option>${opts(seasons)}</select></div><div class="form-group"><label>Year</label><input id="yieldYear" type="number" min="2000" max="2100" value="${new Date().getFullYear()}"></div><div class="form-group"><label>Area (acre)</label><input id="yieldArea" type="number" min="0.01" step="0.01" value="1"><small style="display:block;opacity:.65;margin-top:3px">1 acre = 0.404686 hectare</small></div><div class="form-group"><label>Annual Rainfall (mm)</label><input id="yieldRainfallModel" type="number" min="0" step="1" value="800"></div><div class="form-group"><label>Fertilizer (kg)</label><input id="yieldFertilizerModel" type="number" min="0" step="1" value="100"></div><div class="form-group"><label>Pesticide (kg)</label><input id="yieldPesticideModel" type="number" min="0" step="0.1" value="10"></div>`;
    out.parentNode.insertBefore(box,out);
    const btn=document.createElement("button"); btn.type="button"; btn.id="yieldModelButton"; btn.className="btn-primary"; btn.textContent="Estimate Crop Yield"; btn.addEventListener("click",predictYield); out.parentNode.insertBefore(btn,out);
    out.innerHTML="<div style='opacity:.75'>Enter farm details and click Estimate Crop Yield.</div>"; return true;
  }
  function localPrediction(p){
    const c=cropBase[p.crop]??globalBase,s=stateBase[p.state]??globalBase,se=seasonBase[p.season]??globalBase;
    let y=globalBase+0.7*(c-globalBase)+0.2*(s-globalBase)+0.1*(se-globalBase);
    const prof=profiles[p.crop];
    if(prof){const [lo,hi,seasons,ref]=prof,r=p.rainfall;if(r<lo)y*=clamp(1-0.10*((lo-r)/Math.max(lo,1)),.85,1.02);else if(r>hi)y*=clamp(1-0.10*((r-hi)/Math.max(hi,1)),.85,1.02);if(!seasons.includes(p.season))y*=.94;const fertPerHa=p.fertilizer/(p.areaAcre*ACRE_TO_HA);y*=clamp(1+0.035*Math.tanh(fertPerHa/Math.max(ref,1)-.8),.96,1.035);const pestPerHa=p.pesticide/(p.areaAcre*ACRE_TO_HA);if(pestPerHa>4)y*=clamp(1-(pestPerHa-4)*.0075,.97,1);}
    const bounds={"Moong":[.2,3],"Moong(Green Gram)":[.2,3],"Wheat":[.5,8],"Rice":[.5,12],"Maize":[.5,15],"Bajra":[.2,5],"Jowar":[.2,5],"Turmeric":[2,40],"Sugarcane":[20,160],"Banana":[5,100],"Potato":[3,60],"Tomato":[5,100]};
    if(bounds[p.crop])y=clamp(y,bounds[p.crop][0],bounds[p.crop][1]);
    return Number(Math.max(0,y).toFixed(3));
  }
  function render(d,p,source){
    const out=document.getElementById("yieldResult"); if(!out)return;
    const y=Number(d.yield_tpha),acreYield=Number(d.yield_tpa??(y*ACRE_TO_HA)),production=y*p.areaAcre*ACRE_TO_HA,interval=d.prediction_interval_tpha||{};
    out.innerHTML=`<div style="padding:14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);background:rgba(16,185,129,.08)"><div style="font-size:1.2rem;font-weight:700;color:var(--accent-green)">Estimated Yield: ${y.toFixed(3)} t/ha <span style="font-size:.85rem;font-weight:600;opacity:.8">(${acreYield.toFixed(3)} t/acre)</span></div><div style="margin-top:7px">Estimated production: <b>${production.toFixed(3)} tonnes</b> for ${p.areaAcre.toFixed(2)} acre</div>${Number.isFinite(interval.low)&&Number.isFinite(interval.high)?`<div style="margin-top:6px;font-size:.86rem">Expected range: <b>${Number(interval.low).toFixed(3)}–${Number(interval.high).toFixed(3)} t/ha</b></div>`:""}<div style="margin-top:8px;font-size:.82rem;opacity:.82">${esc(source)}${d.confidence?` · Confidence: ${esc(d.confidence)}`:""}</div><div style="margin-top:7px;font-size:.76rem;opacity:.7">${esc(d.note||"Historical-data estimate; not a guaranteed farm yield.")}</div></div>`;
  }
  async function predictYield(){
    if(!document.getElementById("trainedYieldInputs")&&!install())return;
    const g=id=>document.getElementById(id)?.value;
    const p={state:g("yieldState"),crop:g("yieldCrop"),season:g("yieldSeason"),year:finite(g("yieldYear")),areaAcre:finite(g("yieldArea")),rainfall:finite(g("yieldRainfallModel")),fertilizer:finite(g("yieldFertilizerModel")),pesticide:finite(g("yieldPesticideModel"))},out=document.getElementById("yieldResult"),btn=document.getElementById("yieldModelButton");
    if(!p.state||!p.crop||!p.season||p.year===null||p.year<2000||p.year>2100||p.areaAcre===null||p.areaAcre<=0||p.rainfall===null||p.rainfall<0||p.fertilizer===null||p.fertilizer<0||p.pesticide===null||p.pesticide<0){out.innerHTML="<div style='color:#fecaca'>Please enter valid values in all fields.</div>";return;}
    if(btn){btn.disabled=true;btn.textContent="Calculating…";} out.innerHTML="<div>Calculating optimized historical yield estimate…</div>";
    const payload={state:p.state,crop:p.crop,season:p.season,year:p.year,area_acre:p.areaAcre,rainfall:p.rainfall,fertilizer:p.fertilizer,pesticide:p.pesticide};
    try{
      const r=await fetch("/predict_yield",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d.success===true&&Number.isFinite(Number(d.yield_tpha)))render(d,p,d.model||"Optimized historical yield model");
      else {const y=localPrediction(p);render({yield_tpha:y,yield_tpa:y*ACRE_TO_HA,note:"Local validated fallback using the historical crop/state/season baseline with bounded agronomic corrections.",confidence:"Fallback"},p,"Local validated historical baseline");}
    }catch(e){const y=localPrediction(p);render({yield_tpha:y,yield_tpa:y*ACRE_TO_HA,note:"The prediction service was unavailable, so the local validated historical baseline was used.",confidence:"Fallback"},p,"Local validated historical baseline");}
    finally{if(btn){btn.disabled=false;btn.textContent="Estimate Crop Yield";}}
  }
  window.predictYield=predictYield;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
