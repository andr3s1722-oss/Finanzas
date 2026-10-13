/* Flujo: balance y destino del dinero por semana o mes. Reemplaza la vista semanal original. */
var flowMode='semana', flowAnchor=null, flowScope='Todos';
function flowRange(){return Finance.range(flowMode,flowAnchor||today());}
function flowLabel(r,mode){
 if(mode==='mes')return monthLabel(r.start.slice(0,7));
 return etiquetaSemana(r.start)+' · '+r.start.slice(0,4);
}
function flowSet(mode){flowMode=mode;flowAnchor=today();rSemanal();}
function flowShift(n){
 var next=Finance.shift(flowMode,flowAnchor||today(),n);
 if(Finance.range(flowMode,next).start>Finance.range(flowMode,today()).start)return;
 flowAnchor=next;rSemanal();
}
function flowJump(date){flowAnchor=date;rSemanal();window.scrollTo(0,0);}
function flowScopeSet(a){flowScope=a;rSemanal();}
function flowDelta(now,before,word,partial){
 if(!before)return '';
 if(partial)return 'Llevas '+money(now)+' · '+word+' cerró en '+money(before);
 var diff=now-before,pct=Math.abs(diff/before*100);
 if(pct<1)return 'Gastaste igual que '+word;
 return 'Gastaste '+money(Math.abs(diff))+' ('+Math.round(pct)+'%) '+(diff>0?'más':'menos')+' que '+word;
}
function flowCatRows(sp,prev){
 if(!sp.byCategory.length)return '<div class="empty"><div class="e">🗂</div><div class="t">Sin gastos en este periodo</div></div>';
 var prevBy={};prev.byCategory.forEach(function(c){prevBy[c.name]=c.value;});
 return sp.byCategory.map(function(c){
  var meta=CATS[c.name]||CATS.Otros,pct=sp.spent?c.value/sp.spent*100:0,before=prevBy[c.name]||0;
  var diff=c.value-before,tag=before?(Math.abs(diff)<0.5?'':'<span class="'+(diff>0?'r':'g')+'"> '+(diff>0?'↑':'↓')+money(Math.abs(diff))+'</span>'):'<span style="color:var(--tx3)"> nuevo</span>';
  var items=c.items.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(o){return {k:'e',o:o};});
  return '<details class="flow-cat"><summary><span class="ico" style="background:'+meta.c+'1f">'+meta.e+'</span>'
   +'<span class="flow-cat-m"><span class="row-t">'+esc(c.name)+'</span>'
   +'<span class="track" style="margin:6px 0 0"><span class="fill" style="display:block;width:'+pct.toFixed(1)+'%;background:'+meta.c+'"></span></span></span>'
   +'<span class="row-v num">'+money(c.value)+'<span class="sub">'+Math.round(pct)+'%'+tag+'</span></span></summary>'
   +movRows(items)+'</details>';
 }).join('');
}
function flowBars(sp,mode){
 var mx=1;sp.days.forEach(function(d){mx=Math.max(mx,d.in,d.out);});
 var todayS=today();
 return '<div class="flow-bars '+mode+'">'+sp.days.map(function(d,i){
  var lbl=mode==='mes'?((i+1)%5===0||i===0?String(+d.date.slice(8,10)):''):'DLMXJVS'.charAt(new Date(d.date+'T12:00:00').getDay());
  return '<div class="flow-col'+(d.date===todayS?' now':'')+'" title="'+d.date+'">'
   +'<div class="flow-stack"><i style="height:'+(d.in/mx*100).toFixed(1)+'%;background:var(--grn)"></i><i style="height:'+(d.out/mx*100).toFixed(1)+'%;background:var(--red)"></i></div>'
   +'<span>'+lbl+'</span></div>';
 }).join('')+'</div>';
}
function flowHistory(){
 var keys={};
 D.income.concat(D.expenses,D.cafe_hours).forEach(function(o){keys[Finance.range(flowMode,o.date).start]=1;});
 keys[Finance.range(flowMode,today()).start]=1;
 var cur=flowRange().start;
 return Object.keys(keys).sort().reverse().slice(0,flowMode==='mes'?24:20).map(function(start){
  var r=Finance.range(flowMode,start),s=Finance.span(D,r.start,r.end,flowScope);
  return '<button class="row flow-hist'+(start===cur?' on':'')+'" onclick="flowJump(\''+start+'\')">'
   +'<div class="row-m"><div class="row-t">'+flowLabel(r,flowMode)+'</div><div class="row-s">Entró '+money(s.received)+' · salió '+money(s.spent)+'</div></div>'
   +'<div class="row-v num '+(s.net<0?'r':'g')+'">'+(s.net>=0?'+':'')+money(s.net)+'</div></button>';
 }).join('');
}
function flowSnapshot(){
 function card(mode,title){
  var r=Finance.range(mode,today()),pr=Finance.range(mode,Finance.shift(mode,today(),-1));
  var s=Finance.span(D,r.start,r.end),top=s.byCategory[0];
  return '<button class="tile flow-snap" onclick="flowMode=\''+mode+'\';flowAnchor=today();go(\'semanal\')"><div class="l">'+title+'</div>'
   +'<div class="v num '+(s.net<0?'r':'g')+'">'+(s.net>=0?'+':'')+money(s.net)+'</div>'
   +'<div class="s">Entró '+money(s.received)+' · salió '+money(s.spent)+'</div>'
   +'<div class="s" style="margin-top:6px">'+(top?(CATS[top.name]||CATS.Otros).e+'\u00a0'+esc(top.name)+' '+money(top.value):'Sin gastos')+'</div></button>';
 }
 return '<div class="sec">Balance<button onclick="go(\'semanal\')">Ver flujo ›</button></div><div class="grid2">'+card('semana','Esta semana')+card('mes','Este mes')+'</div>';
}
function rSemanal(){
 if(!flowAnchor)flowAnchor=today();
 var r=flowRange(),sp=Finance.span(D,r.start,r.end,flowScope);
 var pr=Finance.range(flowMode,Finance.shift(flowMode,flowAnchor,-1)),prev=Finance.span(D,pr.start,pr.end,flowScope);
 var word=flowMode==='mes'?'el mes anterior':'la semana anterior';
 var isNow=r.start===Finance.range(flowMode,today()).start;
 var top=sp.byCategory[0],rate=sp.received>0?Math.round(sp.net/sp.received*100):null;
 var days=flowMode==='mes'&&isNow?+today().slice(8,10):sp.days.length;
 if(flowMode==='semana'&&isNow)days=Math.max(1,sp.days.filter(function(d){return d.date<=today();}).length);
 var perDay=sp.spent/days;
 var hours=sp.income.filter(function(o){return o.generatedSalary;}).reduce(function(s,o){return s+o.hours;},0);
 el('s-semanal').innerHTML=
  '<div class="seg mini"><button class="'+(flowMode==='semana'?'on':'')+'" onclick="flowSet(\'semana\')">Semana</button><button class="'+(flowMode==='mes'?'on':'')+'" onclick="flowSet(\'mes\')">Mes</button></div>'
  +areaChips(flowScope,'flowScopeSet')
  +'<div class="mp"><button onclick="flowShift(-1)" aria-label="Anterior">‹</button><div class="lbl">'+flowLabel(r,flowMode)+'</div><button onclick="flowShift(1)" aria-label="Siguiente">›</button></div>'
  +'<div class="hero"><div class="hero-l">Balance · '+(flowScope==='Todos'?'todas las áreas':flowScope)+'</div>'
  +'<div class="hero-v num '+(sp.net<0?'r':'g')+'">'+(sp.net>=0?'+':'')+money(sp.net)+'</div>'
  +'<div class="hero-s">'+flowDelta(sp.spent,prev.spent,word,isNow)+'</div>'
  +'<div class="hero-row flow-three"><div class="hero-chip"><div class="l">Entró</div><div class="v num g">'+money(sp.received)+'</div></div>'
  +'<div class="hero-chip"><div class="l">Salió</div><div class="v num r">'+money(sp.spent)+'</div></div>'
  +'<div class="hero-chip"><div class="l">'+(rate==null?'Por día':'Ahorro')+'</div><div class="v num">'+(rate==null?money(perDay):rate+'%')+'</div></div></div></div>'
  +'<div class="card" style="margin-top:12px">'+flowBars(sp,flowMode)
  +'<div class="flow-leg"><span><i style="background:var(--grn)"></i>Entró</span><span><i style="background:var(--red)"></i>Salió</span><span class="num">Promedio '+money(perDay)+'/día</span></div></div>'
  +'<div class="sec">A dónde se va tu dinero</div>'
  +(top?'<div class="note" style="padding-bottom:10px">Lo que más pesa: <b>'+esc(top.name)+'</b> con '+Math.round(top.value/sp.spent*100)+'% de lo que gastaste.'+(hours?' Trabajaste '+hours+' h.':'')+' Toca una categoría para ver cada gasto.</div>':'')
  +'<div class="card flow-cats">'+flowCatRows(sp,prev)+'</div>'
  +(sp.byMerchant.length?'<div class="sec">Dónde más gastas</div><div class="card" style="padding:6px 14px"><div class="list">'+sp.byMerchant.slice(0,6).map(function(m){
    return '<div class="row"><div class="row-m"><div class="row-t">'+esc(m.name)+'</div><div class="row-s">'+m.count+(m.count===1?' compra':' compras')+'</div></div><div class="row-v num">'+money(m.value)+'</div></div>';}).join('')+'</div></div>':'')
  +'<div class="sec">De dónde entra</div>'
  +(sp.bySource.length?'<div class="card" style="padding:6px 14px"><div class="list">'+sp.bySource.slice(0,8).map(function(m){
    var pct=sp.received?m.value/sp.received*100:0;
    return '<div class="row"><div class="row-m"><div class="row-t">'+esc(m.name)+'</div><div class="track" style="margin:6px 0 0"><div class="fill" style="width:'+pct.toFixed(1)+'%;background:var(--grn)"></div></div></div><div class="row-v num g">+'+money(m.value)+'<span class="sub">'+Math.round(pct)+'%</span></div></div>';}).join('')+'</div></div>'
   :'<div class="empty"><div class="e">💵</div><div class="t">Sin ingresos en este periodo</div></div>')
  +'<div class="dash-actions">'+(workHoras()?'<button onclick="editHora()">+ Turno</button>':'')+'<button onclick="openAdd(\'ingreso\')">+ Ingreso</button><button onclick="openAdd(\'gasto\')">+ Gasto</button></div>'
  +'<div class="sec">Historial · '+(flowMode==='mes'?'meses':'semanas')+'</div><div class="card" style="padding:6px 14px"><div class="list">'+flowHistory()+'</div></div>'
  +'<div class="note" style="padding-top:12px">Lunes a domingo, en USD. Ingresos incluyen horas × tarifa, propinas y otros cobros (las propinas ligadas se cuentan una vez). Los gastos salen completos en su fecha de pago; si los repartiste en varias semanas, el presupuesto sí los reparte. Las partes de gastos compartidos se cuentan como tu gasto.</div>';
}
TITLES.semanal='Flujo';

