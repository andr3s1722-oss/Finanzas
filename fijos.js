/* Gastos fijos: arriendo, servicios, carro, gimnasio… (las suscripciones tienen su propia pantalla). Avisan cuándo pagar y descuentan del presupuesto. */
var BILL_TEMPLATES=[['🏠','Arriendo','Vivienda'],['💡','Luz, agua o gas','Servicios'],['📶','Internet o celular','Servicios'],['🚗','Cuota del carro','Transporte'],['🛡️','Seguro del carro','Servicios'],['🏋️','Gimnasio','Salud'],['🏢','Administración','Vivienda'],['📦','Otro gasto fijo','Otros']];
function billFreqText(b){return (FREQ.filter(function(x){return x[0]===b.freq;})[0]||['',''])[1]+' · '+srcFreqText(b);}
function billsMonthlyUSD(){return sumUSD(D.bills,function(b){return Finance.billMonthly(b);});}
function billsPaidMonthUSD(m){return sumUSD(D.expenses.filter(function(e){return e.fixedId&&monthOf(e.date)===m;}));}
function pendienteFijos(m){return Finance.billsPendingMonth(D,m||monthOf(today()),D.settings.budgets);}
/* Tarjeta del Resumen */
function fijosCard(){
 var pend=Finance.pendingBills(D,today());
 if(!pend.length){
  var n=Finance.nextBill(D,today());
  if(!n)return '';
  var days=Finance.daysBetween(today(),n.date);
  return '<div class="note" style="padding:0 2px 12px">Próximo gasto fijo: <b>'+esc(n.bill.name)+'</b> el '+dayLabel(n.date)+' ('+(days===1?'mañana':'en '+days+' días')+') · '+fmt(n.bill.amount,n.bill.currency)+'</div>';
 }
 return '<div class="card" style="margin-bottom:14px"><div class="sec" style="margin:0 0 6px">¿Ya pagaste?</div>'+pend.map(function(p){
  var meta=CATS[p.bill.category]||CATS.Otros;
  return '<div class="row"><div class="ico" style="background:'+meta.c+'1f">'+meta.e+'</div><div class="row-m"><div class="row-t">'+esc(p.bill.name)+'</div><div class="row-s">'+dayLabel(p.date)+' · '+esc(p.bill.category)+'</div></div><div class="row-v num">−'+fmt(p.bill.amount,p.bill.currency)+'</div></div>'
   +'<div class="dash-actions" style="margin:0 0 8px"><button onclick="confirmarBill(\''+p.bill.id+'\',\''+p.date+'\')">Sí, ya pagué</button><button onclick="omitirBill(\''+p.bill.id+'\',\''+p.date+'\')">Omitir</button></div>';
 }).join('')+'</div>';
}
function confirmarBill(id,dt){
 var b=D.bills.filter(function(x){return x.id===id;})[0];if(!b)return;
 if(D.expenses.some(function(e){return e.fixedId===id&&e.fixedDate===dt;}))return;
 // un gasto mensual pesa en el presupuesto semanal repartido en 4 semanas; uno quincenal, en 2
 D.expenses.push({id:uid(),date:dt,desc:b.name,amount:b.amount,currency:b.currency,category:b.category,spread:b.freq==='mensual'?4:(b.freq==='quincenal'?2:1),fixedId:id,fixedDate:dt});
 save();refresh();toast('Gasto guardado ✓ · si el monto cambió, edítalo en Movimientos');
}
function omitirBill(id,dt){var b=D.bills.filter(function(x){return x.id===id;})[0];if(!b)return;b.skipped=(b.skipped||[]).concat([dt]);save();refresh();}
/* Pantalla */
function rFijos(){
 var m=monthOf(today()),esperado=billsMonthlyUSD(),pagado=billsPaidMonthUSD(m),subs=totalSuscripcionesMes(m);
 var lista=D.bills.map(function(b){
  var meta=CATS[b.category]||CATS.Otros;
  return '<div class="row" onclick="sheetBill(\''+b.id+'\')"><div class="ico" style="background:'+meta.c+'1f">'+meta.e+'</div><div class="row-m"><div class="row-t">'+esc(b.name)+'</div><div class="row-s">'+esc(b.category)+' · '+billFreqText(b)+'</div></div><div class="row-v num">'+fmt(b.amount,b.currency)+'</div></div>';
 }).join('');
 el('s-fijos').innerHTML='<div class="dash-intro"><div class="eyebrow">Lo que pagas siempre</div><h1>Gastos fijos.</h1><p>Arriendo, servicios, carro, gimnasio… Te avisamos cuando toca pagar y los descontamos de tu presupuesto.</p></div>'
  +'<div class="hero"><div class="hero-l">Gastos fijos al mes</div><div class="hero-v num">'+money(esperado+subs)+'</div><div class="hero-s">'+money(esperado)+' en gastos fijos + '+money(subs)+' en suscripciones</div>'
  +'<div class="hero-row flow-three"><div class="hero-chip"><div class="l">Pagado</div><div class="v num g">'+money(pagado)+'</div></div><div class="hero-chip"><div class="l">Falta</div><div class="v num r">'+money(Math.max(0,esperado-pagado))+'</div></div><div class="hero-chip"><div class="l">Fijos</div><div class="v num">'+D.bills.length+'</div></div></div></div>'
  +fijosCard()
  +'<div class="sec">Agregar</div><div class="chips" style="margin-bottom:12px">'+BILL_TEMPLATES.map(function(t,i){return '<button class="chip" onclick="sheetBill(null,'+i+')">'+t[0]+' '+t[1]+'</button>';}).join('')+'<button class="chip" onclick="go(\'subs\')">🔁 Suscripción</button></div>'
  +(lista?'<div class="card" style="padding:6px 14px"><div class="list">'+lista+'</div></div>':'<div class="empty"><div class="e">🧾</div><div class="t">Aún no tienes gastos fijos</div><div class="s">Toca uno de arriba para empezar</div></div>')
  +'<div class="note" style="padding-top:12px">Cuando llega el día, la app te pregunta si ya pagaste y lo anota con un toque. Los gastos mensuales pesan en tu presupuesto semanal repartidos en 4 semanas. Las suscripciones (Netflix, apps…) se llevan en <b>Suscripciones</b>.</div>';
}
/* Crear o editar */
function sheetBill(id,tpl,after){
 var b=id?D.bills.filter(function(x){return x.id===id;})[0]:null,t=(tpl!=null&&BILL_TEMPLATES[tpl])||null;
 _src={kind:'bill',freq:b?b.freq:'mensual',weekday:b?Number(b.weekday):5,after:after||null};
 _cur=b?b.currency:(D.settings.mainCurrency||monedaInicial());_curManual=true;_cat=b?b.category:(t?t[2]:'Servicios');_catManual=false;
 sheet(b?'Editar gasto fijo':'Nuevo gasto fijo',
  fText('f-srcname','Nombre',b?b.name:(t?(t[1]==='Otro gasto fijo'?'':t[1]):''),'Arriendo, Tigo, Claro, gimnasio…',null,'oninput="billAutoCat()"')
  +fAmount(b?b.amount:null,_cur)
  +catGrid(_cat)+'<div class="note" id="bill-hint" style="padding:0 2px 10px"></div>'
  +'<div class="f"><label>¿Cada cuánto lo pagas?</label><div class="seg mini" id="src-freq">'+FREQ.map(function(x){return '<button data-f="'+x[0]+'" class="'+(_src.freq===x[0]?'on':'')+'" onclick="srcFreq(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div></div>'
  +'<div id="src-days"></div>'
  +fText('f-srcstart','Desde','','','date')
  +'<div class="note">Te preguntamos el día que toca pagar para anotarlo con un toque. Si el mes es más corto, el día 30 se ajusta al último día.</div>',
  (b?'<button class="btn dg" onclick="delBill(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveBill('+(id?'\''+id+'\'':'null')+')">Guardar</button>',
  function(){el('f-srcstart').value=b&&b.start?b.start:today();srcDays(b);billHint();});
}
/* Al escribir el nombre, la app reconoce qué es: Tigo/Claro = Servicios, Claude/Netflix = Suscripciones… */
function billAutoCat(){
 if(!_catManual){var c=detectarCat(val('f-srcname'));if(c&&c!==_cat)marcarCat(c);}
 billHint();
}
function billHint(){
 var h=el('bill-hint');if(!h)return;
 h.textContent=_cat==='Suscripciones'?'Parece una suscripción: se guarda en Suscripciones, se cobra cada mes y se descuenta de tu presupuesto.':'';
}
function saveBill(id){
 var name=val('f-srcname'),a=num('f-amount'),start=val('f-srcstart');
 if(!name)return toast('Ponle un nombre');
 if(!(a>0))return toast('Escribe cuánto pagas');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return toast('Falta la fecha de inicio');
 var b=id?D.bills.filter(function(x){return x.id===id;})[0]:null,days=null,day=null;
 function dd(v){var n=parseInt(v,10);return (n>=1&&n<=31)?n:NaN;}
 if(_src.freq==='quincenal'){var d1=dd(val('f-srcd1')),d2=dd(val('f-srcd2'));if(isNaN(d1)||isNaN(d2))return toast('Los días de pago van de 1 a 31');days=[d1,d2].sort(function(x,y){return x-y;});}
 else if(_src.freq==='mensual'){day=dd(val('f-srcday'));if(isNaN(day))return toast('El día de pago va de 1 a 31');}
if(!confirmarMonto(a,_cur,'gasto'))return;
 if(_cat==='Suscripciones'){                 // las suscripciones tienen su propio registro (se cuentan por mes)
  var mensual=Finance.billMonthly({amount:a,freq:_src.freq});
  if(b)D.bills=D.bills.filter(function(x){return x.id!==b.id;});
  D.subscriptions.push({id:uid(),name:name,amount:Math.round(mensual*100)/100,currency:_cur,activeFrom:start,activeUntil:null,note:''});
  recordarMoneda(_cur);save();closeSheet();
  if(_src.after){var g=_src.after;_src.after=null;g();}else{refresh();toast('Guardada en Suscripciones ✓');}
  return;
 }
 if(!b){b={id:uid(),skipped:[]};D.bills.push(b);}
 b.name=name;b.amount=a;b.currency=_cur;b.category=_cat;b.freq=_src.freq;b.start=start;
 delete b.days;delete b.day;delete b.weekday;
 if(days)b.days=days;if(day)b.day=day;if(_src.freq==='semanal')b.weekday=_src.weekday;
 recordarMoneda(_cur);save();closeSheet();
 if(_src.after){var f=_src.after;_src.after=null;f();}else{refresh();toast('Guardado ✓');}
}
function delBill(id){if(!confirm('¿Eliminar este gasto fijo? Los pagos ya anotados se quedan.'))return;D.bills=D.bills.filter(function(x){return x.id!==id;});save();closeSheet();refresh();toast('Eliminado');}
TITLES.fijos='Gastos fijos';SUBS.fijos=1;
