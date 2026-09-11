// Enhanced historical yield model v2.
// The historical target-encoding baseline is kept as the anchor, while the
// prediction layer now applies small, bounded agronomic corrections.
// Production is never used because Yield is derived from Production / Area.
// Area is used only to convert acre input and to normalize farm inputs per ha.
import { predictYieldModel as basePredict, MODEL_INFO as BASE_INFO } from "./yield-model-safe.js";

const ACRE_TO_HA = 0.40468564224;

// Broad crop-climate profiles used only for a bounded rainfall correction.
// They are intentionally conservative: this is still a historical-data model,
// not a full crop-growth simulator.
const CROP_PROFILES = {
  "Arecanut": { rain:[1500,3000], seasons:["Whole Year"], refFertilizer:180 },
  "Arhar/Tur": { rain:[500,1000], seasons:["Kharif","Whole Year"], refFertilizer:80 },
  "Bajra": { rain:[250,600], seasons:["Kharif","Summer"], refFertilizer:120 },
  "Banana": { rain:[1000,2500], seasons:["Whole Year"], refFertilizer:200 },
  "Barley": { rain:[300,600], seasons:["Rabi"], refFertilizer:100 },
  "Black pepper": { rain:[1500,3000], seasons:["Whole Year"], refFertilizer:180 },
  "Cardamom": { rain:[1500,3000], seasons:["Whole Year"], refFertilizer:120 },
  "Cashewnut": { rain:[800,1800], seasons:["Whole Year"], refFertilizer:100 },
  "Castor seed": { rain:[350,700], seasons:["Kharif","Rabi"], refFertilizer:80 },
  "Coconut": { rain:[1200,2500], seasons:["Whole Year"], refFertilizer:200 },
  "Coriander": { rain:[400,800], seasons:["Rabi","Whole Year"], refFertilizer:80 },
  "Cotton(lint)": { rain:[500,1000], seasons:["Kharif"], refFertilizer:160 },
  "Cowpea(Lobia)": { rain:[400,800], seasons:["Kharif","Summer","Rabi"], refFertilizer:60 },
  "Dry chillies": { rain:[500,1000], seasons:["Kharif","Rabi","Whole Year"], refFertilizer:140 },
  "Garlic": { rain:[350,700], seasons:["Rabi"], refFertilizer:120 },
  "Ginger": { rain:[1000,2500], seasons:["Whole Year"], refFertilizer:150 },
  "Gram": { rain:[300,550], seasons:["Rabi"], refFertilizer:80 },
  "Grapes": { rain:[500,900], seasons:["Whole Year"], refFertilizer:180 },
  "Groundnut": { rain:[500,1000], seasons:["Kharif","Summer","Whole Year"], refFertilizer:100 },
  "Guar seed": { rain:[200,500], seasons:["Kharif"], refFertilizer:60 },
  "Horse-gram": { rain:[300,700], seasons:["Kharif","Rabi"], refFertilizer:50 },
  "Jowar": { rain:[300,700], seasons:["Kharif","Rabi","Summer"], refFertilizer:100 },
  "Jute": { rain:[1200,2000], seasons:["Kharif"], refFertilizer:100 },
  "Lentil": { rain:[300,500], seasons:["Rabi"], refFertilizer:70 },
  "Linseed": { rain:[300,600], seasons:["Rabi"], refFertilizer:60 },
  "Maize": { rain:[500,800], seasons:["Kharif","Rabi","Summer"], refFertilizer:140 },
  "Mango": { rain:[750,1500], seasons:["Whole Year"], refFertilizer:180 },
  "Masoor": { rain:[300,500], seasons:["Rabi"], refFertilizer:70 },
  "Mesta": { rain:[800,1500], seasons:["Kharif"], refFertilizer:100 },
  "Moong": { rain:[350,750], seasons:["Kharif","Summer"], refFertilizer:60 },
  "Moong(Green Gram)": { rain:[350,750], seasons:["Kharif","Summer"], refFertilizer:60 },
  "Moth": { rain:[200,500], seasons:["Kharif"], refFertilizer:50 },
  "Mustard": { rain:[300,500], seasons:["Rabi"], refFertilizer:80 },
  "Niger seed": { rain:[500,1000], seasons:["Kharif"], refFertilizer:60 },
  "Onion": { rain:[350,700], seasons:["Rabi","Kharif"], refFertilizer:120 },
  "Other Rabi pulses": { rain:[300,600], seasons:["Rabi"], refFertilizer:70 },
  "Other Cereals": { rain:[400,900], seasons:["Kharif","Rabi"], refFertilizer:100 },
  "Other Kharif pulses": { rain:[400,900], seasons:["Kharif"], refFertilizer:70 },
  "Other Summer Pulses": { rain:[350,750], seasons:["Summer"], refFertilizer:60 },
  "Peas & beans (Pulses)": { rain:[400,800], seasons:["Rabi","Kharif"], refFertilizer:80 },
  "Potato": { rain:[400,800], seasons:["Rabi","Winter"], refFertilizer:150 },
  "Ragi": { rain:[400,800], seasons:["Kharif","Rabi","Summer"], refFertilizer:80 },
  "Rapeseed &Mustard": { rain:[300,500], seasons:["Rabi"], refFertilizer:80 },
  "Rice": { rain:[900,1400], seasons:["Kharif","Rabi","Summer"], refFertilizer:160 },
  "Rubber": { rain:[1800,3000], seasons:["Whole Year"], refFertilizer:150 },
  "Safflower": { rain:[350,700], seasons:["Rabi"], refFertilizer:70 },
  "Sesamum": { rain:[400,700], seasons:["Kharif","Rabi"], refFertilizer:60 },
  "Small millets": { rain:[300,700], seasons:["Kharif","Rabi"], refFertilizer:60 },
  "Soyabean": { rain:[500,900], seasons:["Kharif"], refFertilizer:100 },
  "Sugarcane": { rain:[1000,2000], seasons:["Whole Year"], refFertilizer:250 },
  "Sunflower": { rain:[400,800], seasons:["Kharif","Rabi"], refFertilizer:100 },
  "Sweet potato": { rain:[750,1500], seasons:["Whole Year"], refFertilizer:100 },
  "Tapioca": { rain:[1000,2000], seasons:["Whole Year"], refFertilizer:100 },
  "Tobacco": { rain:[500,1000], seasons:["Rabi","Kharif","Whole Year"], refFertilizer:100 },
  "Tomato": { rain:[400,800], seasons:["Rabi","Kharif","Summer"], refFertilizer:140 },
  "Turmeric": { rain:[1000,2000], seasons:["Kharif","Whole Year"], refFertilizer:120 },
  "Urad": { rain:[350,750], seasons:["Kharif","Summer"], refFertilizer:60 },
  "Wheat": { rain:[350,650], seasons:["Rabi"], refFertilizer:140 },
  "other oilseeds": { rain:[350,800], seasons:["Kharif","Rabi"], refFertilizer:70 }
};

