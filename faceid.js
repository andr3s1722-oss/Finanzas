/* Desbloqueo con Face ID / Touch ID (WebAuthn con autenticador de plataforma).
   Es una puerta LOCAL: cualquier verificación ocurre en el dispositivo, no en un servidor.
   Evita teclear la clave, pero no cifra los datos guardados. */
var FACE_KEY='finanzas_faceid_v1',FACE_RELOCK_MS=60000,faceHiddenAt=0;
function faceB64(buf){var s='',b=new Uint8Array(buf);for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function faceUnb64(t){t=String(t).replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';var s=atob(t),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}
function faceRandom(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return a;}
function faceOn(){return !!sGet(FACE_KEY);}
function faceLockMsg(t){var e=el('lock-err');if(e)e.textContent=t||'';}
function faceShowButton(){var b=el('lock-face');if(b)b.style.display=faceOn()?'block':'none';}
async function faceEnable(){
 if(!(window.PublicKeyCredential&&navigator.credentials&&navigator.credentials.create))return toast('Este navegador no permite Face ID aquí');
 try{
  var cred=await navigator.credentials.create({publicKey:{
   rp:{name:'Finanzas',id:location.hostname},
   user:{id:faceRandom(16),name:'finanzas',displayName:'Finanzas'},
   challenge:faceRandom(32),
   pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
   authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},
   timeout:60000,attestation:'none'}});
  if(!cred||!cred.rawId)throw new Error('sin credencial');
  sSet(FACE_KEY,faceB64(cred.rawId));
  toast('Face ID activado ✓');
 }catch(e){toast(e&&e.name==='NotAllowedError'?'Se canceló Face ID':'No se pudo activar Face ID en este dispositivo');}
 if(screen==='ajustes')rAjustes();
}
function faceDisable(){sDel(FACE_KEY);faceShowButton();toast('Face ID desactivado');if(screen==='ajustes')rAjustes();}
async function faceUnlock(){
 var id=sGet(FACE_KEY);if(!id)return false;
 try{
  var r=await navigator.credentials.get({publicKey:{challenge:faceRandom(32),allowCredentials:[{type:'public-key',id:faceUnb64(id),transports:['internal']}],userVerification:'required',rpId:location.hostname,timeout:60000}});
  if(r){faceLockMsg('');entrar();return true;}
 }catch(e){}
 faceLockMsg('No se pudo verificar. Toca el botón o usa tu clave.');
 return false;
}
/* Al volver a la app tras más de un minuto fuera, vuelve a pedir Face ID (solo si está activado). */
function faceLockNow(){
 if(!faceOn())return;
 var i=el('lock-in');if(i)i.value='';
 faceLockMsg('');faceShowButton();el('lock').style.display='flex';faceUnlock();
}
function faceVisibility(hidden,now){
 now=now||Date.now();
 if(hidden){faceHiddenAt=now;return false;}
 var away=faceHiddenAt?now-faceHiddenAt:0;faceHiddenAt=0;
 if(faceOn()&&away>FACE_RELOCK_MS&&window.__started){faceLockNow();return true;}
 return false;
}
function faceInit(){
 faceShowButton();
 document.addEventListener('visibilitychange',function(){faceVisibility(document.visibilityState==='hidden');});
 if(faceOn()&&ssGet('a$_ok')!=='1')faceUnlock();
}
function faceCard(){
 var on=faceOn();
 return '<div class="sec">Seguridad</div><div class="card"><div style="display:flex;align-items:center;gap:12px"><div class="ico" style="background:var(--card2)">🔐</div><div class="row-m"><div class="row-t">Entrar con Face ID</div><div class="row-s">'+(on?'Activado en este dispositivo':'Evita teclear la clave al abrir')+'</div></div></div>'
  +'<div class="dash-actions" style="margin:12px 0 0"><button onclick="'+(on?'faceDisable()':'faceEnable()')+'">'+(on?'Desactivar':'Activar Face ID')+'</button></div>'
  +'<div class="note" style="padding:10px 0 0">Se activa por separado en cada dispositivo y en la app instalada. La clave sigue funcionando como respaldo. Es un candado de la app: no cifra tus datos.'+(on?' Se vuelve a pedir si sales de la app más de un minuto.':'')+'</div></div>';
}
