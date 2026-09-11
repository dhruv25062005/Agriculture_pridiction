/* Historical yield UI — simple farmer-friendly presentation. */
(() => {
  "use strict";
  const VERSION="2026-09-11-trained-yield-v10";
  if(window.__KISAN_TRAINED_YIELD__===VERSION)return;
  window.__KISAN_TRAINED_YIELD__=VERSION;

  const esc=s=>String(s??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const states=["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];
  const crops=["Arecanut","Arhar/Tur","Bajra","Banana","Barley","Black pepper","Cardamom","Cashewnut","Castor seed","Coconut","Coriander","Cotton(lint)","Cowpea(Lobia)","Dry chillies","Garlic","Ginger","Gram","Grapes","Groundnut","Guar seed","Horse-gram","Jowar","Jute","Khesari","Lentil","Linseed","Maize","Mango","Masoor","Mesta","Moong","Moong(Green Gram)","Moth","Mustard","Niger seed","Oilseeds total","Onion","Other Rabi pulses","Other Cereals","Other Kharif pulses","Other Summer Pulses","Peas & beans (Pulses)","Potato","Ragi","Rapeseed &Mustard","Rice","Rubber","Safflower","Sannhamp","Sesamum","Small millets","Soyabean","Sugarcane","Sunflower","Sweet potato","Tapioca","Tobacco","Tomato","Turmeric","Urad","Wheat","other oilseeds"];
  const seasons=["Autumn","Kharif","Rabi","Summer","Whole Year","Winter"];
  const finite=v=>Number.isFinite(Number(v))?Number(v):null;
  const opts=a=>a.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");

  function install(){
    const out=document.getElementById("yieldResult");if(!out)return false;
    document.getElementById("t-yieldTitle")?.replaceChildren(document.createTextNode("📈 Crop Yield Estimate"));
    const old=out.parentElement;if(!old)return false;
    old.querySelectorAll("#trainedYieldInputs,#yieldModelButton").forEach(x=>x.remove());
    ["yieldHumidityInput","yieldRainInput"].forEach(id=>document.getElementById(id)?.closest(".form-group")?.remove());
    old.querySelectorAll("button[onclick=\"predictYield()\"]").forEach(x=>x.remove());
    const box=document.createElement("div");box.id="trainedYieldInputs";box.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0";
    box.innerHTML=`<div class="form-group"><label>State</label><select id="yieldState"><option value="">Select state</option>${opts(states)}</select></div><div class="form-group"><label>Crop</label><select id="yieldCrop"><option value="">Select crop</option>${opts(crops)}</select></div><div class="form-group"><label>Season</label><select id="yieldSeason"><option value="">Select season</option>${opts(seasons)}</select></div><div class="form-group"><label>Year</label><input id="yieldYear" type="number" min="1997" max="2100" value="${new Date().getFullYear()}"></div><div class="form-group"><label>Area (acre)</label><input id="yieldArea" type="number" min="0.01" max="10000" step="0.01" value="1"><small style="display:block;opacity:.65;margin-top:3px">1 acre = 0.404686 hectare</small></div><div class="form-group"><label>Annual Rainfall (mm)</label><input id="yieldRainfallModel" type="number" min="0" max="10000" step="1" value="800"><small style="display:block;opacity:.65;margin-top:3px">Rainfall helps the model understand your conditions.</small></div><div class="form-group"><label>Fertilizer (kg)</label><input id="yieldFertilizerModel" type="number" min="0" step="1" value="100"></div><div class="form-group"><label>Pesticide (kg)</label><input id="yieldPesticideModel" type="number" min="0" step="0.1" value="10"></div>`;
    out.parentNode.insertBefore(box,out);
    const btn=document.createElement("button");btn.type="button";btn.id="yieldModelButton";btn.className="btn-primary";btn.textContent="Estimate Crop Yield";btn.addEventListener("click",predictYield);out.parentNode.insertBefore(btn,out);
    out.innerHTML="<div style='opacity:.75'>Enter your farm details and click Estimate Crop Yield.</div>";return true;
  }

  function simpleConfidence(d){
    if(d.confidence==="Medium")return {label:"Good",text:"The estimate matches the model's historical experience."};
    if(d.confidence==="Low")return {label:"Use with care",text:"This is a rough estimate because some conditions are different from the model's past data."};
    return {label:"Use with care",text:"This estimate has higher uncertainty."};
  }

  function simpleReason(d){
    const note=String(d.note||"").toLowerCase();
    const future=/outside the historical dataset|future forecast|year .* outside/.test(note);
    const inputWarning=/outside the model's training range/.test(note);
    if(future&&inputWarning)return "Because this year is beyond the past data and some input values are outside the usual range, treat this as a rough estimate.";
    if(future)return "This year is beyond the past data, so treat this as a rough estimate rather than a guarantee.";
    if(inputWarning)return "Some of your input values are outside the range seen in past data, so the estimate is less certain.";
    return "This estimate is based on past crop and weather data.";
  }

  function render(d,p){
    const out=document.getElementById("yieldResult");if(!out)return;
    const y=Number(d.yield_tpha),acreYield=Number(d.yield_tpa??(y*.40468564224)),production=Number(d.estimated_production_tonnes??(y*p.areaAcre*.40468564224)),range=d.indicative_range_tpha||{};
    const c=simpleConfidence(d);
    const low=Number(range.low),high=Number(range.high);
    const rangeText=Number.isFinite(low)&&Number.isFinite(high)?`${low.toFixed(2)}–${high.toFixed(2)} tonnes/hectare`:"Not available";
    out.innerHTML=`<div style="padding:16px;border-radius:14px;border:1px solid rgba(52,211,153,.35);background:rgba(16,185,129,.08)">
      <div style="font-size:.9rem;opacity:.8">YOUR CROP YIELD ESTIMATE</div>
      <div style="font-size:1.55rem;font-weight:800;color:var(--accent-green);margin-top:4px">${y.toFixed(2)} tonnes per hectare</div>
      <div style="margin-top:4px;font-size:.9rem;opacity:.8">About ${acreYield.toFixed(2)} tonnes per acre</div>
      <div style="margin-top:14px;padding:10px;border-radius:10px;background:rgba(255,255,255,.05)"><b>For your ${p.areaAcre.toFixed(2)} acre field:</b><br>Expected production: <b>${production.toFixed(2)} tonnes</b></div>
      <div style="margin-top:10px;font-size:.9rem"><b>Likely range:</b> ${rangeText}</div>
      <div style="margin-top:10px"><b>Confidence: ${esc(c.label)}</b><div style="font-size:.82rem;opacity:.75;margin-top:3px">${esc(c.text)}</div></div>
      <div style="margin-top:10px;font-size:.82rem;opacity:.75">💡 ${esc(simpleReason(d))}</div>
    </div>`;
  }

  async function predictYield(){
    if(!document.getElementById("trainedYieldInputs")&&!install())return;
    const g=id=>document.getElementById(id)?.value;
    const p={state:g("yieldState"),crop:g("yieldCrop"),season:g("yieldSeason"),year:finite(g("yieldYear")),areaAcre:finite(g("yieldArea")),rainfall:finite(g("yieldRainfallModel")),fertilizer:finite(g("yieldFertilizerModel")),pesticide:finite(g("yieldPesticideModel"))};
    const out=document.getElementById("yieldResult"),btn=document.getElementById("yieldModelButton");
    if(!p.state||!p.crop||!p.season||p.year===null||p.year<1997||p.year>2100||p.areaAcre===null||p.areaAcre<=0||p.areaAcre>10000||p.rainfall===null||p.rainfall<0||p.rainfall>10000||p.fertilizer===null||p.fertilizer<0||p.pesticide===null||p.pesticide<0){out.innerHTML="<div style='color:#fecaca'>Please enter valid values in all fields.</div>";return;}
    if(btn){btn.disabled=true;btn.textContent="Calculating…";}out.innerHTML="<div>Calculating your crop yield estimate…</div>";
    const payload={state:p.state,crop:p.crop,season:p.season,year:p.year,area_acre:p.areaAcre,rainfall:p.rainfall,fertilizer:p.fertilizer,pesticide:p.pesticide};
    try{
      const r=await fetch("/predict_yield",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d.success===true&&Number.isFinite(Number(d.yield_tpha)))render(d,p);
      else out.innerHTML=`<div style="padding:12px;border-radius:10px;border:1px solid rgba(248,113,113,.35);color:#fecaca">We could not calculate the yield. ${esc(d.error||"Please check your farm details and try again.")}</div>`;
    }catch(e){out.innerHTML="<div style=\"padding:12px;border-radius:10px;border:1px solid rgba(248,113,113,.35);color:#fecaca\">The yield service is temporarily unavailable. Please try again in a moment.</div>";}
    finally{if(btn){btn.disabled=false;btn.textContent="Estimate Crop Yield";}}
  }

  window.predictYield=predictYield;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();