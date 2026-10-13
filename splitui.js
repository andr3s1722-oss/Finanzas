/* Split: gastos compartidos al estilo Splitwise. Saldos siempre relativos a ti, por moneda. */
var _sp=null,_saldo=null;
function spFmt(a,c){return c==='COP'?'COP '+mask(Math.round(Math.abs(a)).toLocaleString('es-CO')):money(Math.abs(a));}
function spPerson(id){return id==='me'?{id:'me',name:'Yo'}:D.people.filter(function(p){return p.id===id;})[0]||{id:id,name:'(borrado)'};}
function spName(id){return spPerson(id).name;}
function spBalText(bal){
 var keys=Object.keys(bal||{}).filter(function(c){return Math.abs(bal[c])>=0.005;});
 if(!keys.length)return '<span style="color:var(--tx3)">Al día</span>';
 return keys.map(function(c){
  var v=bal[c];
  return '<span class="num '+(v>0?'g':'r')+'">'+(v>0?'te debe ':'le debes ')+spFmt(Math.abs(v),c)+'</span>';
 }).join('<br>');
}
function spEntryRow(e,viewer){
 var cur=e.currency||'USD';
 if(e.kind==='pago'){
  var mine=e.from==='me';
  return '<div class="row" onclick="spOpenEntry(\''+e.id+'\')"><div class="ico" style="background:#0F7A461f">🤝</div><div class="row-m"><div class="row-t">'+(mine?'Pagaste a '+esc(spName(e.to)):esc(spName(e.from))+' te pagó')+'</div><div class="row-s">Saldo · '+dayLabel(e.date)+'</div></div><div class="row-v num '+(mine?'':'g')+'">'+spFmt(e.amount,cur)+'</div></div>';
 }
 var share=Split.myShare(e),payerMe=e.payer==='me';
 var effect=payerMe?(e.amount-share):-share;
 return '<div class="row" onclick="spOpenEntry(\''+e.id+'\')"><div class="ico" style="background:'+(CATS[e.category]||CATS.Otros).c+'1f">'+(CATS[e.category]||CATS.Otros).e+'</div><div class="row-m"><div class="row-t">'+esc(e.desc)+'</div><div class="row-s">'+(payerMe?'Pagaste tú':'Pagó '+esc(spName(e.payer)))+' · '+spFmt(e.amount,cur)+' · '+dayLabel(e.date)+'</div></div><div class="row-v num '+(effect>=0?'g':'r')+'">'+(effect>=0?'+':'−')+spFmt(Math.abs(effect),cur)+'<span class="sub">'+(effect>=0?'te deben':'debes')+'</span></div></div>';
}
function spOpenEntry(id){
 var e=D.splits.filter(function(x){return x.id===id;})[0];if(!e)return;
 if(e.kind==='pago')sheetSaldo(null,id);else sheetSplit(id);
}
function rSplit(){
 var bal=Split.balances(D),t=Split.totalsUSD(D,fx());
 var people=D.people.map(function(p){
  var b=bal[p.id]||{},hist=Split.involving(D,p.id).slice().sort(function(a,c){return c.date.localeCompare(a.date);});
  return '<details class="card sp-person"><summary><span class="sp-av">'+esc((p.name||'?').charAt(0).toUpperCase())+'</span><span class="row-m"><span class="row-t" style="display:block">'+esc(p.name)+'</span><span class="row-s" style="display:block">'+hist.length+' movimientos</span></span><span class="row-v" style="font-size:13px">'+spBalText(b)+'</span></summary>'
   +'<div class="sp-body"><div class="dash-actions" style="margin-top:0"><button onclick="sheetSaldo(\''+p.id+'\')">Saldar cuentas</button><button onclick="sheetPersona(\''+p.id+'\')">Editar</button></div>'
   +(hist.length?'<div class="list">'+hist.map(function(e){return spEntryRow(e);}).join('')+'</div>':'<div class="note">Aún no hay movimientos.</div>')+'</div></details>';
 }).join('');
 var recent=D.splits.slice().sort(function(a,c){return c.date.localeCompare(a.date);}).slice(0,8);
 el('s-split').innerHTML=
  '<div class="dash-intro"><div class="eyebrow">Gastos compartidos</div><h1>Cuentas claras.</h1><p>Anota quién pagó y entre quiénes se divide. Tu parte cuenta como gasto tuyo.</p></div>'
  +'<div class="hero"><div class="hero-l">Saldo neto</div><div class="hero-v num '+(t.net<0?'r':'g')+'">'+(t.net>=0?'+':'')+money(t.net)+'</div>'
  +'<div class="hero-s">'+(t.net>0.005?'En total te deben':t.net<-0.005?'En total debes':'Todo al día')+' · COP al cambio de '+fx()+'</div>'
  +'<div class="hero-row"><div class="hero-chip"><div class="l">Te deben</div><div class="v num g">'+money(t.owed)+'</div></div><div class="hero-chip"><div class="l">Debes</div><div class="v num r">'+money(t.owe)+'</div></div><div class="hero-chip"><div class="l">Personas</div><div class="v num">'+D.people.length+'</div></div></div></div>'
  +'<div class="dash-actions"><button onclick="sheetSplit()">+ Gasto compartido</button><button onclick="sheetPersona()">+ Persona</button></div>'
  +'<div class="sec">Personas</div>'
  +(people||'<div class="empty"><div class="e">👥</div><div class="t">Aún no hay nadie</div><div class="s">Agrega a un amigo para empezar a dividir</div></div>')
  +(recent.length?'<div class="sec">Últimos movimientos</div><div class="card" style="padding:6px 14px"><div class="list">'+recent.map(function(e){return spEntryRow(e);}).join('')+'</div></div>':'')
  +'<div class="note" style="padding-top:12px">El saldo con cada persona se lleva aparte por moneda (USD y COP). Si tú pagaste, solo tu parte entra a tus gastos y lo que te deben suma a tu patrimonio como por cobrar; si pagó otra persona, lo que debes resta. Saldar cuentas no es un gasto.</div>';
}
/* personas */
function sheetPersona(id,thenSplit){
 var p=id?spPerson(id):null;
 sheet(p?'Editar persona':'Nueva persona',fText('f-pname','Nombre',p?p.name:'','Andy, Sasha…'),
  (p?'<button class="btn dg" onclick="delPersona(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="savePersona('+(id?'\''+id+'\'':'null')+','+(thenSplit?'true':'false')+')">Guardar</button>');
}
function savePersona(id,thenSplit){
 var n=val('f-pname');if(!n)return toast('Falta el nombre');
 if(D.people.some(function(p){return p.id!==id&&p.name.toLowerCase()===n.toLowerCase();}))return toast('Ya existe '+n);
 if(id)spPerson(id).name=n;else{var np={id:uid(),name:n};D.people.push(np);}
 save();closeSheet();if(thenSplit)sheetSplit();else{refresh();}toast('Guardado ✓');
}
function delPersona(id){
 if(Split.involving(D,id).length)return toast('Tiene movimientos: elimínalos o sáldalos primero');
 if(!confirm('¿Eliminar a '+spName(id)+'?'))return;
 D.people=D.people.filter(function(p){return p.id!==id;});save();closeSheet();refresh();toast('Eliminado');
}
/* gasto compartido */
function sheetSplit(id){
 if(!D.people.length){toast('Primero agrega a una persona');return sheetPersona(null,true);}
 var e=id?D.splits.filter(function(x){return x.id===id;})[0]:null;
 _cur=e?(e.currency||'USD'):monedaInicial();_curManual=!!e;_cat=e?(e.category||'Restaurante'):'Restaurante';_catManual=!!e;_spread=1;
 _sp={id:id||null,payer:e?e.payer:'me',who:{},exact:{},mode:'igual',record:e?!!e.expenseId:true};
 if(e){
  e.parts.forEach(function(p){_sp.who[p.who]=true;_sp.exact[p.who]=p.share;});
  var eq=Split.equal(e.amount,e.parts.map(function(p){return p.who;}));
  _sp.mode=eq.every(function(q,i){return Math.abs(q.share-e.parts[i].share)<0.011;})?'igual':'montos';
 }else{_sp.who.me=true;D.people.forEach(function(p){_sp.who[p.id]=true;});}
 sheet(e?'Editar gasto compartido':'Gasto compartido',
  fAmount(e?e.amount:null,_cur)+fText('f-desc','Descripción',e?e.desc:'','Cena, Airbnb, Uber…',null,'oninput="autoCat()"')
  +fText('f-date','Fecha',e?e.date:today(),'','date')
  +'<div id="sp-box"></div>'+catGrid(_cat),
  (e?'<button class="btn dg" onclick="delSplit(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveSplit()">Guardar</button>',
  function(){spBox();if(!e)el('f-amount').focus();});
}
function spAll(){return [{id:'me',name:'Yo'}].concat(D.people);}
function spCapture(){
 if(!_sp||_sp.mode!=='montos')return;
 spAll().forEach(function(p){var i=el('sp-m-'+p.id);if(i)_sp.exact[p.id]=i.value;});
}
function spBox(){
 var box=el('sp-box');if(!box||!_sp)return;
 box.innerHTML=
  '<div class="f"><label>Pagó</label><div class="sp-who">'+spAll().map(function(p){
   return '<button class="chip '+(_sp.payer===p.id?'on':'')+'" onclick="spPayer(\''+p.id+'\')">'+esc(p.name)+'</button>';}).join('')+'</div></div>'
  +'<div class="f"><label>Se divide entre</label><div class="sp-who">'+spAll().map(function(p){
   return '<button class="chip '+(_sp.who[p.id]?'on':'')+'" aria-pressed="'+!!_sp.who[p.id]+'" onclick="spToggle(\''+p.id+'\')">'+esc(p.name)+'</button>';}).join('')+'</div></div>'
  +'<div class="seg mini"><button class="'+(_sp.mode==='igual'?'on':'')+'" onclick="spMode(\'igual\')">Partes iguales</button><button class="'+(_sp.mode==='montos'?'on':'')+'" onclick="spMode(\'montos\')">Montos exactos</button></div>'
  +'<div id="sp-parts"></div>'
  +'<div class="f"><label>Tus cuentas</label><div class="sp-who"><button class="chip '+(_sp.record?'on':'')+'" aria-pressed="'+!!_sp.record+'" onclick="spRecord()">Contar mi parte como gasto mío</button></div></div>';
 spPreview();
}
function spPayer(id){spCapture();_sp.payer=id;spBox();}
function spToggle(id){spCapture();_sp.who[id]=!_sp.who[id];spBox();}
function spMode(m){spCapture();_sp.mode=m;spBox();}
function spRecord(){spCapture();_sp.record=!_sp.record;spBox();}
function spIds(){return spAll().map(function(p){return p.id;}).filter(function(i){return _sp.who[i];});}
function spPreview(){
 var h=el('sp-parts');if(!h||!_sp)return;
 var ids=spIds(),a=parseMonto((el('f-amount')||{}).value);if(isNaN(a))a=0;
 if(_sp.mode==='igual'){
  var parts=Split.equal(a,ids);
  h.innerHTML=ids.length?'<div class="sp-sum">'+parts.map(function(p){return esc(spName(p.who))+' '+spFmt(p.share,_cur);}).join(' · ')+'</div>':'<div class="sp-sum bad">Elige al menos una persona</div>';
  return;
 }
 h.innerHTML=ids.map(function(i){
  var v=_sp.exact[i];if(v==null||v==='')v=ids.length?(Split.equal(a,ids).filter(function(p){return p.who===i;})[0]||{share:''}).share:'';
  _sp.exact[i]=v;
  return '<div class="sp-amt"><label for="sp-m-'+i+'">'+esc(spName(i))+'</label><input id="sp-m-'+i+'" inputmode="decimal" value="'+esc(v)+'" oninput="spSum()"></div>';}).join('')+'<div id="sp-total" class="sp-sum"></div>';
 spSum();
}
function spSum(){
 var t=el('sp-total');if(!t)return;
 var a=parseMonto(el('f-amount').value);if(isNaN(a))a=0;
 var sum=0;spIds().forEach(function(i){var v=parseMonto((el('sp-m-'+i)||{}).value);if(!isNaN(v))sum+=v;});
 var left=Split.cents(a-sum);
 t.className='sp-sum'+(Math.abs(left)>0.01?' bad':'');
 t.textContent=Math.abs(left)<=0.01?'Suma exacta ✓':(left>0?'Faltan ':'Sobran ')+spFmt(Math.abs(left),_cur);
}
var _updWeekBase=updWeek;
updWeek=function(){_updWeekBase();if(_sp&&el('sp-box')){if(_sp.mode==='igual')spPreview();else spSum();}};
function saveSplit(){
 spCapture();
 var a=num('f-amount'),d=val('f-desc'),dt=val('f-date'),ids=spIds();
 if(!a||!d||!dt)return toast('Falta monto, descripción o fecha');
 if(!ids.length)return toast('Elige entre quiénes se divide');
 if(!_curManual&&_cur==='USD'&&parecePesos(d,a,_cat,el('f-amount').value)){_cur='COP';toast('Lo guardé en pesos (COP): '+a.toLocaleString('es-CO')+' parece pesos.');}
 if(!confirmarMonto(a,_cur,'gasto'))return;
 if(ids.length===1&&ids[0]===_sp.payer)return toast('Elige también a otra persona: quien pagó no se debe a sí mismo');
 var parts;
 if(_sp.mode==='igual')parts=Split.equal(a,ids);
 else{
  parts=ids.map(function(i){var v=parseMonto(_sp.exact[i]);return {who:i,share:isNaN(v)?0:Split.cents(v)};});
  var sum=parts.reduce(function(s,p){return s+p.share;},0);
  if(Math.abs(sum-a)>0.01)return toast('Los montos suman '+spFmt(Split.cents(sum),_cur)+', no '+spFmt(a,_cur));
 }
 var e=_sp.id?D.splits.filter(function(x){return x.id===_sp.id;})[0]:null;
 if(!e){e={id:uid(),kind:'gasto'};D.splits.push(e);recordarMoneda(_cur);}
 e.date=dt;e.desc=d;e.amount=a;e.currency=_cur;e.category=_cat;e.payer=_sp.payer;e.parts=parts;
 var mine=Split.myShare(e),ex=e.expenseId?D.expenses.filter(function(x){return x.id===e.expenseId;})[0]:null;
 if(_sp.record&&mine>0){
  if(!ex){ex={id:uid(),spread:1};D.expenses.push(ex);e.expenseId=ex.id;}
  ex.date=dt;ex.desc=d;ex.amount=mine;ex.currency=_cur;ex.category=_cat;ex.splitId=e.id;
 }else if(ex){D.expenses=D.expenses.filter(function(x){return x.id!==ex.id;});delete e.expenseId;}
 save();closeSheet();_sp=null;refresh();toast('Gasto compartido guardado ✓');
}
function delSplit(id){
 if(!confirm('¿Eliminar este gasto compartido? También se quita tu parte de tus gastos.'))return;
 var e=D.splits.filter(function(x){return x.id===id;})[0];
 if(e&&e.expenseId)D.expenses=D.expenses.filter(function(x){return x.id!==e.expenseId;});
 D.splits=D.splits.filter(function(x){return x.id!==id;});save();closeSheet();_sp=null;refresh();toast('Eliminado');
}
/* saldar cuentas */
function sheetSaldo(personId,entryId){
 var e=entryId?D.splits.filter(function(x){return x.id===entryId;})[0]:null;
 var pid=e?(e.from==='me'?e.to:e.from):personId,bal=(Split.balances(D)[pid])||{};
 var cur=e?(e.currency||'USD'):(Object.keys(bal).sort(function(a,b){return Math.abs(bal[b])-Math.abs(bal[a]);})[0]||'USD');
 _cur=cur;_sp=null;
 _saldo={pid:pid,id:e?e.id:null,dir:e?(e.from==='me'?'pago':'cobro'):((bal[cur]||0)<0?'pago':'cobro')};
 var sug=e?e.amount:(bal[cur]?Math.abs(bal[cur]):null);
 sheet(e?'Editar saldo':'Saldar con '+esc(spName(pid)),
  '<div class="note" style="padding-bottom:12px">Ahora: '+spBalText(bal)+'</div>'
  +'<div class="seg mini"><button id="sd-cobro" class="'+(_saldo.dir==='cobro'?'on':'')+'" onclick="sdDir(\'cobro\')">Me pagó</button><button id="sd-pago" class="'+(_saldo.dir==='pago'?'on':'')+'" onclick="sdDir(\'pago\')">Le pagué</button></div>'
  +fAmount(sug,cur)+fText('f-date','Fecha',e?e.date:today(),'','date'),
  (e?'<button class="btn dg" onclick="delSplit(\''+e.id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveSaldo()">Guardar</button>');
}
function sdDir(d){_saldo.dir=d;el('sd-cobro').classList.toggle('on',d==='cobro');el('sd-pago').classList.toggle('on',d==='pago');}
function saveSaldo(){
 var a=num('f-amount'),dt=val('f-date');if(!a||!dt)return toast('Falta monto o fecha');
 var e=_saldo.id?D.splits.filter(function(x){return x.id===_saldo.id;})[0]:null;
 if(!e){e={id:uid(),kind:'pago'};D.splits.push(e);}
 e.date=dt;e.amount=a;e.currency=_cur;
 e.from=_saldo.dir==='pago'?'me':_saldo.pid;e.to=_saldo.dir==='pago'?_saldo.pid:'me';
 save();closeSheet();_saldo=null;refresh();toast('Saldo registrado ✓');
}
TITLES.split='Split';SUBS.split=1;