/* Patrimonio en el tiempo: una foto por día desde que se abre la app. */
function snapNW(){
 var nw=Math.round(totals().nw*100)/100,t=today();D.history=D.history||[];
 var last=D.history[D.history.length-1];
 if(last&&last.d===t){if(Math.abs(last.nw-nw)<0.5)return;last.nw=nw;}
 else D.history.push({d:t,nw:nw});
 if(D.history.length>800)D.history=D.history.slice(-800);
 save();
}
/* Solo lectura: dibujar la tarjeta nunca modifica los datos. La foto del día se guarda al abrir la app. */
function nwCard(){
 var h=(D.history||[]).filter(function(x){return x.d<today();}).concat([{d:today(),nw:Math.round(totals().nw*100)/100}]);
 if(h.length<2)return '<div class="note" style="padding:0 2px 12px">Tu patrimonio se irá dibujando aquí: guardo una foto cada día que abres la app.</div>';
 var vals=h.map(function(x){return x.nw;}),mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),span=(mx-mn)||1;
 var pts=h.map(function(x,i){return (i/(h.length-1)*100).toFixed(2)+','+(38-(x.nw-mn)/span*34).toFixed(2);});
 var diff=vals[vals.length-1]-vals[0];
 return '<div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:baseline"><div class="sec" style="margin:0">Patrimonio</div><span class="num '+(diff>=0?'g':'r')+'" style="font-size:12px;font-weight:700">'+(diff>=0?'+':'−')+money(Math.abs(diff))+' desde '+dayLabel(h[0].d)+'</span></div>'
  +'<svg viewBox="0 0 100 42" preserveAspectRatio="none" style="width:100%;height:64px;display:block;margin-top:10px"><polyline points="'+pts.join(' ')+'" fill="none" stroke="'+(diff>=0?'var(--grn)':'var(--red)')+'" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg></div>';
}
