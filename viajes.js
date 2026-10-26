/* Viajes: cada viaje lleva sus gastos aparte de tu presupuesto personal (área «Viajes»), con su ciudad en el mapa y sus fechas. */
var curViaje=null,_mv=null;
var VIAJE_PALABRAS=/hotel|tiquete|vuelo|bus\b|airbnb|hostal|maleta|peaje|aeropuerto|airport|avion|flight/i;
function viajeGastos(id){return D.expenses.filter(function(e){return e.tripId===id;});}
function viajeTotal(id){return sumUSD(viajeGastos(id));}
function viajesSinAsignar(){return D.expenses.filter(function(e){return Finance.area(e)==='Viajes'&&!e.tripId;});}
function viajeTitulo(v){return v.city||v.name;}
function viajeNoches(v){return v.start&&v.end?Math.max(0,Finance.daysBetween(v.start,v.end)):null;}
function viajeDias(v){var n=viajeNoches(v);return n==null?(v.start?1:null):n+1;}
function viajeCuando(v,hoy){
 hoy=hoy||today();if(!v.start)return {t:'',c:''};
 var s=v.start,e=v.end||v.start;
 if(hoy<s){var d=Finance.daysBetween(hoy,s);return {t:d===1?'mañana':'en '+d+' días',c:'soon'};}
 if(hoy<=e)return {t:'¡ahora mismo!',c:'now'};
 var d2=Finance.daysBetween(e,hoy);
 return {t:d2<14?'hace '+d2+(d2===1?' día':' días'):(d2<60?'hace '+Math.round(d2/7)+' sem':'hace '+Math.round(d2/30)+' meses'),c:'past'};
}
/* Fecha como hoja de calendario */
function calBadge(ds){
 if(!ds)return '';var a=ds.split('-');
 return '<span class="cal"><i>'+MS[+a[1]-1].toUpperCase()+'</i><b>'+(+a[2])+'</b></span>';
}
function viajeFechasHtml(v){
 if(!v.start)return '<span class="trip-nodate">sin fechas</span>';
 var n=viajeNoches(v);
 return calBadge(v.start)+(v.end&&v.end!==v.start?'<span class="cal-arrow">→</span>'+calBadge(v.end):'')+(n!=null&&n>0?'<em class="trip-noches">'+n+(n===1?' noche':' noches')+'</em>':'');
}
function viajeFechas(v){
 if(!v.start)return 'sin fechas';
 var a=v.start.split('-'),txt=(+a[2])+' '+MS[+a[1]-1].toLowerCase();
 if(v.end&&v.end!==v.start){var b=v.end.split('-');txt+=' – '+(+b[2])+' '+MS[+b[1]-1].toLowerCase();}
 return txt+' '+a[0];
}
function viajeMini(v){
 return typeof v.lat==='number'?mapaSvg([v],{aspect:1,minW:100,cls:'mapa-mini',ruta:false,pin:2.6,label:'Mapa de '+viajeTitulo(v)}):'<span class="trip-globe">🌍</span>';
}
function viajePasaporte(viajes){
 var ciudades={},paises={},dias=0;
 viajes.forEach(function(v){if(typeof v.lat==='number'){ciudades[v.city||v.name]=1;if(v.country)paises[v.country]=1;}dias+=viajeDias(v)||0;});
 return {ciudades:Object.keys(ciudades).length,paises:Object.keys(paises).length,dias:dias};
}
function rViajes(){
 var viajes=D.trips.slice().sort(function(a,b){return String(b.start||'').localeCompare(String(a.start||''));});
 var total=sumUSD(D.expenses.filter(function(e){return Finance.area(e)==='Viajes';}));
 var sin=viajesSinAsignar(),pas=viajePasaporte(viajes),conPin=viajes.filter(function(v){return typeof v.lat==='number';});
 var anio='',lista=viajes.map(function(v){
  var y=(v.start||'').slice(0,4),cab=(y&&y!==anio&&viajes.length>2)?'<div class="trip-year">'+y+'</div>':'';if(y)anio=y;
  var g=viajeGastos(v.id),t=viajeTotal(v.id),dias=viajeDias(v),cu=viajeCuando(v);
  return cab+'<button class="trip" onclick="verViaje(\''+v.id+'\')"><span class="trip-map">'+viajeMini(v)+'</span>'
   +'<span class="trip-body"><span class="trip-city">'+(v.flag?esc(v.flag)+' ':'')+esc(viajeTitulo(v))+'</span>'
   +(v.city&&v.name&&v.name!==v.city?'<span class="trip-sub">'+esc(v.name)+'</span>':'')
   +'<span class="trip-dates">'+viajeFechasHtml(v)+'</span></span>'
   +'<span class="trip-cost"><b class="num">'+money(t)+'</b><small>'+(dias&&t?money(t/dias)+'/día':g.length+(g.length===1?' gasto':' gastos'))+'</small></span>'
   +(cu.t?'<span class="trip-when '+cu.c+'">'+cu.t+'</span>':'')+'</button>';
 }).join('');
 el('s-viajes').innerHTML='<div class="dash-intro"><div class="eyebrow">Fuera del presupuesto del día a día</div><h1>Viajes.</h1></div>'
  +'<div class="map-card">'+mapaSvg(conPin,{aspect:1.75,minW:90,cls:'mapa-grande',etiquetas:true,click:'verViaje',pin:1.7})
  +'<div class="map-over"><span class="map-title">'+(conPin.length?'Tu mapa':'Tu mapa de viajes')+'</span>'+(conPin.length?'':'<span class="map-hint">Pon la ciudad de un viaje y aparece aquí</span>')+'</div></div>'
  +'<div class="pasaporte"><div><b>'+pas.ciudades+'</b><span>'+(pas.ciudades===1?'ciudad':'ciudades')+'</span></div><div><b>'+pas.paises+'</b><span>'+(pas.paises===1?'país':'países')+'</span></div><div><b>'+pas.dias+'</b><span>días de viaje</span></div><div><b class="num">'+kmoney(total)+'</b><span>gastado</span></div></div>'
  +'<div class="dash-actions"><button onclick="sheetViaje()">+ Nuevo viaje</button></div>'
  +(lista||'<div class="empty"><div class="e">🧳</div><div class="t">Aún no tienes viajes</div><div class="s">Crea uno y mueve ahí los gastos del viaje</div></div>')
  +(sin.length?'<div class="sec">Gastos de viaje sin asignar</div><div class="card" style="padding:6px 14px">'+movRows(sin.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(e){return {k:'e',o:e};}))+'</div>':'');
}
/* Resumen: mapa compacto de tus viajes; toca para abrir la sección */
function viajesCard(){
 var conPin=(D.trips||[]).filter(function(v){return typeof v.lat==='number';});
 if(!conPin.length)return '';
 var pas=viajePasaporte(D.trips);
 return '<div class="sec">Viajes · '+pas.ciudades+(pas.ciudades===1?' ciudad':' ciudades')+'</div><div class="map-card" role="button" tabindex="0" onclick="go(\'viajes\')">'+mapaSvg(conPin,{aspect:1.75,minW:90,cls:'mapa-grande',etiquetas:true,pin:1.7})+'</div>';
}
function verViaje(id){
 curViaje=id;var v=D.trips.filter(function(x){return x.id===id;})[0];
 TITLES.viaje=v?viajeTitulo(v):'Viaje';SUBS.viaje=1;go('viaje');
}
function viajePorDia(v,g){
 if(!v.start||!v.end)return '';
 var n=viajeDias(v);if(!n||n<2||n>31)return '';
 var dias=[],mx=0;
 for(var i=0;i<n;i++){var d=Finance.plus(v.start,i),t=sumUSD(g.filter(function(e){return e.date===d;}));dias.push({d:d,t:t});mx=Math.max(mx,t);}
 var pico=dias.reduce(function(a,b){return b.t>a.t?b:a;},dias[0]);
 return '<div class="sec">Día por día</div><div class="card"><div class="trip-bars">'+dias.map(function(x){
  var wd='DLMXJVS'.charAt(new Date(x.d+'T12:00:00').getDay());
  return '<div class="tb'+(x===pico&&x.t>0?' peak':'')+'" title="'+x.d+'"><i style="height:'+(mx?Math.max(x.t>0?6:2,x.t/mx*100):2).toFixed(0)+'%"></i><span>'+(+x.d.slice(8))+'</span><em>'+wd+'</em></div>';
 }).join('')+'</div>'+(pico.t>0?'<div class="note" style="padding:10px 0 0">Tu día más caro fue el '+dayLabel(pico.d)+': '+money(pico.t)+'.</div>':'')+'</div>';
}
function rViaje(){
 var v=D.trips.filter(function(x){return x.id===curViaje;})[0];if(!v){go('viajes');return;}
 var g=viajeGastos(v.id).sort(function(a,b){return b.date.localeCompare(a.date);}),total=sumUSD(g),dias=viajeDias(v),cu=viajeCuando(v);
 var cats={};g.forEach(function(e){cats[e.category]=(cats[e.category]||0)+toUSD(e.amount,e.currency);});
 var items=Object.keys(cats).map(function(k){return {n:k,v:cats[k]};}).sort(function(a,b){return b.v-a.v;});
 var caro=g.length?g.reduce(function(a,b){return toUSD(b.amount,b.currency)>toUSD(a.amount,a.currency)?b:a;}):null;
 el('s-viaje').innerHTML='<div class="map-card big">'+(typeof v.lat==='number'?mapaSvg([v],{aspect:1.5,minW:120,cls:'mapa-grande',pin:1.7,label:'Mapa de '+viajeTitulo(v)}):'<div class="map-empty">🌍<span>Ponle una ciudad al viaje para verlo en el mapa</span></div>')
  +'<div class="map-over bottom"><span class="map-city">'+(v.flag?esc(v.flag)+' ':'')+esc(viajeTitulo(v))+'</span>'+(v.country?'<span class="map-country">'+esc(v.country)+'</span>':'')+'</div></div>'
  +'<div class="trip-head"><div class="trip-dates big">'+viajeFechasHtml(v)+'</div>'+(cu.t?'<span class="trip-when '+cu.c+'">'+cu.t+'</span>':'')+'</div>'
  +(v.city&&v.name&&v.name!==v.city?'<div class="note" style="padding:0 2px 12px;font-size:14px;color:var(--tx)">'+esc(v.emoji||'✈️')+' '+esc(v.name)+'</div>':'')
  +'<div class="grid2"><div class="tile"><div class="l">Total</div><div class="v num">'+money(total)+'</div><div class="s">'+g.length+(g.length===1?' gasto':' gastos')+'</div></div>'
  +'<div class="tile"><div class="l">Por día</div><div class="v num">'+(dias&&total?money(total/dias):'—')+'</div><div class="s">'+(dias?dias+(dias===1?' día':' días'):'sin fechas')+'</div></div></div>'
  +'<div class="dash-actions"><button onclick="viajeAgregar(\''+v.id+'\')">+ Gasto del viaje</button><button onclick="sheetMover(\''+v.id+'\')">Mover gastos existentes</button><button onclick="sheetViaje(\''+v.id+'\')">Editar</button></div>'
  +viajePorDia(v,g)
  +(items.length?'<div class="sec">En qué se fue</div><div class="card" style="padding:6px 14px"><div class="list">'+items.map(function(it){var m=CATS[it.n]||CATS.Otros;return '<div class="row"><div class="ico" style="background:'+m.c+'1f">'+m.e+'</div><div class="row-m"><div class="row-t">'+esc(it.n)+'</div><div class="track" style="margin:6px 0 0"><div class="fill" style="width:'+(total?it.v/total*100:0).toFixed(1)+'%;background:'+m.c+'"></div></div></div><div class="row-v num">'+money(it.v)+'</div></div>';}).join('')+'</div></div>':'')
  +(caro&&g.length>1?'<div class="note" style="padding-top:10px">Lo más caro: <b>'+esc(caro.desc)+'</b> ('+money(toUSD(caro.amount,caro.currency))+').</div>':'')
  +'<div class="sec">Gastos</div><div class="card" style="padding:6px 14px">'+movRows(g.map(function(e){return {k:'e',o:e};}))+'</div>';
}
function sheetViaje(id){
 var v=id?D.trips.filter(function(x){return x.id===id;})[0]:null;
 sheet(v?'Editar viaje':'Nuevo viaje',
  fText('f-vjcity','¿A qué ciudad fue?',v?(v.city||''):'','Medellín, Chicago, Cartagena…',null,'list="vj-ciudades" oninput="viajeCiudadHint()" autocomplete="off"')
  +'<datalist id="vj-ciudades">'+CIUDADES.map(function(c){return '<option value="'+esc(c[0])+'">';}).join('')+'</datalist>'
  +'<div class="note" id="vj-hint" style="padding:0 2px 10px">'+(v&&v.city?'':'La ciudad se ubica sola en el mapa.')+'</div>'
  +fText('f-vjname','Nombre del viaje (opcional)',v?v.name:'','Entrega del Jetta, vacaciones…')
  +fText('f-vjemoji','Emoji',v?v.emoji:'✈️')
  +'<div class="f2">'+fText('f-vjstart','Salida',v?v.start:today(),'','date')+fText('f-vjend','Regreso',v?v.end:'','','date')+'</div>',
  (v?'<button class="btn dg" onclick="delViaje(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveViaje('+(id?'\''+id+'\'':'null')+')">Guardar</button>',
  function(){viajeCiudadHint();});
}
function viajeCiudadHint(){
 var h=document.getElementById('vj-hint');if(!h)return;var q=val('f-vjcity');
 if(!q){h.textContent='La ciudad se ubica sola en el mapa.';return;}
 var c=ciudadBuscar(q);h.textContent=c?'📍 '+c.city+', '+c.country+' '+c.flag:'No la tengo en la lista: la busco en línea al guardar.';
}
function saveViaje(id){
 var cityRaw=val('f-vjcity'),n=val('f-vjname'),s=val('f-vjstart'),e=val('f-vjend');
 if(!cityRaw&&!n)return toast('Escribe la ciudad o un nombre para el viaje');
 if(e&&s&&e<s)return toast('El regreso no puede ser antes de la salida');
 var v=id?D.trips.filter(function(x){return x.id===id;})[0]:null;
 if(!v){v={id:uid()};D.trips.push(v);}
 var found=cityRaw?ciudadBuscar(cityRaw):null;
 v.name=n||cityRaw;v.emoji=val('f-vjemoji')||'✈️';if(s)v.start=s;else delete v.start;if(e)v.end=e;else delete v.end;
 function ubicar(c){if(c){v.city=c.city;v.country=c.country;v.flag=c.flag;v.lat=c.lat;v.lon=c.lon;}else{delete v.lat;delete v.lon;delete v.flag;delete v.country;if(cityRaw)v.city=cityRaw;else delete v.city;}}
 ubicar(found);
 if(v.name===v.city&&n==='')v.name=v.city;
 save();closeSheet();if(screen==='viaje')TITLES.viaje=viajeTitulo(v);
 if(cityRaw&&!found){                     // fuera de la lista: se busca en línea y el pin aparece cuando llegue
  toast('Buscando «'+cityRaw+'» en el mapa…');
  ciudadGeocodificar(cityRaw).then(function(c){if(c){ubicar(c);save();toast('📍 '+c.city+', '+c.country+' ✓');}else toast('No encontré esa ciudad en el mapa: queda sin pin');refresh();});
 }else if(!id){toast('Viaje creado ✓ · ahora muévele sus gastos');sheetMover(v.id);return;}
 if(!id&&cityRaw&&!found)sheetMover(v.id);else refresh();
 if(id)toast('Guardado ✓');
}
function delViaje(id){
 if(!confirm('¿Eliminar este viaje? Sus gastos se conservan, pero quedan sin viaje asignado.'))return;
 D.trips=D.trips.filter(function(x){return x.id!==id;});D.expenses.forEach(function(e){if(e.tripId===id)delete e.tripId;});
 save();closeSheet();if(screen==='viaje')go('viajes');else refresh();toast('Viaje eliminado');
}
function viajeAgregar(id){openAdd('gasto');var a=el('f-area');if(a)a.value='Viajes';tripPick(id);}
/* Mover gastos que ya existen a un viaje: salen del presupuesto personal */
function sheetMover(id){
 var v=D.trips.filter(function(x){return x.id===id;})[0];if(!v)return;
 var lo=v.start?Finance.plus(v.start,-2):Finance.plus(today(),-30),hi=v.end?Finance.plus(v.end,2):today();
 var lista=D.expenses.filter(function(e){return e.tripId!==id&&e.date>=lo&&e.date<=hi;}).sort(function(a,b){return a.date.localeCompare(b.date);});
 _mv={id:id,sel:{}};
 lista.forEach(function(e){_mv.sel[e.id]=VIAJE_PALABRAS.test(e.desc)||Finance.area(e)==='Viajes';});
 sheet('Gastos de '+esc(v.name),
  '<div class="note" style="padding-top:0">Marca los gastos que fueron de este viaje. Dejan de contar en tu presupuesto personal. Ya marqué los que parecen de viaje (hotel, tiquetes, bus…): revisa el resto.</div>'
  +(lista.length?'<div class="card" style="padding:4px 12px">'+lista.map(function(e){
    return '<button class="row mv-row" onclick="mvToggle(\''+e.id+'\')"><span class="chk" id="mv-'+e.id+'">'+(_mv.sel[e.id]?'✓':'')+'</span><div class="row-m"><div class="row-t">'+esc(e.desc)+'</div><div class="row-s">'+dayLabel(e.date)+' · '+esc(e.category)+'</div></div><div class="row-v num">'+fmt(e.amount,e.currency)+'</div></button>';
   }).join('')+'</div>':'<div class="empty"><div class="t">No hay gastos en esas fechas</div><div class="s">Ajusta las fechas del viaje</div></div>'),
  '<button class="btn gh" onclick="closeSheet()">Ahora no</button><button class="btn" onclick="mvAplicar()">Mover</button>');
}
function mvToggle(eid){_mv.sel[eid]=!_mv.sel[eid];var c=el('mv-'+eid);if(c)c.textContent=_mv.sel[eid]?'✓':'';}
function mvAplicar(){
 var n=0;
 D.expenses.forEach(function(e){if(_mv.sel[e.id]){e.area='Viajes';e.tripId=_mv.id;n++;}});
 save();closeSheet();refresh();toast(n?n+(n===1?' gasto movido al viaje ✓':' gastos movidos al viaje ✓'):'No marcaste ningún gasto');
}
/* En el formulario de gasto: fila visible «Viaje» para no esconderla en «Más opciones» */
var _tripSel='';
function tripRowHtml(){
 return '<button class="chip'+(!_tripSel?' on':'')+'" aria-pressed="'+!_tripSel+'" onclick="tripPick(\'\')">Ninguno</button>'
  +D.trips.slice().sort(function(a,b){return String(b.start||'').localeCompare(String(a.start||''));}).slice(0,6).map(function(v){
   return '<button class="chip'+(_tripSel===v.id?' on':'')+'" aria-pressed="'+(_tripSel===v.id)+'" onclick="tripPick(\''+v.id+'\')">'+esc(v.emoji||'✈️')+' '+esc(v.name)+'</button>';}).join('')
  +'<button class="chip" onclick="tripNuevo()">+ Nuevo viaje</button>';
}
function tripChips(o){
 _tripSel=(o&&o.tripId)||'';
 return '<div class="f trip-f"><label>¿Es de un viaje?</label><div class="sp-who" id="trip-row">'+tripRowHtml()+'</div><div class="note" id="trip-note" style="padding:6px 2px 0">'+(_tripSel?'Va al viaje y sale de tu presupuesto personal.':'')+'</div></div>';
}
function tripRefresh(){var r=document.getElementById('trip-row');if(r)r.innerHTML=tripRowHtml();var n=document.getElementById('trip-note');if(n)n.textContent=_tripSel?'Va al viaje y sale de tu presupuesto personal.':'';}
function tripPick(id){_tripSel=id;tripRefresh();var a=document.getElementById('f-area');if(a&&id)a.value='Viajes';if(typeof updWeek==='function')updWeek();}
function tripNuevo(){
 var n=prompt('¿Cómo se llama el viaje? (por ejemplo: Cartagena)');if(!n||!n.trim())return;
 var v={id:uid(),name:n.trim().slice(0,40),emoji:'✈️',start:today()};D.trips.push(v);save();
 _tripSel=v.id;tripRefresh();toast('Viaje creado ✓ · ponle las fechas después en Viajes');
}
function tripVal(){return _tripSel;}
function storeTrip(o){if(_tripSel){o.tripId=_tripSel;o.area='Viajes';}else delete o.tripId;}
TITLES.viajes='Viajes';SUBS.viajes=1;TITLES.viaje='Viaje';SUBS.viaje=1;
