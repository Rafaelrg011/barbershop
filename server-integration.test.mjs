import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {handler as accounts} from '../netlify/functions/accounts.mjs';
import {handler as state} from '../netlify/functions/state.mjs';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Solo ejecutar con emuladores.');
initializeApp({projectId:'demo-barbe-shop'});
const db=getFirestore(),auth=getAuth();
const owner='owner-api',other='other-api',password='UnaClaveLarga2026!';
for(const [uid,tenant] of [[owner,'api-piloto'],[other,'api-otro']]){
 await auth.createUser({uid,email:uid+'@example.com',password});
 await db.doc('memberships/'+uid).set({tenantId:tenant,role:'owner',active:true});
}
async function login(uid,pass=password){const r=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:uid.includes('@')?uid:uid+'@example.com',password:pass,returnSecureToken:true})});return r.json()}
const token=(await login(owner)).idToken,otherToken=(await login(other)).idToken;
const call=async(fn,body,bearer=token)=>{const r=await fn({httpMethod:body?'POST':'GET',headers:{'content-type':'application/json',authorization:'Bearer '+bearer},body:body?JSON.stringify(body):''});return {status:r.statusCode,...JSON.parse(r.body)}};
const empty={schema:1,barbers:[],services:[],clients:[],appointments:[],movements:[],promos:[],schedules:[],cashSessions:[],currentCashId:null,cashOpen:false,opening:0,closed:false,historyLog:[],serial:10000,availabilityHistory:{},blocks:[],inventory:[],stockLedger:[],commissionRules:[],settlements:[],productRates:{}};
let created;
await test('API crea cuenta real emulada y no escribe contraseña en Firestore',async()=>{
 const response=await call(accounts,{action:'create',requestId:crypto.randomUUID(),name:'Ana',email:'ana@example.com',password,role:'reception',active:true});
 assert.equal(response.status,200,JSON.stringify(response));created=response.account;
 assert.ok((await login('ana@example.com')).idToken);
 const membership=(await db.doc('memberships/'+created.uid).get()).data();assert.equal('password' in membership,false);
 const audit=await db.collection('tenants/api-piloto/accountAudit').get();assert.equal(JSON.stringify(audit.docs.map(d=>d.data())).includes(password),false);
});
await test('otro propietario no puede modificar la cuenta',async()=>{
 const r=await call(accounts,{action:'update',requestId:crypto.randomUUID(),uid:created.uid,version:created.version,name:'Hack',email:'hack@example.com',password,role:'reception',active:true},otherToken);assert.equal(r.status,403);
});
await test('recepción no puede administrar cuentas',async()=>{
 const r=await call(accounts,null,(await login('ana@example.com')).idToken);assert.equal(r.status,403);
});
await test('cambia usuario y contraseña, la anterior deja de servir',async()=>{
 const r=await call(accounts,{action:'update',requestId:crypto.randomUUID(),uid:created.uid,version:created.version,name:'Ana',email:'ana.nueva@example.com',password:'OtraClaveLarga2026!',role:'reception',active:true});assert.equal(r.status,200,JSON.stringify(r));created=r.account;
 assert.ok((await login('ana.nueva@example.com','OtraClaveLarga2026!')).idToken);
 assert.equal((await login('ana@example.com')).idToken,undefined);
 assert.equal((await login('ana.nueva@example.com',password)).idToken,undefined);
});
await test('desactivar bloquea el inicio de sesión',async()=>{
 const r=await call(accounts,{action:'update',requestId:crypto.randomUUID(),uid:created.uid,version:created.version,name:'Ana',email:'ana.nueva@example.com',password:'',role:'reception',active:false});assert.equal(r.status,200,JSON.stringify(r));
 assert.equal((await login('ana.nueva@example.com','OtraClaveLarga2026!')).idToken,undefined);
});
await test('estado: inicializa, rechaza revisión antigua y evita repetir operación',async()=>{
 const first=await call(state,{expected:0,operationId:crypto.randomUUID(),state:empty});assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.revision,1);
 const id=crypto.randomUUID(),second=await call(state,{expected:1,operationId:id,state:{...empty,clients:[{id:1,name:'Cliente',phone:''}]}});assert.equal(second.status,200,JSON.stringify(second));
 const conflict=await call(state,{expected:1,operationId:crypto.randomUUID(),state:empty});assert.equal(conflict.status,409);
 const duplicate=await call(state,{expected:1,operationId:id,state:empty});assert.equal(duplicate.status,200);assert.equal(duplicate.revision,2);
 assert.equal(JSON.parse((await db.doc('tenants/api-piloto/state/current').get()).data().payload).clients.length,1);
});
await test('no admite tokens falsos ni contraseñas dentro del estado',async()=>{
 assert.equal((await call(state,{expected:2,operationId:crypto.randomUUID(),state:empty},'fake')).status,401);
 assert.equal((await call(state,{expected:2,operationId:crypto.randomUUID(),state:{...empty,password}})).status,400);
});

const {handler:deviceHandler}=await import('../netlify/functions/device.mjs');
let deviceToken;
await test('equipo nuevo no puede leer sin habilitación',async()=>{
 const r=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});deviceToken=(await r.json()).idToken;
 const data=await call(state,null,deviceToken);assert.equal(data.status,403);
});
await test('solo propietario habilita la recepción del equipo',async()=>{
 assert.equal((await call(deviceHandler,{deviceToken},deviceToken)).status,403);
 assert.equal((await call(deviceHandler,{deviceToken})).status,200);
 const data=await call(state,null,deviceToken);assert.equal(data.status,200);assert.equal(data.role,'reception');
});
await test('recepción guarda cliente y lo recupera en otra lectura',async()=>{
 const old=await call(state,null,deviceToken),next=structuredClone(old.state);
 next.clients.push({id:98765,name:'Recepción emulada',phone:''});
 const result=await call(state,{state:next,expected:old.revision,operationId:crypto.randomUUID()},deviceToken);assert.equal(result.status,200,JSON.stringify(result));
 const read=await call(state,null,deviceToken);assert.ok(read.state.clients.some(c=>c.id===98765));
});
await test('recepción no cambia comisiones ni crea otra cuenta',async()=>{
 const old=await call(state,null,deviceToken),next=structuredClone(old.state);next.productRates={0:99};
 assert.equal((await call(state,{state:next,expected:old.revision,operationId:crypto.randomUUID()},deviceToken)).status,403);
 assert.equal((await call(accounts,null,deviceToken)).status,403);
});
await test('otro propietario no puede trasladar equipo a su barbería',async()=>{
 assert.equal((await call(deviceHandler,{deviceToken},otherToken)).status,403);
});
