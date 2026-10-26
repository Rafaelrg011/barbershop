(function(){
 const key='barak-demostracion-v1:'+location.pathname.replace(/index\.html$/,'');let revision=null;
 window.cloud={ready:false,uid:'demo-local',profile:'Propietario'};
 function load(){const raw=localStorage.getItem(key);const state=raw?JSON.parse(raw):barakDemoState();state.clients.forEach(c=>{c.notes=(c.notes||'').replace('CLIENTE FICTICIO · ','')});state.movements.forEach(m=>{if(m.note)m.note=m.note.replace('Cobro ficticio · ','Cobro · ').replace('Propina ficticia','Propina')});state.salaryDeductions.forEach(d=>{if(d.reason==='Descuento ficticio para mostrar el cálculo')d.reason='Adelanto de salario'});window.StateValidation.validateState(state);window.appState.apply(state);if(!raw)localStorage.setItem(key,JSON.stringify(state));revision=localStorage.getItem(key);window.cloud.ready=true;window.appState.setProfile('Propietario');}
 window.cloud.commit=async state=>{window.StateValidation.validateState(state);if(localStorage.getItem(key)!==revision)throw Error('La información cambió en otra pestaña. Recarga antes de continuar.');const next=JSON.stringify(state);localStorage.setItem(key,next);revision=next;};
 document.getElementById('role').onchange=e=>{if(window.appState.isActive())return;window.cloud.profile=e.target.value;window.appState.setProfile(e.target.value)};
 document.getElementById('reloadConnection').onclick=()=>location.reload();
 try{load()}catch(e){const n=document.getElementById('connectionStatus');n.hidden=false;n.textContent='No se pudo cargar la información: '+e.message;document.getElementById('connectionTools').hidden=false;}
 const picker=document.getElementById('profilePicker');
 document.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>{
  if(window.appState.isActive())return;
  const value=button.dataset.profile;
  window.cloud.profile=value;window.appState.setProfile(value);
  document.getElementById('profileName').textContent=value;
  document.querySelectorAll('[data-profile]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  picker.open=false;
 }));
 document.querySelector('[data-profile="Propietario"]').setAttribute('aria-pressed','true');
 document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus()}});
})();