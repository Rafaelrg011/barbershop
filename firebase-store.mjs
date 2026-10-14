import {ApiError,requireOwner,assertTarget} from './accounts.mjs';
export function accountStore(db,FieldValue){
  const member=uid=>db.doc('memberships/'+uid);
  const audit=(tenant,id)=>db.doc('tenants/'+tenant+'/accountAudit/'+id);
  return {
    async getMember(uid){return (await member(uid).get()).data()},
    async reserve({uid,actor,tenantId,command:c}){
      return db.runTransaction(async tx=>{
        const [ownerSnap,targetSnap,stateSnap]=await Promise.all([tx.get(member(actor)),tx.get(member(uid)),tx.get(db.doc('tenants/'+tenantId+'/state/current'))]);
        const owner=requireOwner(ownerSnap.data(),{});if(owner.tenantId!==tenantId)throw new ApiError(403,'Acceso revocado.');
        const previous=targetSnap.data();
        if(previous){
          assertTarget(owner,previous,uid,actor);
          if(previous.lastRequestId===c.requestId&&previous.status==='ready')return {done:true,member:previous};
          if(previous.status==='updating')throw new ApiError(409,'Esta cuenta tiene un cambio en curso. Espera y actualiza la lista.');
          if(c.action==='create')throw new ApiError(409,'La cuenta ya fue procesada. Actualiza la lista y usa Editar.');
          if(previous.version!==c.version)throw new ApiError(409,'Otro cambio modificó esta cuenta. Actualiza la lista.');
        }else if(c.action!=='create')throw new ApiError(404,'No se encontró la cuenta.');
        if(c.role==='barber'){
          let state;try{state=JSON.parse(stateSnap.data()?.payload||'{}')}catch{throw new ApiError(409,'Revisa el catálogo de profesionales.');}
          if(!state.schedules?.[c.barberId]?.active||!state.barbers?.[c.barberId])throw new ApiError(400,'Selecciona un profesional activo de esta barbería.');
        }
        // Límite por propietario: 20 cambios/minuto, contador transaccional.
        const rateRef=db.doc('accountRateLimits/'+actor),rateSnap=await tx.get(rateRef),rate=rateSnap.data()||{},now=Date.now();
        const recent=Number.isFinite(rate.since)&&now-rate.since<60000;
        if(recent&&rate.count>=20)throw new ApiError(429,'Demasiados cambios. Espera un minuto.');
        tx.set(rateRef,{since:recent?rate.since:now,count:recent?rate.count+1:1});
        tx.set(member(uid),{...(previous||{}),tenantId,role:c.role,name:c.name,email:c.email,barberId:c.barberId,
          active:false,status:'updating',version:previous?.version||1,lastRequestId:c.requestId,updatedBy:actor,updatedAt:FieldValue.serverTimestamp()});
        tx.create(audit(tenantId,c.requestId),{actor,target:uid,action:c.action,passwordChanged:c.passwordChanged,status:'started',at:FieldValue.serverTimestamp()});
        return {previous};
      });
    },
    async finalize({uid,actor,tenantId,command:c}){
      return db.runTransaction(async tx=>{
        const [a,b]=await Promise.all([tx.get(member(actor)),tx.get(member(uid))]);
        const owner=requireOwner(a.data(),{}),m=b.data();assertTarget(owner,m,uid,actor);
        if(m.lastRequestId!==c.requestId||m.status!=='updating')throw new ApiError(409,'La cuenta cambió durante la operación.');
        const patch={active:c.active,status:'ready',version:m.version+1,updatedAt:FieldValue.serverTimestamp()};
        tx.update(member(uid),patch);
        tx.update(audit(tenantId,c.requestId),{status:'completed',completedAt:FieldValue.serverTimestamp()});
        return {...m,...patch};
      });
    },
    async fail({uid,actor,tenantId,requestId}){
      await db.runTransaction(async tx=>{
        const m=(await tx.get(member(uid))).data();if(m?.lastRequestId!==requestId)return;
        tx.update(member(uid),{active:false,status:'error',version:(m.version||1)+1,updatedAt:FieldValue.serverTimestamp()});
        tx.set(audit(tenantId,requestId),{actor,target:uid,status:'failed',completedAt:FieldValue.serverTimestamp()},{merge:true});
      });
    }
  };
}
