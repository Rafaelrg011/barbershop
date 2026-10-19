/* Validación compartida: navegador y servidor. Importes expresados en Bs. */
(function(root){
 'use strict';
 const fail=message=>{throw Error(message)};
 const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 const cash=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=200000000&&Math.abs(n*100-Math.round(n*100))<0.00001;
 const cents=n=>Math.round(n*100);
 const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const time=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
 const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const statuses=['Pendiente','Confirmada','Cliente presente','En servicio','Completada','Cancelada','No asistió'];
 const methods=['Efectivo','QR (registro manual)','Transferencia (registro manual)'];
 const arrays=['barbers','services','clients','appointments','movements','promos','schedules','cashSessions','historyLog','blocks','inventory','stockLedger','commissionRules','settlements'];
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function safeTree(v,depth=0){
   if(depth>25)fail('Los datos tienen demasiados niveles.');
   if(typeof v==='number'&&!Number.isFinite(v))fail('Hay un valor numérico no válido.');
   if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){
     if(['__proto__','prototype','constructor'].includes(k)||/password|private.?key|access.?token|refresh.?token/i.test(k))fail('Campo no permitido en los registros.');
     safeTree(x,depth+1);
   }
 }
 function unique(list,name){const ids=new Set();for(const x of list){if(!x||!integer(x.id,1)||ids.has(x.id))fail('Identificador duplicado o inválido en '+name);ids.add(x.id)}}
 function validMoney(value,label,nonnegative=true){if(!cash(value)||(nonnegative&&value<0))fail('Importe no válido: '+label)}
 function validateState(s){
   if(!s||s.schema!==1)fail('Versión de datos no compatible.');safeTree(s);
   for(const key of arrays)if(!Array.isArray(s[key]))fail('Falta la colección '+key);
   if(!integer(s.serial,1)||typeof s.cashOpen!=='boolean'||typeof s.closed!=='boolean'||!s.productRates||!s.availabilityHistory)fail('Estado incompleto.');
   for(const key of ['clients','appointments','movements','promos','cashSessions','blocks','inventory','stockLedger','settlements'])unique(s[key],key);
   if(s.barbers.some(x=>typeof x!=='string'||!x.trim()||x.length>80)||s.schedules.length!==s.barbers.length)fail('Revisa el equipo.');
   s.schedules.forEach(x=>{if(!x||!['start','end','breakStart','breakEnd'].every(k=>time(x[k]))||x.start>=x.end||x.breakStart<x.start||x.breakEnd>x.end||x.breakStart>=x.breakEnd||!Array.isArray(x.days)||x.days.some(d=>!integer(d)||d>6)||typeof x.active!=='boolean')fail('Horario no válido.')});
   s.services.forEach(x=>{validMoney(x.price,'servicio');if(typeof x.name!=='string'||!x.name.trim()||!integer(x.duration,5)||x.duration>480||!integer(x.prep)||x.prep>60)fail('Servicio no válido.')});
   s.clients.forEach(x=>{if(typeof x.name!=='string'||!x.name.trim()||x.name.length>80||typeof x.phone!=='string')fail('Cliente no válido.')});
   const sessions=new Map(s.cashSessions.map(x=>[x.id,x])),clients=new Set(s.clients.map(x=>x.id));
   s.appointments.forEach(a=>{
     if(!clients.has(a.client)||!integer(a.barber)||!s.barbers[a.barber]||!integer(a.service)||!s.services[a.service]||!date(a.date)||!time(a.time)||!statuses.includes(a.status)||!integer(a.duration,5)||a.duration>480||!integer(a.prep)||a.prep>60)fail('Cita no válida.');
     validMoney(a.price,'precio de cita');validMoney(a.paid,'abonos');if(a.paid>a.price)fail('El abono supera el precio.');
     const net=s.movements.filter(m=>m.appointment===a.id).reduce((n,m)=>n+cents(m.amount),0);
     if(net!==cents(a.paid))fail('Los pagos no coinciden con el saldo de la cita.');
   });
   const bookings=s.appointments.filter(a=>!['Cancelada','No asistió'].includes(a.status)).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.barber-b.barber||a.time.localeCompare(b.time));
   for(let i=1;i<bookings.length;i++){const a=bookings[i-1],b=bookings[i];if(a.date===b.date&&a.barber===b.barber&&minutes(a.time)+a.duration+a.prep>minutes(b.time))fail('Existen citas solapadas.');}
   s.movements.forEach(m=>{validMoney(m.amount,'movimiento',false);if(!m.amount||!methods.includes(m.type)||!sessions.has(m.session)||!date(m.date))fail('Movimiento de caja no válido.');if(m.appointment&&!s.appointments.some(a=>a.id===m.appointment))fail('Pago sin cita.');if(m.kind==='sale'){if(!integer(m.quantity,1)||!s.inventory.some(p=>p.id===m.product)||!integer(m.barber)||!s.barbers[m.barber])fail('Venta no válida.');validMoney(m.unitPrice,'producto');validMoney(m.commissionAmount,'comisión');if(!cash(m.commissionRate)||m.commissionRate<0||m.commissionRate>100||cents(m.amount)!==cents(m.unitPrice*m.quantity)||cents(m.commissionAmount)!==Math.round(m.amount*m.commissionRate))fail('Cálculo de venta no válido.');}});
   s.cashSessions.forEach(c=>{validMoney(c.opening,'apertura');if(!date(c.date))fail('Fecha de caja no válida.');if(c.closed){const expected=cents(c.opening)+s.movements.filter(m=>m.session===c.id&&m.type==='Efectivo').reduce((n,m)=>n+cents(m.amount),0);validMoney(c.counted,'conteo');if(cents(c.expected)!==expected||cents(c.diff)!==cents(c.counted)-expected)fail('El cierre no coincide con sus movimientos.');if(c.diff&&!String(c.reason||'').trim())fail('Falta explicar la diferencia de caja.');}});
   s.cashSessions.forEach(c=>{
     for(const [key,total] of [['openingCounts',c.opening],['closingCounts',c.counted]])if(c[key]){
       c[key].forEach(x=>validMoney(x.amount,'desglose de efectivo'));
       if(c[key].reduce((n,x)=>n+cents(x.amount),0)!==cents(total))fail('El desglose no coincide con el efectivo.');
     }
     if(c.closed){const qr=s.movements.filter(m=>m.session===c.id&&m.type==='QR (registro manual)').reduce((n,m)=>n+cents(m.amount),0);
       const digital=s.movements.filter(m=>m.session===c.id&&m.type!=='Efectivo').reduce((n,m)=>n+cents(m.amount),0);
       if(c.qrNet!==undefined&&cents(c.qrNet)!==qr)fail('El total QR no coincide con los cobros.');
       if(c.closingTotal!==undefined&&cents(c.closingTotal)!==cents(c.counted)+digital)fail('El total de cierre no coincide.');
     }
   });
   const open=s.cashSessions.filter(c=>!c.closed);if(open.length>1||s.cashOpen!==(open.length===1)||s.cashOpen&&s.currentCashId!==open[0].id)fail('Estado de caja inconsistente.');
   s.inventory.forEach(p=>{validMoney(p.price,'precio de producto');if(!integer(p.min)||typeof p.name!=='string'||!p.name.trim())fail('Producto no válido.');if(s.stockLedger.filter(m=>m.product===p.id).reduce((n,m)=>n+m.delta,0)<0)fail('El inventario no puede ser negativo.');});
   s.stockLedger.forEach(m=>{if(!Number.isSafeInteger(m.delta)||!s.inventory.some(p=>p.id===m.product))fail('Movimiento de inventario no válido.');});
   for(const r of [...s.commissionRules.filter(Boolean).map(x=>x.rate),...Object.values(s.productRates)])if(!cash(r)||r<0||r>100)fail('Comisión fuera de rango.');
   return s;
 }
 function validateTransition(previous,next){
   validateState(next);if(!previous)return;
   // Correcciones financieras se añaden como movimientos; no se borra el historial.
   for(const key of ['movements','stockLedger','settlements'])for(const row of previous[key])if(!eq(row,next[key].find(x=>x.id===row.id)))fail('No se puede borrar ni modificar el historial de '+key+'.');
   for(const c of previous.cashSessions){const n=next.cashSessions.find(x=>x.id===c.id);if(!n||['date','opening','openingCounts','openedAt','openedBy'].some(k=>!eq(c[k],n[k])))fail('No se puede modificar la apertura de una caja existente.');}
   for(const c of previous.cashSessions.filter(c=>c.closed))if(!eq(c,next.cashSessions.find(x=>x.id===c.id)))fail('No se puede modificar una caja cerrada.');
   for(const m of next.movements.filter(m=>!previous.movements.some(x=>x.id===m.id))){
     if(previous.cashSessions.some(c=>c.id===m.session&&c.closed))fail('No se puede añadir un cobro a una caja cerrada.');
     if(m.kind==='sale'){
       const product=previous.inventory.find(p=>p.id===m.product),rate=previous.productRates[m.barber];
       if(!product||rate===undefined||m.unitPrice!==product.price||m.commissionRate!==rate)fail('La venta debe conservar el precio y comisión vigentes.');
       if(!next.stockLedger.some(x=>x.saleId===m.id&&x.product===m.product&&x.delta===-m.quantity))fail('La venta no descuenta el inventario.');
     }
   }
   for(const a of next.appointments){const old=previous.appointments.find(x=>x.id===a.id);
     if(old&&['Completada','Cancelada','No asistió'].includes(old.status)&&!eq({...old,paid:0},{...a,paid:0}))fail('No se puede reescribir una cita cerrada.');
     if(!old||old.date!==a.date||old.time!==a.time||old.barber!==a.barber||old.service!==a.service){
       const sch=next.schedules[a.barber],begin=minutes(a.time),end=begin+a.duration+a.prep,day=new Date(a.date+'T12:00:00Z').getUTCDay();
       if(!sch.active||!sch.days.includes(day)||begin<minutes(sch.start)||end>minutes(sch.end)||begin<minutes(sch.breakEnd)&&end>minutes(sch.breakStart)||next.blocks.some(b=>b.barber===a.barber&&b.date===a.date&&begin<b.end&&end>b.start))fail('La cita queda fuera de la disponibilidad.');
       if(!old){const service=previous.services[a.service];if(!service?.active||a.price!==service.price||a.duration!==service.duration||a.prep!==service.prep)fail('La nueva cita debe usar el precio y duración del catálogo.');}
     }
   }
 }
 const api={validateState,validateTransition};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StateValidation=api;
})(typeof window==='undefined'?globalThis:window);
