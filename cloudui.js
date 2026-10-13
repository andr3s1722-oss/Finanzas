/* Pantalla Nube: cuenta, estado de sincronización y acciones. Usa la sesión de Supabase de PublicSync. */
var CloudSync=null;
function cloudRequest(url,options){
 options=options||{};
 return new Promise(function(resolve,reject){
  var xhr=new XMLHttpRequest();xhr.open(options.method||'GET',url,true);
  Object.keys(options.headers||{}).forEach(function(k){xhr.setRequestHeader(k,options.headers[k]);});
  xhr.onload=function(){var data=null;try{data=xhr.responseText?JSON.parse(xhr.responseText):null;}catch(e){}resolve({ok:xhr.status>=200&&xhr.status<300,status:xhr.status,data:data,text:xhr.responseText||''});};
  xhr.onerror=function(){reject(new Error('Network error'));};
  xhr.send(options.body||null);
 });
}
function cloudDevice(){
 var standalone=false;try{standalone=(window.navigator&&window.navigator.standalone)||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);}catch(e){}
 var ua=(typeof navigator!=='undefined'&&navigator.userAgent)||'';
 return (/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':'Computador')+(standalone?' · app instalada':' · navegador');
}
function cloudBoot(){
 if(CloudSync||typeof Cloud==='undefined'||!window.PublicSync||!PublicSync.getSession)return;
 CloudSync=Cloud.create({
  url:'https://qtmjogfivvwivenoiczx.supabase.co',key:'sb_publishable_sFR-ur1OZZxIkwFjuMXsJQ_ncA77AAC',
  request:cloudRequest,getSession:function(){return PublicSync.getSession();},
  storage:{get:sGet,set:sSet},getData:function(){return D;},
  apply:function(obj){D=normalize(obj);save();refresh();},
  backup:function(txt){try{sSet(KEY+'_precloud',txt);}catch(e){}},
  device:cloudDevice,onStatus:function(){if(screen==='nube')rNube();}
 });
 CloudSync.touch(1500);
 setInterval(function(){CloudSync.touch(0);},5*60*1000);
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')CloudSync.touch(500);});
}
function cloudTouch(){if(CloudSync)CloudSync.touch();}
function cloudEmail(){
 try{var token=publicSession&&publicSession.access_token;
  if(!token)return '';var p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.email||'';}catch(e){return '';}
}
function cloudWhen(iso){if(!iso)return 'Nunca';var d=new Date(iso);return isNaN(d)?'Nunca':d.toLocaleString('es-US',{dateStyle:'medium',timeStyle:'short'});}
var CLOUD_LABEL={ok:'Sincronizado',syncing:'Sincronizando…','signed-out':'Sin conectar',offline:'Sin conexión',auth:'Sesión vencida','not-setup':'Falta activar la base de datos',conflict:'Cambios simultáneos',error:'Error'};
function cloudShort(){
 if(!CloudSync)return '';var s=CloudSync.status();return s.state==='idle'?'':(CLOUD_LABEL[s.state]||'');
}
function rNube(){
 if(!el('s-nube'))return;
 var s=CloudSync?CloudSync.status():{state:'idle',message:'',at:''},st=CloudSync?CloudSync.state():{version:0,at:''};
 var signed=!!publicSession,email=cloudEmail();
 var head='<div class="dash-intro"><div class="eyebrow">Tus datos, en todos tus dispositivos</div><h1>Nube.</h1><p>Se sincroniza solo entre tu iPhone, la app instalada y el navegador. Tu respaldo JSON sigue funcionando igual.</p></div>';
 if(!signed){
  el('s-nube').innerHTML=head+'<div class="card"><div class="f"><label for="cloud-email">Tu correo</label><input id="cloud-email" type="email" autocomplete="email" placeholder="tu@correo.com" value="'+esc(sGet('finanzas_public_email_v1')||'')+'"></div>'
   +'<button class="btn" style="width:100%" onclick="cloudSignIn()">Enviar enlace</button><div class="note" style="padding:10px 0 0">Te llega un enlace seguro, sin contraseña. '+esc((window.PublicSync?PublicSync.status():'')||'')+'</div></div>'
   +'<div class="sec">¿Abriste el enlace en Safari y usas la app instalada?</div><div class="card"><p class="note" style="padding-top:0">iOS guarda la sesión por separado. En Safari toca <b>Copiar conexión</b> y pégala aquí.</p>'
   +'<div class="f"><textarea id="cloud-code" rows="3" placeholder="Pega aquí el código" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:13px"></textarea></div>'
   +'<div class="dash-actions" style="margin:0"><button onclick="cloudUseCode()">Conectar con el código</button><button onclick="PublicSync.copyConnection().then(rNube)">Copiar conexión</button></div></div>';
  return;
 }
 var bad=s.state==='not-setup'?'<div class="warn">Falta crear la tabla en Supabase. Abre <b>supabase/migrations/20261013000000_cloud_sync.sql</b> del repositorio, pégalo en Supabase → SQL Editor y ejecútalo. Luego toca Sincronizar.</div>'
   :(s.state==='error'||s.state==='auth'||s.state==='offline'?'<div class="warn">'+esc(s.message||CLOUD_LABEL[s.state])+'</div>':'');
 el('s-nube').innerHTML=head+bad
  +'<div class="card"><div style="display:flex;align-items:center;gap:12px"><div class="ico" style="background:var(--card2)">☁️</div><div class="row-m"><div class="row-t">'+esc(email||'Cuenta conectada')+'</div><div class="row-s">'+esc(cloudDevice())+'</div></div><div class="row-v" style="font-size:13px">'+esc(CLOUD_LABEL[s.state]||'Listo')+'</div></div>'
  +'<div class="note" style="padding:12px 0 0">Última sincronización: '+esc(cloudWhen(st.at))+(st.version?' · versión '+st.version:'')+'</div></div>'
  +'<div class="dash-actions"><button onclick="cloudSyncNow()">Sincronizar ahora</button></div>'
  +'<div class="sec">Avanzado</div><div class="menu">'
  +mi('⬆️',T.blu,'Subir esta copia','reemplaza la nube',"cloudForce('push')")
  +mi('⬇️',T.pur,'Bajar la copia de la nube','reemplaza este equipo',"cloudForce('pull')")
  +mi('↩️',T.org,'Restaurar copia anterior',sGet(KEY+'_precloud')?'disponible':'ninguna',"cloudRestore()")
  +mi('🔌',T.red,'Desconectar este dispositivo','',"cloudSignOut()")+'</div>'
  +'<div class="note" style="padding-top:12px">Cuando dos dispositivos cambian a la vez, se mezclan los cambios de cada uno: nada se pierde, y si ambos tocan el mismo dato gana el de este dispositivo. Antes de aplicar cambios de la nube se guarda una copia local para poder restaurarla.</div>';
}
async function cloudSignIn(){var v=el('cloud-email').value.trim();if(!v)return toast('Escribe tu correo');await PublicSync.signIn(v);rNube();}
async function cloudUseCode(){var v=el('cloud-code').value.trim();if(!v)return toast('Pega primero el código');await PublicSync.useConnection(v);rNube();if(CloudSync)CloudSync.touch(300);}
async function cloudSyncNow(){if(!CloudSync)return;toast('Sincronizando…');await CloudSync.sync();rNube();var s=CloudSync.status();toast(s.state==='ok'?'Sincronizado ✓':(s.message||'No se pudo sincronizar'));}
async function cloudForce(mode){
 if(!CloudSync)return;
 var msg=mode==='push'?'Esto reemplaza la copia de la nube con lo que hay en este dispositivo. ¿Continuar?':'Esto reemplaza los datos de este dispositivo con la copia de la nube (guardo una copia antes). ¿Continuar?';
 if(!confirm(msg))return;
 await CloudSync.sync({force:mode});rNube();var s=CloudSync.status();toast(s.state==='ok'?'Listo ✓':(s.message||'No se pudo'));
}
function cloudRestore(){
 var raw=sGet(KEY+'_precloud');if(!raw)return toast('No hay copia anterior');
 if(!confirm('Vuelves a los datos que tenías antes de la última sincronización. ¿Continuar?'))return;
 try{D=normalize(JSON.parse(raw));save();rNube();toast('Copia restaurada ✓');}catch(e){toast('La copia no se pudo leer');}
}
async function cloudSignOut(){
 if(!confirm('Este dispositivo dejará de sincronizar (tus datos locales se quedan). ¿Desconectar?'))return;
 await PublicSync.signOut();if(CloudSync)CloudSync.forget();rNube();
}
TITLES.nube='Nube';SUBS.nube=1;
