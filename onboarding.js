/* Primeros pasos, ayuda dentro de la app y perfil de este dispositivo (nombre y clave propios). */
var CHECK_ITEMS=[
 {id:'pago',t:'Cómo te pagan',h:'Sueldo semanal, quincenal o mensual, por horas… para recordarte cuándo cobras.',done:function(){return workMode()!=='ninguno'||D.recurring.length>0;},act:"wizardStart()"},
 {id:'cuentas',t:'Tus cuentas',h:'Cuánto tienes en el banco, Nequi o efectivo.',done:function(){return D.assets.some(function(a){return a.type==='Liquidez';});},act:"go('cash')"},
 {id:'gasto',t:'Anota tu primer gasto',h:'Toca el + y registra lo que gastaste hoy.',done:function(){return D.expenses.length>0;},act:"openAdd('gasto')"},
 {id:'fijos',t:'Tus gastos fijos',h:'Arriendo, servicios, carro, suscripciones: te avisamos cuándo pagar.',done:function(){return D.bills.length>0||D.subscriptions.length>0;},act:"go('fijos')"},
 {id:'presupuesto',t:'Pon tu presupuesto',h:'Cuánto quieres gastar: la app te dice cuánto te queda cada semana.',done:function(){return Finance.weeklyBudget(D)>0;},act:"sheetPresupuesto()"},
 {id:'meta',t:'Una meta de ahorro',h:'Para un viaje, un fondo de emergencia… y cuánto apartar por semana.',done:function(){return D.goals.length>0;},act:"sheetMeta()"},
 {id:'cobrar',t:'Quién te debe y cuándo',h:'Lo que te deben (o debes), con fecha, para no olvidarlo.',done:function(){return D.receivables.length>0||D.payables.length>0;},act:"editDebt('cobrar')"},
 {id:'tarjetas',t:'Tus tarjetas de crédito',h:'Saldo, cupo y fecha de pago de cada una.',done:function(){return D.cards.length>0;},act:"editCard()"},
 {id:'activos',t:'Lo que tienes: carro, casa…',h:'Cuenta para tu patrimonio, sin mezclarlo con tus inversiones.',done:function(){return D.assets.some(function(a){return a.type!=='Liquidez';});},act:"editAsset()"},
 {id:'inversiones',t:'Tus inversiones',h:'Acciones, CDT, cajitas… y cuánto vas a recibir.',done:function(){return D.investments.length>0||D.fixed.length>0;},act:"go('portafolio')"},
 {id:'proyecto',t:'¿Tienes un negocio o proyecto?',h:'Llévalo aparte de tus gastos personales. Opcional.',done:function(){return D.projects.length>0;},act:"sheetProyecto()"}
];
function setupCard(){
 if(D.settings.onboardHidden===true)return '';
 if(D.settings.onboardHidden===undefined&&D.expenses.length>=20)return '';        // quien ya tiene historial no necesita la guía
 var items=CHECK_ITEMS.map(function(i){return {i:i,ok:i.done()};});
 var ok=items.filter(function(x){return x.ok;}).length;
 if(ok===items.length)return '';
 var pend=items.filter(function(x){return !x.ok;}),show=pend.slice(0,4),rest=pend.slice(4);
 function row(x){return '<button class="row chk-row" onclick="'+x.i.act+'"><span class="chk">'+(x.ok?'✓':'')+'</span><div class="row-m"><div class="row-t">'+esc(x.i.t)+'</div><div class="chk-h">'+esc(x.i.h)+'</div></div><span style="color:var(--tx3)">›</span></button>';}
 return '<div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:baseline"><div class="sec" style="margin:0">Primeros pasos</div><span class="num" style="font-size:12px;color:var(--tx3)">'+ok+' de '+items.length+'</span></div>'
  +'<div class="track" style="margin:10px 0 6px"><div class="fill" style="width:'+(ok/items.length*100).toFixed(0)+'%;background:var(--grn)"></div></div>'
  +'<div class="list">'+show.map(row).join('')+'</div>'
  +(rest.length?'<details class="more" style="margin:6px 0 0"><summary>Ver '+rest.length+' más</summary><div class="list">'+rest.map(row).join('')+'</div></details>':'')
  +'<div class="dash-actions" style="margin:10px 0 0"><button onclick="go(\'ayuda\')">Cómo usar la app</button><button onclick="ocultarGuia()">Ocultar guía</button></div></div>';
}
function ocultarGuia(){D.settings.onboardHidden=true;save();refresh();toast('Guía oculta · la encuentras en Más → Cómo usar la app');}
/* Presupuesto rápido (semana o mes) */
var _pp='mes';
function sheetPresupuesto(){
 _cur=D.settings.mainCurrency||monedaInicial();_curManual=true;
 var actual=Finance.weeklyBudget(D);
 sheet('Tu presupuesto',
  '<div class="note" style="padding-top:0">¿Cuánto quieres gastar como máximo? La app te dice cuánto te queda cada semana. Tus suscripciones se descuentan solas.'+(actual>0?' Ahora: '+money(actual)+' por semana.':'')+'</div>'
  +'<div class="seg mini"><button id="pp-m" class="on" onclick="ppPer(\'mes\')">Por mes</button><button id="pp-s" onclick="ppPer(\'semana\')">Por semana</button></div>'+fAmount(null,_cur),
  '<button class="btn" onclick="guardarPresupuesto()">Guardar</button>');
 _pp='mes';
}
function ppPer(p){_pp=p;el('pp-m').classList.toggle('on',p==='mes');el('pp-s').classList.toggle('on',p==='semana');}
function guardarPresupuesto(){
 var a=num('f-amount');if(!a||a<=0)return toast('Escribe un monto');
 var semanal=_pp==='mes'?a*12/52:a;
 if(_cur==='COP'){D.settings.weeklyBudgetCOP=Math.round(semanal);D.settings.weekly=Math.round(semanal/fx()*100)/100;}
 else{delete D.settings.weeklyBudgetCOP;D.settings.weekly=Math.round(semanal*100)/100;}
 save();closeSheet();refresh();toast('Presupuesto guardado ✓');
}
/* Ayuda */
var AYUDA=[
 ['🏠','Resumen','Tu patrimonio (lo que tienes menos lo que debes), el balance de la semana y del mes, y a dónde se va tu plata. El ojito de arriba tapa todos los montos cuando le muestras la app a alguien.',"go('resumen')"],
 ['➕','Registrar un gasto o ingreso','Toca el botón + de abajo. Escribe el monto y qué compraste: la app elige la categoría sola (y aprende de lo que corriges). Fecha, área y repartir en semanas están en «Más opciones».',"openAdd('gasto')"],
 ['📆','Flujo: semana y mes','Cuánto entró, cuánto salió y a dónde se fue, por categoría y comercio. Compara con la semana o el mes anterior.',"go('semanal')"],
 ['🧾','Gastos fijos','Arriendo, servicios, internet, la cuota del carro, el gimnasio… Dile a la app cuándo los pagas: te avisa el día que toca y los descuenta de tu presupuesto. Las suscripciones tienen su propia pantalla.',"go('fijos')"],
 ['🎯','Presupuesto y metas','Pon cuánto quieres gastar y la app te dice cuánto te queda cada semana. En metas apartas para algo concreto y ves cuánto necesitas por semana.',"go('presupuesto')"],
 ['💵','Cómo te pagan','Sueldo semanal, quincenal o mensual, o por horas, y ingresos extra. Cuando llega el día de pago te preguntamos si ya te pagaron y lo anotas con un toque.',"go('ajustes')"],
 ['👥','Split y cobros','Anota gastos compartidos, quién pagó y entre quiénes se divide. Con «Cobrar» le mandas el resumen por correo o WhatsApp, aunque no use la app.',"go('split')"],
 ['📥','Importar movimientos','Pega el mensaje de tu banco o sube el extracto en CSV y la app lo convierte en gastos, sin duplicar.',"go('importar')"],
 ['📈','Inversiones, CDT y cajitas','Acciones y ETF, y también CDT y cajitas con su tasa EA: te dice cuándo vencen y cuánto vas a recibir.',"go('portafolio')"],
 ['🏦','Cuentas, tarjetas y deudas','Cash = lo que tienes en cuentas. Tarjetas = lo que debes y tu cupo. Por cobrar / por pagar = deudas con fecha.',"go('cash')"],
 ['🚙','Activos y patrimonio','Un carro o una casa cuentan para tu patrimonio pero no para tus inversiones. Agrégalos en Portafolio → Otros activos.',"go('portafolio')"],
 ['💼','Proyectos y negocios','Lleva un negocio o proyecto aparte de tus gastos personales, con su propio balance. Se crean desde Más.',"sheetProyecto()"],
 ['☁️','Nube, Face ID y Apple Pay','Con tu cuenta en la nube tus datos están en todos tus dispositivos. Face ID abre la app sin teclear, y el atajo de Apple Pay anota tus pagos solos.',"go('nube')"]
];
function rAyuda(){
 el('s-ayuda').innerHTML='<div class="dash-intro"><div class="eyebrow">Para empezar</div><h1>Cómo usar la app.</h1><p>Un recorrido corto por cada parte. Toca una para ver para qué sirve.</p></div>'
  +'<div class="dash-actions" style="margin-top:0"><button onclick="wizardStart()">Repetir la configuración inicial</button></div>'
  +AYUDA.map(function(a){return '<details class="card help"><summary><span>'+a[0]+'</span><b>'+a[1]+'</b></summary><p>'+a[2]+'</p><button class="btn gh" onclick="'+a[3]+'">Abrir</button></details>';}).join('')
  +'<div class="note" style="padding-top:12px">Tus datos viven en este dispositivo y, si conectas la nube, también en tu cuenta. Haz un respaldo (Más → Exportar respaldo) de vez en cuando.</div>';
}
/* Perfil de este dispositivo: nombre en la pantalla de entrada y clave propia */
function perfilCard(){
 var pin=sGet(PIN_KEY),tienePin=pinVigente()!=='';
 return '<div class="sec">Tu perfil</div><div class="card">'
  +fText('set-nombre','Tu nombre',nombreVigente(),'Tu nombre')
  +'<div class="note" style="padding:0 0 10px">'+(tienePin?'Este dispositivo pide una clave al abrir la app.':'Este dispositivo no pide clave. Puedes poner una.')+'</div>'
  +fText('set-pin','Clave de 4 a 6 números (déjala vacía para no usar clave)',pin===null?'':pin,'••••','password','inputmode="numeric" maxlength="6" autocomplete="off"')
  +'<button class="btn" style="width:100%" onclick="guardarPerfil()">Guardar perfil</button></div>';
}
function guardarPerfil(){
 var n=val('set-nombre'),p=val('set-pin');
 if(p!==''&&!/^\d{4,6}$/.test(p))return toast('La clave debe tener de 4 a 6 números');
 sSet(NAME_KEY,n);sSet(PIN_KEY,p);
 var l=el('lock-name');if(l)l.textContent=n;
 toast(p===''?'Perfil guardado · sin clave':'Perfil guardado ✓');rAjustes();
}
TITLES.ayuda='Cómo usar la app';SUBS.ayuda=1;
