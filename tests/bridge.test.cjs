const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function environment(){
 const els={};const el=s=>els[s]??={innerHTML:'',textContent:'',style:{},disabled:false,addEventListener(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}};
 const ctx={document:{querySelector:el,createElement:()=>({click(){}})},navigator:{onLine:true},window:{addEventListener(){}},Intl,Date,console,setTimeout:()=>1,clearTimeout(){},structuredClone,FormData:class{},URL,Blob,location:{reload(){}}};
 vm.createContext(ctx);for(const f of ['app.js','state-bridge.js'])vm.runInContext(fs.readFileSync(__dirname+'/../public/'+f,'utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);ctx.window.cloud={ready:true,uid:'uid-owner',commit:async()=>{}};
 return {ctx,run,el};
}
test('arranca sin clientes ni cobros ficticios y renderiza secciones vacías',()=>{
 const {run}=environment();assert.equal(run('clients.length+appointments.length+movements.length+barbers.length'),0);
 for(const section of ['Agenda','Clientes','Servicios','Caja','Estadísticas','Afluencia','Promociones','Inventario','Comisiones','Equipo','Configuración'])run(`navigate('${section}')`);
});
test('guardar espera confirmación y persiste al cliente',async()=>{
 const {ctx,run,el}=environment();let resolve;
 ctx.window.cloud.commit=()=>new Promise(r=>resolve=r);
 const pending=run("window.appState.operation(()=>{clients.push({id:1,name:'Ana',phone:''});finish('Cliente guardado')})");
 assert.notEqual(el('#toast').textContent,'Cliente guardado');resolve();await pending;
 assert.equal(el('#toast').textContent,'Cliente guardado');assert.equal(run('clients.length'),1);
});
test('error remoto revierte un cobro y no informa éxito',async()=>{
 const {ctx,run,el}=environment();ctx.window.cloud.commit=async()=>{const e=Error('Sin permiso');e.cloudFailure=true;throw e};
 await assert.rejects(run("window.appState.operation(()=>{movements.push({amount:30});finish('Cobrado')})"),/Sin permiso/);
 assert.equal(run('movements.length'),0);assert.notEqual(el('#toast').textContent,'Cobrado');
});
test('sin conexión no ejecuta la mutación',async()=>{
 const {ctx,run}=environment();ctx.navigator.onLine=false;
 await assert.rejects(run('window.appState.operation(()=>clients.push({id:1}))'),/conexión/);assert.equal(run('clients.length'),0);
});
test('la validación fallida no rompe referencias de un formulario abierto',async()=>{
 const {run}=environment();run("clients.push({id:1,name:'Original'});var savedClient=clients[0]");
 await assert.rejects(run("window.appState.operation(()=>{throw Error('Revisa el importe')})"),/Revisa/);
 assert.equal(run('clients[0]===savedClient'),true);
});
