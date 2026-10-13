/* Metas de ahorro. Son un apartado: no restan de ninguna cuenta ni cuentan como gasto. */
function metaSaved(g){return (g.log||[]).reduce(function(s,x){return s+Number(x.amount||0);},0);}
function metaWeeks(g){
 if(!g.deadline)return null;
 var days=(Date.parse(g.deadline+'T12:00:00')-Date.parse(today()+'T12:00:00'))/86400000;
 return Math.max(1,Math.ceil(days/7));
}
function rMetas(){
 var tot=D.goals.reduce(function(s,g){return s+toUSD(metaSaved(g),g.currency);},0);
 var meta=D.goals.reduce(function(s,g){return s+toUSD(g.target,g.currency);},0);
 el('s-metas').innerHTML=
  '<div class="dash-intro"><div class="eyebrow">Ahorro</div><h1>Tus metas.</h1><p>Aparta plata para algo concreto y mira cuánto falta. Es un registro: no mueve tus cuentas.</p></div>'
  +(D.goals.length?'<div class="hero"><div class="hero-l">Apartado en total</div><div class="hero-v num g">'+money(tot)+'</div><div class="hero-s">de '+money(meta)+' en metas · '+(meta?Math.round(tot/meta*100):0)+'%</div></div>':'')
  +'<div class="dash-actions"><button onclick="sheetMeta()">+ Nueva meta</button></div>'
  +(D.goals.length?D.goals.map(function(g){
    var s=metaSaved(g),pct=g.target>0?Math.min(100,s/g.target*100):0,left=Math.max(0,g.target-s),w=metaWeeks(g);
    var hint=left<=0?'¡Meta cumplida!':(w?'Necesitas '+fmt(Math.ceil(left/w),g.currency)+' por semana ('+w+(w===1?' semana':' semanas')+')':'Faltan '+fmt(left,g.currency));
    return '<div class="card" style="margin-bottom:10px"><div style="display:flex;align-items:center;gap:12px"><div class="ico" style="background:var(--card2)">'+esc(g.emoji||'🎯')+'</div>'
     +'<div class="row-m"><div class="row-t">'+esc(g.name)+'</div><div class="row-s">'+fmt(s,g.currency)+' de '+fmt(g.target,g.currency)+(g.deadline?' · para '+dayLabel(g.deadline):'')+'</div></div>'
     +'<div class="row-v num '+(left<=0?'g':'')+'">'+Math.round(pct)+'%</div></div>'
     +'<div class="track"><div class="fill" style="width:'+pct.toFixed(1)+'%;background:var(--grn)"></div></div>'
     +'<div class="note" style="padding-bottom:10px">'+hint+'</div>'
     +'<div class="dash-actions" style="margin:0"><button onclick="sheetAporte(\''+g.id+'\')">+ Aportar</button><button onclick="sheetMeta(\''+g.id+'\')">Editar</button></div></div>';
   }).join(''):'<div class="empty"><div class="e">🎯</div><div class="t">Aún no tienes metas</div><div class="s">Crea una para el pasaje, la mudanza o el fondo de emergencia</div></div>');
}
function sheetMeta(id){
 var g=id?D.goals.filter(function(x){return x.id===id;})[0]:null;_cur=g?g.currency:'USD';
 sheet(g?'Editar meta':'Nueva meta',
  fText('f-gname','Nombre',g?g.name:'','Mudanza a Colombia, fondo de emergencia…')
  +fAmount(g?g.target:null,_cur).replace('oninput="fitAmt(this);updWeek()"','oninput="fitAmt(this)"')
  +fText('f-gemoji','Emoji',g?g.emoji:'🎯')
  +fText('f-gdate','Fecha objetivo (opcional)',g?g.deadline:'','','date'),
  (g?'<button class="btn dg" onclick="delMeta(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveMeta('+(id?'\''+id+'\'':'null')+')">Guardar</button>');
}
function saveMeta(id){
 var n=val('f-gname'),a=num('f-amount');if(!n||!a||a<=0)return toast('Falta el nombre o el monto de la meta');
 var g=id?D.goals.filter(function(x){return x.id===id;})[0]:null;
 if(!g){g={id:uid(),log:[]};D.goals.push(g);}
 g.name=n;g.target=a;g.currency=_cur;g.emoji=val('f-gemoji')||'🎯';
 var dl=val('f-gdate');if(dl)g.deadline=dl;else delete g.deadline;
 save();closeSheet();refresh();toast('Meta guardada ✓');
}
function delMeta(id){if(!confirm('¿Eliminar esta meta y sus aportes?'))return;D.goals=D.goals.filter(function(x){return x.id!==id;});save();closeSheet();refresh();toast('Eliminada');}
function sheetAporte(id){
 var g=D.goals.filter(function(x){return x.id===id;})[0];if(!g)return;_cur=g.currency;
 sheet('Aportar a '+esc(g.name),'<div class="note">Usa un monto negativo para retirar.</div>'+fAmount(null,g.currency).replace('oninput="fitAmt(this);updWeek()"','oninput="fitAmt(this)"')+fText('f-date','Fecha',today(),'','date'),
  '<button class="btn" onclick="saveAporte(\''+id+'\')">Guardar</button>',function(){el('f-amount').focus();});
}
function saveAporte(id){
 var g=D.goals.filter(function(x){return x.id===id;})[0],a=num('f-amount'),dt=val('f-date');
 if(!g||!a||!dt)return toast('Falta monto o fecha');
 g.log=g.log||[];g.log.push({id:uid(),date:dt,amount:a});save();closeSheet();refresh();toast('Aporte guardado ✓');
}
TITLES.metas='Metas';SUBS.metas=1;
