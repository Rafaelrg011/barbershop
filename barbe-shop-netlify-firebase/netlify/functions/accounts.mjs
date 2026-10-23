import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {ApiError,requireOwner,publicAccount,manageAccount} from '../../server/accounts.mjs';
import {accountStore} from '../../server/firebase-store.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(status,value)=>({statusCode:status,headers,body:JSON.stringify(value)});
export async function handler(event){
  if(!['GET','POST'].includes(event.httpMethod))return response(405,{error:'Método no permitido.'});
  // No CORS: los navegadores solo pueden llamar desde el mismo sitio.
  if(event.httpMethod==='POST'&&!(event.headers['content-type']||'').startsWith('application/json'))return response(415,{error:'Formato no permitido.'});
  if(event.isBase64Encoded||Buffer.byteLength(event.body||'','utf8')>8192)return response(413,{error:'Solicitud demasiado grande.'});
  const bearer=event.headers.authorization||'';
  if(!bearer.startsWith('Bearer ')||bearer.length>8192)return response(401,{error:'Inicia sesión para continuar.'});
  try{
    if(!getApps().length){
      const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if(!raw)throw new ApiError(503,'La administración de cuentas aún no está configurada en el servidor.');
      initializeApp({credential:cert(JSON.parse(raw))});
    }
    const auth=getAuth(),db=getFirestore();
    let token;try{token=await auth.verifyIdToken(bearer.slice(7),true)}catch{throw new ApiError(401,'La sesión venció o fue revocada. Vuelve a ingresar.');}
    const store=accountStore(db,FieldValue);
    const owner=requireOwner(await store.getMember(token.uid),token);
    if(event.httpMethod==='GET'){
      const rows=await db.collection('memberships').where('tenantId','==',owner.tenantId).limit(200).get();
      return response(200,{accounts:rows.docs.filter(d=>['reception','barber'].includes(d.data().role)).map(d=>publicAccount(d.id,d.data()))});
    }
    let data;try{data=JSON.parse(event.body||'')}catch{throw new ApiError(400,'Solicitud no válida.');}
    const account=await manageAccount({store,auth,token,data});
    return response(200,{account});
  }catch(error){
    // Nunca registrar cuerpo, token, contraseña o el error bruto de Auth.
    return response(error instanceof ApiError?error.status:503,{error:error instanceof ApiError?error.message:'No se pudo completar la solicitud. Revisa la configuración del servidor.'});
  }
}
