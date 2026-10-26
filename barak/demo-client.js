(function(){
 const key='barak-demostracion-v1:'+location.pathname.replace(/index\.html$/,'');let revision=null;
 window.cloud={ready:false,uid:'demo-local',profile:'Propietario'};
 const banner=document.createElement('div');banner.style='padding:12px 24px;background:#fff3cd;color:#382d08;display:flex;gap:12px;align-items:center;flex-wrap:wrap';banner.innerHTML='<strong>DEMOSTRACIÓN · Datos ficticios</strong><span>Los cambios se guardan solo en este navegador.</span><button type="button" id="restartDemo">Reiniciar demo</button>';document.querySelector('.workspace header').after(banner);
 function load(){const raw=localStorage.getItem(key);const state=raw?JSON.parse(raw):barakDemoState();window.StateValidation.validateState(state);window.appState.apply(state);if(!raw)localStorage.setItem(key,JSON.stringify(state));revision=localStorage.getItem(key);window.cloud.ready=true;window.appState.setProfile('Propietario');}
 window.cloud.commit=async state=>{window.StateValidation.validateState(state);if(localStorage.getItem(key)!==revision)throw Error('La demo cambió en otra pestaña. Recarga antes de continuar.');const next=JSON.stringify(state);localStorage.setItem(key,next);revision=next;};
 document.getElementById('role').onchange=e=>{if(window.appState.isActive())return;window.cloud.profile=e.target.value;window.appState.setProfile(e.target.value)};
 document.getElementById('restartDemo').onclick=()=>{if(window.appState.isActive())return;if(confirm('¿Restaurar los ejemplos y borrar los cambios realizados en esta demo?')){try{localStorage.removeItem(key);location.reload()}catch(e){alert('No se pudo reiniciar: '+e.message)}}};
 document.getElementById('reloadConnection').onclick=()=>location.reload();
 try{load()}catch(e){const n=document.getElementById('connectionStatus');n.hidden=false;n.textContent='No se pudo cargar la demo: '+e.message;document.getElementById('connectionTools').hidden=false;}
})();
