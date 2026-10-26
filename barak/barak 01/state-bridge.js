/* Puente de transición: solo propietario. No concede permisos. */
(function () {
  const clone = value => JSON.parse(JSON.stringify(value));
  function read() {
    return clone({schema:1,barbers,services,clients,appointments,movements,promos,
      schedules,cashSessions,currentCashId,cashOpen,opening,closed,historyLog,
      serial,availabilityHistory,blocks,inventory,stockLedger,commissionRules,
      settlements,productRates,monthlySalaries,salaryDeductions});
  }
  function apply(s) {
    if(window.StateValidation)window.StateValidation.validateState(s);
    if(s.schema!==1) throw Error('Versión de datos no compatible.');
    barbers.splice(0,barbers.length,...s.barbers); services.splice(0,services.length,...s.services);
    ({clients,appointments,movements,promos,schedules,cashSessions,currentCashId,
      cashOpen,opening,closed,historyLog,serial,availabilityHistory,blocks,inventory,
      stockLedger,commissionRules,settlements,productRates}=clone(s));
    monthlySalaries=clone(s.monthlySalaries||{});salaryDeductions=clone(s.salaryDeductions||[]);
    role=window.cloud?.profile||'Recepción'; historyStart=Object.keys(availabilityHistory).sort()[0]||today;
  }
  function empty() {
    return {schema:1,barbers:[],services:[],clients:[],appointments:[],movements:[],
      promos:[],schedules:[],cashSessions:[],currentCashId:null,cashOpen:false,
      opening:0,closed:false,historyLog:[],serial:10000,availabilityHistory:{},
      blocks:[],inventory:[],stockLedger:[],commissionRules:[],settlements:[],productRates:{},monthlySalaries:{},salaryDeductions:[]};
  }
  apply(empty());
  const originalModal=modal, originalFinish=finish, originalNotify=notify;
  let active=false, queuedMessage='';
  finish=message=>{if(active){queuedMessage=message;return;}originalFinish(message)};
  notify=message=>{if(active){queuedMessage=message;return;}originalNotify(message)};
  async function operation(work) {
    if(active) throw Error('Espera a que termine el guardado.');
    if(!window.cloud?.ready||!navigator.onLine) throw Error('No se puede guardar ahora. Revisa la conexión y vuelve a cargar.');
    if(localCashDate()!==today)throw Error('Cambió el día. Recarga la página antes de registrar operaciones.');
    const before=read(); active=true; queuedMessage='';
    try {
      const result=work();
      if(result instanceof Promise) await result;
      let after=read();
      const changed=JSON.stringify(before)!==JSON.stringify(after);
      if(changed){
        delete availabilityHistory[today];
        const recorded={};barbers.forEach((_,i)=>recorded[i]=ranges(today,i));
        availabilityHistory[today]=recorded;after=read();
        if(window.StateValidation)window.StateValidation.validateTransition(before,after);
        await window.cloud.commit(after);
      }
      const message=queuedMessage;
      active=false;
      if(message||changed){closeModal();render()}
      if(message) originalNotify(message);
      if(changed&&typeof loyaltyAfterSave==='function')loyaltyAfterSave(before,after);
    } catch(error) {
      const current=read();const changed=JSON.stringify({...before,serial:0})!==JSON.stringify({...current,serial:0});
      if(changed)apply(before);
      active=false; queuedMessage='';
      if(error.cloudFailure||changed){closeModal();render();originalNotify(error.message)}
      throw error;
    }
  }
  modal=(title,fields,save)=>originalModal(title,fields,form=>operation(()=>save(form)));
  const originalToggle=togglePromo;
  togglePromo=id=>operation(()=>originalToggle(id)).catch(error=>originalNotify(error.message));
  seedLab=resetLab=()=>{throw Error('Esta función no está disponible.');};
  const originalLog=logAction;
  logAction=(title,entity=null)=>{originalLog(title,entity);historyLog[0].uid=window.cloud?.uid||null};
  setupPage=()=>{
    $('#main').innerHTML=heading('Configuración','Administración de tu barbería.')+
      '<section class="panel" style="padding:24px"><h2>Operación</h2><div class="buttons"><button onclick="navigate(\'Equipo\')">Equipo</button><button onclick="navigate(\'Servicios\')">Servicios</button><button onclick="blockForm()">Bloquear horario</button><button onclick="exportDemo()">Descargar registros</button></div><h2>Acceso libre</h2><p>Recepción y Propietario se abren sin usuario ni contraseña. Cualquier persona con el enlace puede consultar y gestionar los registros. Los cambios se guardan únicamente en este navegador.</p><p>QR: registro de cobros, sin verificación bancaria. WhatsApp: mensajes preparados para envío manual. Informes internos, sin facturación fiscal.</p><p>El informe descargado no es una copia de seguridad restaurable.</p></section>';
  };
  const originalBooking=bookingForm;
  bookingForm=(...args)=>{
    if(!clients.length)return originalNotify('Registra primero un cliente.');
    if(!services.some(s=>s.active))return originalNotify('Configura un servicio activo en Servicios.');
    if(!schedules.some(s=>s.active))return originalNotify('Agrega un profesional en Equipo.');
    return originalBooking(...args);
  };
  window.appState={read,apply,empty,render,operation,isActive:()=>active,setProfile(value){role=value;filter='Todos';view='Agenda';$('#role').value=value;render()}};
})();
