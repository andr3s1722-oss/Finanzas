/* Pantalla Nube: cuenta, estado de sincronización y acciones. Usa la sesión de Supabase de PublicSync. */
var CloudSync=null;
var CLOUD_URL='https://qtmjogfivvwivenoiczx.supabase.co',CLOUD_KEY='sb_publishable_sFR-ur1OZZxIkwFjuMXsJQ_ncA77AAC';
var cloudInbox=[],cloudInboxAt=0,cloudToken='';
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
  url:CLOUD_URL,key:CLOUD_KEY,
  request:cloudRequest,getSession:function(){return PublicSync.getSession();},
  storage:{get:sGet,set:sSet},getData:function(){return D;},
  apply:function(obj){D=normalize(obj);save();refresh();},
  backup:function(txt){try{sSet(KEY+'_precloud',txt);}catch(e){}},
  device:cloudDevice,onStatus:function(st){if(screen==='nube')rNube();if(st&&st.state==='ok')cloudInboxPull();}
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
var cloudStep='email',cloudPending='';
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
  var intro=cloudStep==='code'
   ?'<div class="card"><p class="note" style="padding-top:0">Te enviamos un código a <b>'+esc(cloudPending)+'</b>. Escríbelo aquí (revisa también el correo no deseado).</p>'
    +'<div class="f"><label for="cloud-otp">Código</label><input id="cloud-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="font-size:22px;letter-spacing:.25em;text-align:center"></div>'
    +'<button class="btn" style="width:100%" onclick="cloudVerify()">Entrar</button>'
    +'<div class="dash-actions" style="margin:12px 0 0"><button onclick="cloudBack()">Cambiar correo o reenviar</button></div>'
    +'<div class="note" style="padding:10px 0 0">'+esc((window.PublicSync?PublicSync.status():'')||'')+'</div></div>'
   :'<div class="card"><div class="f"><label for="cloud-email">Tu correo</label><input id="cloud-email" type="email" autocomplete="email" placeholder="tu@correo.com" value="'+esc(cloudPending||sGet('finanzas_public_email_v1')||'')+'"></div>'
    +'<button class="btn" style="width:100%" onclick="cloudSignIn()">Enviar código</button><div class="note" style="padding:10px 0 0">Sin contraseña: te llega un código de un solo uso. '+esc((window.PublicSync?PublicSync.status():'')||'')+'</div></div>';
  el('s-nube').innerHTML=head+intro
   +'<details class="card" style="margin-top:12px"><summary style="cursor:pointer;min-height:44px;font-weight:650">¿Prefieres usar el enlace del correo?</summary><p class="note" style="padding-top:8px">El enlace se abre en Safari. Si usas la app instalada, en Safari toca <b>Copiar conexión</b> y pega el código aquí.</p>'
   +'<div class="f"><textarea id="cloud-code" rows="3" placeholder="Pega aquí el código de conexión" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:13px"></textarea></div>'
   +'<div class="dash-actions" style="margin:0"><button onclick="cloudUseCode()">Conectar con el código</button><button onclick="PublicSync.copyConnection().then(rNube)">Copiar conexión</button></div></details>';
  return;
 }
 var bad=s.state==='not-setup'?'<div class="warn">Falta crear la tabla en Supabase. Abre <b>supabase/migrations/20261013000000_cloud_sync.sql</b> del repositorio, pégalo en Supabase → SQL Editor y ejecútalo. Luego toca Sincronizar.</div>'
   :(s.state==='error'||s.state==='auth'||s.state==='offline'?'<div class="warn">'+esc(s.message||CLOUD_LABEL[s.state])+'</div>':'');
 el('s-nube').innerHTML=head+bad
  +'<div class="card"><div style="display:flex;align-items:center;gap:12px"><div class="ico" style="background:var(--card2)">☁️</div><div class="row-m"><div class="row-t">'+esc(email||'Cuenta conectada')+'</div><div class="row-s">'+esc(cloudDevice())+'</div></div><div class="row-v" style="font-size:13px">'+esc(CLOUD_LABEL[s.state]||'Listo')+'</div></div>'
  +'<div class="note" style="padding:12px 0 0">Última sincronización: '+esc(cloudWhen(st.at))+(st.version?' · versión '+st.version:'')+'</div></div>'
  +'<div class="dash-actions"><button onclick="cloudSyncNow()">Sincronizar ahora</button></div>'
  +cloudApplePayCard()
  +'<div class="sec">Avanzado</div><div class="menu">'
  +mi('⬆️',T.blu,'Subir esta copia','reemplaza la nube',"cloudForce('push')")
  +mi('⬇️',T.pur,'Bajar la copia de la nube','reemplaza este equipo',"cloudForce('pull')")
  +mi('↩️',T.org,'Restaurar copia anterior',sGet(KEY+'_precloud')?'disponible':'ninguna',"cloudRestore()")
  +mi('🔌',T.red,'Desconectar este dispositivo','',"cloudSignOut()")+'</div>'
  +'<div class="note" style="padding-top:12px">Cuando dos dispositivos cambian a la vez, se mezclan los cambios de cada uno: nada se pierde, y si ambos tocan el mismo dato gana el de este dispositivo. Antes de aplicar cambios de la nube se guarda una copia local para poder restaurarla.</div>';
}
async function cloudSignIn(){var v=el('cloud-email').value.trim();if(!v)return toast('Escribe tu correo');var ok=await PublicSync.signIn(v);if(ok){cloudStep='code';cloudPending=v;}rNube();if(ok&&el('cloud-otp'))el('cloud-otp').focus();}
async function cloudVerify(){var code=el('cloud-otp').value;var ok=await PublicSync.verifyCode(cloudPending,code);if(ok){cloudStep='email';cloudPending='';if(CloudSync)CloudSync.touch(300);toast('Cuenta conectada ✓');}else toast(PublicSync.status()||'Código incorrecto');rNube();}
function cloudBack(){cloudStep='email';rNube();}
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

