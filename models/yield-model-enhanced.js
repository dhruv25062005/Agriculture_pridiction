// Trustworthy yield wrapper around the leakage-safe historical baseline.
// IMPORTANT: the training data is state/crop/season aggregate data. Farm-level
// fertilizer/pesticide totals and annual rainfall are therefore retained as
// context but are NOT allowed to create unvalidated pseudo-precision.
// Production is never a model feature because Yield is derived from it.
import { predictYieldModel as basePredict, MODEL_INFO as BASE_INFO, SUPPORTED_CROPS, SUPPORTED_STATES, SUPPORTED_SEASONS } from "./yield-model-safe.js";

const ACRE_TO_HA=0.40468564224;
const MEDIAN_ABS_ERROR=Number(BASE_INFO.test_metrics.median_absolute_error_tpha)||0.439;

// Conservative physical plausibility guards. These are sanity bounds, not
// claimed biological maxima and should be replaced with crop/state-specific
// validated bounds when a curated training set is available.
const YIELD_BOUNDS={
  Arecanut:[0.2,5],"Arhar/Tur":[0.2,3],Bajra:[0.2,5],Banana:[5,100],Barley:[0.5,8],
  "Black pepper":[0.1,5],Cardamom:[0.05,3],Cashewnut:[0.1,3],"Castor seed":[0.2,4],Coconut:[1,20],
  Coriander:[0.2,3],"Cotton(lint)":[0.2,5],"Cowpea(Lobia)":[0.2,4],"Dry chillies":[0.2,8],Garlic:[1,20],
  Ginger:[1,40],Gram:[0.2,4],Grapes:[5,50],Groundnut:[0.3,6],"Guar seed":[0.2,3],"Horse-gram":[0.2,3],
  Jowar:[0.2,5],Jute:[1,8],Khesari:[0.2,3],Lentil:[0.2,3],Linseed:[0.2,3],Maize:[0.5,15],Mango:[1,20],
  Masoor:[0.2,3],Mesta:[1,10],Moong:[0.2,3],"Moong(Green Gram)":[0.2,3],Moth:[0.2,3],Mustard:[0.2,5],
  "Niger seed":[0.1,3],"Oilseeds total":[0.2,4],Onion:[2,70],"Other Rabi pulses":[0.2,3],"Other Cereals":[0.2,5],
  "Other Kharif pulses":[0.2,4],"Other Summer Pulses":[0.2,4],"Peas & beans (Pulses)":[0.3,8],Potato:[3,60],
  Ragi:[0.2,5],"Rapeseed &Mustard":[0.2,5],Rice:[0.5,12],Rubber:[0.3,5],Safflower:[0.1,3],Sannhamp:[0.2,8],
  Sesamum:[0.1,2.5],"Small millets":[0.2,4],Soyabean:[0.3,5],Sugarcane:[20,160],Sunflower:[0.2,5],
  "Sweet potato":[3,40],Tapioca:[5,60],Tobacco:[0.3,5],Tomato:[5,100],Turmeric:[2,40],Urad:[0.2,3],Wheat:[0.5,8],
  "other oilseeds":[0.1,4]
};

export const MODEL_INFO={
  type:"Leakage-safe historical baseline + validated sanity layer",
  target:BASE_INFO.target,
  training_rows:BASE_INFO.training_rows,
  test_rows:BASE_INFO.test_rows,
  training_year_range:BASE_INFO.training_year_range,
  production_excluded:true,
  model_features_used:["Crop","State","Season"],
  context_only_inputs:["Year","Annual_Rainfall","Fertilizer","Pesticide"],
  area_role:"production calculation only; never a yield multiplier",
  validation_status:BASE_INFO.validation_status,
  test_metrics:BASE_INFO.test_metrics,
  version:"2026-09-11-yield-v3"
};

