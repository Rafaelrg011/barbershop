(() => {
  const key='the-barber-presentation-v1';
  const status=document.getElementById('connectionStatus');
  const warn=message=>{status.textContent=message;status.hidden=false;};
  window.cloud={ready:true,profile:'Propietario',uid:'browser',async commit(state){
    try{localStorage.setItem(key,JSON.stringify(state));status.hidden=true;}
    catch{throw new Error('No se pudo conservar el cambio en este navegador. Revisa el espacio disponible.');}
  }};
  try {
    const saved=localStorage.getItem(key);
    if(saved)window.appState.apply(JSON.parse(saved));
    else localStorage.setItem(key,JSON.stringify(window.appState.read()));
  } catch {warn('No se pudieron cargar los registros guardados de este navegador.');window.cloud.ready=false;}
  document.getElementById('role').onchange=event=>{
    window.cloud.profile=event.target.value;window.appState.setProfile(event.target.value);
  };
  window.appState.setProfile('Propietario');
})();
