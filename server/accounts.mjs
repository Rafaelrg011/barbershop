import {createHash} from 'node:crypto';
export class ApiError extends Error { constructor(status,message){super(message);this.status=status} }
const reject=(message,status=400)=>{throw new ApiError(status,message)};
export function validateCommand(data) {
  if(!data||typeof data!=='object'||Array.isArray(data))reject('Solicitud no válida.');
  const allowed=['action','requestId','uid','version','name','email','password','role','barberId','active'];
  if(Object.keys(data).some(k=>!allowed.includes(k)))reject('La solicitud contiene campos no permitidos.');
  if(!['create','update'].includes(data.action))reject('Acción no válida.');
  if(typeof data.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(data.requestId))reject('Identificador de operación no válido.');
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>80)reject('Indica un nombre de hasta 80 caracteres.');
  if(typeof data.email!=='string'||data.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(data.email))reject('El usuario debe ser un correo electrónico válido.');
  if(!['reception','barber'].includes(data.role))reject('Solo se pueden gestionar recepción y barberos.',403);
  if(typeof data.active!=='boolean')reject('Indica si la cuenta está activa.');
  if(data.password!==undefined&&typeof data.password!=='string')reject('Contraseña no válida.');
  if(data.action==='create'||data.password){
    if(typeof data.password!=='string'||data.password.length<12||data.password.length>128||!data.password.trim())reject('La contraseña debe tener entre 12 y 128 caracteres.');
  }
  if(data.action==='update'&&(typeof data.uid!=='string'||!/^staff_[a-f0-9]{40}$/.test(data.uid)||!Number.isSafeInteger(data.version)||data.version<1))reject('Cuenta o versión no válida.');
  if(data.role==='barber'&&(!Number.isSafeInteger(data.barberId)||data.barberId<0))reject('Selecciona el profesional vinculado.');
  return {...data,name:data.name.trim(),email:data.email.trim().toLowerCase(),barberId:data.role==='barber'?data.barberId:null};
}
export function requireOwner(member,token,now=Date.now(),recent=false){
  if(!member||member.active!==true||member.role!=='owner'||typeof member.tenantId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(member.tenantId))reject('Solo el propietario habilitado puede gestionar las cuentas.',403);
  if(recent&&(!Number.isFinite(token.auth_time)||now/1000-token.auth_time>300||token.auth_time>now/1000+30))reject('Confirma nuevamente tu contraseña de propietario.',401);
  return member;
}
export function assertTarget(owner,target,uid,actor){
  if(uid===actor||!target||target.tenantId!==owner.tenantId||!['reception','barber'].includes(target.role))reject('No puedes modificar esa cuenta.',403);
}
export function publicAccount(uid,m){
  return {uid,name:m.name||'',email:m.email||'',role:m.role,barberId:m.barberId??null,
    active:m.active===true,version:m.version||1,status:m.status||'ready'};
}
// La contraseña solo se entrega a Firebase Auth, nunca al almacén ni a la auditoría.
export async function manageAccount({store,auth,token,data,now=Date.now()}){
  const owner=requireOwner(await store.getMember(token.uid),token,now,true);
  const c=validateCommand(data);
  const uid=c.action==='create'?'staff_'+createHash('sha256').update(owner.tenantId+':'+token.uid+':'+c.requestId).digest('hex').slice(0,40):c.uid;
  const {password,...safeCommand}=c;safeCommand.passwordChanged=Boolean(password);
  const reservation=await store.reserve({uid,actor:token.uid,tenantId:owner.tenantId,command:safeCommand});
  if(reservation.done)return publicAccount(uid,reservation.member);
  try{
    if(c.action==='create')await auth.createUser({uid,email:c.email,displayName:c.name,password:c.password,disabled:true,emailVerified:false});
    else{
      try{await auth.updateUser(uid,{disabled:true})}catch(error){
        if(error.code!=='auth/user-not-found'||reservation.previous.status!=='error')throw error;
        if(!c.password)throw new ApiError(400,'La creación anterior falló. Indica una contraseña nueva para recuperar la cuenta.');
        await auth.createUser({uid,email:c.email,password:c.password,displayName:c.name,disabled:true,emailVerified:false});
      }
      const patch={email:c.email,displayName:c.name};
      if(c.password)patch.password=c.password;
      if(c.email!==reservation.previous.email)patch.emailVerified=false;
      await auth.updateUser(uid,patch);
    }
    await auth.revokeRefreshTokens(uid);
    if(c.active)await auth.updateUser(uid,{disabled:false});
    const updated=await store.finalize({uid,actor:token.uid,tenantId:owner.tenantId,command:safeCommand});
    return publicAccount(uid,updated);
  }catch(error){
    // Sin rollback de contraseñas: se deja bloqueada la cuenta si la operación es parcial.
    await store.fail({uid,actor:token.uid,tenantId:owner.tenantId,requestId:c.requestId}).catch(()=>{});
    if(c.action==='update'||error.code!=='auth/uid-already-exists')await auth.updateUser(uid,{disabled:true}).catch(()=>{});
    if(error.code==='auth/email-already-exists')reject('Ese correo ya está registrado. Usa otro; no se vinculan cuentas existentes.',409);
    if(error instanceof ApiError)throw error;
    reject('No se completó el cambio. La cuenta queda bloqueada; revisa su estado antes de reintentar.',503);
  }
}