function toHa(input){
  const acre=Number(input.area_acre);
  if(Number.isFinite(acre)&&acre>0)return acre*ACRE_TO_HA;
  const ha=Number(input.area_ha??input.area);
  if(Number.isFinite(ha)&&ha>0)return ha;
  throw new Error("Area must be greater than zero.");
}
function validate(input){
  const crop=String(input.crop??"").trim();
  const state=String(input.state??"").trim();
  const season=String(input.season??"").trim();
  const year=Number(input.year);
  const rainfall=Number(input.rainfall);
  const fertilizer=Number(input.fertilizer);
  const pesticide=Number(input.pesticide);
  if(!SUPPORTED_STATES.includes(state))throw new Error(`Unsupported state: ${state||"missing"}.`);
  if(!SUPPORTED_CROPS.includes(crop))throw new Error(`Unsupported crop: ${crop||"missing"}.`);
  if(!SUPPORTED_SEASONS.includes(season))throw new Error(`Unsupported season: ${season||"missing"}.`);
  if(!Number.isInteger(year)||year<1997||year>2100)throw new Error("Year must be an integer from 1997 to 2100.");
  if(!Number.isFinite(rainfall)||rainfall<0||rainfall>10000)throw new Error("Annual rainfall must be between 0 and 10000 mm.");
  if(!Number.isFinite(fertilizer)||fertilizer<0||fertilizer>100000000)throw new Error("Fertilizer must be between 0 and 100000000 kg.");
  if(!Number.isFinite(pesticide)||pesticide<0||pesticide>10000000)throw new Error("Pesticide must be between 0 and 10000000 kg.");
  return {crop,state,season,year,rainfall,fertilizer,pesticide};
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

export function predictYieldModel(input){
  const p=validate(input);
  const areaHa=toHa(input);

  // The baseline intentionally receives a 1-ha area because area is not a
  // learned yield driver. This prevents farm size from changing t/ha.
  const base=basePredict({state:p.state,crop:p.crop,season:p.season,year:p.year,area:1,rainfall:p.rainfall,fertilizer:p.fertilizer,pesticide:p.pesticide});
  let predicted=Number(base.yield_tpha);
  const bounds=YIELD_BOUNDS[p.crop];
  let sanity_adjusted=false;
  if(bounds){const bounded=clamp(predicted,bounds[0],bounds[1]);sanity_adjusted=Math.abs(bounded-predicted)>1e-9;predicted=bounded;}
  predicted=Number(Math.max(0,predicted).toFixed(3));

  // This is an indicative uncertainty band, not a calibrated confidence
  // interval. It is anchored to the held-out median absolute error and a
  // conservative relative component because the source data contain severe
  // outliers and have not yet received temporal validation.
  const halfWidth=Math.max(MEDIAN_ABS_ERROR,predicted*0.35);
  const low=Number(Math.max(0,predicted-halfWidth).toFixed(3));
  const rawHigh=predicted+halfWidth;
  const high=Number((bounds?Math.min(bounds[1],rawHigh):rawHigh).toFixed(3));
  const historicalYear=p.year<=BASE_INFO.training_year_range[1];
  const confidence=historicalYear?"Medium":"Low";
  const warnings=[];
  if(!historicalYear)warnings.push(`Year ${p.year} is outside the training period (${BASE_INFO.training_year_range[0]}–${BASE_INFO.training_year_range[1]}); no future trend is assumed.`);
  warnings.push("Annual rainfall, fertilizer and pesticide are shown for transparency but are not converted into unvalidated yield adjustments because their farm-level units do not match the aggregate training data.");
  warnings.push("Temporal validation is still required before this should be treated as a production-grade forecast.");

  return {
    success:true,
    yield_tpha:predicted,
    yield_tpa:Number((predicted*ACRE_TO_HA).toFixed(3)),
    estimated_production_tonnes:Number((predicted*areaHa).toFixed(3)),
    unit:"tonnes/hectare",
    model:MODEL_INFO.type,
    model_version:MODEL_INFO.version,
    confidence,
    confidence_reason:historicalYear?"Inputs fall within the historical training period; confidence remains moderate because validation is not temporal.":"Future-year scenario outside the training period; confidence is low.",
    indicative_range_tpha:{low,high},
    uncertainty_method:"Heuristic band anchored to held-out median absolute error; not a calibrated prediction interval.",
    model_test_metrics:MODEL_INFO.test_metrics,
    validation_status:MODEL_INFO.validation_status,
    sanity_adjusted,
    plausible_range_tpha:bounds?{min:bounds[0],max:bounds[1]}:null,
    leakage_safe:true,
    inputs_used:{state:p.state,crop:p.crop,season:p.season,year:p.year,area_acre:Number((areaHa/ACRE_TO_HA).toFixed(4)),area_ha:Number(areaHa.toFixed(4)),annual_rainfall_mm:p.rainfall,fertilizer_kg:p.fertilizer,pesticide_kg:p.pesticide},
    model_inputs_used:MODEL_INFO.model_features_used,
    context_only_inputs:MODEL_INFO.context_only_inputs,
    note:`Historical-data estimate. ${warnings.join(" ")}`
  };
}
