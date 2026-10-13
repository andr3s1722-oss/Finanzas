/* Sincronización en la nube: merge de 3 vías puro + motor con dependencias inyectadas (probable sin red). */
(function(root){
'use strict';
var KEY='finanzas_cloud_v1',TABLE='/rest/v1/user_data',RPC='/rest/v1/rpc/save_user_data';
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function clone(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
function isObj(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
function keyOf(a,b){
 var all=(a||[]).concat(b||[]);
 if(!all.every(isObj))return null;
 if(all.every(function(o){return o.id!=null;}))return 'id';
 if(all.every(function(o){return typeof o.d==='string';}))return 'd';
 return null;
}
/* Gana lo que cambió; si cambiaron ambos, gana lo local. */
function atomic(b,l,r){if(eq(l,b))return r;if(eq(r,b))return l;return l;}
function mergeValue(b,l,r){
 if(isObj(l)&&isObj(r))return mergeObject(b,l,r);
 if(Array.isArray(l)&&Array.isArray(r)){var k=keyOf(l,r);if(k&&(b===undefined||Array.isArray(b)))return mergeKeyed(b||[],l,r,k);}
 return atomic(b,l,r);
}
function mergeObject(b,l,r){
 b=isObj(b)?b:{};
 var out={},keys=Object.keys(l);
 Object.keys(r).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k);});
 Object.keys(b).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k);});
 keys.forEach(function(k){
  var v=(isObj(l[k])&&isObj(r[k]))||(Array.isArray(l[k])&&Array.isArray(r[k]))?mergeValue(b[k],l[k],r[k]):atomic(b[k],l[k],r[k]);
  if(v!==undefined)out[k]=clone(v);
 });
 return out;
}
function mergeKeyed(b,l,r,key){
 var bm={},lm={},rm={};
 b.forEach(function(o){if(isObj(o))bm[o[key]]=o;});l.forEach(function(o){lm[o[key]]=o;});r.forEach(function(o){rm[o[key]]=o;});
 var out=[],seen={};
 function add(id){
  if(seen[id])return;seen[id]=1;
  var bo=bm[id],lo=lm[id],ro=rm[id];
  if(lo&&ro){out.push(eq(lo,ro)?clone(lo):(isObj(lo)&&isObj(ro)?mergeObject(bo,lo,ro):atomic(bo,lo,ro)));}
  else if(lo){if(!bo||!eq(lo,bo))out.push(clone(lo));}          // añadido aquí, o editado aquí y borrado allá: se conserva
  else if(ro){if(!bo||!eq(ro,bo))out.push(clone(ro));}          // añadido allá, o editado allá y borrado aquí: se conserva
 }
 l.forEach(function(o){add(o[key]);});r.forEach(function(o){add(o[key]);});
 return out;
}
function merge(base,local,remote){return mergeObject(isObj(base)?base:{},local,remote);}