/* ═══════════ Bandeja de Apple Pay ═══════════ */
async function cloudAuth(){var P=window.PublicSync;return P&&P.getSession?await P.getSession():null;}
function cloudHeaders(s,json){var h={apikey:CLOUD_KEY};if(s)h.Authorization='Bearer '+s.access_token;if(json)h['Content-Type']='application/json';return h;}
function inboxLocalDate(iso){var d=new Date(iso);if(isNaN(d))return today();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function inboxCand(row){
 var n=Importer.amountNumber(row.amount_raw);
 var desc=String(row.merchant||'').trim()||'Apple Pay';
 return {id:row.id,date:inboxLocalDate(row.created_at),desc:desc,amount:isNaN(n)?0:Math.abs(n),kind:'gasto',currency:row.currency==='COP'?'COP':'USD',cat:detectarCat(desc)||'Otros',card:row.card||''};
}
function inboxPending(){
 var saved={};D.expenses.forEach(function(e){if(e.fromInbox)saved[e.fromInbox]=1;});
 return cloudInbox.filter(function(r){return !saved[r.id];});
}
function inboxCount(){return inboxPending().length;}
async function cloudInboxDelete(ids){
 if(!ids.length)return true;
 var s=await cloudAuth();if(!s)return false;
 try{
  var r=await cloudRequest(CLOUD_URL+'/rest/v1/inbox?id=in.('+ids.map(encodeURIComponent).join(',')+')',{method:'DELETE',headers:cloudHeaders(s)});
  if(r.ok)cloudInbox=cloudInbox.filter(function(x){return ids.indexOf(x.id)<0;});
  return r.ok;
 }catch(e){return false;}
}
async function cloudInboxPull(force){
 if(!force&&Date.now()-cloudInboxAt<20000)return;
 var s=await cloudAuth();if(!s)return;
 cloudInboxAt=Date.now();
 try{
  var r=await cloudRequest(CLOUD_URL+'/rest/v1/inbox?select=id,created_at,amount_raw,merchant,currency,card&order=created_at.asc&limit=100',{headers:cloudHeaders(s)});
  if(!r.ok||!Array.isArray(r.data))return;
  var before=cloudInbox.map(function(x){return x.id;}).join(',');
  cloudInbox=r.data;
  // ya guardados aquí pero que no se alcanzaron a borrar de la nube: se borran ahora
  var done=cloudInbox.filter(function(x){return D.expenses.some(function(e){return e.fromInbox===x.id;});}).map(function(x){return x.id;});
  if(done.length)await cloudInboxDelete(done);
  if(cloudInbox.map(function(x){return x.id;}).join(',')!==before&&(screen==='inbox'||screen==='resumen'||screen==='mas'))refresh();
 }catch(e){}
}
function inboxBanner(){
 var n=inboxCount();if(!n)return '';
 return '<button class="card finance-alert" onclick="go(\'inbox\')" style="margin-bottom:14px"><strong>'+n+(n===1?' pago por confirmar':' pagos por confirmar')+' ↗</strong><span>Llegaron desde Apple Pay. Revísalos y guárdalos.</span></button>';
}
function rInbox(){
 var cands=Importer.markDuplicates(inboxPending().map(inboxCand),D);
 el('s-inbox').innerHTML='<div class="dash-intro"><div class="eyebrow">Apple Pay</div><h1>Pagos por confirmar.</h1><p>Cada pago que haces con Apple Pay llega aquí. Guárdalo tal cual, corrígelo o descártalo.</p></div>'
  +(cands.length?'<div class="card" style="padding:6px 14px">'+cands.map(function(it){
    var meta=CATS[it.cat]||CATS.Otros;
    return '<div class="inbox-row'+(it.dup?' dup':'')+'"><div class="row"><div class="ico" style="background:'+meta.c+'1f">'+meta.e+'</div><div class="row-m"><div class="row-t">'+esc(it.desc)+'</div><div class="row-s">'+dayLabel(it.date)+' · '+esc(it.cat)+(it.card?' · '+esc(it.card):'')+(it.dup?' · posible duplicado':'')+'</div></div><div class="row-v num">−'+fmt(it.amount,it.currency)+'</div></div>'
     +'<div class="dash-actions" style="margin:0 0 10px"><button onclick="cloudInboxAccept(\''+it.id+'\')">Guardar</button><button onclick="cloudInboxAccept(\''+it.id+'\',true)">Editar</button><button onclick="cloudInboxDiscard(\''+it.id+'\')">Descartar</button></div></div>';
   }).join('')+'</div>'
   +'<button class="btn" style="width:100%;margin-top:14px" onclick="cloudInboxAcceptAll()">Guardar todos ('+cands.filter(function(i){return !i.dup;}).length+')</button>'
   :'<div class="empty"><div class="e">✅</div><div class="t">No hay pagos por confirmar</div><div class="s">Cuando pagues con Apple Pay, aparecen aquí</div></div>')
  +'<div class="dash-actions"><button onclick="cloudInboxPull(true).then(rInbox)">Actualizar</button><button onclick="go(\'nube\')">Configurar el atajo</button></div>';
}
function inboxSave(it){
 var existing=D.expenses.filter(function(e){return e.fromInbox===it.id;})[0];
 if(existing)return existing;
 var e={id:uid(),date:it.date,desc:it.desc,amount:it.amount,currency:it.currency,category:it.cat,spread:1,fromInbox:it.id};
 D.expenses.push(e);return e;
}
async function cloudInboxAccept(id,thenEdit){
 var row=cloudInbox.filter(function(x){return x.id===id;})[0];if(!row)return;
 var it=inboxCand(row);
 if(!(it.amount>0))return toast('No pude leer el monto de este pago');
 if(!D.expenses.some(function(e){return e.fromInbox===id;})&&!confirmarMonto(it.amount,it.currency,'gasto'))return;
 var e=inboxSave(it);save();
 await cloudInboxDelete([id]);
 if(thenEdit){rInbox();editExp(e.id);return;}
 toast('Guardado ✓');rInbox();
}
async function cloudInboxAcceptAll(){
 var cands=Importer.markDuplicates(inboxPending().map(inboxCand),D).filter(function(i){return !i.dup&&i.amount>0;});
 if(!cands.length)return toast('No hay nada para guardar');
 var raro=cands.filter(function(i){return montoDudoso(i.amount,i.currency,'gasto');})[0];
 if(raro&&!confirm('"'+raro.desc+'" ('+raro.amount.toLocaleString('en-US')+' '+raro.currency+') parece tener la moneda equivocada.\n\nAceptar = guardar todos así. Cancelar = revisar uno por uno.'))return;
 cands.forEach(inboxSave);save();
 await cloudInboxDelete(cands.map(function(i){return i.id;}));
 toast(cands.length+(cands.length===1?' pago guardado ✓':' pagos guardados ✓'));rInbox();
}
async function cloudInboxDiscard(id){
 if(!confirm('¿Descartar este pago? No se guardará.'))return;
 await cloudInboxDelete([id]);rInbox();
}
/* llave del atajo */
async function cloudMakeToken(){
 if(!confirm('Se crea una llave nueva para el atajo. Si ya tenías un atajo, deja de funcionar hasta que le pongas la llave nueva. ¿Continuar?'))return;
 var s=await cloudAuth();if(!s)return toast('Primero conecta tu cuenta');
 try{
  var r=await cloudRequest(CLOUD_URL+'/rest/v1/rpc/create_capture_token',{method:'POST',headers:cloudHeaders(s,true),body:'{}'});
  if(r.ok&&typeof r.data==='string'&&r.data.length>=32){cloudToken=r.data;rNube();return;}
  toast(r.status===404?'Falta ejecutar el SQL de Apple Pay en Supabase':'No se pudo crear la llave ('+r.status+')');
 }catch(e){toast('Sin conexión');}
}
async function cloudRevokeToken(){
 if(!confirm('El atajo actual dejará de funcionar. ¿Revocar la llave?'))return;
 var s=await cloudAuth();if(!s)return;
 try{var r=await cloudRequest(CLOUD_URL+'/rest/v1/rpc/revoke_capture_token',{method:'POST',headers:cloudHeaders(s,true),body:'{}'});cloudToken='';toast(r.ok?'Llave revocada':'No se pudo revocar');}catch(e){toast('Sin conexión');}
 rNube();
}
function cloudCopy(txt,label){
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){toast((label||'Texto')+' copiado ✓');},function(){toast('No se pudo copiar');});
 else toast('No se pudo copiar');
}
function cloudApplePayCard(){
 var url=CLOUD_URL+'/rest/v1/rpc/capture_expense';
 var steps=cloudToken
  ?'<div class="warn" style="margin-bottom:10px"><b>Copia tu llave ahora.</b> No se vuelve a mostrar. Si la pierdes, crea otra.</div>'
   +'<div class="dash-actions" style="margin:0 0 12px"><button onclick="cloudCopy(cloudToken,\'Llave\')">Copiar llave</button><button onclick="cloudCopy(\''+url+'\',\'Dirección\')">Copiar dirección</button><button onclick="cloudCopy(CLOUD_KEY,\'apikey\')">Copiar apikey</button></div>'
   +'<ol class="imp-steps"><li>En <b>Atajos → Automatización → +</b> elige <b>Transacción</b> (se activa al pagar con Apple Pay). Marca tus tarjetas y <b>Ejecutar inmediatamente</b>.</li>'
   +'<li>Añade la acción <b>Obtener contenido de la URL</b>. URL: la dirección copiada. Método: <b>POST</b>.</li>'
   +'<li>Encabezados: <code>apikey</code> = la apikey copiada, y <code>Content-Type</code> = <code>application/json</code>.</li>'
   +'<li>Cuerpo de la solicitud: <b>JSON</b>, con estos campos de tipo <b>Texto</b>: <code>token</code> = tu llave, <code>amount</code> = la variable <b>Cantidad</b>, <code>merchant</code> = la variable <b>Comerciante</b>, <code>currency</code> = <code>USD</code>. Opcional: <code>card</code> = la variable de la tarjeta.</li></ol>'
   +'<p class="note" style="padding-bottom:0">Los nombres de las variables cambian un poco según la versión de iOS. Usa exactamente esos nombres de campo en inglés: el servidor los exige.</p>'
  :'<p class="note" style="padding-top:0">Cada pago con Apple Pay llega a tu nube y lo confirmas aquí en la app. Primero crea la llave del atajo.</p>';
 return '<div class="sec">Apple Pay</div><div class="card">'+steps
  +'<div class="dash-actions" style="margin:12px 0 0"><button onclick="cloudMakeToken()">'+(cloudToken?'Crear otra llave':'Crear llave del atajo')+'</button><button onclick="cloudRevokeToken()">Revocar</button><button onclick="go(\'inbox\')">Ver pendientes'+(inboxCount()?' ('+inboxCount()+')':'')+'</button></div></div>';
}
TITLES.inbox='Pendientes';SUBS.inbox=1;
