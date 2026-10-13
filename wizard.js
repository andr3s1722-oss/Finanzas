/* Asistente de inicio: se adapta a cada persona (cómo le pagan, en qué moneda, presupuesto, meta). Todo es opcional y se puede repetir. */
var _wz=null;
var WZ_STEPS=['perfil','pago','extra','fijos','presupuesto','meta','cuentas','candado','fin'];
function wzCur(){return (D.settings.mainCurrency==='USD')?'USD':(D.settings.mainCurrency==='COP'?'COP':monedaInicial());}
function wizardStart(){_wz={i:0,extras:0};wzShow();}
function wzShow(){
 var id=WZ_STEPS[_wz.i],s=WZ_VIEW[id]();
 var first=_wz.i===0,last=id==='fin';
 sheet(s.title,
  '<div class="wz-dots">'+WZ_STEPS.map(function(x,k){return '<i class="'+(k<=_wz.i?'on':'')+'"></i>';}).join('')+'</div>'+s.body,
  (first||last?'':'<button class="btn gh" onclick="wzBack()">Atrás</button>')
  +(s.skip?'<button class="btn gh" onclick="wzSkip()">Omitir</button>':'')
  +'<button class="btn" onclick="wzNext()">'+(last?'Ir a mi resumen':(s.next||'Siguiente'))+'</button>',
  s.after);
}
function wzGo(n){_wz.i=Math.max(0,Math.min(WZ_STEPS.length-1,n));wzShow();}
function wzBack(){wzGo(_wz.i-1);}
function wzSkip(){wzGo(_wz.i+1);}
function wzNext(){
 var id=WZ_STEPS[_wz.i];
 if(id==='fin'){closeSheet();_wz=null;go('resumen');return;}
 var r=WZ_APPLY[id]?WZ_APPLY[id]():true;
 if(r===false)return;                 // validación fallida: se queda en el paso
 if(r==='wait')return;                // otro formulario continuará el asistente
 wzGo(_wz.i+1);
}
function wzChoice(key,val,labels,cur,fn){
 return '<div class="seg mini" style="margin-bottom:12px">'+labels.map(function(l){return '<button data-v="'+l[0]+'" class="'+(cur===l[0]?'on':'')+'" onclick="'+fn+'(\''+l[0]+'\')">'+l[1]+'</button>';}).join('')+'</div>';
}
var WZ_VIEW={
 perfil:function(){
  _wz.moneda=_wz.moneda||(D.settings.mainCurrency||(monedaInicial()==='COP'?'COP':'USD'));
  return {title:'Bienvenido 👋',next:'Empezar',
   body:'<p class="note" style="padding-top:0;font-size:14px;line-height:1.55">En un par de minutos dejamos la app lista para ti. Todo se puede omitir y cambiar después.</p>'
    +fText('wz-nombre','¿Cómo te llamas?',sGet(NAME_KEY)||'','Tu nombre')
    +'<div class="f"><label>¿En qué moneda manejas tu plata?</label>'+wzChoice('moneda','',[['COP','Pesos (COP)'],['USD','Dólares (USD)'],['AMBAS','Las dos']],_wz.moneda,'wzMoneda')+'</div>'};
 },
 pago:function(){
  _wz.pago=_wz.pago||workMode();
  return {title:'¿Cómo te pagan?',skip:true,
   body:'<p class="note" style="padding-top:0">Así sabemos qué recordarte y cómo calcular tus ingresos.</p>'
    +'<div class="wz-cards">'+[['fijo','💼','Sueldo fijo','Te pagan cada semana, quincena o mes'],['horas','⏱','Por horas','Pagan por hora trabajada (y a veces propinas)'],['variable','🧾','Independiente','Ingresos que cambian cada mes'],['ninguno','🙂','No tengo ingreso fijo','Solo quiero llevar mis gastos']].map(function(o){
      return '<button class="wz-card'+(_wz.pago===o[0]?' on':'')+'" onclick="wzPago(\''+o[0]+'\')"><span>'+o[1]+'</span><b>'+o[2]+'</b><small>'+o[3]+'</small></button>';}).join('')+'</div>'
    +(_wz.pago==='horas'?'<div class="f"><label>Tarifa por hora</label><div style="display:flex;gap:8px"><input id="wz-rate" inputmode="decimal" value="'+(D.settings.rate||'')+'" placeholder="0" style="flex:1"><div class="seg mini" style="flex:0 0 118px;margin:0"><button id="wz-rcop" class="'+((D.settings.rateCurrency||wzCur())==='COP'?'on':'')+'" onclick="wzRateCur(\'COP\')">COP</button><button id="wz-rusd" class="'+((D.settings.rateCurrency||wzCur())!=='COP'?'on':'')+'" onclick="wzRateCur(\'USD\')">USD</button></div></div></div>'
      +'<div class="sp-who"><button class="chip '+(_wz.tips?'on':'')+'" onclick="wzTips()">Recibo propinas</button></div>':'')};
 },
 extra:function(){
  return {title:'Ingresos extra',skip:true,next:'Seguir',
   body:'<p class="note" style="padding-top:0">¿Tienes otros ingresos además de tu trabajo? Por ejemplo: un arriendo, clases, ventas, una mesada o un negocio. Te recordamos cuándo cobrarlos.</p>'
    +(_wz.extras?'<div class="card" style="margin-bottom:10px">Ya agregaste '+_wz.extras+(_wz.extras===1?' ingreso extra ✓':' ingresos extra ✓')+'</div>':'')
    +'<button class="btn gh" style="width:100%" onclick="wzExtra()">+ Agregar un ingreso extra</button>'};
 },
 fijos:function(){
  var ans=_wz.fijos||null,sel=_wz.fijosSel||{};
  var body='<p class="note" style="padding-top:0">Son los pagos que repites cada mes: arriendo, servicios, la cuota del carro, suscripciones… Te avisamos cuándo toca pagar y los descontamos de tu presupuesto. <b>Si no tienes, sigue sin problema.</b></p>';
  if(!ans)body+='<div class="wz-cards" style="grid-template-columns:1fr"><button class="wz-card" style="min-height:0" onclick="wzFijos(\'si\')"><b>Sí, tengo gastos fijos</b><small>Elijo cuáles y los configuro</small></button><button class="wz-card" style="min-height:0" onclick="wzFijos(\'no\')"><b>No, por ahora no</b><small>Puedo agregarlos después en Más → Gastos fijos</small></button></div>';
  else if(ans==='no')body+='<div class="card">Perfecto, sin gastos fijos por ahora. Podrás agregarlos cuando quieras desde <b>Más → Gastos fijos</b>.</div>';
  else body+='<div class="f"><label>¿Cuáles tienes? Toca los que apliquen</label><div class="chips" style="margin:0;flex-wrap:wrap;overflow:visible">'+WZ_BILL_OPTS.map(function(o){return '<button class="chip '+(sel[o[0]]?'on':'')+'" aria-pressed="'+!!sel[o[0]]+'" onclick="wzFijosToggle(\''+o[0]+'\')">'+o[1]+' '+o[2]+'</button>';}).join('')+'</div></div>'
    +'<div class="note">'+(Object.keys(sel).filter(function(k){return sel[k];}).length?'Al tocar Siguiente te pedimos el monto y el día de cada uno.':'Si no tocas ninguno, seguimos sin gastos fijos.')+' La app reconoce sola si algo es servicio o suscripción (Tigo, Claro = servicios; Claude, Netflix = suscripciones).</div>'
    +(_wz.bills?'<div class="card">Ya agregaste '+_wz.bills+(_wz.bills===1?' gasto fijo ✓':' gastos fijos ✓')+'</div>':'');
  return {title:'¿Tienes gastos fijos?',skip:true,next:ans==='si'?'Siguiente':'Seguir',body:body};
 },
 presupuesto:function(){
  _cur=wzCur();_curManual=true;_wz.per=_wz.per||'mes';
  return {title:'Tu presupuesto',skip:true,
   body:'<p class="note" style="padding-top:0">¿Cuánto quieres gastar como máximo? La app te va diciendo cuánto te queda cada semana.</p>'
    +'<div class="seg mini"><button id="wz-pm" class="'+(_wz.per==='mes'?'on':'')+'" onclick="wzPer(\'mes\')">Por mes</button><button id="wz-ps" class="'+(_wz.per==='semana'?'on':'')+'" onclick="wzPer(\'semana\')">Por semana</button></div>'
    +fAmount(null,_cur)+'<div class="note">Tus suscripciones y gastos fijos se descuentan solos de este presupuesto.</div>'};
 },
 meta:function(){
  _cur=wzCur();_curManual=true;
  return {title:'Una meta de ahorro',skip:true,
   body:'<p class="note" style="padding-top:0">¿Estás ahorrando para algo? Un viaje, un fondo de emergencia, un carro… Te decimos cuánto necesitas apartar cada semana.</p>'
    +fText('wz-mname','¿Para qué?','','Viaje, fondo de emergencia…')+fAmount(null,_cur)+fText('wz-mdate','¿Para cuándo? (opcional)','','','date')};
 },
 cuentas:function(){
  _cur=wzCur();_curManual=true;
  return {title:'Tus cuentas',skip:true,
   body:'<p class="note" style="padding-top:0">Anota cuánto tienes hoy en tu cuenta principal (Nequi, banco, efectivo). Con esto la app calcula tu patrimonio. Podrás agregar más cuentas, tarjetas y deudas después.</p>'
    +fText('wz-aname','Nombre de la cuenta','','Nequi, Bancolombia, Chase…')+fAmount(null,_cur)};
 },
 candado:function(){
  var pin=sGet(PIN_KEY);
  return {title:'Protege tu app',skip:true,
   body:'<p class="note" style="padding-top:0">Pon una clave de 4 números para abrir la app (opcional). También puedes entrar con Face ID.</p>'
    +fText('wz-pin','Clave de 4 números',pin||'','••••','password','inputmode="numeric" maxlength="6" autocomplete="off"')
    +'<button class="btn gh" style="width:100%" onclick="faceEnable()">'+(faceOn()?'Face ID activado ✓':'Activar Face ID')+'</button>'};
 },
 fin:function(){
  var hecho=[];
  if(sGet(NAME_KEY))hecho.push('Nombre');if(workMode()!=='ninguno')hecho.push('Cómo te pagan');if(D.recurring.length)hecho.push('Ingresos recurrentes');if(D.bills.length)hecho.push('Gastos fijos');
  if(D.settings.weekly>0||D.settings.weeklyBudgetCOP>0)hecho.push('Presupuesto');if(D.goals.length)hecho.push('Meta de ahorro');if(D.assets.some(function(a){return a.type==='Liquidez';}))hecho.push('Cuenta');
  return {title:'¡Listo! 🎉',
   body:'<p style="font-size:14px;line-height:1.6">'+(hecho.length?'Dejamos configurado: <b>'+hecho.join(', ')+'</b>.':'Puedes configurar todo con calma desde tu resumen.')+'</p>'
    +'<p class="note" style="padding-top:6px">En tu resumen verás una guía de <b>primeros pasos</b> con lo que falta: tarjetas, deudas, activos como un carro, inversiones, un negocio… Y en <b>Más → Cómo usar la app</b> hay una explicación de cada parte.</p>'};
 }
};
function wzMoneda(m){_wz.moneda=m;document.querySelectorAll('.seg.mini button[data-v]').forEach(function(b){b.classList.toggle('on',b.dataset.v===m);});}
function wzPago(m){_wz.pago=m;wzShow();}
function wzTips(){_wz.tips=!_wz.tips;wzShow();}
function wzRateCur(c){D.settings.rateCurrency=c;el('wz-rcop').classList.toggle('on',c==='COP');el('wz-rusd').classList.toggle('on',c==='USD');}
function wzPer(p){_wz.per=p;el('wz-pm').classList.toggle('on',p==='mes');el('wz-ps').classList.toggle('on',p==='semana');}
var WZ_BILL_OPTS=[['arriendo','🏠','Arriendo',0],['servicios','💡','Servicios',1],['carro','🚗','Carro',3],['subs','🔁','Suscripciones',-1],['gym','🏋️','Gimnasio',5],['admin','🏢','Administración',6],['otro','📦','Otro',7]];
function wzFijos(a){_wz.fijos=a;if(a==='no'){_wz.fijosSel={};}wzShow();}
function wzFijosToggle(k){_wz.fijosSel=_wz.fijosSel||{};_wz.fijosSel[k]=!_wz.fijosSel[k];wzShow();}
// recorre los que elegiste, uno por uno; al terminar, el asistente sigue
function wzFijosQueue(){
 var q=_wz.fijosQueue||[];
 if(!q.length){_wz.fijosQueue=null;wzGo(_wz.i+1);return;}
 var k=q.shift(),o=WZ_BILL_OPTS.filter(function(x){return x[0]===k;})[0];
 var seguir=function(){_wz.bills=(_wz.bills||0)+1;wzFijosQueue();};
 if(o[3]<0){_subAfter=seguir;sheetSub();}
 else sheetBill(null,o[3],seguir);
}
function wzBill(i){sheetBill(null,i,function(){_wz.bills=(_wz.bills||0)+1;wzShow();});}
function wzSub(){closeSheet();toast('Las suscripciones se agregan en Suscripciones');go('subs');}
function wzExtra(){sheetFuente(null,'extra',function(){_wz.extras=(_wz.extras||0)+1;wzShow();});}
var WZ_APPLY={
 perfil:function(){
  var n=val('wz-nombre');if(n)sSet(NAME_KEY,n);
  D.settings.mainCurrency=_wz.moneda==='AMBAS'?undefined:_wz.moneda;if(D.settings.mainCurrency===undefined)delete D.settings.mainCurrency;
  if(_wz.moneda==='COP'||_wz.moneda==='USD')recordarMoneda(_wz.moneda);
  var l=el('lock-name');if(l)l.textContent=n||'';
  save();return true;
 },
 pago:function(){
  var m=_wz.pago||'ninguno';D.settings.work=D.settings.work||{};D.settings.work.mode=m;
  if(m==='horas'){
   var r=parseMonto(val('wz-rate'));if(isNaN(r)||r<=0){toast('Escribe cuánto te pagan por hora');return false;}
   D.settings.rate=r;D.settings.rateCurrency=D.settings.rateCurrency||(wzCur()==='COP'?'COP':'USD');D.settings.work.tips=!!_wz.tips;save();return true;
  }
  D.settings.work.tips=false;save();
  if(m==='fijo'&&!D.recurring.some(function(r){return r.kind==='sueldo';})){sheetFuente(null,'sueldo',function(){wzGo(_wz.i+1);});return 'wait';}
  return true;
 },
 extra:function(){return true;},
 fijos:function(){
  var sel=_wz.fijosSel||{},q=WZ_BILL_OPTS.map(function(o){return o[0];}).filter(function(k){return sel[k];});
  if(_wz.fijos!=='si'||!q.length)return true;
  _wz.fijosQueue=q;wzFijosQueue();return 'wait';
 },
 presupuesto:function(){
  var a=num('f-amount');if(!a||a<=0)return true;
  var semanal=_wz.per==='mes'?a*12/52:a;
  if(_cur==='COP'){D.settings.weeklyBudgetCOP=Math.round(semanal);D.settings.weekly=Math.round(semanal/fx()*100)/100;}
  else{delete D.settings.weeklyBudgetCOP;D.settings.weekly=Math.round(semanal*100)/100;}
  save();return true;
 },
 meta:function(){
  var n=val('wz-mname'),a=num('f-amount');if(!n||!(a>0))return true;
  var g={id:uid(),name:n,target:a,currency:_cur,emoji:'🎯',log:[]},d=val('wz-mdate');if(d)g.deadline=d;D.goals.push(g);save();return true;
 },
 cuentas:function(){
  var n=val('wz-aname'),a=num('f-amount');if(!n||a==null)return true;
  D.assets.push({id:uid(),name:n,type:'Liquidez',value:a,currency:_cur});save();return true;
 },
 candado:function(){
  var p=val('wz-pin');
  if(p===''){if(sGet(PIN_KEY)===null)sSet(PIN_KEY,'');return true;}
  if(!/^\d{4,6}$/.test(p)){toast('La clave debe tener de 4 a 6 números');return false;}
  sSet(PIN_KEY,p);return true;
 }
};