const YIELD_BOUNDS = {
  Arecanut:[0.2,5], "Arhar/Tur":[0.2,3], Bajra:[0.2,5], Banana:[5,100], Barley:[0.5,8],
  "Black pepper":[0.1,5], Cardamom:[0.05,3], Cashewnut:[0.1,3], "Castor seed":[0.2,4], Coconut:[1,20],
  Coriander:[0.2,3], "Cotton(lint)":[0.2,5], "Cowpea(Lobia)":[0.2,4], "Dry chillies":[0.2,8], Garlic:[1,20],
  Ginger:[1,40], Gram:[0.2,4], Grapes:[5,50], Groundnut:[0.3,6], "Guar seed":[0.2,3], "Horse-gram":[0.2,3],
  Jowar:[0.2,5], Jute:[1,8], Khesari:[0.2,3], Lentil:[0.2,3], Linseed:[0.2,3], Maize:[0.5,15], Mango:[1,20],
  Masoor:[0.2,3], Mesta:[1,10], Moong:[0.2,3], "Moong(Green Gram)":[0.2,3], Moth:[0.2,3], Mustard:[0.2,5],
  "Niger seed":[0.1,3], "Oilseeds total":[0.2,4], Onion:[2,70], "Other Rabi pulses":[0.2,3], "Other Cereals":[0.2,5],
  "Other Kharif pulses":[0.2,4], "Other Summer Pulses":[0.2,4], "Peas & beans (Pulses)":[0.3,8], Potato:[3,60],
  Ragi:[0.2,5], "Rapeseed &Mustard":[0.2,5], Rice:[0.5,12], Rubber:[0.3,5], Safflower:[0.1,3], Sannhamp:[0.2,8],
  Sesamum:[0.1,2.5], "Small millets":[0.2,4], Soyabean:[0.3,5], Sugarcane:[20,160], Sunflower:[0.2,5],
  "Sweet potato":[3,40], Tapioca:[5,60], Tobacco:[0.3,5], Tomato:[5,100], Turmeric:[2,40], Urad:[0.2,3], Wheat:[0.5,8],
  "other oilseeds":[0.1,4]
};

