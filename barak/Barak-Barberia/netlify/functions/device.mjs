import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {ApiError,requireOwner} from '../../server/accounts.mjs';
export async function handler(event){
 const response=(statusCode,value)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(value)});
 try{
  if(event.httpMethod!=='POST')throw new ApiError(405,'Método no permitido.');
  if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>16000)throw new ApiError(400,'Solicitud no válida.');
  if(!getApps().length){if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON)throw new ApiError(503,'Falta configurar Firebase en Netlify.');initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))})}
  let token,device;try{
   const body=JSON.parse(event.body);
   token=await getAuth().verifyIdToken((event.headers.authorization||'').replace(/^Bearer /,''),true);
   device=await getAuth().verifyIdToken(body.deviceToken,true);
  }catch{throw new ApiError(401,'Vuelve a ingresar como propietario.');}
  if(device.firebase?.sign_in_provider!=='anonymous'||device.uid===token.uid)throw new ApiError(403,'Identidad de recepción no válida.');
  const db=getFirestore();
  await db.runTransaction(async tx=>{
   const ownerRef=db.doc('memberships/'+token.uid),deviceRef=db.doc('memberships/'+device.uid);
   const [o,d]=await Promise.all([tx.get(ownerRef),tx.get(deviceRef)]);
   const owner=requireOwner(o.data(),token,Date.now(),true);
   if(d.exists&&(d.data().tenantId!==owner.tenantId||d.data().role!=='reception'||!d.data().deviceAccess))throw new ApiError(403,'Este navegador está asociado a otro acceso.');
   tx.set(deviceRef,{tenantId:owner.tenantId,role:'reception',deviceAccess:true,active:true,authorizedBy:token.uid,authorizedAt:FieldValue.serverTimestamp()});
  });
  return response(200,{ok:true});
 }catch(e){return response(e instanceof ApiError?e.status:503,{error:e instanceof ApiError?e.message:'No se pudo habilitar este equipo. Revisa la configuración del servidor.'})}
}
