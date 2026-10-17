const el=id=>document.getElementById(id);
const ownerEmail='pruebapaginas011@gmail.com';
let revision=0,pending=false,loading=false,epoch=0,ownerAttempt=0;
let ownerAuth,deviceAuth,Auth,deviceReady;
window.cloud={ready:false,uid:null,profile:'Recepción'};
const message=text=>el('authMessage').textContent=text;
const status=text=>el('connectionStatus').textContent=text;
function deadline(promise,label,ms=20000){
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms)})]).finally(()=>clearTimeout(timer));
}
function busy(value){
 pending=value;el('saving').hidden=!value;
 document.querySelector('.workspace').inert=value;document.querySelector('aside').inert=value;
 el('form').inert=value;el('modal').querySelectorAll('button').forEach(b=>b.disabled=value);
}
function currentUser(){return window.cloud.profile==='Propietario'?ownerAuth?.currentUser:deviceAuth?.currentUser}
function clearState(profile){
 epoch++;revision=0;window.cloud.ready=false;window.cloud.uid=null;window.cloud.profile=profile;
 el('modal').close();window.appState.apply(window.appState.empty());window.appState.setProfile(profile);
 el('logout').hidden=profile!=='Propietario';el('accountEmail').textContent=profile==='Propietario'?'propietario01':'';
}
function explain(e){
 if(e.code==='auth/operation-not-allowed')return 'Activa el proveedor Anónimo en Firebase Authentication para habilitar recepción sin contraseña.';
 if(e.code==='auth/invalid-credential'||e.code==='auth/wrong-password')return 'Usuario o contraseña incorrectos. Revisa las mayúsculas.';
 if(e.code==='auth/too-many-requests')return 'Demasiados intentos. Espera unos minutos antes de volver a ingresar.';
 return e.message||'No se pudo conectar. Vuelve a intentarlo.';
}
async function api(path,user,body){
 if(!user)throw Error('No hay una sesión disponible.');
 const token=await deadline(user.getIdToken(),'No se pudo comprobar la sesión. Revisa la conexión.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetch('/.netlify/functions/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',signal:controller.signal,...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await res.json()}catch{throw Error('Netlify no devolvió el servicio de datos. Despliega el proyecto completo con sus funciones; revisa también la protección de acceso de Netlify.');}
  if(!res.ok)throw Error(data.error||'No se pudo completar la operación.');
  return data;
 }catch(e){if(e.name==='AbortError')throw Error('El servidor tardó demasiado. Comprueba la conexión y vuelve a cargar antes de repetir la operación.');throw e}
 finally{clearTimeout(timer)}
}
async function loadState(){
 const generation=epoch,user=currentUser();
 const data=await api('state',user);
 if(generation!==epoch||pending||window.appState.isActive()||data.revision<revision&&window.cloud.ready)return;
 if((window.cloud.profile==='Propietario'&&data.role!=='owner')||(window.cloud.profile==='Recepción'&&data.role!=='reception'))throw Error('El perfil no coincide con los permisos de la cuenta.');
 if(!data.state&&data.role==='owner'){
  await api('state',user,{state:window.appState.empty(),expected:0,operationId:crypto.randomUUID()});
  return loadState();
 }
 if(!data.state)throw Error('El propietario debe preparar la barbería primero.');
 if(!Number.isSafeInteger(data.revision))throw Error('Respuesta de datos no válida.');
 window.appState.apply(data.state);revision=data.revision;window.cloud.uid=user.uid;window.cloud.ready=true;window.appState.render();status('Conectado · Cambios confirmados en Firebase');
}
async function reception(){
 if(pending)return;
 ownerAttempt++;el('access').hidden=true;el('password').value='';clearState('Recepción');status('Conectando recepción…');
 if(ownerAuth)await Auth.signOut(ownerAuth);
 try{await deviceReady;await loadState()}catch(e){window.cloud.ready=false;status(explain(e))}
}
function openOwner(){
 if(pending)return;
 el('role').value=window.cloud.profile;el('access').hidden=false;message('Ingresa para acceder al perfil Propietario.');el('password').focus();
}
el('role').onchange=e=>e.target.value==='Propietario'?openOwner():reception();
el('cancelOwner').onclick=reception;
el('logout').onclick=reception;
el('retry').onclick=()=>location.reload();
window.appState.setProfile('Recepción');status('Conectando recepción…');
window.cloud.commit=async state=>{
 if(pending||!window.cloud.ready||!navigator.onLine)throw Error('No se puede guardar ahora. Revisa la conexión.');
 busy(true);
 try{const data=await api('state',currentUser(),{state,expected:revision,operationId:crypto.randomUUID()});revision=data.revision;status('Guardado confirmado en Firebase')}
 catch(e){window.cloud.ready=false;e.cloudFailure=true;status(explain(e)+' El cambio no se confirmó; recarga antes de repetirlo.');throw e}
 finally{busy(false)}
};
async function start(){
 const [App,A]=await deadline(Promise.all([
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
 ]),'No se pudo cargar Firebase. Comprueba tu conexión y vuelve a cargar.');Auth=A;
 ownerAuth=Auth.getAuth(App.initializeApp(window.FIREBASE_CONFIG,'owner-profile'));
 deviceAuth=Auth.getAuth(App.initializeApp(window.FIREBASE_CONFIG,'reception-device'));
 await deadline(Auth.setPersistence(ownerAuth,Auth.inMemoryPersistence),'No se pudo preparar el acceso del propietario.');
 deviceReady=(async()=>{
  await deadline(Auth.setPersistence(deviceAuth,Auth.browserLocalPersistence),'El navegador no permite conservar el acceso de recepción. Revisa los permisos de almacenamiento.');
  await deadline(deviceAuth.authStateReady(),'No se pudo recuperar la sesión de recepción.');
  if(!deviceAuth.currentUser)await deadline(Auth.signInAnonymously(deviceAuth),'No se pudo conectar recepción. Comprueba la conexión.');
 })();
 // Attach the error handler immediately; owner login remains usable if anonymous auth is disabled.
 deviceReady.catch(e=>status(explain(e)));
 el('loginForm').onsubmit=async event=>{
  event.preventDefault();if(loading)return;
  const username=el('username').value.trim().toLowerCase();
  if(username!=='propietario01'&&username!==ownerEmail){message('Revisa el usuario y la contraseña.');return}
  const attempt=++ownerAttempt;loading=true;el('loginButton').disabled=true;message('Ingresando…');
  let login;
  try{
   login=Auth.signInWithEmailAndPassword(ownerAuth,ownerEmail,el('password').value);
   // A timed-out or cancelled request must never grant a late owner session.
   login.then(()=>{if(attempt!==ownerAttempt)Auth.signOut(ownerAuth)}).catch(()=>{});
   await deadline(login,'El acceso tardó demasiado. Revisa tu conexión y vuelve a intentarlo.');
   if(attempt!==ownerAttempt)return;
   clearState('Propietario');message('Cargando datos de la barbería…');await loadState();
   if(attempt!==ownerAttempt)return;
   el('access').hidden=true;
   status('Conectado como propietario. Habilita este equipo para recepción en Configuración.');
  }catch(e){
   if(attempt===ownerAttempt){ownerAttempt++;message(explain(e));el('retry').hidden=false;clearState('Recepción');await Auth.signOut(ownerAuth);}
  }finally{el('password').value='';loading=false;el('loginButton').disabled=false}
 };
 el('recover').onclick=async()=>{
  el('recover').disabled=true;
  try{await deadline(Auth.sendPasswordResetEmail(ownerAuth,ownerEmail),'La recuperación tardó demasiado. Inténtalo más tarde.');message('Solicitud enviada. Revisa el correo de recuperación y spam.')}
  catch(e){message(explain(e))}finally{el('recover').disabled=false}
 };
 window.cloud.enableReception=async()=>{
  if(window.cloud.profile!=='Propietario'||!window.cloud.ready)return;
  try{
   await deviceReady;
   const deviceToken=await deadline(deviceAuth.currentUser.getIdToken(),'No se pudo verificar este equipo.');
   await api('device',ownerAuth.currentUser,{deviceToken});status('Equipo habilitado. Puedes volver a Recepción sin contraseña.');
  }catch(e){status(explain(e))}
 };
 await reception();
 setInterval(async()=>{
  if(pending||loading||!window.cloud.ready||window.appState.isActive()||el('modal').open||!el('access').hidden||document.hidden)return;
  const generation=epoch;try{await loadState()}catch(e){if(generation===epoch){window.cloud.ready=false;status(explain(e)+' Vuelve a cargar.')}}
 },15000);
}
el('loginForm').onsubmit=e=>{e.preventDefault();message('Firebase aún no está listo. Revisa el mensaje de conexión.')};
start().catch(e=>{status(explain(e));message(explain(e));el('retry').hidden=false});
window.addEventListener('offline',()=>{window.cloud.ready=false;status('Sin conexión. No se registran cambios hasta volver a conectar y recargar.')});
window.addEventListener('beforeunload',event=>{if(pending){event.preventDefault();event.returnValue=''}});