export const MODEL_INFO = {
  type: "Hybrid historical baseline + bounded agronomic calibration",
  target: BASE_INFO.target,
  training_rows: BASE_INFO.training_rows,
  test_rows: BASE_INFO.test_rows,
  production_excluded: true,
  numeric_features: ["Year", "Area_acre", "Annual_Rainfall", "Fertilizer_kg_per_ha", "Pesticide_kg_per_ha"],
  underlying_test_metrics: BASE_INFO.test_metrics,
  version: "2026-09-11-yield-v2"
};

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function toHa(input){
  const acre=Number(input.area_acre);
  if(Number.isFinite(acre)&&acre>0)return acre*ACRE_TO_HA;
  const ha=Number(input.area_ha ?? input.area);
  if(Number.isFinite(ha)&&ha>0)return ha;
  throw new Error("Area must be greater than zero.");
}
function rainfallFactor(crop,rainfall){
  const p=CROP_PROFILES[crop];
  if(!p||!Number.isFinite(rainfall)||rainfall<=0)return 1;
  const [lo,hi]=p.rain;
  if(rainfall>=lo&&rainfall<=hi)return 1;
  const distance=rainfall<lo ? (lo-rainfall)/Math.max(lo,1) : (rainfall-hi)/Math.max(hi,1);
  // At most ±10%; avoids turning rainfall into a dominant pseudo-feature.
  return clamp(1-0.10*Math.min(1.5,distance),0.85,1.02);
}
function inputFactor(crop,fertilizerPerHa,pesticidePerHa){
  const p=CROP_PROFILES[crop];
  if(!p)return 1;
  const fertRatio=clamp(fertilizerPerHa/Math.max(p.refFertilizer,1),0,4);
  // Generic fertilizer input is not nutrient-specific, so keep its influence small.
  let factor=1 + 0.035*Math.tanh(fertRatio-0.8);
  const pestRatio=clamp(pesticidePerHa/2,0,6);
  // Never reward excessive pesticide use; only apply a small stress penalty above a high level.
  if(pestRatio>2)factor-=Math.min(0.03,(pestRatio-2)*0.0075);
  return clamp(factor,0.96,1.035);
}
function seasonFactor(crop,season){
  const p=CROP_PROFILES[crop];
  if(!p||!season)return {factor:1,matched:true};
  if(p.seasons.includes(season))return {factor:1,matched:true};
  // Mismatch is a confidence/risk signal, not a hard rejection.
  return {factor:0.94,matched:false};
}
function confidence(crop,season,rainfall){
  const p=CROP_PROFILES[crop];
  if(!p)return "Medium";
  if(!p.seasons.includes(season))return "Low";
  if(!Number.isFinite(rainfall)||rainfall<=0)return "Medium";
  const [lo,hi]=p.rain;
  const comfortable=rainfall>=lo*0.8&&rainfall<=hi*1.2;
  return comfortable ? "High" : "Medium";
}

