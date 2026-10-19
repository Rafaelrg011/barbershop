/* Gestión de credenciales: formulario independiente del guardado de caja. */
(function(){
 let accounts=[],requestBusy=false;
 const byId=id=>document.getElementById(id);
 const safe=s=>esc(String(s??''));
 async function api(method='GET',data){
   if(!window.cloud?.accountToken)throw Error('Primero inicia sesión como propietario.');
   const token=await window.cloud.accountToken();
   const res=await fetch('/.netlify/functions/accounts',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store',credentials:'omit'});
   let body;try{body=await res.json()}catch{throw Error('La administración de cuentas necesita desplegar el servidor de Netlify.');}
   if(!res.ok)throw Error(body.error||'No se pudo completar la operación.');return body;
 }
 function mount(){
   if(role!=='Propietario')return;
   const section=document.createElement('section');section.className='panel account-panel';section.id='accountsPanel';
   section.innerHTML='<div class="panelhead"><div><h2>Usuarios y contraseñas</h2><p class="muted">Cuentas individuales de recepción y barberos.</p></div><div class="buttons"><button type="button" id="reloadAccounts">Actualizar lista</button><button class="primary" type="button" id="newAccount">＋ Crear usuario</button></div></div><div class="account-body"><p>El usuario de acceso es un correo electrónico. Puedes cambiarlo, asignar una contraseña nueva o desactivar la cuenta. Las contraseñas actuales no se muestran.</p><p id="accountStatus" role="status">Cargando cuentas…</p><div id="accountList"></div><p class="formhint">La creación de credenciales no habilita todavía las operaciones del personal: los permisos de recepción y barberos sobre agenda y caja siguen pendientes. No compartas tu cuenta de propietario.</p></div>';
   document.getElementById('main').append(section);
   byId('reloadAccounts').onclick=load;byId('newAccount').onclick=()=>edit();load();
 }
 async function load(){
   if(requestBusy)return;
   const status=byId('accountStatus');if(!status)return;status.textContent='Consultando cuentas…';
   try{const data=await api();accounts=data.accounts;if(!byId('accountList'))return;
     byId('accountList').innerHTML=accounts.length?'<div class="tablewrap"><table><thead><tr><th>Nombre / usuario</th><th>Perfil</th><th>Estado</th><th></th></tr></thead><tbody>'+accounts.map((a,i)=>'<tr><td><b>'+safe(a.name)+'</b><br>'+safe(a.email)+'</td><td>'+ (a.role==='barber'?'Barbero':'Recepción')+(a.role==='barber'?'<br>'+safe(barbers[a.barberId]||'Profesional no disponible'):'')+'</td><td>'+ (a.status==='updating'?'Cambio en curso':a.status==='error'?'Bloqueada: revisar cambio':a.active?'Activa':'Desactivada')+'</td><td><button type="button" data-edit-account="'+i+'">Editar acceso</button></td></tr>').join('')+'</tbody></table></div>':'<p>Aún no hay cuentas de personal.</p>';
     byId('accountList').querySelectorAll('[data-edit-account]').forEach(b=>b.onclick=()=>edit(accounts[Number(b.dataset.editAccount)]));
     status.textContent='';
   }catch(error){status.textContent=error.message}
 }
 function edit(account){
   if(requestBusy)return;
   let dialog=byId('accountDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='accountDialog';document.body.append(dialog)}
   const selected=account?.role||'reception';
   dialog.innerHTML='<form id="accountForm" autocomplete="off"><div class="dialoghead"><h2>'+ (account?'Editar acceso':'Crear usuario')+'</h2><button type="button" id="closeAccount" aria-label="Cerrar">×</button></div><div class="account-fields">'+
     field('Nombre',input('name','text',account?.name||'','required maxlength="80"'))+
     field('Usuario (correo electrónico)',input('email','email',account?.email||'','required maxlength="254" autocomplete="off"'))+
     field('Perfil','<select name="role"><option value="reception" '+(selected==='reception'?'selected':'')+'>Recepción</option><option value="barber" '+(selected==='barber'?'selected':'')+'>Barbero</option></select>')+
     '<div id="barberField">'+field('Profesional vinculado','<select name="barberId"><option value="">Selecciona un profesional</option>'+barbers.map((b,i)=>schedules[i]?.active?'<option value="'+i+'" '+(account?.barberId===i?'selected':'')+'>'+safe(b)+'</option>':'').join('')+'</select>')+'</div>'+
     field(account?'Contraseña nueva (deja vacío para conservarla)':'Contraseña inicial',input('password','password','','minlength="12" maxlength="128" autocomplete="new-password" '+(!account?'required':'')))+
     field('Repite la contraseña nueva',input('confirmation','password','','minlength="12" maxlength="128" autocomplete="new-password" '+(!account?'required':'')))+
     '<label class="inlinecheck"><input type="checkbox" name="active" '+(!account||account.active?'checked':'')+'>Cuenta activa</label><p class="formhint">Usa de 12 a 128 caracteres. Al guardar se cerrarán las sesiones anteriores de esta cuenta. No se guardan contraseñas en los informes.</p>'+ 
     field('Confirma tu contraseña de propietario',input('ownerPassword','password','','required autocomplete="current-password"'))+
     '</div><p id="accountError" class="error" role="alert"></p><div class="dialogactions"><button type="button" id="cancelAccount">Cancelar</button><button type="submit" class="primary">Guardar acceso</button></div></form>';
   const form=byId('accountForm'),requestId=crypto.randomUUID();
   const close=()=>{if(!requestBusy){form.reset();dialog.close();dialog.innerHTML=''}};
   byId('closeAccount').onclick=byId('cancelAccount').onclick=close;
   dialog.oncancel=e=>{if(requestBusy)e.preventDefault();else setTimeout(close,0)};
   const sync=()=>{const barber=form.elements.role.value==='barber';byId('barberField').hidden=!barber;form.elements.barberId.required=barber};form.elements.role.onchange=sync;sync();
   form.onsubmit=async event=>{
     event.preventDefault();if(requestBusy)return;byId('accountError').textContent='';
     const f=new FormData(form),password=String(f.get('password'));
     if(password!==f.get('confirmation')){byId('accountError').textContent='Las contraseñas nuevas no coinciden.';return}
     requestBusy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
     try{
       await window.cloud.confirmOwner(String(f.get('ownerPassword')));
       form.elements.ownerPassword.value='';
       await api('POST',{action:account?'update':'create',requestId,...(account?{uid:account.uid,version:account.version}:{}),
         name:f.get('name'),email:f.get('email'),password,role:f.get('role'),barberId:f.get('role')==='barber'?Number(f.get('barberId')):null,active:f.has('active')});
       requestBusy=false;close();await load();notify('Acceso guardado.');
     }catch(error){if(byId('accountError'))byId('accountError').textContent=error.message+' Si el resultado es incierto, cierra y actualiza la lista antes de repetir.'}
     finally{requestBusy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);if(form.elements.ownerPassword)form.elements.ownerPassword.value='';}
   };
   dialog.showModal();
 }
 const original=setupPage;setupPage=()=>{original();mount()};
 window.accountUI={clear(){accounts=[];requestBusy=false;const d=byId('accountDialog');if(d){d.close();d.innerHTML=''}},isBusy:()=>requestBusy};
})();
