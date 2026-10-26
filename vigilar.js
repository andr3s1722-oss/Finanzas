/* Alertas de gasto: te avisan al anotar algo de pádel, fría, etc. antes de pasarte, y cuando ya te pasaste. */
var WATCH_DEFAULTS=[
 {name:'Salidas (fría, Escobar, cover)',words:['fria','escobar','cover','trago','cerveza','bar'],cap:50,period:'mes'},
 {name:'Pádel',words:['padel','grip','torneo'],cap:30,period:'mes'}
];
var WATCH_NOTE_DEFAULT='Acuérdate: no gastar más de lo que ganas.';
function watchRules(){return D.settings.watch||[];}
function watchNote(){return D.settings.watchNote||WATCH_NOTE_DEFAULT;}
function watchPeriodo(r){return r.period==='semana'?'esta semana':'este mes';}
function gastoPersonalSemana(ws){
 return D.expenses.reduce(function(s,e){return Finance.area(e)!=='Personal'?s:s+weekPortion(e,ws);},0);
}
/* Calcula los avisos de un gasto (guardado o no). extraUSD = lo que se sumaría si aún no está guardado. */
function avisoInfo(e,extraUSD,guardado){
 var lines=[],level=0,fecha=e.date||today(),extra=guardado?0:(extraUSD||0);
 function add(lvl,txt){lines.push({lvl:lvl,txt:txt});if(lvl>level)level=lvl;}
 watchRules().forEach(function(r){
  if(!Finance.watchMatches(r,e.desc))return;
  var st=Finance.watchStatus(D,r,fecha,extra);
  var lvl=st.over?2:(st.near?1:0);
  add(lvl,esc(r.name)+': '+(guardado?'llevas ':'con esto llegas a ')+money(st.spent)+' de '+money(st.cap)+' '+watchPeriodo(r)+' ('+Math.round(st.pct)+'%) — '+(st.over?'te pasaste por '+money(-st.left):'te quedan '+money(st.left)));
 });
 var cap=Number((D.settings.budgets||{})[e.category])||0;
 if(cap>0){
  var m=monthOf(fecha),spent=gastoMesCat(e.category,m)+extra,pct=spent/cap*100;
  if(pct>=80)add(pct>100?2:1,esc(e.category)+': '+(guardado?'llevas ':'con esto llegas a ')+money(spent)+' de '+money(cap)+' este mes ('+Math.round(pct)+'%)'+(pct>100?' — te pasaste por '+money(spent-cap):''));
 }
 if(Finance.area(e)==='Personal'){
  var b=Finance.weeklyBudget(D);
  if(b>0){
   var ws=weekStartOf(fecha),sp=gastoPersonalSemana(ws)+(guardado?0:extra),p=sp/b*100;
   if(p>=80)add(p>100?2:1,'Esta semana: '+(guardado?'llevas ':'con esto llegas a ')+money(sp)+' de '+money(b)+' ('+Math.round(p)+'%)'+(p>100?' — te pasaste por '+money(sp-b):' — te quedan '+money(b-sp)));
  }
 }
 return {level:level,lines:lines};
}
/* Después de guardar: aviso fuerte si estás cerca o te pasaste; un toque breve si solo coincide con una regla. */
function avisoGasto(e){
 if(!e)return null;
 var info=avisoInfo(e,0,true);
 if(!info.lines.length)return info;
 if(info.level>=1){
  var titulo=info.level>=2?'Te pasaste 🚨':'Ya te vas a pasar 👀';
  sheet(titulo,
   info.lines.map(function(l){return '<div class="watch-line lvl'+l.lvl+'">'+l.txt+'</div>';}).join('')
   +'<div class="note" style="padding:10px 2px 0;font-size:14px;color:var(--tx)"><b>'+esc(watchNote())+'</b></div>',
   '<button class="btn" onclick="closeSheet()">Entendido</button>');
 }else toast(info.lines[0].txt.replace(/<[^>]*>/g,''));
 return info;
}
/* Mientras escribes: «con este gasto llegas a…» */
function watchHint(){
 var box=document.getElementById('watch-hint');if(!box)return;
 var d=el('f-desc')?val('f-desc'):'',raw=el('f-amount')?parseMonto(el('f-amount').value):NaN;
 if(!d||isNaN(raw)||raw<=0){box.style.display='none';return;}
 var usd=toUSD(raw,_cur),e={desc:d,category:_cat,date:el('f-date')?val('f-date')||today():today(),area:el('f-area')?val('f-area'):'',amount:raw,currency:_cur};
 if(Finance.area(e)!=='Personal'&&!watchRules().some(function(r){return Finance.watchMatches(r,d);})){box.style.display='none';return;}
 var info=avisoInfo(e,usd,false);
 if(!info.lines.length){box.style.display='none';return;}
 box.className='watch-hint lvl'+info.level;box.style.display='block';
 box.innerHTML=info.lines.map(function(l){return '<div>'+(l.lvl>=2?'🚨 ':(l.lvl===1?'⚠️ ':'· '))+l.txt+'</div>';}).join('');
}
var _updWeekWatch=updWeek;
updWeek=function(){_updWeekWatch();if(document.getElementById('watch-hint'))watchHint();};
/* Pantalla de reglas (dentro de Presupuesto) */
function watchCard(){
 var rules=watchRules();
 var rows=rules.map(function(r){
  var st=Finance.watchStatus(D,r,today()),col=st.over?'var(--red)':(st.near?'var(--org)':'var(--grn)');
  return '<div style="margin-bottom:14px" onclick="sheetWatch(\''+r.id+'\')"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px"><span style="flex:1;font-size:13.5px;font-weight:600">'+esc(r.name)+'</span><span class="num" style="font-size:12.5px">'+money(st.spent)+' / '+money(st.cap)+'</span></div>'
   +'<div class="track" style="margin:0"><div class="fill" style="width:'+Math.min(100,st.pct).toFixed(0)+'%;background:'+col+'"></div></div>'
   +'<div style="font-size:11px;color:var(--tx3);margin-top:4px">'+esc((r.words||[]).join(', '))+' · '+(r.period==='semana'?'por semana':'por mes')+'</div></div>';
 }).join('');
 return '<div class="sec">Alertas de gasto</div><div class="card"><p class="note" style="padding-top:0">Cada vez que anotes algo con estas palabras te avisamos cuánto llevas, y cuando estés cerca del tope o te pases.</p>'
  +(rows||'<div class="note" style="padding:0 0 8px">Aún no tienes reglas.</div>')
  +'<div class="dash-actions" style="margin:6px 0 10px"><button onclick="sheetWatch()">+ Regla</button>'+(rules.length?'':'<button onclick="watchSugeridas()">Crear las sugeridas</button>')+'</div>'
  +fText('f-watchnote','Tu recordatorio',watchNote(),WATCH_NOTE_DEFAULT,null,'onchange="guardarWatchNote()"')+'</div>';
}
function guardarWatchNote(){var v=val('f-watchnote');if(v&&v!==WATCH_NOTE_DEFAULT)D.settings.watchNote=v;else delete D.settings.watchNote;save();toast('Recordatorio guardado ✓');}
function watchSugeridas(){D.settings.watch=WATCH_DEFAULTS.map(function(r){return {id:uid(),name:r.name,words:r.words.slice(),cap:r.cap,period:r.period};});save();refresh();toast('Reglas creadas ✓ · ajústalas cuando quieras');}
var _wp='mes';
function sheetWatch(id){
 var r=id?watchRules().filter(function(x){return x.id===id;})[0]:null;
 _cur='USD';_curManual=true;_wp=r?r.period:'mes';
 sheet(r?'Editar regla':'Nueva regla',
  fText('f-wname','Nombre',r?r.name:'','Pádel, salidas, domicilios…')
  +fText('f-wwords','Palabras (separadas por coma)',r?(r.words||[]).join(', '):'','padel, grip, torneo')
  +'<div class="f"><label>Tope</label><div class="seg mini" id="w-per"><button data-p="mes" class="'+(_wp==='mes'?'on':'')+'" onclick="wPer(\'mes\')">Por mes</button><button data-p="semana" class="'+(_wp==='semana'?'on':'')+'" onclick="wPer(\'semana\')">Por semana</button></div></div>'
  +fAmount(r?r.cap:null,'USD')
  +'<div class="note">El tope es en dólares. Te avisamos al 80% y cuando te pases. Las palabras no distinguen tildes ni mayúsculas.</div>',
  (r?'<button class="btn dg" onclick="delWatch(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveWatch('+(id?'\''+id+'\'':'null')+')">Guardar</button>');
}
function wPer(p){_wp=p;document.querySelectorAll('#w-per button').forEach(function(b){b.classList.toggle('on',b.dataset.p===p);});}
function saveWatch(id){
 var n=val('f-wname'),w=val('f-wwords').split(',').map(function(x){return x.trim();}).filter(Boolean),a=num('f-amount');
 if(!n)return toast('Ponle un nombre');if(!w.length)return toast('Escribe al menos una palabra');if(!(a>0))return toast('Escribe el tope');
 D.settings.watch=D.settings.watch||[];
 var r=id?D.settings.watch.filter(function(x){return x.id===id;})[0]:null;
 if(!r){r={id:uid()};D.settings.watch.push(r);}
 r.name=n;r.words=w;r.cap=Math.round(toUSD(a,_cur)*100)/100;r.period=_wp;
 save();closeSheet();refresh();toast('Regla guardada ✓');
}
function delWatch(id){if(!confirm('¿Eliminar esta regla?'))return;D.settings.watch=watchRules().filter(function(x){return x.id!==id;});save();closeSheet();refresh();toast('Eliminada');}
