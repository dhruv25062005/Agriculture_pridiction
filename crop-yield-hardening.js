import express from "express";
import { strictRateLimiter } from "./config/security.js";
import { predictYieldModel } from "./models/yield-model-enhanced.js";
import { predictYieldModel as safePredictYieldModel } from "./models/yield-model-safe.js";

const originalApplicationPost=express.application.post;
const originalRouterPost=express.Router.prototype.post;
const num=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;

const profiles=[
  ["Pearl millet (Bajra)",[25,35],[200,500],"Kharif/Summer","Low","high"],
  ["Sorghum (Jowar)",[20,32],[250,600],"Kharif/Rabi","Low-Moderate","high"],
  ["Chickpea",[18,26],[300,500],"Rabi","Low","moderate"],
  ["Mustard",[10,25],[300,500],"Rabi","Low","moderate"],
  ["Wheat",[15,24],[350,550],"Rabi","Moderate","low"],
  ["Rice",[24,30],[900,1400],"Kharif","High","low"],
  ["Maize",[20,30],[500,800],"Kharif/Summer","Moderate","moderate"],
  ["Tomato",[18,28],[400,700],"Rabi/Summer","Moderate","low"],
  ["Potato",[15,23],[450,700],"Rabi","Moderate","low"],
  ["Cotton",[21,32],[500,900],"Kharif","Moderate","moderate"],
  ["Soybean",[20,30],[450,700],"Kharif","Moderate","moderate"],
  ["Groundnut",[24,30],[500,1000],"Kharif/Summer","Moderate","moderate"],
  ["Pigeon pea (Arhar)",[20,30],[600,1000],"Kharif","Moderate","moderate"],
  ["Lentil",[18,25],[300,500],"Rabi","Low","moderate"],
  ["Onion",[13,25],[350,700],"Rabi/Kharif","Moderate","low"],
  ["Sugarcane",[20,32],[1000,2000],"Long duration","Very high","low"],
  ["Banana",[20,35],[1000,2500],"Whole year","High","low"],
  ["Chilli",[20,30],[500,1000],"Kharif/Rabi","Moderate","moderate"],
  ["Sesame",[25,35],[400,700],"Kharif","Low","high"],
  ["Sunflower",[20,30],[400,700],"Rabi/Kharif","Moderate","moderate"]
];
const resilience={high:1,moderate:.55,low:.15};
function fit(value,range){const mid=(range[0]+range[1])/2;const half=Math.max((range[1]-range[0])/2,.1);const normalized=Math.abs(value-mid)/half;if(normalized<=1)return Math.round(100-20*normalized*normalized);return Math.max(0,Math.round(80*Math.exp(-(normalized-1)*1.25)));}
function rainfallFitWithResilience(rainfall,range,className){const base=fit(rainfall,range);if(rainfall>=range[0])return base;const deficit=Math.min(1,Math.max(0,1-rainfall/range[0]));return Math.min(88,Math.round(base+resilience[className]*18*deficit));}
function classify(score){if(score>=80)return "Favorable";if(score>=65)return "Good climate fit";if(score>=50)return "Marginal — irrigation/management may be needed";if(score>=35)return "Limited fit";return "Poor climate fit";}
function recommendationReason(best,rainfall){const low=best.rainfall_range_mm[0];if(rainfall<low&&best.resilience!=="low")return `${best.crop} ranks highest because it tolerates lower moisture better than most alternatives; ${Math.round(low-rainfall)} mm below its typical lower rainfall range.`;if(rainfall<low)return `${best.crop} is the best available climate match, but rainfall is below its typical range; supplemental irrigation may be required.`;return `${best.crop} has the strongest combined temperature and rainfall fit for the supplied climate.`;}
function cropRecommendation(req,res){
  const temp=num(req.body?.temp??req.body?.temperature,NaN);
  const rainfall=num(req.body?.rainfall??req.body?.seasonal_rainfall,NaN);
  if(!Number.isFinite(temp)||temp<-10||temp>55)return res.status(400).json({success:false,error:"Temperature must be between -10°C and 55°C."});
  if(!Number.isFinite(rainfall)||rainfall<0||rainfall>3000)return res.status(400).json({success:false,error:"Seasonal rainfall must be between 0 and 3000 mm."});
  const ranked=profiles.map(([crop,temperatureRange,rainfallRange,season,waterRequirement,resilienceClass])=>{const temperatureFit=fit(temp,temperatureRange);const rainfallFit=rainfallFitWithResilience(rainfall,rainfallRange,resilienceClass);const score=Math.round(temperatureFit*.45+rainfallFit*.55);return {crop,score,season,water_requirement:waterRequirement,resilience:resilienceClass,temperature_fit:temperatureFit,rainfall_fit:rainfallFit,temperature_range_c:temperatureRange,rainfall_range_mm:rainfallRange};}).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  return res.json({success:true,api_version:"2026-09-11-crop-v4",crop:best.crop,recommendation:best.crop,score:best.score,suitability_label:classify(best.score),temperature_fit:best.temperature_fit,rainfall_fit:best.rainfall_fit,season:best.season,water_requirement:best.water_requirement,resilience:best.resilience,recommended_temperature_range_c:best.temperature_range_c,recommended_rainfall_range_mm:best.rainfall_range_mm,recommendation_confidence:"Climate screening only",alternatives:ranked.slice(1,6),inputs_used:{temperature_c:temp,seasonal_rainfall_mm:rainfall},note:`${recommendationReason(best,rainfall)} Climate screening does not include soil, irrigation, cultivar, sowing date, pests, disease pressure or market conditions.`});
}
function trainedYield(req,res){
  const p=req.body||{};
  const input={state:p.state,crop:p.crop,season:p.season,year:p.year??new Date().getFullYear(),area_acre:p.area_acre,area_ha:p.area_ha,area:p.area,rainfall:p.rainfall??p.annual_rainfall??p.Annual_Rainfall,fertilizer:p.fertilizer??p.Fertilizer,pesticide:p.pesticide??p.Pesticide};
  try{
    let result=predictYieldModel(input);
    if(!result||result.success!==true||!Number.isFinite(Number(result.yield_tpha))){
      result=safePredictYieldModel({...input,area_ha:Number(input.area_ha??input.area??(Number(input.area_acre)*0.40468564224))});
      result={...result,success:true,model:`${result.model} (safe finite fallback)`,confidence:"Low",fallback_reason:"The temporal model returned a non-finite value, so the leakage-safe historical baseline was used."};
    }
    if(!Number.isFinite(Number(result.yield_tpha)))throw new Error("Yield model could not produce a finite estimate.");
    return res.json({...result,api_version:"2026-09-11-yield-v4",forecast_type:"historical_data_estimate",confidence_note:"Indicative historical estimate; model output is checked for finite values and no unverified fallback number is silently presented."});
  }catch(error){return res.status(400).json({success:false,error:error?.message||"Unable to calculate yield."});}
}
function withFinalHandler(handlers,finalHandler){
  const preserved=handlers.length?handlers.slice(0,-1):[];
  return [...preserved,strictRateLimiter,finalHandler];
}
function patchedPost(originalPost){return function(route,...handlers){if(route==="/recommend_crop")return originalPost.call(this,route,...withFinalHandler(handlers,cropRecommendation));if(route==="/predict_yield")return originalPost.call(this,route,...withFinalHandler(handlers,trainedYield));return originalPost.call(this,route,...handlers);};}
express.application.post=patchedPost(originalApplicationPost);
express.Router.prototype.post=patchedPost(originalRouterPost);