function create(deps){
 var st=load(),busy=false,timer=null,status={state:'idle',message:'',at:st.at||''};
 function load(){try{var v=JSON.parse(deps.storage.get(KEY));if(v&&typeof v==='object')return {version:Number(v.version)||0,base:v.base||'',at:v.at||''};}catch(e){}return {version:0,base:'',at:''};}
 function persist(){try{deps.storage.set(KEY,JSON.stringify(st));}catch(e){}}
 function set(state,message){status={state:state,message:message||'',at:st.at||''};if(deps.onStatus)deps.onStatus(status);}
 function headers(session){return {apikey:deps.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};}
 function fail(kind,message){var e=new Error(message||kind);e.kind=kind;return e;}
 function classify(r){
  var text=String(r.text||'');
  if(r.status===409||/version_conflict/.test(text))return fail('conflict','Cambios simultáneos');
  if(r.status===404||/PGRST205|PGRST202|42P01|does not exist|Could not find/.test(text))return fail('not-setup','Falta crear la tabla en Supabase');
  if(/42501|permission denied/.test(text))return fail('error','Faltan permisos en la tabla de la nube: ejecuta de nuevo el SQL de la migración (supabase/migrations)');
  var why=(r.data&&(r.data.message||r.data.msg||r.data.error_description||r.data.hint))||text.slice(0,120);
  if(/jwt expired|token.*expired|expired/i.test(text))return fail('auth','La sesión venció: vuelve a conectarte');
  if(r.status===401||r.status===403)return fail('auth','Supabase no aceptó la sesión ('+r.status+(why?': '+why:'')+')');
  if(/data_too_large/.test(text))return fail('error','Los datos son demasiado grandes para la nube');
  return fail('error','Error '+r.status+(why?': '+why:''));
 }
 async function call(url,options){
  var r;try{r=await deps.request(url,options);}catch(e){throw fail('offline','Sin conexión');}
  if(!r.ok)throw classify(r);
  return r;
 }
 async function remoteGet(session){
  var r=await call(deps.url+TABLE+'?select=data,version,updated_at,device',{headers:headers(session)});
  var row=Array.isArray(r.data)?r.data[0]:null;
  return row?{data:row.data,version:Number(row.version),updatedAt:row.updated_at,device:row.device}:null;
 }
 async function remoteSave(session,expected,data){
  var r=await call(deps.url+RPC,{method:'POST',headers:headers(session),body:JSON.stringify({expected_version:expected,new_data:data,device_name:deps.device?deps.device():null})});
  return Number(r.data);
 }
 function commit(version){st.version=version;st.base=JSON.stringify(deps.getData());st.at=deps.now?deps.now():new Date().toISOString();persist();set('ok','Sincronizado');}
 /* opts.force: 'push' sube esta copia y reemplaza la nube; 'pull' baja la nube y reemplaza este dispositivo. */
 async function sync(opts){
  opts=opts||{};
  if(busy)return status;
  busy=true;
  try{
   var session=await deps.getSession();
   if(!session){set('signed-out','Sin conectar');return status;}
   set('syncing','Sincronizando…');
   for(var attempt=0;attempt<4;attempt++){
    var remote=await remoteGet(session),local=deps.getData(),localStr=JSON.stringify(local);
    if(opts.force==='pull'){
     if(!remote)throw fail('error','La nube está vacía');
     deps.backup(localStr);deps.apply(clone(remote.data));commit(remote.version);return status;
    }
    if(!remote){commit(await remoteSave(session,0,local));return status;}
    if(opts.force==='push'){commit(await remoteSave(session,remote.version,local));return status;}
    var dirty=localStr!==st.base;
    if(remote.version===st.version){
     if(!dirty){set('ok','Sincronizado');return status;}
     try{commit(await remoteSave(session,remote.version,local));return status;}catch(e){if(e.kind==='conflict')continue;throw e;}
    }
    var merged=merge(st.base?JSON.parse(st.base):{},local,remote.data);
    if(!eq(merged,local)){deps.backup(localStr);deps.apply(clone(merged));}
    if(eq(merged,remote.data)){commit(remote.version);return status;}
    try{commit(await remoteSave(session,remote.version,deps.getData()));return status;}catch(e2){if(e2.kind==='conflict')continue;throw e2;}
   }
   throw fail('error','Demasiados cambios simultáneos: intenta de nuevo');
  }catch(e){
   var kind=e&&e.kind||'error';
   set(kind,e&&e.message||'Error');
   return status;
  }finally{busy=false;}
 }
 function touch(delay){if(busy)return;clearTimeout(timer);timer=setTimeout(function(){sync();},delay==null?4000:delay);}
 function forget(){st={version:0,base:'',at:''};persist();set('signed-out','Sin conectar');}
 return {sync:sync,touch:touch,forget:forget,status:function(){return status;},state:function(){return {version:st.version,at:st.at};},isBusy:function(){return busy;}};
}
var api={KEY:KEY,eq:eq,merge:merge,mergeValue:mergeValue,create:create};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Cloud=api;
})(typeof globalThis!=='undefined'?globalThis:this);
