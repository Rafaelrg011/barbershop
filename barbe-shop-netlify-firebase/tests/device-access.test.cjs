const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function setup(){
 const elements=new Map(),requests=[];let profile;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:'',textContent:'',close(){},querySelectorAll(){return []}});return elements.get(id)};
 const ctx={document:{getElementById:el,querySelector:el},window:{appState:{empty:()=>({}),apply(){},render(){},setProfile:p=>profile=p,isActive:()=>false},addEventListener(){}},navigator:{onLine:true},location:{reload(){}},setTimeout,clearTimeout,setInterval(){},AbortController,crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({role:'owner',state:{schema:1},revision:1})}}};
 vm.createContext(ctx);const code=fs.readFileSync(__dirname+'/../public/firebase-client.js','utf8').replace(/start\(\)\.catch\([^\n]+\);/,'');vm.runInContext(code,ctx);await vm.runInContext('start()',ctx);return {ctx,el,requests,get profile(){return profile}};
}
test('carga sin credenciales ni registro de dispositivo',async()=>{const e=await setup();assert.equal(e.profile,'Recepción');assert.equal(e.ctx.window.cloud.ready,true);assert.equal(e.requests[0].url,'/.netlify/functions/public-state');assert.equal(e.requests[0].options.headers.Authorization,undefined)});
test('propietario entra directamente sin formulario',async()=>{const e=await setup();e.el('role').onchange({target:{value:'Propietario'}});assert.equal(e.profile,'Propietario');assert.equal(e.ctx.window.cloud.ready,true)});
test('guarda desde acceso público con revisión',async()=>{const e=await setup();await e.ctx.window.cloud.commit({schema:1});const request=e.requests.at(-1);assert.equal(request.options.method,'POST');assert.equal(JSON.parse(request.options.body).expected,1)});
test('sin conexión no confirma guardado',async()=>{const e=await setup();e.ctx.navigator.onLine=false;await assert.rejects(e.ctx.window.cloud.commit({}),/No se puede guardar/)});
test('HTML no contiene formulario ni campos de acceso',()=>{const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');assert.doesNotMatch(html,/id="(loginForm|username|password|access|recover)"/)});
