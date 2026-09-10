import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { getFirebaseAdminAuth } from "./config/security.js";

// Fast production /predict handler. It bypasses the older monkey-patched
// /predict implementations by registering directly through Express route().
const COOKIE = "agri_session";
const previousPost = express.application.post;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
let ai;
const getAI = () => ai || (process.env.GEMINI_API_KEY && (ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })), ai);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const parseCookies = h => Object.fromEntries(String(h || "").split(";").map(x => { const i=x.indexOf("="); return i<0?["",""]:[x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1).trim())]; }).filter(x=>x[0]));
const isImage = b => (b?.[0]===255&&b?.[1]===216&&b?.[2]===255) || (b?.length>=8&&Buffer.from(b.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (b?.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP");
async function auth(req,res,next){const token=parseCookies(req.headers.cookie||"")[COOKIE];if(!token)return res.status(401).json({success:false,error:"Authentication required. Please sign in again."});try{const d=await(await getFirebaseAdminAuth()).verifySessionCookie(token,true);req.diseaseUser={uid:d.uid,name:d.name||d.email?.split("@")[0]||"Farmer"};next();}catch{return res.status(401).json({success:false,error:"Your session has expired. Please sign in again."});}}
function parse(text){const s=String(text||"").replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim(),a=s.indexOf("{"),b=s.lastIndexOf("}");if(a<0||b<=a)throw Error("Invalid diagnosis JSON");return JSON.parse(s.slice(a,b+1));}
async function diagnose(req,res){
  if(!req.file)return res.status(400).json({success:false,error:"Image is required."});
  if(!isImage(req.file.buffer))return res.status(400).json({success:false,error:"Invalid image. Upload JPEG, PNG or WebP."});
  const client=getAI();if(!client)return res.status(200).json({success:false,retryable:false,error:"Disease detection is not configured on the server."});
  const prompt=`Analyze this agricultural image. Return ONLY compact JSON: is_plant(boolean),detected_subject,plant,disease,severity,cause,is_healthy(boolean),is_insect_caused(boolean),culprit,damage_mechanism,confidence(number 0-100 or null),summary,organic_treatment,chemical_treatment,recovery_protocol(array max 3),prevention_tips(array max 3). If no clear plant is visible set is_plant=false, confidence=null, disease="Non-Plant Subject" and do not invent treatment. If uncertain use disease="Uncertain diagnosis". Keep text concise. For chemical treatment never invent product or dose; follow the current locally registered crop-specific label.`;
  const contents=[{inlineData:{mimeType:req.file.mimetype||"image/jpeg",data:req.file.buffer.toString("base64")}},{text:prompt}];
  const model=process.env.GEMINI_FAST_MODEL||"gemini-3.5-flash-lite";
  try{
    const result=await Promise.race([client.models.generateContent({model,contents,config:{responseMimeType:"application/json"}}),sleep(12000).then(()=>{throw Object.assign(new Error("Diagnosis timeout"),{code:"TIMEOUT"});})]);
    const d=parse(result.text),confidence=Number(d.confidence),out={success:true,...d,confidence:Number.isFinite(confidence)?Math.max(0,Math.min(100,confidence)):null,source:`Gemini AI (${model})`,id:crypto.randomUUID(),timestamp:new Date().toISOString(),user:req.diseaseUser.name};
    if(!d.is_plant){out.success=false;out.confidence=null;out.error="No reliable plant specimen was detected. Please upload a clear crop image.";}
    return res.status(200).json(out);
  }catch(e){
    console.warn("Fast disease detection failed:",e.message);const status=Number(e?.status||e?.statusCode||0),retryable=[429,500,502,503,504].includes(status)||e?.code==="TIMEOUT";
    return res.status(200).json({success:false,retryable,error:e?.code==="TIMEOUT"?"Analysis is taking too long. Please try again with a clear close-up leaf image.":retryable?"AI analysis is temporarily busy. Please try again in a few seconds.":"AI could not analyze this image. Please try a clearer crop image."});
  }
}
express.application.post=function(route,...handlers){if(route==="/predict")return this.route(route).post(auth,upload.single("image"),diagnose);return previousPost.call(this,route,...handlers);};
