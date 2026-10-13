/* Cómo te pagan y de dónde te llega la plata: sueldo (semanal, quincenal, mensual), ingresos extra, trabajo por horas y propinas. */
var FREQ=[['semanal','Semanal'],['quincenal','Quincenal'],['mensual','Mensual']];
var DIAS_SEM=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
var WORK_MODES=[['fijo','Sueldo fijo'],['horas','Por horas'],['variable','Independiente'],['ninguno','No aplica']];
var _src=null;
function workMode(){return Finance.workMode(D);}
function workHoras(){return workMode()==='horas';}
function workTips(){return Finance.workTips(D);}
function rateCur(){return D.settings.rateCurrency==='COP'?'COP':'USD';}
function tarifaUSD(){return toUSD(D.settings.rate||0,rateCur());}
function srcFreqText(r){
 if(r.freq==='semanal')return 'cada '+DIAS_SEM[Number(r.weekday)||0].toLowerCase();
 if(r.freq==='quincenal')return 'el '+(r.days&&r.days.length?r.days:[15,30]).join(' y el ');
 return 'el '+(r.day||1)+' de cada mes';
}
/* Tarjeta del Resumen: pagos que ya deberían haber llegado, para confirmarlos con un toque. */
function ingresosCard(){
 var pend=Finance.pendingIncome(D,today());
 if(!pend.length){
  var n=Finance.nextPay(D,today());
  if(!n)return '';
  var days=Finance.daysBetween(today(),n.date);
  return '<div class="note" style="padding:0 2px 12px">Próximo pago: <b>'+esc(n.rec.name)+'</b> el '+dayLabel(n.date)+' ('+(days===1?'mañana':'en '+days+' días')+') · '+fmt(n.rec.amount,n.rec.currency)+'</div>';
 }
 return '<div class="card" style="margin-bottom:14px"><div class="sec" style="margin:0 0 6px">¿Ya te pagaron?</div>'+pend.map(function(p){
  return '<div class="row"><div class="ico" style="background:#0F7A461f">💵</div><div class="row-m"><div class="row-t">'+esc(p.rec.name)+'</div><div class="row-s">'+dayLabel(p.date)+'</div></div><div class="row-v num g">+'+fmt(p.rec.amount,p.rec.currency)+'</div></div>'
   +'<div class="dash-actions" style="margin:0 0 8px"><button onclick="confirmarPago(\''+p.rec.id+'\',\''+p.date+'\')">Sí, ya llegó</button><button onclick="omitirPago(\''+p.rec.id+'\',\''+p.date+'\')">No llegó / omitir</button></div>';
 }).join('')+'</div>';
}
function confirmarPago(id,dt){
 var r=D.recurring.filter(function(x){return x.id===id;})[0];if(!r)return;
 if(D.income.some(function(i){return i.recurringId===id&&i.recurringDate===dt;}))return;
 D.income.push({id:uid(),date:dt,source:r.name,amount:r.amount,currency:r.currency,area:'Personal',incomeKind:r.kind==='sueldo'?'salary':'extra',recurringId:id,recurringDate:dt});
 save();refresh();toast('Ingreso guardado ✓ · si el monto cambió, edítalo en Movimientos');
}
function omitirPago(id,dt){
 var r=D.recurring.filter(function(x){return x.id===id;})[0];if(!r)return;
 r.skipped=(r.skipped||[]).concat([dt]);save();refresh();
}
/* Crear o editar una fuente de ingreso */
function sheetFuente(id,kind,after){
 var r=id?D.recurring.filter(function(x){return x.id===id;})[0]:null;
 _src={kind:r?r.kind:(kind||'sueldo'),freq:r?r.freq:'quincenal',weekday:r?Number(r.weekday):5,after:after||null};
 _cur=r?r.currency:monedaInicial();_curManual=true;
 sheet(r?'Editar ingreso':(_src.kind==='sueldo'?'Tu sueldo':'Ingreso extra'),
  '<div class="seg mini" id="src-kind"><button data-k="sueldo" class="'+(_src.kind==='sueldo'?'on':'')+'" onclick="srcKind(\'sueldo\')">Sueldo</button><button data-k="extra" class="'+(_src.kind==='extra'?'on':'')+'" onclick="srcKind(\'extra\')">Ingreso extra</button></div>'
  +fText('f-srcname','Nombre',r?r.name:(_src.kind==='sueldo'?'Quincena':''),'Quincena, sueldo, arriendo, freelance…')
  +fAmount(r?r.amount:null,_cur)
  +'<div class="f"><label>¿Cada cuánto te pagan?</label><div class="seg mini" id="src-freq">'+FREQ.map(function(x){return '<button data-f="'+x[0]+'" class="'+(_src.freq===x[0]?'on':'')+'" onclick="srcFreq(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div></div>'
  +'<div id="src-days"></div>'
  +fText('f-srcstart','Desde','' ,'' ,'date')
  +'<div class="note">Cuando llegue el día de pago, la app te pregunta si ya te pagaron y lo anotas con un toque. Si el mes es más corto, el día 30 se ajusta al último día del mes.</div>',
  (r?'<button class="btn dg" onclick="delFuente(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveFuente('+(id?'\''+id+'\'':'null')+')">Guardar</button>',
  function(){
   el('f-srcstart').value=r&&r.start?r.start:today();
   srcDays(r);
  });
}
function srcKind(k){_src.kind=k;document.querySelectorAll('#src-kind button').forEach(function(b){b.classList.toggle('on',b.dataset.k===k);});var n=el('f-srcname');if(n&&(!n.value||/^(Quincena|Sueldo)$/.test(n.value)))n.value=k==='sueldo'?'Quincena':'';}
function srcFreq(f){_src.freq=f;document.querySelectorAll('#src-freq button').forEach(function(b){b.classList.toggle('on',b.dataset.f===f);});var n=el('f-srcname');if(n&&_src.kind==='sueldo'&&/^(Quincena|Sueldo|Pago semanal)$/.test(n.value))n.value=f==='quincenal'?'Quincena':f==='semanal'?'Pago semanal':'Sueldo';srcDays();}
function srcDays(r){
 var box=el('src-days');if(!box)return;
 if(_src.freq==='quincenal'){var d=(r&&r.days)||[15,30];box.innerHTML='<div class="f2">'+fText('f-srcd1','Primer día de pago',d[0],'15',null,'inputmode="numeric"')+fText('f-srcd2','Segundo día de pago',d[1],'30',null,'inputmode="numeric"')+'</div>';}
 else if(_src.freq==='mensual'){box.innerHTML=fText('f-srcday','Día del mes',(r&&r.day)||30,'30',null,'inputmode="numeric"');}
 else{box.innerHTML='<div class="f"><label>Día de la semana</label><div class="sp-who">'+DIAS_SEM.map(function(n,i){return '<button class="chip'+(_src.weekday===i?' on':'')+'" onclick="srcWeekday('+i+')">'+n+'</button>';}).join('')+'</div></div>';}
}
function srcWeekday(i){_src.weekday=i;srcDays();}
function saveFuente(id){
 var name=val('f-srcname'),a=num('f-amount'),start=val('f-srcstart');
 if(!name)return toast('Ponle un nombre');
 if(!(a>0))return toast('Escribe cuánto te pagan');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return toast('Falta la fecha de inicio');
 var r=id?D.recurring.filter(function(x){return x.id===id;})[0]:null,days=null,day=null;
 function dd(v){var n=parseInt(v,10);return (n>=1&&n<=31)?n:NaN;}
 if(_src.freq==='quincenal'){var d1=dd(val('f-srcd1')),d2=dd(val('f-srcd2'));if(isNaN(d1)||isNaN(d2))return toast('Los días de pago van de 1 a 31');days=[d1,d2].sort(function(x,y){return x-y;});}
 else if(_src.freq==='mensual'){day=dd(val('f-srcday'));if(isNaN(day))return toast('El día de pago va de 1 a 31');}
 if(!confirmarMonto(a,_cur,'ingreso'))return;
 if(!r){r={id:uid(),skipped:[]};D.recurring.push(r);}
 r.kind=_src.kind;r.name=name;r.amount=a;r.currency=_cur;r.freq=_src.freq;r.start=start;
 delete r.days;delete r.day;delete r.weekday;
 if(days)r.days=days;if(day)r.day=day;if(_src.freq==='semanal')r.weekday=_src.weekday;
 recordarMoneda(_cur);save();closeSheet();
 if(_src.after){var f=_src.after;_src.after=null;f();}else{refresh();toast('Guardado ✓');}
}
function delFuente(id){if(!confirm('¿Eliminar este ingreso recurrente? Los pagos ya anotados se quedan.'))return;D.recurring=D.recurring.filter(function(x){return x.id!==id;});save();closeSheet();refresh();toast('Eliminado');}
/* Ajustes: cómo te pagan */
function setWorkMode(m){D.settings.work=D.settings.work||{};D.settings.work.mode=m;if(D.settings.work.tips===undefined)D.settings.work.tips=m==='horas'&&workTips();save();rAjustes();}
function toggleTips(){D.settings.work=D.settings.work||{};D.settings.work.mode=workMode();D.settings.work.tips=!workTips();save();rAjustes();}
function setRateCur(c){D.settings.rateCurrency=c;save();rAjustes();}
function trabajoAjustes(){
 var m=workMode();
 var srcs=D.recurring.map(function(r){
  return '<div class="row" onclick="sheetFuente(\''+r.id+'\')"><div class="ico" style="background:#0F7A461f">'+(r.kind==='sueldo'?'💼':'➕')+'</div><div class="row-m"><div class="row-t">'+esc(r.name)+'</div><div class="row-s">'+(FREQ.filter(function(f){return f[0]===r.freq;})[0]||['',''])[1]+' · '+srcFreqText(r)+'</div></div><div class="row-v num g">'+fmt(r.amount,r.currency)+'</div></div>';
 }).join('');
 return '<div class="sec">Tu trabajo e ingresos</div><div class="card">'
  +'<div class="f" style="margin-bottom:8px"><label>¿Cómo te pagan?</label><div class="seg mini" style="margin-bottom:0">'+WORK_MODES.map(function(x){return '<button class="'+(m===x[0]?'on':'')+'" onclick="setWorkMode(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div></div>'
  +(m==='horas'?'<div class="f"><label>Tarifa por hora</label><div style="display:flex;gap:8px"><input id="set-rate" value="'+(D.settings.rate||0)+'" inputmode="decimal" style="flex:1"><div class="seg mini" style="flex:0 0 118px;margin:0"><button class="'+(rateCur()==='USD'?'on':'')+'" onclick="setRateCur(\'USD\')">USD</button><button class="'+(rateCur()==='COP'?'on':'')+'" onclick="setRateCur(\'COP\')">COP</button></div></div></div>':'')
  +'<div class="sp-who" style="margin:4px 0 10px"><button class="chip '+(workTips()?'on':'')+'" aria-pressed="'+workTips()+'" onclick="toggleTips()">Recibo propinas</button></div>'
  +(srcs?'<div class="list">'+srcs+'</div>':'<div class="note" style="padding:0 0 8px">Agrega tu sueldo (semanal, quincenal o mensual) y cualquier ingreso extra: te avisamos cuando toca cobrarlo.</div>')
  +'<div class="dash-actions" style="margin:8px 0 0"><button onclick="sheetFuente(null,\'sueldo\')">+ Sueldo</button><button onclick="sheetFuente(null,\'extra\')">+ Ingreso extra</button></div></div>';
}