export function predictYieldModel(input){
  const areaHa=toHa(input);
  const crop=String(input.crop??"").trim();
  const state=String(input.state??"").trim();
  const season=String(input.season??"").trim();
  const year=Number(input.year);
  const rainfall=Number(input.rainfall);
  const fertilizer=Number(input.fertilizer);
  const pesticide=Number(input.pesticide);
  if(!crop||!state||!season)throw new Error("State, crop and season are required.");
  if(!Number.isFinite(year)||year<2000||year>2100)throw new Error("Year must be between 2000 and 2100.");
  if(!Number.isFinite(rainfall)||rainfall<0||rainfall>10000)throw new Error("Annual rainfall must be between 0 and 10000 mm.");
  if(!Number.isFinite(fertilizer)||fertilizer<0)throw new Error("Fertilizer must be a non-negative number.");
  if(!Number.isFinite(pesticide)||pesticide<0)throw new Error("Pesticide must be a non-negative number.");

  // Use a harmless 1-ha representation for the historical baseline: area must not
  // change tonnes/hectare. Farm size affects production only.
  const baseline=basePredict({state,crop,season,year,area:1,rainfall,fertilizer,pesticide});
  let predicted=Number(baseline.yield_tpha);
  const fertPerHa=fertilizer/areaHa;
  const pesticidePerHa=pesticide/areaHa;
  const rf=rainfallFactor(crop,rainfall);
  const inf=inputFactor(crop,fertPerHa,pesticidePerHa);
  const sf=seasonFactor(crop,season);
  predicted*=rf*inf*sf.factor;

  const bounds=YIELD_BOUNDS[crop];
  let sanity_adjusted=false;
  if(bounds){const bounded=clamp(predicted,bounds[0],bounds[1]);sanity_adjusted=Math.abs(bounded-predicted)>1e-9;predicted=bounded;}
  predicted=Number(Math.max(0,predicted).toFixed(3));

  const uncertainty=Math.max(0.12,predicted*0.18);
  const low=Number(Math.max(0,predicted-uncertainty).toFixed(3));
  const high=Number((predicted+uncertainty).toFixed(3));
  const conf=confidence(crop,season,rainfall);
  const notes=[];
  if(!sf.matched)notes.push(`${crop} is not normally associated with ${season} in the agronomic profile; treat this estimate as lower-confidence.`);
  if(rainfallFactor(crop,rainfall)<0.99)notes.push("Rainfall is outside the crop's typical band, so a small climate adjustment was applied.");
  notes.push("Area is used only for total production; yield per hectare is area-independent.");

  return {
    success:true,
    yield_tpha:predicted,
    yield_tpa:Number((predicted*ACRE_TO_HA).toFixed(3)),
    unit:"tonnes/hectare",
    model:MODEL_INFO.type,
    model_version:MODEL_INFO.version,
    confidence:conf,
    prediction_interval_tpha:{low,high},
    model_test_metrics:MODEL_INFO.underlying_test_metrics,
    sanity_adjusted,
    plausible_range_tpha:bounds?{min:bounds[0],max:bounds[1]}:null,
    inputs_used:{state,crop,season,year,area_acre:Number((areaHa/ACRE_TO_HA).toFixed(4)),area_ha:Number(areaHa.toFixed(4)),annual_rainfall_mm:rainfall,fertilizer_kg:fertilizer,pesticide_kg:pesticide,fertilizer_kg_per_ha:Number(fertPerHa.toFixed(2)),pesticide_kg_per_ha:Number(pesticidePerHa.toFixed(2))},
    leakage_safe:true,
    note:`Historical baseline calibrated with bounded rainfall, season and input-intensity adjustments. ${notes.join(" ")}`
  };
}
