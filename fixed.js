/* Renta fija: CDT y cajitas (Nu, etc.). Muestra a cuánto tiempo vencen y cuánto vas a recibir. */
var _fx=null;
var FX_KINDS=[['CDT','CDT'],['Cajita','Cajita Nu'],['Otro','Otro ahorro']];
function fxKindLabel(k){return (FX_KINDS.filter(function(x){return x[0]===k;})[0]||[k,k])[1];}
function fxDayText(d){var x=d.split('-');return +x[2]+' '+MS[+x[1]-1].toLowerCase()+' '+x[0];}
function fxRemainText(s){
 if(!s.term)return 'sin plazo fijo';
 if(s.matured)return 'ya venció';
 return s.remaining===1?'falta 1 día':'faltan '+s.remaining+' días'+(s.remaining>=60?' (~'+Math.round(s.remaining/30)+' meses)':'');
}
function fixedSection(){
 var list=D.fixed.slice();
 var head='<div class="sec">Renta fija · CDT y cajitas<button onclick="sheetFijo()">+ Agregar</button></div>';
 if(!list.length)return head+'<div class="card"><div class="empty" style="padding:22px 10px"><div class="e">🏦</div><div class="t">Aún no tienes CDT ni cajitas</div><div class="s">Agrega uno y verás cuándo vence y cuánto vas a recibir</div></div></div>';
 var today_=today(),tot=0,ganado=0,recibir=0,mensual=0;
 var rows=list.map(function(f){
  var s=Finance.fixedStats(f,today_),v=toUSD(s.value,f.currency);tot+=toUSD(s.principal,f.currency);ganado+=toUSD(s.accruedNet,f.currency);
  if(s.term&&!s.matured)recibir+=toUSD(s.atMaturity.payout,f.currency);else if(s.term)recibir+=toUSD(s.value,f.currency);
  if(!s.term)mensual+=toUSD(s.perMonth,f.currency);
  var line2=s.term?(s.matured?'Disponible desde el '+fxDayText(s.maturity):'Recibirás <b>'+fmt(s.atMaturity.payout,f.currency)+'</b> el '+fxDayText(s.maturity)):'≈ <b>'+fmt(s.perMonth,f.currency)+'</b> al mes · '+fmt(s.perYear,f.currency)+' al año';
  return '<div class="row" onclick="sheetFijo(\''+f.id+'\')"><div class="ico" style="background:'+(f.kind==='Cajita'?'#820AD11f':'#0B6E7D1f')+'">'+(f.kind==='Cajita'?'💜':'🏦')+'</div>'
   +'<div class="row-m"><div class="row-t">'+esc(f.name)+'</div><div class="fx-line">'+esc(fxKindLabel(f.kind))+' · '+(Number(f.rate)||0)+'% EA · '+fxRemainText(s)+'</div><div class="fx-line">'+line2+'</div></div>'
   +'<div class="row-v num">'+fmt(s.value,f.currency)+'<span class="sub">hoy</span></div></div>';
 }).join('');
 return head+'<div class="grid2" style="margin-bottom:10px"><div class="tile"><div class="l">Invertido</div><div class="v num">'+money(tot)+'</div><div class="s">ganado hasta hoy '+money(ganado)+'</div></div>'
  +'<div class="tile"><div class="l">Recibirás</div><div class="v num g">'+money(recibir)+'</div><div class="s">'+(mensual>0?'+ ≈ '+money(mensual)+'/mes en cajitas':'al vencimiento, neto')+'</div></div></div>'
  +'<div class="card" style="padding:6px 14px"><div class="list">'+rows+'</div></div>'
  +'<div class="note" style="padding-top:8px">Los rendimientos se calculan con la tasa efectiva anual (EA) que anotes y son una estimación: tu banco certifica el valor final. Muchos CDT retienen un 4% de los rendimientos en la fuente; confírmalo en tu certificado.</div>';
}
function sheetFijo(id){
 var f=id?D.fixed.filter(function(x){return x.id===id;})[0]:null;
 _fx={kind:f?f.kind:'CDT'};_cur=f?f.currency:'COP';_curManual=true;
 sheet(f?'Editar '+fxKindLabel(f.kind):'Nuevo CDT o cajita',
  '<div class="seg mini" id="fx-kind">'+FX_KINDS.map(function(k){return '<button data-k="'+k[0]+'" class="'+(_fx.kind===k[0]?'on':'')+'" onclick="fxKind(\''+k[0]+'\')">'+k[1]+'</button>';}).join('')+'</div>'
  +fText('f-fxname','Nombre',f?f.name:'CDT','CDT Bancolombia, Cajita Turbo…')
  +fAmount(f?f.principal:null,_cur)
  +fText('f-fxrate','Tasa efectiva anual (% EA)',f?f.rate:'','9,5',null,'inputmode="decimal" oninput="fxPreview()"')
  +fText('f-fxstart','Fecha de inicio',f?f.start:today(),'','date')
  +'<div class="f"><label for="f-fxdays">Plazo (días)</label><input id="f-fxdays" inputmode="numeric" value="'+(f&&f.days?f.days:'')+'" placeholder="Vacío si no tiene plazo fijo" oninput="fxPreview()">'
  +'<div class="sp-who" style="margin-top:8px">'+[30,90,180,360].map(function(n){return '<button class="chip" onclick="fxDays('+n+')">'+n+'</button>';}).join('')+'</div></div>'
  +fText('f-fxwh','Retención en la fuente (%)',f&&f.withholding!=null?f.withholding:(_fx.kind==='CDT'?4:0),'4',null,'inputmode="decimal" oninput="fxPreview()"')
  +'<div id="fx-prev" class="card" style="margin-bottom:12px"></div>',
  (f?'<button class="btn dg" onclick="delFijo(\''+id+'\')">Eliminar</button>':'')+'<button class="btn" onclick="saveFijo('+(id?'\''+id+'\'':'null')+')">Guardar</button>',
  function(){fxPreview();});
}
function fxKind(k){
 _fx.kind=k;document.querySelectorAll('#fx-kind button').forEach(function(b){b.classList.toggle('on',b.dataset.k===k);});
 var n=el('f-fxname');if(n&&(!n.value||/^(CDT|Cajita Nu|Otro ahorro)$/.test(n.value)))n.value=fxKindLabel(k);
 var w=el('f-fxwh');if(w&&(w.value===''||w.value==='0'||w.value==='4'))w.value=k==='CDT'?'4':'0';
 if(k==='Cajita'&&el('f-fxdays')&&el('f-fxdays').value==='')el('f-fxdays').value='';
 fxPreview();
}
function fxDays(n){el('f-fxdays').value=n;fxPreview();}
function fxRead(){
 var p=num('f-amount'),r=parseMonto(val('f-fxrate')),w=parseMonto(val('f-fxwh')),dRaw=val('f-fxdays'),d=dRaw===''?0:parseInt(dRaw,10);
 return {principal:p,rate:r,withholding:isNaN(w)?0:w,days:isNaN(d)?NaN:d,start:val('f-fxstart')};
}
function fxPreview(){
 var box=el('fx-prev');if(!box)return;
 var x=fxRead();
 if(!(x.principal>0)||isNaN(x.rate)||x.rate<0){box.innerHTML='<div class="note" style="padding:0">Escribe el monto y la tasa para ver cuánto vas a recibir.</div>';return;}
 var s=Finance.fixedStats(x,x.start&&/^\d{4}-\d{2}-\d{2}$/.test(x.start)?today():today());
 var txt;
 if(s.term){txt='<b>Recibirás '+fmt(s.atMaturity.payout,_cur)+'</b> el '+fxDayText(s.maturity)+'.<br>Rendimiento neto: '+fmt(s.atMaturity.net,_cur)+(x.withholding>0?' (bruto '+fmt(s.atMaturity.gross,_cur)+')':'')+'. '+fxRemainText(s)+'.';}
 else txt='<b>≈ '+fmt(s.perMonth,_cur)+' al mes</b> y '+fmt(s.perYear,_cur)+' al año, con la tasa actual y sin retirar. Sin plazo fijo.';
 box.innerHTML='<div style="font-size:13.5px;line-height:1.55">'+txt+'</div>';
}
var _updWeekFx=updWeek;
updWeek=function(){_updWeekFx();if(el('fx-prev'))fxPreview();};
function saveFijo(id){
 var x=fxRead(),name=val('f-fxname');
 if(!name)return toast('Ponle un nombre');
 if(!(x.principal>0))return toast('Escribe el monto invertido');
 if(isNaN(x.rate)||x.rate<0||x.rate>100)return toast('La tasa EA debe estar entre 0 y 100');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x.start))return toast('Falta la fecha de inicio');
 if(isNaN(x.days)||x.days<0)return toast('El plazo debe ser un número de días');
 if(_fx.kind==='CDT'&&!(x.days>0))return toast('Un CDT necesita plazo en días');
 if(x.withholding<0||x.withholding>100)return toast('Retención entre 0 y 100');
 var f=id?D.fixed.filter(function(y){return y.id===id;})[0]:null;
 if(!f){f={id:uid()};D.fixed.push(f);}
 f.kind=_fx.kind;f.name=name;f.currency=_cur;f.principal=x.principal;f.rate=x.rate;f.start=x.start;f.withholding=x.withholding;
 if(x.days>0)f.days=x.days;else delete f.days;
 save();closeSheet();refresh();toast('Guardado ✓');
}
function delFijo(id){if(!confirm('¿Eliminar esta inversión?'))return;D.fixed=D.fixed.filter(function(x){return x.id!==id;});save();closeSheet();refresh();toast('Eliminado');}
