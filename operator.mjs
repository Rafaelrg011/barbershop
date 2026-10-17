import {ApiError,requireOwner} from './accounts.mjs';
export function requireOperator(member,token){
  if(member?.role==='owner')return requireOwner(member,token);
  if(!member||member.active!==true||member.role!=='reception'||!member.deviceAccess||token.firebase?.sign_in_provider!=='anonymous'||! /^[a-zA-Z0-9_-]{1,80}$/.test(member.tenantId||''))throw new ApiError(403,'Este navegador aún no está habilitado para recepción. Entra al perfil Propietario para habilitarlo.');
  return member;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validateReception(previous,next){
  if(!previous)throw new ApiError(403,'El propietario debe preparar la barbería primero.');
  const mutable=['clients','appointments','movements','cashSessions','currentCashId','cashOpen','opening','closed','historyLog','serial','availabilityHistory','stockLedger'];
  for(const k of new Set([...Object.keys(previous),...Object.keys(next)]))if(!mutable.includes(k)&&!same(previous[k],next[k]))throw new ApiError(403,'Solo el propietario puede cambiar catálogos, equipo, comisiones y configuración.');
  for(const row of next.stockLedger.filter(x=>!previous.stockLedger.some(y=>y.id===x.id))){
    const sale=next.movements.find(m=>m.id===row.saleId&&!previous.movements.some(old=>old.id===m.id));
    if(!sale||sale.kind!=='sale'||sale.product!==row.product||row.delta!==-sale.quantity)throw new ApiError(403,'Recepción solo puede descontar inventario mediante una venta.');
  }
  for(const a of next.appointments){
    const old=previous.appointments.find(x=>x.id===a.id);
    if(old&&['price','basePrice','duration','prep','service','serviceName','promoSnapshot'].some(k=>!same(old[k],a[k])))throw new ApiError(403,'Recepción no puede modificar el precio ni el servicio de una cita existente.');
  }
}
