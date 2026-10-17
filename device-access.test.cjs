const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function setup({authorized=true,anonDisabled=false}={}){
 const elements=new Map(),calls=[];let enabled=authorized;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:id==='access',value:'',textContent:'',innerHTML:'',close(){this.open=false},focus(){},querySelectorAll(){return []}});return elements.get(id)};
 const device={uid:'device',isAnonymous:true,getIdToken:async()=>'device-token'};
 const owner={uid:'owner',getIdToken:async()=>'owner-token'};
 const auths={};const Auth={getAuth:a=>auths[a.name]??=( {currentUser:null,authStateReady:async()=>{}} ),inMemoryPersistence:'memory',browserLocalPersistence:'persistent',setPersistence:async(a,p)=>a.persistence=p,signInAnonymously:async a=>{if(anonDisabled)throw {code:'auth/operation-not-allowed'};a.currentUser=device},signOut:async a=>{a.currentUser=null},signInWithEmailAndPassword:async(a,email,password)=>{calls.push({email,password});a.currentUser=owner},sendPasswordResetEmail:async(a,email)=>calls.push({recovery:email})};
 const fetch=async(url,o)=>{
  calls.push({url,method:o.method});const isOwner=o.headers.Authorization==='Bearer owner-token';
  const response=(ok,data)=>({ok,json:async()=>data});
  if(url.endsWith('device')){enabled=true;return response(isOwner,{ok:isOwner})}
  if(!isOwner&&!enabled)return response(false,{error:'Este navegador aún no está habilitado para recepción.'});
  return response(true,{role:isOwner?'owner':'reception',revision:1,state:{schema:1}});
 };
 let profile,applied;const ctx={document:{hidden:false,getElementById:el,querySelector:el},window:{FIREBASE_CONFIG:{apiKey:'public'},appState:{empty:()=>({}),apply:s=>applied=s,render(){},setProfile:p=>{profile=p;el('role').value=p},isActive:()=>false},addEventListener(){}},navigator:{onLine:true},location:{reload(){}},setInterval(){},setTimeout,clearTimeout,AbortController,crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},App:{initializeApp:(c,name)=>({name})},Auth,fetch,console};
 let code=fs.readFileSync(__dirname+'/../public/firebase-client.js','utf8').replace(/import\('https:\/\/www.gstatic.com\/firebasejs\/[^']+\/firebase-(app|auth).js'\)/g,(_,t)=>'Promise.resolve(globalThis.'+(t==='app'?'App':'Auth')+')');
 code=code.replace(/start\(\)\.catch\([^\n]+\);/,'');
 vm.createContext(ctx);vm.runInContext(code,ctx);await vm.runInContext('start()',ctx);
 return {ctx,el,calls,Auth,auths,run:s=>vm.runInContext(s,ctx),get profile(){return profile},get applied(){return applied}};
}
const submit=async e=>{e.el('username').value='propietario01';e.el('password').value='test-only-password';await e.el('loginForm').onsubmit({preventDefault(){}})};
test('abre Recepción sin formulario, conserva identidad de equipo',async()=>{const e=await setup();assert.equal(e.profile,'Recepción');assert.equal(e.el('access').hidden,true);assert.equal(e.ctx.window.cloud.ready,true);assert.equal(e.auths['reception-device'].persistence,'persistent');assert.equal(e.auths['owner-profile'].persistence,'memory')});
test('equipo desconocido muestra Recepción sin leer ni guardar registros',async()=>{const e=await setup({authorized:false});assert.equal(e.profile,'Recepción');assert.equal(e.ctx.window.cloud.ready,false);assert.equal(e.el('access').hidden,true);await assert.rejects(e.ctx.window.cloud.commit({}),/No se puede/)});
test('seleccionar Propietario abre formulario sin elevar permisos',async()=>{const e=await setup();e.el('role').onchange({target:{value:'Propietario'}});assert.equal(e.el('access').hidden,false);assert.equal(e.ctx.window.cloud.profile,'Recepción')});
test('login usa alias y solo desbloquea tras cargar permisos',async()=>{const e=await setup();await submit(e);assert.equal(e.profile,'Propietario');assert.equal(e.ctx.window.cloud.ready,true);assert.equal(e.calls.find(x=>x.email).email,'pruebapaginas011@gmail.com');assert.equal(e.el('password').value,'')});
test('volver a Recepción cierra identidad de propietario',async()=>{const e=await setup();await submit(e);await e.el('logout').onclick();assert.equal(e.profile,'Recepción');assert.equal(e.auths['owner-profile'].currentUser,null);assert.equal(e.ctx.window.cloud.ready,true)});
test('contraseña inválida no permite entrar al propietario',async()=>{const e=await setup();e.Auth.signInWithEmailAndPassword=async()=>{throw {code:'auth/invalid-credential'}};await submit(e);assert.equal(e.profile,'Recepción');assert.match(e.el('authMessage').textContent,/incorrectos/);assert.equal(e.el('password').value,'')});
test('recuperación se dirige al correo confirmado',async()=>{const e=await setup();await e.el('recover').onclick();assert.equal(e.calls.find(x=>x.recovery).recovery,'pruebapaginas011@gmail.com')});
test('proveedor anónimo deshabilitado explica el paso y no bloquea formulario propietario',async()=>{const e=await setup({anonDisabled:true});assert.match(e.el('connectionStatus').textContent,/proveedor Anónimo/);await submit(e);assert.equal(e.profile,'Propietario')});
test('propietario habilita equipo y después recepción carga sin contraseña',async()=>{const e=await setup({authorized:false});await submit(e);await e.ctx.window.cloud.enableReception();await e.el('logout').onclick();assert.equal(e.profile,'Recepción');assert.equal(e.ctx.window.cloud.ready,true)});
test('espera de red tiene un límite',async()=>{const e=await setup();await assert.rejects(e.run("deadline(new Promise(()=>{}),'Tiempo agotado',5)"),/Tiempo agotado/)});
test('cancelar login pendiente impide activación tardía del propietario',async()=>{const e=await setup();let resolve;e.Auth.signInWithEmailAndPassword=a=>new Promise(r=>{resolve=()=>{a.currentUser={uid:'owner'};r()}});const p=submit(e);await e.el('cancelOwner').onclick();resolve();await p;await Promise.resolve();assert.equal(e.profile,'Recepción');assert.equal(e.auths['owner-profile'].currentUser,null)});
