/* Firebase browser configuration */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { initializeFirestore, getFirestore, doc, getDocFromServer, setDoc, getDoc, getDocs, collection, query, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let app=null,auth=null,db=null;
export const OperationType={CREATE:"create",UPDATE:"update",DELETE:"delete",LIST:"list",GET:"get",WRITE:"write"};
export function handleFirestoreError(error,operationType,path){const errInfo={error:error instanceof Error?error.message:String(error),operationType,path:path||null,authInfo:{userId:auth?.currentUser?.uid||null,email:auth?.currentUser?.email||null,emailVerified:auth?.currentUser?.emailVerified||null}};console.warn("Firestore Notice:",JSON.stringify(errInfo));return errInfo;}
export async function testConnection(){if(!db)return;try{await Promise.race([getDocFromServer(doc(db,"test","connection")),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Probe timeout")),4000))]);console.log("✅ Firestore connection validated");}catch(error){console.log("ℹ️ Firestore connection probe unavailable; this does not block normal reads/writes.");}}

async function fetchWithTimeout(url, options={}, timeoutMs=10000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}

async function initFirebase(){
  try{
    const response=await fetchWithTimeout("/firebase_config",{credentials:"same-origin",cache:"no-store"},10000);
    if(!response.ok)throw new Error(`Firebase configuration endpoint returned HTTP ${response.status}`);
    const cfg=await response.json();
    const missing=["apiKey","authDomain","projectId","appId"].filter(k=>!cfg?.[k]);
    if(missing.length)throw new Error(`Firebase configuration is incomplete: ${missing.join(", ")}`);
    app=initializeApp(cfg);
    auth=getAuth(app);
    const dbId=String(cfg.firestoreDatabaseId||"(default)").trim()||"(default)";
    try{db=initializeFirestore(app,{experimentalForceLongPolling:true},dbId);}catch(_){db=getFirestore(app,dbId);}
    console.log(`✅ Firebase initialized (Firestore database: ${dbId})`);
    return{app,auth,db};
  }catch(err){
    app=null;auth=null;db=null;
    console.error("❌ Firebase initialization failed:",err.message);
    return{app:null,auth:null,db:null,error:err};
  }
}

export const firebaseReady=initFirebase();
export function getFirebaseAuth(){return auth} export function getFirebaseDB(){return db}
export{app,auth,db,doc,getDocFromServer,setDoc,getDoc,getDocs,collection,query,orderBy,onSnapshot,deleteDoc};
