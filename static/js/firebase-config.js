/* Firebase browser configuration */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { initializeFirestore, getFirestore, doc, getDocFromServer, setDoc, getDoc, getDocs, collection, query, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let app=null,auth=null,db=null;
export const OperationType={CREATE:"create",UPDATE:"update",DELETE:"delete",LIST:"list",GET:"get",WRITE:"write"};
export function handleFirestoreError(error,operationType,path){const errInfo={error:error instanceof Error?error.message:String(error),operationType,path:path||null,authInfo:{userId:auth?.currentUser?.uid||null,email:auth?.currentUser?.email||null,emailVerified:auth?.currentUser?.emailVerified||null}};console.warn("Firestore Notice:",JSON.stringify(errInfo));return errInfo;}

export async function testConnection(){
  if(!db)return false;
  try{
    await Promise.race([
      getDocFromServer(doc(db,"test","connection")),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("Probe timeout")),4000))
    ]);
    window.__AGRI_FIRESTORE_READY__=true;
    return true;
  }catch(error){
    window.__AGRI_FIRESTORE_READY__=false;
    return false;
  }
}

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
    db=null;
    window.__AGRI_FIRESTORE_READY__=false;
    console.log("✅ Firebase Auth initialized (Firestore unavailable; auth is independent)");
    return{app,auth,db};
  }catch(err){
    app=null;auth=null;db=null;
    window.__AGRI_FIRESTORE_READY__=false;
    console.error("❌ Firebase initialization failed:",err.message);
    return{app:null,auth:null,db:null,error:err};
  }
}

export const firebaseReady=initFirebase();
export function getFirebaseAuth(){return auth} export function getFirebaseDB(){return db}
export{app,auth,db,doc,getDocFromServer,setDoc,getDoc,getDocs,collection,query,orderBy,onSnapshot,deleteDoc};

// Decorative authentication scene. It loads independently and never blocks auth initialization.
if(typeof document!=="undefined"){
  import("/static/js/auth-3d.js?v=20260911-auth3d1").catch(error=>console.debug("Auth visual scene unavailable:",error));
  import("/static/js/auth-ui-upgrade.js?v=20260911-authui1").catch(error=>console.debug("Auth UI layer unavailable:",error));
}
