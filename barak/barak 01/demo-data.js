function barakDemoState(){
 const s=window.appState.empty();
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const shift=n=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 s.barbers=['Marco Vargas','Diego Rojas','Luis Mendoza'];
 s.schedules=s.barbers.map(()=>({start:'09:00',end:'19:00',breakStart:'13:00',breakEnd:'14:00',days:[0,1,2,3,4,5,6],active:true}));
 s.services=[{name:'Corte clásico',price:40,duration:30},{name:'Corte + barba',price:65,duration:60},{name:'Perfilado de barba',price:30,duration:30},{name:'Corte premium',price:80,duration:60}].map(x=>({...x,prep:0,active:true}));
 const names=['Carlos Méndez','Andrés Salazar','Gabriel Flores','Sebastián Ríos','Daniel Castro','Joaquín Pérez','Mateo Aguilar','Santiago López','Nicolás Torres','Samuel Cruz','Adrián Molina','Bruno Rivas'];
 s.clients=names.map((name,i)=>({id:i+1,name,phone:'',notes:''+['Degradado bajo, conservar volumen arriba.','Corte clásico con tijera.','Barba corta y contornos definidos.'][i%3],consent:false}));
 s.cashSessions=[{id:500,date,opening:100,openedAt:date+'T09:00:00-04:00',openedBy:'Propietario',closed:false}];s.cashOpen=true;s.opening=100;s.currentCashId=500;
 let id=1000;
 function booking(client,barber,service,day,time,status,paid=0,method='Efectivo',session=500){const v=s.services[service];const a={id:++id,client,barber,service,serviceName:v.name,date:day,time,status,price:v.price,duration:v.duration,prep:0,paid};s.appointments.push(a);if(paid)s.movements.push({id:++id,date:day,session,appointment:a.id,amount:paid,type:method,note:'Cobro · '+v.name});return a;}
 for(let n=1;n<=9;n++){
  const d=shift(-n),session=500+n;let amount=0;
  s.cashSessions.push({id:session,date:d,opening:0,openedAt:d+'T09:00:00-04:00',openedBy:'Recepción',closed:true,closedAt:d+'T19:00:00-04:00',closedBy:'Propietario',expected:0,counted:0,diff:0,reason:''});
  booking(1,0,0,d,'10:00','Completada',40,'Efectivo',session);amount+=40;
  if(n<=8){booking(2,1,1,d,'11:00','Completada',65,'Efectivo',session);amount+=65;}
  if(n<=4){booking(3,2,2,d,'15:00','Completada',30,'Efectivo',session);amount+=30;}
  Object.assign(s.cashSessions.at(-1),{expected:amount,counted:amount});
 }
 const a=booking(4,0,1,date,'09:00','Completada',65);
 s.movements.push({id:++id,date,session:500,appointment:a.id,amount:20,type:'Efectivo',kind:'tip',client:4,clientName:s.clients[3].name,barber:0,barberName:s.barbers[0],note:'Propina'});
 booking(5,1,0,date,'09:00','Completada',40,'QR (registro manual)');
 booking(6,2,1,date,'10:00','En servicio');booking(7,0,0,date,'11:00','Cliente presente');
 booking(2,1,1,date,'14:00','Confirmada',30,'QR (registro manual)');
 booking(8,2,3,date,'15:00','Pendiente');booking(9,0,0,date,'16:00','Confirmada');
 booking(10,1,0,shift(1),'10:00','Confirmada');booking(11,2,1,shift(1),'11:00','Pendiente');
 s.monthlySalaries={0:2500,1:2400,2:2300};s.salaryDeductions=[{id:++id,barber:0,month:date.slice(0,7),date,amount:150,reason:'Adelanto de salario'}];
 s.serial=10000;return s;
}
