const el=id=>document.getElementById(id);
let revision=0,pending=false,epoch=0;

window.cloud={ready:false,uid:null,profile:'Recepción'};
const status=text=>el('connectionStatus').textContent=text;
function busy(value){
 pending=value;el('saving').hidden=!value;
 document.querySelector('.workspace').inert=value;document.querySelector('aside').inert=value;
 el('form').inert=value;el('modal').querySelectorAll('button').forEach(b=>b.disabled=value);
}
function currentUser(){return null}
function explain(e){return e.message||'No se pudo conectar. Vuelve a intentarlo.'}
async function api(path,user,body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetch('/.netlify/functions/public-state',{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:controller.signal,...(body?{body:JSON.stringify(body)}:{})});
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
 if(data.role!=='owner')throw Error('El equipo no tiene acceso de gestión.');
 if(!data.state&&data.role==='owner'){
  await api('state',user,{state:window.appState.empty(),expected:0,operationId:crypto.randomUUID()});
  return loadState();
 }
 if(!data.state)throw Error('El propietario debe preparar la barbería primero.');
 if(!Number.isSafeInteger(data.revision))throw Error('Respuesta de datos no válida.');
 window.appState.apply(data.state);revision=data.revision;window.cloud.uid='public-access';window.cloud.ready=true;window.appState.render();status('Conectado · Cambios confirmados en Firebase');
}
el('role').onchange=e=>{
 if(pending||window.appState.isActive()){el('role').value=window.cloud.profile;return}
 const value=e.target.value;if(!['Recepción','Propietario'].includes(value))return;
 el('modal').close();window.cloud.profile=value;window.appState.setProfile(value);
};
el('reloadConnection').onclick=()=>location.reload();
window.appState.setProfile('Recepción');status('Conectando recepción…');
window.cloud.commit=async state=>{
 if(pending||!window.cloud.ready||!navigator.onLine)throw Error('No se puede guardar ahora. Revisa la conexión.');
 busy(true);
 try{const data=await api('state',currentUser(),{state,expected:revision,operationId:crypto.randomUUID()});revision=data.revision;status('Guardado confirmado en Firebase')}
 catch(e){window.cloud.ready=false;e.cloudFailure=true;status(explain(e)+' El cambio no se confirmó; recarga antes de repetirlo.');throw e}
 finally{busy(false)}
};
async function start(){
 window.cloud.uid='public-access';
 await loadState();
 setInterval(async()=>{
  if(pending||!window.cloud.ready||window.appState.isActive()||el('modal').open||document.hidden)return;
  const generation=epoch;try{await loadState()}catch(e){if(generation===epoch){window.cloud.ready=false;status(explain(e)+' Vuelve a cargar.')}}
 },15000);
}
start().catch(e=>{window.cloud.ready=false;status(explain(e));});
window.addEventListener('offline',()=>{window.cloud.ready=false;status('Sin conexión. No se registran cambios hasta volver a conectar y recargar.')});
window.addEventListener('beforeunload',event=>{if(pending){event.preventDefault();event.returnValue=''}});
