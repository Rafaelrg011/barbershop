import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {ApiError,requireOwner} from '../server/accounts.mjs';import {requireOperator,validateReception} from '../server/operator.mjs';import validation from '../public/state-validation.js';
const empty={schema:1,barbers:[],services:[],clients:[],appointments:[],movements:[],promos:[],schedules:[],cashSessions:[],currentCashId:null,cashOpen:false,opening:0,closed:false,historyLog:[],serial:10000,availabilityHistory:{},blocks:[],inventory:[],stockLedger:[],commissionRules:[],settlements:[],productRates:{}};
function setup(){
 const records=new Map([['memberships/owner',{role:'owner',active:true,tenantId:'piloto'}],['memberships/other',{role:'owner',active:true,tenantId:'otro'}],['tenants/piloto/state/current',{payload:JSON.stringify(empty),schema:1,revision:1}]]);
 const snapshot=path=>({exists:records.has(path),data:()=>structuredClone(records.get(path))});
 const db={doc:path=>({path,get:async()=>snapshot(path)}),runTransaction:async fn=>fn({get:async r=>snapshot(r.path),set:(r,v)=>records.set(r.path,structuredClone(v)),create:(r,v)=>{if(records.has(r.path))throw Error('exists');records.set(r.path,structuredClone(v))}})};
 const ctx={ApiError,requireOwner,requireOperator,validateReception,validation,getApps:()=>[{}],getFirestore:()=>db,FieldValue:{serverTimestamp:()=>123},Buffer,process:{env:{}},getAuth:()=>({verifyIdToken:async token=>{if(!['owner','other','device'].includes(token))throw Error('invalid');return {uid:token,auth_time:Date.now()/1000,firebase:{sign_in_provider:token==='device'?'anonymous':'password'}}}})};
 const load=name=>{const c=vm.createContext({...ctx});let source=readFileSync(new URL('../netlify/functions/'+name+'.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export async function handler','async function handler');vm.runInContext(source,c);return c.handler};
 const funcs={state:load('state'),device:load('device')};
 return {records,call:async(name,body,token='owner')=>{const r=await funcs[name]({httpMethod:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):''});return {status:r.statusCode,...JSON.parse(r.body)}}};
}
test('funciones: autorización de equipo y persistencia recepción al releer',async()=>{
 const e=setup();assert.equal((await e.call('state',null,'device')).status,403);
 assert.equal((await e.call('device',{deviceToken:'device'},'device')).status,403);
 assert.equal((await e.call('device',{deviceToken:'device'})).status,200);
 let s=await e.call('state',null,'device');assert.equal(s.role,'reception');
 s.state.clients.push({id:1,name:'Ana',phone:''});
 const write=await e.call('state',{state:s.state,expected:s.revision,operationId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},'device');assert.equal(write.status,200,JSON.stringify(write));
 s=await e.call('state',null,'device');assert.equal(s.state.clients[0].name,'Ana');assert.equal(s.revision,2);
 s.state.services.push({name:'Corte',price:40,duration:30,prep:0,active:true});
 assert.equal((await e.call('state',{state:s.state,expected:2,operationId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'},'device')).status,403);
 assert.equal((await e.call('device',{deviceToken:'device'},'other')).status,403);
});
test('funciones: revocar equipo bloquea lectura y escritura',async()=>{
 const e=setup();await e.call('device',{deviceToken:'device'});
 e.records.get('memberships/device').active=false;
 assert.equal((await e.call('state',null,'device')).status,403);
 assert.equal((await e.call('state',{state:empty,expected:1,operationId:'cccccccc-cccc-cccc-cccc-cccccccccccc'},'device')).status,403);
});
