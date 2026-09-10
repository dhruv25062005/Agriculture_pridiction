// Security middleware and Firebase authentication helpers.
let rateLimit;
try {
  const mod = await import("express-rate-limit");
  rateLimit = mod.default || mod.rateLimit || mod;
} catch (_) {
  rateLimit = (options = {}) => {
    const windowMs = options.windowMs || 60000;
    const max = options.max || 120;
    const hits = new Map();
    const timer = setInterval(() => { const now = Date.now(); for (const [key, v] of hits) if (now > v.resetTime) hits.delete(key); }, Math.min(windowMs, 60000));
    timer.unref?.();
    return (req, res, next) => {
      if (options.skip?.(req)) return next();
      const key = req.ip || req.socket?.remoteAddress || "global";
      const now = Date.now(); let v = hits.get(key);
      if (!v || now > v.resetTime) { v = { count: 0, resetTime: now + windowMs }; hits.set(key, v); }
      v.count++;
      if (v.count > max) return res.status(429).json(options.message || { success:false, error:"Too many requests." });
      next();
    };
  };
}
let cors;
try { const mod = await import("cors"); cors = mod.default || mod; }
catch (_) { cors = () => (req,res,next) => next(); }
let helmet;
try { const mod = await import("helmet"); helmet = mod.default || mod; }
catch (_) { helmet = () => (_req,_res,next) => next(); }

let firebaseAdminAuthPromise = null;
export async function getFirebaseAdminAuth() {
  if (firebaseAdminAuthPromise) return firebaseAdminAuthPromise;
  firebaseAdminAuthPromise = (async () => {
    const { getApps, initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    if (getApps().length === 0) {
      let credential;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        let account;
        try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."); }
        if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, "\n");
        credential = cert(account);
      } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
        credential = cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        credential = applicationDefault();
      } else {
        throw new Error("Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_PROJECT_ID.");
      }
      initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID || undefined });
    }
    return getAuth();
  })().catch(err => { firebaseAdminAuthPromise = null; throw err; });
  return firebaseAdminAuthPromise;
}

function readRequestBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve,reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let size=0; const chunks=[]; let settled=false;
    req.on("data", chunk => { if (settled) return; size += chunk.length; if (size > maxBytes) { settled=true; reject(new Error("Request body too large")); return; } chunks.push(chunk); });
    req.on("end", () => { if (settled) return; try { settled=true; resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { settled=true; reject(new Error("Invalid JSON body")); } });
    req.on("error", err => { if (!settled) { settled=true; reject(err); } });
  });
}

export const firebaseSessionGuard = async (req,res,next) => {
  if (req.method !== "POST" || req.path !== "/set_session") return next();
  try {
    const incoming = await readRequestBody(req);
    const idToken = incoming?.idToken;
    if (typeof idToken !== "string" || idToken.length < 100) return res.status(401).json({success:false,error:"Missing Firebase ID token. Please sign in again."});
    const decoded = await (await getFirebaseAdminAuth()).verifyIdToken(idToken, true);
    req.firebaseIdToken = idToken;
    req.body = { uid: decoded.uid, email: decoded.email || "", name: decoded.name || decoded.email?.split("@")[0] || "Smart Farmer", photo: decoded.picture || null, provider: decoded.firebase?.sign_in_provider || "password", emailVerified: Boolean(decoded.email_verified), firebaseVerified: true };
    next();
  } catch (err) {
    console.warn("Firebase session verification failed:", err.code || err.message);
    return res.status(401).json({success:false,error:"Authentication token is invalid, expired, or revoked. Please sign in again."});
  }
};

export const firebaseConfigMiddleware = (req,res,next) => {
  if (req.method !== "GET" || req.path !== "/firebase_config") return next();
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "", authDomain: process.env.FIREBASE_AUTH_DOMAIN || "", databaseURL: process.env.FIREBASE_DATABASE_URL || "", projectId: process.env.FIREBASE_PROJECT_ID || "", storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "", messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "", appId: process.env.FIREBASE_APP_ID || "", measurementId: process.env.FIREBASE_MEASUREMENT_ID || "",
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() || "(default)"
  };
  const missing=["apiKey","authDomain","projectId","appId"].filter(k=>!config[k]);
  if(missing.length) return res.status(503).json({error:"Firebase is not configured on the server.",missing});
  res.setHeader("Cache-Control","public,max-age=3600"); res.json(config);
};

export const corsConfig = () => {
  const explicit=(process.env.CORS_ORIGINS||"").split(",").map(x=>x.trim().replace(/\/$/,"")).filter(Boolean);
  const own=(process.env.RENDER_EXTERNAL_URL||"").replace(/\/$/,"");
  return cors({ origin:(origin,cb)=>{ if(!origin||explicit.includes(origin)||(own&&origin===own)||origin.startsWith("http://localhost:")||origin.startsWith("http://127.0.0.1:")) return cb(null,true); cb(new Error("CORS origin not allowed")); }, credentials:true, methods:["GET","POST","PUT","DELETE","OPTIONS"], allowedHeaders:["Content-Type","Authorization","X-Requested-With"], maxAge:86400 });
};
export const createRateLimiter=(windowMs=60000,max=120)=>rateLimit({windowMs:parseInt(process.env.RATE_LIMIT_WINDOW_MS||windowMs,10),max:parseInt(process.env.RATE_LIMIT_REQUESTS||max,10),standardHeaders:true,legacyHeaders:false,skip:req=>req.path==="/health"||req.path==="/sw.js"});
export const strictRateLimiter=rateLimit({windowMs:60000,max:60,standardHeaders:true,legacyHeaders:false,message:{success:false,error:"Too many requests. Please wait a moment."}});
export const helmetConfig=()=>helmet({contentSecurityPolicy:false,frameguard:{action:"deny"},crossOriginEmbedderPolicy:false,crossOriginOpenerPolicy:false,crossOriginResourcePolicy:false});
export const securityMiddleware=app=>{app.use(helmetConfig());app.use(corsConfig());app.use(createRateLimiter());app.use(firebaseConfigMiddleware);app.use(firebaseSessionGuard);};
export const sessionSecurityOptions={httpOnly:true,secure:process.env.NODE_ENV==="production"||process.env.RENDER==="true",sameSite:process.env.SESSION_SAMESITE||"lax",signed:true,maxAge:5*24*60*60*1000};
