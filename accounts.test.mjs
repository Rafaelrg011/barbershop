import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCommand,requireOwner,assertTarget,manageAccount,publicAccount} from '../server/accounts.mjs';
const now=Date.now(),token={uid:'owner',auth_time:Math.floor(now/1000)};
const owner={tenantId:'piloto',role:'owner',active:true};
const command={action:'create',requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',name:'Recepción',email:'recepcion@example.com',password:'UnaClaveLarga2026!',role:'reception',barberId:null,active:true};
test('solo propietario activo y recientemente autenticado',()=>{
 for(const m of [null,{...owner,active:false},{...owner,role:'reception'},{...owner,role:'barber'}])assert.throws(()=>requireOwner(m,token,now,true));
 assert.throws(()=>requireOwner(owner,{...token,auth_time:token.auth_time-600},now,true),/Confirma/);
 assert.equal(requireOwner(owner,token,now,true).role,'owner');
});
test('no se puede editar otra barbería, propietario ni cuenta propia',()=>{
 assert.throws(()=>assertTarget(owner,{...owner,role:'barber',tenantId:'otro'},'staff','owner'));
 assert.throws(()=>assertTarget(owner,owner,'other-owner','owner'));
 assert.throws(()=>assertTarget(owner,{...owner,role:'barber'},'owner','owner'));
});
test('rechaza ascenso a propietario, campos extra y contraseña corta',()=>{
 for(const patch of [{role:'owner'},{tenantId:'otro'},{password:'123'},{barberId:0,role:'admin'},{name:''},{email:'bad'}])assert.throws(()=>validateCommand({...command,...patch}));
});
test('barbero exige vinculación explícita',()=>{
 assert.throws(()=>validateCommand({...command,role:'barber'}));assert.equal(validateCommand({...command,role:'barber',barberId:2}).barberId,2);
});
test('una cuenta editada puede conservar contraseña',()=>{
 const c=validateCommand({...command,action:'update',uid:'staff_'+'a'.repeat(40),version:1,password:''});assert.equal(c.password,'');
});
function fixture(){
 const calls=[];let failed=false;
 const store={getMember:async()=>owner,reserve:async()=>({previous:{email:'old@example.com',status:'ready'}}),finalize:async()=>{calls.push('finalize');return {...owner,...command,role:'reception',version:2}},fail:async()=>{failed=true}};
 const auth={createUser:async o=>calls.push(['create',o]),updateUser:async(uid,o)=>calls.push(['update',o]),revokeRefreshTokens:async()=>calls.push('revoke')};
 return {store,auth,calls,failed:()=>failed};
}
test('crea deshabilitada, revoca sesiones y habilita antes de finalizar',async()=>{
 const f=fixture();const res=await manageAccount({...f,token,data:command,now});
 assert.equal(f.calls[0][1].disabled,true);assert.equal(f.calls[1],'revoke');assert.deepEqual(f.calls[2],['update',{disabled:false}]);assert.equal(f.calls[3],'finalize');
 assert.equal(res.email,command.email);assert.equal('password' in res,false);
});
test('no pasa contraseñas al historial ni respuesta pública',()=>{
 const p=publicAccount('uid',{...command,passwordHash:'hash'});assert.equal('password' in p,false);assert.equal('passwordHash' in p,false);assert.equal('requestId' in p,false);
});
test('un fallo después de cambiar credenciales bloquea la cuenta',async()=>{
 const f=fixture();f.store.finalize=async()=>{throw Error('db unavailable')};
 await assert.rejects(manageAccount({...f,token,data:command,now}),/bloqueada/);assert.equal(f.failed(),true);assert.deepEqual(f.calls.at(-1),['update',{disabled:true}]);
});
test('correo ya registrado no toma control de una cuenta ajena',async()=>{
 const f=fixture();f.auth.createUser=async()=>{const e=Error();e.code='auth/email-already-exists';throw e};
 await assert.rejects(manageAccount({...f,token,data:command,now}),/ya está registrado/);assert.equal(f.failed(),true);
});
test('repetición terminada no vuelve a modificar Firebase Auth',async()=>{
 const f=fixture();f.store.reserve=async()=>({done:true,member:{...command,version:2}});
 await manageAccount({...f,token,data:command,now});assert.equal(f.calls.length,0);
});
test('rechazo de reserva no ejecuta cambios de Auth',async()=>{
 const f=fixture();f.store.reserve=async()=>{throw Error('otro local')};
 await assert.rejects(manageAccount({...f,token,data:command,now}));assert.equal(f.calls.length,0);
});
