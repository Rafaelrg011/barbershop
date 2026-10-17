// Ejecutar únicamente con Firestore Emulator; nunca apunta a la base real.
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,serverTimestamp} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const env=await initializeTestEnvironment({projectId:'demo-barbe-shop',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const path='tenants/piloto/state/current';
const record=(revision=1)=>({schema:1,payload:'{"schema":1}',revision,updatedBy:'owner',updatedAt:serverTimestamp(),operationId:crypto.randomUUID()});
try{
 await env.withSecurityRulesDisabled(async c=>{
   for(const [uid,role,tenantId] of [['owner','owner','piloto'],['other','owner','otro'],['staff','reception','piloto']])
     await setDoc(doc(c.firestore(),'memberships',uid),{role,tenantId,active:true});
 });
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),record()));
 await test('propietario puede leer el estado de su barbería',()=>assertSucceeds(getDoc(doc(env.authenticatedContext('owner',{firebase:{sign_in_provider:'password'}}).firestore(),path))));
 await test('anónimo, otro local y recepción no pueden leer',async()=>{
   for(const c of [env.authenticatedContext('owner',{firebase:{sign_in_provider:'anonymous'}}),env.unauthenticatedContext(),env.authenticatedContext('other'),env.authenticatedContext('staff')])await assertFails(getDoc(doc(c.firestore(),path)));
 });
 await test('no puede autoasignarse permisos',()=>assertFails(setDoc(doc(env.authenticatedContext('staff').firestore(),'memberships','staff'),{role:'owner',tenantId:'piloto',active:true})));
 await test('no puede escribir en otra barbería',()=>assertFails(setDoc(doc(env.authenticatedContext('other').firestore(),path),{...record(2),updatedBy:'other'})));
 await test('escritura directa rechazada incluso con UID y revisión válidos',async()=>{
   const ref=doc(env.authenticatedContext('owner',{firebase:{sign_in_provider:'password'}}).firestore(),path);
   await assertFails(setDoc(ref,record(1)));
   await assertFails(setDoc(ref,{...record(2),updatedBy:'staff'}));
   await assertFails(setDoc(ref,record(2))); // Ni el propietario escribe fuera del servidor.
 });
}finally{await env.cleanup()}
