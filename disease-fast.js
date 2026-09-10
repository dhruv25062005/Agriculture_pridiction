import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { getFirebaseAdminAuth } from "./config/security.js";

// Production /predict handler. The current Gemini project allows 5 RPM, so
// the server deliberately budgets 4 RPM to leave safety headroom for other
// Gemini calls in the app and avoids wasting quota on retries.
const COOKIE = "agri_session";
const previousPost = express.application.post;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
const SERVER_RPM_LIMIT = 4;
const RPM_WINDOW_MS = 60_000;
const geminiRequestTimes = [];
let ai;
const getAI = () => ai || (process.env.GEMINI_API_KEY && (ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })), ai);
const parseCookies = h => Object.fromEntries(String(h || "").split(";").map(x => { const i=x.indexOf("="); return i<0?["",""]:[x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1).trim())]; }).filter(x=>x[0]));
const isImage = b => (b?.[0]===255&&b?.[1]===216&&b?.[2]===255) || (b?.length>=8&&Buffer.from(b.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (b?.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP");
async function auth(req,res,next){const token=parseCookies(req.headers.cookie||"")[COOKIE];if(!token)return res.status(401).json({success:false,error:"Authentication required. Please sign in again."});try{const d=await(await getFirebaseAdminAuth()).verifySessionCookie(token,true);req.diseaseUser={uid:d.uid,name:d.name||d.email?.split("@")[0]||"Farmer"};next();}catch{return res.status(401).json({success:false,error:"Your session has expired. Please sign in again."});}}
function parse(text){const s=String(text||"").replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim(),a=s.indexOf("{"),b=s.lastIndexOf("}");if(a<0||b<=a)throw Error("Invalid diagnosis JSON");return JSON.parse(s.slice(a,b+1));}
function statusOf(e){return Number(e?.status||e?.statusCode||e?.response?.status||e?.error?.code||0);}
function messageOf(e){return String(e?.message||e?.error?.message||"").toLowerCase();}
function pruneRequestTimes(now=Date.now()){while(geminiRequestTimes.length&&now-geminiRequestTimes[0]>=RPM_WINDOW_MS)geminiRequestTimes.shift();}
function reserveGeminiSlot(){const now=Date.now();pruneRequestTimes(now);if(geminiRequestTimes.length>=SERVER_RPM_LIMIT){const wait=Math.ceil((RPM_WINDOW_MS-(now-geminiRequestTimes[0]))/1000);return {ok:false,wait};}geminiRequestTimes.push(now);return {ok:true,wait:0};}

async function callGemini(client, contents, model){
  return Promise.race([
    client.models.generateContent({
      model,
      contents,
      config:{responseMimeType:"application/json",thinkingConfig:{thinkingLevel:"minimal"},maxOutputTokens:700}
    }),
    new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(new Error("Diagnosis timeout"),{code:"TIMEOUT"})),10000))
  ]);
}

async function diagnose(req,res){
  if(!req.file)return res.status(400).json({success:false,error:"Image is required."});
  if(!isImage(req.file.buffer))return res.status(400).json({success:false,error:"Invalid image. Upload JPEG, PNG or WebP."});
  const client=getAI();
  if(!client)return res.status(503).json({success:false,retryable:false,error:"Disease detection is not configured. Add GEMINI_API_KEY to Render environment variables."});

  const slot=reserveGeminiSlot();
  if(!slot.ok){
    return res.status(200).json({success:false,retryable:true,rate_limited:true,retry_after_seconds:slot.wait,error:`Gemini request limit reached. Please wait ${slot.wait} seconds before scanning again.`});
  }

  const prompt=`Analyze this agricultural image. Return ONLY compact JSON with these keys: is_plant(boolean),detected_subject,plant,disease,severity,cause,is_healthy(boolean),is_insect_caused(boolean),culprit,damage_mechanism,confidence(number 0-100 or null),summary,organic_treatment,chemical_treatment,recovery_protocol(array max 3),prevention_tips(array max 3). If no clear plant is visible: is_plant=false, confidence=null, disease="Non-Plant Subject", no treatment. If uncertain: disease="Uncertain diagnosis". Keep every text field concise. Never invent chemical products or doses; follow the current locally registered crop-specific label.`;
  const mime=(req.file.mimetype||"").toLowerCase();
  const safeMime=mime==="image/png"?"image/png":mime==="image/webp"?"image/webp":"image/jpeg";
  const contents=[{inlineData:{mimeType:safeMime,data:req.file.buffer.toString("base64")}},{text:prompt}];
  const model=process.env.GEMINI_FAST_MODEL||"gemini-3.5-flash-lite";

  try{
    const result=await callGemini(client,contents,model);
    const d=parse(result.text),confidence=Number(d.confidence);
    const out={success:true,...d,confidence:Number.isFinite(confidence)?Math.max(0,Math.min(100,confidence)):null,source:`Gemini AI (${model})`,id:crypto.randomUUID(),timestamp:new Date().toISOString(),user:req.diseaseUser.name};
    if(!d.is_plant){out.success=false;out.confidence=null;out.error="No reliable plant specimen was detected. Please upload a clear crop image.";}
    return res.status(200).json(out);
  }catch(e){
    const status=statusOf(e),text=messageOf(e);
    console.warn("Disease detection failed:",status||"unknown",e?.message||e);
    if(status===401||status===403||/api.?key|unauthorized|permission denied|authentication/i.test(text))return res.status(503).json({success:false,retryable:false,error:"Gemini API authentication failed. Check GEMINI_API_KEY and project permissions in Render."});
    if(status===429||/resource.?exhausted|rate.?limit|quota/i.test(text))return res.status(200).json({success:false,retryable:true,rate_limited:true,error:"Gemini quota/rate limit is currently full. Please wait before scanning again."});
    if(status===503||/overloaded|temporarily unavailable|service unavailable/i.test(text))return res.status(200).json({success:false,retryable:true,error:"Gemini is temporarily busy. Please wait 10–15 seconds and scan again."});
    if(status===404||/model.?not.?found|not found.*model/i.test(text))return res.status(503).json({success:false,retryable:false,error:`Gemini model '${model}' is unavailable. Set GEMINI_FAST_MODEL to a valid vision-capable Gemini model in Render.`});
    if(e?.code==="TIMEOUT")return res.status(200).json({success:false,retryable:true,error:"Gemini analysis timed out. Please hold the leaf steady and try again."});
    return res.status(200).json({success:false,retryable:false,error:"Gemini could not analyze this image. Please try a clearer crop image."});
  }
}

express.application.post=function(route,...handlers){if(route==="/predict")return this.route(route).post(auth,upload.single("image"),diagnose);return previousPost.call(this,route,...handlers);};
