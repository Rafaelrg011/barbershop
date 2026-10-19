
const el=id=>document.getElementById(id);
const message=text=>{el('authMessage').textContent=text};
let pending=false, revision=0, unsubscribe=null, reference=null, latest=null;
window.cloud={ready:false,uid:null};
function lock(text,retry=true){
  window.cloud.ready=false;
  window.accountUI?.clear();
  document.getElementById('modal').close();
  document.body.classList.add('locked'); el('access').hidden=false;
  el('loginForm').hidden=retry;el('retry').hidden=!retry; message(text);
}
function busy(value){
  pending=value;el('saving').hidden=!value;
  document.querySelector('.workspace').inert=value;
  document.querySelector('aside').inert=value;
  el('form').inert=value;
  el('modal').querySelectorAll('button').forEach(b=>b.disabled=value);
}
function adopt(snapshot){
  if(!snapshot.exists())throw Error('No se encontró la información de esta barbería.');
  const data=snapshot.data();
  if(data.schema!==1||!Number.isInteger(data.revision))throw Error('Formato de datos no compatible.');
  window.appState.apply(JSON.parse(data.payload));revision=data.revision;
  window.appState.render();
}
el('retry').onclick=()=>location.reload();
async function start(){
  const config=window.FIREBASE_CONFIG;
  if(!config?.apiKey||Object.values(config).some(v=>String(v).includes('COMPLETAR'))){
    lock('Falta configurar Firebase. Completa firebase-config.js con la configuración web de tu proyecto.',false);
    el('loginForm').hidden=true;return;
  }
  const [App,Auth,DB]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);
  const app=App.initializeApp(config),auth=Auth.getAuth(app),db=DB.getFirestore(app);
  // La base de datos usa caché en memoria; no se activa almacenamiento sin conexión.
  await Auth.setPersistence(auth,Auth.browserSessionPersistence);
  window.cloud.accountToken=()=>{if(!auth.currentUser)throw Error('Inicia sesión.');return auth.currentUser.getIdToken(true)};
  window.cloud.confirmOwner=async password=>{
    const user=auth.currentUser;if(!user?.email)throw Error('Inicia sesión como propietario.');
    try{await Auth.reauthenticateWithCredential(user,Auth.EmailAuthProvider.credential(user.email,password))}
    catch{throw Error('No se pudo confirmar tu contraseña de propietario.');}
  };
  async function saveState(state,expected){
    const token=await auth.currentUser.getIdToken();
    const res=await fetch('/.netlify/functions/state',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',body:JSON.stringify({state,expected,operationId:crypto.randomUUID()})});
    let value;try{value=await res.json()}catch{throw Error('El servicio de guardado necesita desplegarse en Netlify.');}
    if(!res.ok)throw Error(value.error||'No se confirmó el guardado.');return value.revision;
  }
  window.cloud.commit=async state=>{
    if(pending||!window.cloud.ready||!auth.currentUser||!navigator.onLine)
      throw Error('No se puede guardar. Revisa la conexión.');
    busy(true);
    try{
      revision=await saveState(state,revision);
    }catch(error){
      error.cloudFailure=true;
      error.message=error.code==='permission-denied'?'Tu cuenta no tiene permiso para guardar. Contacta al administrador.':error.message;
      lock(error.message+'\nEl cambio no se confirmó. Recarga y comprueba los registros antes de repetirlo.');
      throw error;
    }finally{busy(false)}
  };
  el('loginForm').onsubmit=async event=>{
    event.preventDefault();const button=event.submitter||el('loginForm').querySelector('button[type=submit]');button.disabled=true;
    message('Iniciando sesión…');
    try{await Auth.signInWithEmailAndPassword(auth,el('email').value.trim(),el('password').value);el('password').value=''}
    catch{message('No se pudo ingresar. Revisa el correo, la contraseña y la conexión.')}
    finally{button.disabled=false}
  };
  el('resetPassword').onclick=async()=>{
    const email=el('email').value.trim();if(!email)return message('Escribe tu correo para recuperar la contraseña.');
    try{await Auth.sendPasswordResetEmail(auth,email);message('Si la cuenta está registrada, revisa el correo de recuperación.')}
    catch{message('No se pudo solicitar la recuperación. Revisa el correo y la conexión.')}
  };
  el('logout').onclick=async()=>{if(pending||window.accountUI?.isBusy())return;await Auth.signOut(auth)};
  Auth.onAuthStateChanged(auth,async user=>{
    unsubscribe?.();unsubscribe=null;latest=null;reference=null;window.accountUI?.clear();
    window.cloud.ready=false;window.cloud.uid=null;
    window.appState.apply(window.appState.empty());
    el('main').innerHTML='';el('fields').innerHTML='';
    if(!user){lock('Ingresa con la cuenta de propietario habilitada para tu barbería.',false);return}
    lock('Comprobando acceso…');el('retry').hidden=true;
    try{
      const membership=await DB.getDocFromServer(DB.doc(db,'memberships',user.uid));
      const m=membership.exists()?membership.data():null;
      if(!m||m.role!=='owner'||m.active!==true||typeof m.tenantId!=='string'||!m.tenantId||m.tenantId.includes('/'))
        throw Error(m&&['reception','barber'].includes(m.role)?'Tu cuenta de personal está registrada. El acceso operativo de recepción y barberos aún no está habilitado.':'Cuenta sin acceso de propietario. El administrador debe habilitarla.');
      window.cloud.uid=user.uid;reference=DB.doc(db,'tenants',m.tenantId,'state','current');
      let snapshot=await DB.getDocFromServer(reference);
      if(!snapshot.exists()){
        try{await saveState(window.appState.empty(),0)}catch(error){
          const concurrent=await DB.getDocFromServer(reference);if(!concurrent.exists())throw error;
        }
        snapshot=await DB.getDocFromServer(reference);
      }
      if(auth.currentUser?.uid!==user.uid)return;
      adopt(snapshot);window.cloud.ready=true;
      el('accountEmail').textContent=user.email;document.body.classList.remove('locked');el('access').hidden=true;
      unsubscribe=DB.onSnapshot(reference,{includeMetadataChanges:true},snap=>{
        if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;
        if(!snap.exists()){lock('La información ya no está disponible.');return}
        if(snap.data().revision>revision)latest=snap;
        flushRemote();
      },()=>lock('No se puede leer la información. Revisa los permisos y vuelve a cargar.'));
    }catch(error){lock(error.code==='permission-denied'?'Acceso denegado. Revisa las reglas y la asignación de propietario en Firebase.':error.message)}
  });
  function flushRemote(){
    if(!latest||pending||window.appState.isActive()||el('modal').open||!window.cloud.ready)return;
    try{if(latest.data().revision>revision)adopt(latest);latest=null}
    catch{lock('No se pudo actualizar la información. Vuelve a cargar.')}
  }
  setInterval(flushRemote,500);
  window.addEventListener('offline',()=>lock('Se perdió la conexión. Los cambios sin confirmación no se guardan. Vuelve a cargar cuando tengas internet.'));
  window.addEventListener('beforeunload',event=>{if(pending){event.preventDefault();event.returnValue=''}});
}
start().catch(()=>lock('No se pudo iniciar Firebase. Revisa la configuración y tu conexión.'));
