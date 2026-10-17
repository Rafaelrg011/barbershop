import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import validation from '../../public/state-validation.js';
import {ApiError,requireOwner} from '../../server/accounts.mjs';
import {requireOperator,validateReception} from '../../server/operator.mjs';
const {validateState,validateTransition}=validation;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const result=(status,body)=>({statusCode:status,headers,body:JSON.stringify(body)});
export async function handler(event){
 if(!['GET','POST'].includes(event.httpMethod))return result(405,{error:'Método no permitido.'});
 if(event.httpMethod==='POST'&&!(event.headers['content-type']||'').startsWith('application/json'))return result(415,{error:'Formato no permitido.'});
 if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>800000)return result(413,{error:'Se alcanzó el límite de datos de esta integración.'});
 try{
   if(!getApps().length){if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON)throw new ApiError(503,'Falta configurar el servicio de guardado en Netlify.');initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))})}
   const bearer=event.headers.authorization||'';if(!bearer.startsWith('Bearer ')||bearer.length>8192)throw new ApiError(401,'Inicia sesión.');
   let token;try{token=await getAuth().verifyIdToken(bearer.slice(7),true)}catch{throw new ApiError(401,'Sesión vencida o revocada.');}
   const db=getFirestore(),member=db.doc('memberships/'+token.uid),owner=requireOperator((await member.get()).data(),token);
   const ref=db.doc('tenants/'+owner.tenantId+'/state/current');
   if(event.httpMethod==='GET'){
     const snap=await ref.get();
     return result(200,{state:snap.exists?JSON.parse(snap.data().payload):null,revision:snap.data()?.revision||0,role:owner.role});
   }
   let body;try{body=JSON.parse(event.body)}catch{throw new ApiError(400,'Solicitud no válida.');}
   if(!body||Object.keys(body).some(k=>!['state','expected','operationId'].includes(k))||!Number.isSafeInteger(body.expected)||body.expected<0||typeof body.operationId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.operationId))throw new ApiError(400,'Solicitud no válida.');
   try{validateState(body.state)}catch(error){throw new ApiError(400,error.message)}
   const payload=JSON.stringify(body.state);if(Buffer.byteLength(payload)>750000)throw new ApiError(413,'Se alcanzó el límite de datos de esta integración.');
   const receipt=db.doc('tenants/'+owner.tenantId+'/stateAudit/'+body.operationId);
   const revision=await db.runTransaction(async tx=>{
     const [memberSnap,snap,receiptSnap]=await Promise.all([tx.get(member),tx.get(ref),tx.get(receipt)]);
     const currentOwner=requireOperator(memberSnap.data(),token);if(currentOwner.tenantId!==owner.tenantId)throw new ApiError(403,'Cambió el acceso a la barbería.');
     if(receiptSnap.exists){if(receiptSnap.data().actor!==token.uid)throw new ApiError(403,'Operación no disponible.');return receiptSnap.data().revision}
     if((snap.data()?.revision||0)!==body.expected)throw new ApiError(409,'Otra sesión modificó los datos. Recarga y revisa la operación antes de repetirla.');
     if(currentOwner.role==='reception')validateReception(snap.exists?JSON.parse(snap.data().payload):null,body.state);
     try{validateTransition(snap.exists?JSON.parse(snap.data().payload):null,body.state)}catch(error){throw new ApiError(400,error.message)}
     const next=body.expected+1;
     tx.set(ref,{schema:1,payload,revision:next,updatedBy:token.uid,updatedAt:FieldValue.serverTimestamp(),operationId:body.operationId});
     tx.create(receipt,{actor:token.uid,revision:next,at:FieldValue.serverTimestamp()});
     return next;
   });
   return result(200,{revision});
 }catch(error){return result(error instanceof ApiError?error.status:503,{error:error instanceof ApiError?error.message:'No se confirmó el guardado. Revisa los registros antes de repetir la operación.'})}
}
