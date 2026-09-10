import express from "express";

// Transparent climate suitability engine. It ranks crops from temperature and
// seasonal rainfall and does not invent a validated yield prediction.
const originalPost = express.application.post;
const crops = {
  wheat:{label:"Wheat",temp:[15,24],rain:[350,550],season:"Cool season",water:"Moderate"},
  rice:{label:"Rice",temp:[24,30],rain:[900,1400],season:"Warm/monsoon season",water:"High"},
  maize:{label:"Maize",temp:[20,30],rain:[500,800],season:"Warm season",water:"Moderate"},
  tomato:{label:"Tomato",temp:[20,28],rain:[400,700],season:"Warm season",water:"Moderate"},
  potato:{label:"Potato",temp:[15,23],rain:[450,700],season:"Cool season",water:"Moderate"},
  cotton:{label:"Cotton",temp:[21,32],rain:[500,900],season:"Warm/monsoon season",water:"Moderate"},
  soybean:{label:"Soybean",temp:[20,30],rain:[450,700],season:"Warm/monsoon season",water:"Moderate"},
  chickpea:{label:"Chickpea",temp:[18,26],rain:[300,500],season:"Cool/dry season",water:"Low"},
  mustard:{label:"Mustard",temp:[10,25],rain:[300,500],season:"Cool season",water:"Low"},
  groundnut:{label:"Groundnut",temp:[24,30],rain:[500,1000],season:"Warm season",water:"Moderate"}
};
const num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

// Smooth score: 100 at the center of the published range, 85 at its edges,
// then declines progressively outside the range. This avoids the old problem
// where every value inside a very wide range received exactly 100.
function suitability(value,range){
  const lo=range[0],hi=range[1],mid=(lo+hi)/2,half=Math.max((hi-lo)/2,.1);
  const d=Math.abs(value-mid);
  if(d<=half) return Math.round(100-(d/half)*15);
  return Math.round(clamp(85-((d-half)/half)*55,0,85));
}
function label(score){return score>=80?"Favorable":score>=65?"Moderately favorable":score>=50?"Marginal":"Poor fit";}
function confidence(best,second){const margin=best-(second??0);return best>=80&&margin>=12?"Moderate (climate-only)":margin>=6?"Low (climate-only)":"Very low (close match)";}
function limitText(t,r){if(Math.abs(t-r)<5)return"Temperature and rainfall are similarly influential.";return t<r?`Temperature is the stronger constraint (${t}/100).`:`Seasonal rainfall is the stronger constraint (${r}/100).`;}

function cropRecommendation(req,res){
  const temperature=clamp(num(req.body?.temp,25),-10,55);
  const rainfall=clamp(num(req.body?.rainfall,500),0,3000);
  const ranked=Object.values(crops).map(c=>{const t=suitability(temperature,c.temp),r=suitability(rainfall,c.rain);return{crop:c.label,score:Math.round(t*.45+r*.55),temperature_fit:t,rainfall_fit:r,temperature_range_c:c.temp,rainfall_range_mm:c.rain,season:c.season,water_requirement:c.water};}).sort((a,b)=>b.score-a.score||b.rainfall_fit-a.rainfall_fit);
  const best=ranked[0],second=ranked[1];
  return res.json({success:true,crop:best.crop,recommendation:best.crop,score:best.score,suitability_label:label(best.score),season:best.season,expected_yield:"Not estimated — requires historical yield, soil, cultivar and management data",water_requirement:`${best.water_requirement}; typical seasonal rainfall ${best.rainfall_range_mm[0]}–${best.rainfall_range_mm[1]} mm`,recommendation_confidence:confidence(best.score,second?.score),limiting_factor:limitText(best.temperature_fit,best.rainfall_fit),alternatives:ranked.slice(1,4),inputs_used:{temperature_c:temperature,seasonal_rainfall_mm:rainfall},note:"Climate-screening result, not a guaranteed crop choice. Soil type/pH, irrigation reliability, sowing date, cultivar, pests, market conditions and local agronomic practice are not included."});
}

function yieldIndex(req,res){
  const temperature=clamp(num(req.body?.temp,25),-10,55),rainfall=clamp(num(req.body?.rainfall,500),0,3000),humidity=clamp(num(req.body?.humidity,65),0,100);
  const raw=String(req.body?.crop||"").toLowerCase().trim(),key=Object.keys(crops).find(k=>raw.includes(k));
  if(!key)return res.status(400).json({success:false,error:"Select a specific crop before calculating environmental suitability."});
  const crop=crops[key],temperatureScore=suitability(temperature,crop.temp),rainfallScore=suitability(rainfall,crop.rain),humidityPenalty=humidity>80?Math.min(10,(humidity-80)*.35):0,index=Math.round(clamp(temperatureScore*.45+rainfallScore*.55-humidityPenalty,0,100));
  const recommendations=[];
  if(temperatureScore<80)recommendations.push("Temperature is outside the crop's strongest comfort zone; consider a more suitable planting window.");
  if(rainfallScore<80)recommendations.push(rainfall<crop.rain[0]?"Rainfall is below the typical seasonal requirement; plan irrigation based on soil moisture.":"Rainfall is above the typical seasonal range; ensure drainage and avoid waterlogging.");
  if(humidity>=75)recommendations.push("Humidity pressure is elevated; scout leaves regularly and reduce prolonged canopy wetness where practical.");
  if(!recommendations.length)recommendations.push("Climate conditions are broadly suitable; continue soil-moisture monitoring, balanced nutrition and field scouting.");
  return res.json({success:true,crop:crop.label,forecast_type:"environmental_suitability",yield_index:index,productivity_rating:label(index),potential_growth_index:`Environmental suitability: ${index}/100`,temperature_suitability:temperatureScore,rainfall_suitability:rainfallScore,limiting_factor:limitText(temperatureScore,rainfallScore),fungal_blight_risk:humidity>=85?"High humidity pressure":humidity>=75?"Elevated humidity pressure":humidity>=65?"Moderate humidity pressure":"Lower humidity pressure",agronomic_recommendations:recommendations,confidence:null,confidence_note:"This is a climate suitability index, not a validated yield forecast. A real yield model needs historical yield, soil, cultivar, crop stage and management data.",inputs_used:{crop:crop.label,temperature_c:temperature,seasonal_rainfall_mm:rainfall,relative_humidity_percent:humidity}});
}

express.application.post=function(route,...handlers){if(route==="/recommend_crop")return originalPost.call(this,route,cropRecommendation);if(route==="/predict_yield")return originalPost.call(this,route,yieldIndex);return originalPost.call(this,route,...handlers);};
