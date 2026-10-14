const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateState,validateTransition}=require('../public/state-validation.js');
function state(){return {schema:1,barbers:['Mateo'],services:[{name:'Corte',price:65,duration:30,prep:0,active:true}],clients:[{id:1,name:'Cliente',phone:''}],appointments:[],movements:[],promos:[],schedules:[{start:'09:00',end:'18:00',breakStart:'13:00',breakEnd:'14:00',days:[0,1,2,3,4,5,6],active:true}],cashSessions:[{id:100,date:'2026-10-13',opening:100,closed:false}],currentCashId:100,cashOpen:true,opening:100,closed:false,historyLog:[],serial:10000,availabilityHistory:{},blocks:[],inventory:[{id:30,name:'Cera',price:45,min:2}],stockLedger:[{id:31,product:30,delta:10}],commissionRules:[{rate:40}],settlements:[],productRates:{0:10}}}
const booking={id:50,client:1,barber:0,service:0,serviceName:'Corte',date:'2026-10-13',time:'10:00',duration:30,prep:0,price:65,paid:0,status:'Confirmada'};
test('estado válido pasa y campos de credenciales se rechazan',()=>{
 validateState(state());assert.throws(()=>validateState({...state(),password:'secret'}),/Campo/);
 assert.throws(()=>validateState({...state(),productRates:JSON.parse('{"__proto__":{}}')}),/Campo/);
});
test('anticipo 30 más saldo 35 suma 65 sin duplicación',()=>{
 const s=state();s.appointments=[{...booking,paid:65}];s.movements=[{id:60,session:100,appointment:50,amount:30,type:'QR (registro manual)',date:'2026-10-13'},{id:61,session:100,appointment:50,amount:35,type:'Efectivo',date:'2026-10-13'}];validateState(s);
 s.appointments[0].paid=95;assert.throws(()=>validateState(s),/abono/);
});
test('pagos y citas deben cuadrar',()=>{const s=state();s.appointments=[{...booking,paid:30}];assert.throws(()=>validateState(s),/pagos/)});
test('rechaza solapamientos y fechas imposibles',()=>{
 const s=state();s.appointments=[booking,{...booking,id:51,time:'10:15'}];assert.throws(()=>validateState(s),/solapadas/);
 s.appointments=[{...booking,date:'2026-02-31'}];assert.throws(()=>validateState(s),/Cita/);
});
test('rechaza intervalos fuera del horario y durante descanso',()=>{
 const s=state(),next=structuredClone(s);next.appointments=[{...booking,time:'13:00'}];assert.throws(()=>validateTransition(s,next),/disponibilidad/);
});
test('precio normal se verifica en servidor',()=>{
 const s=state(),next=structuredClone(s);next.appointments=[{...booking,price:1}];assert.throws(()=>validateTransition(s,next),/catálogo/);
});
test('historial financiero es inmutable',()=>{
 const s=state();s.movements=[{id:60,session:100,amount:30,type:'Efectivo',date:'2026-10-13'}];
 const next=structuredClone(s);next.movements=[];assert.throws(()=>validateTransition(s,next),/historial/);
});
test('faltante o sobrante coincide con fondo y movimientos',()=>{
 const s=state();s.cashOpen=false;s.cashSessions[0]={...s.cashSessions[0],closed:true,expected:100,counted:90,diff:-10,reason:'Faltante'};validateState(s);
 s.cashSessions[0].diff=0;assert.throws(()=>validateState(s),/cierre/);
});
test('inventario negativo y ventas sin comisión válida se rechazan',()=>{
 const s=state();s.stockLedger[0].delta=-1;assert.throws(()=>validateState(s),/negativo/);
 const a=state();a.movements=[{id:60,session:100,amount:45,type:'QR (registro manual)',date:'2026-10-13',kind:'sale',quantity:1,product:30,unitPrice:45,barber:0,commissionRate:10,commissionAmount:99}];assert.throws(()=>validateState(a),/venta/);
});
test('stock, cobro y comisión del producto van juntos',()=>{
 const s=state(),n=structuredClone(s);n.movements=[{id:60,session:100,amount:45,type:'QR (registro manual)',date:'2026-10-13',kind:'sale',quantity:1,product:30,unitPrice:45,barber:0,commissionRate:10,commissionAmount:4.5}];
 assert.throws(()=>validateTransition(s,n),/inventario/);n.stockLedger.push({id:61,product:30,delta:-1,saleId:60});validateTransition(s,n);
});
