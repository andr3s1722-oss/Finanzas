/* Importar movimientos (mensajes pegados o CSV), atajo de Apple Pay y exportación CSV. */
var impItems=[],impRows=null,impOpts={currency:monedaInicial(),dateOrder:'auto',expensesPositive:false},impMsgCur='auto',impNote='',quickNoticeItem=null;
function impSite(){return location.origin+location.pathname;}
function impDownload(name,text,type){
 try{
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/csv'}));a.download=name;
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},400);toast('Archivo descargado ✓');
 }catch(e){copiarRespaldo(text);}
}
function impExportCSV(){impDownload('finanzas-movimientos-'+today()+'.csv',Importer.toCSV(D));}
function impSetItems(list,note){
 impItems=Importer.markDuplicates(list,D).map(function(it){
  it.on=!it.dup;it.cat=it.kind==='gasto'?(detectarCat(it.desc)||'Otros'):'';return it;});
 impNote=note||'';impReview();
}
function impReadText(){
 var t=el('imp-text').value;impMsgCur=el('imp-cur').value;
 var list=Importer.parseMessages(t,{currency:impMsgCur==='auto'?null:impMsgCur,today:today()});
 if(!list.length){impItems=[];impNote='No pude leer ningún monto. Pega el mensaje completo, con el signo $ y el monto.';return impReview();}
 impSetItems(list,list.length+(list.length===1?' movimiento detectado':' movimientos detectados'));
}
function impPickFile(){
 var inp=document.createElement('input');inp.type='file';inp.accept='.csv,text/csv,text/plain';
 inp.onchange=function(){
  var f=inp.files[0];if(!f)return;var rd=new FileReader();
  rd.onload=function(){impRows=Importer.parseCSV(rd.result);impCsvApply();};rd.readAsText(f);};
 inp.click();
}
function impCsvApply(){
 if(!impRows)return;
 impOpts.currency=el('imp-ccur')?el('imp-ccur').value:impOpts.currency;
 var r=Importer.fromRows(impRows,impOpts);
 if(r.error){impItems=[];impNote=r.error+'. Revisa que la primera fila tenga encabezados como Fecha, Descripción y Monto.';return impReview();}
 impSetItems(r.items,r.items.length+' movimientos en el archivo · fechas '+(r.dateOrder==='dmy'?'día/mes/año':'mes/día/año'));
}
function impOpt(k,v){impOpts[k]=v;if(k==='expensesPositive')impOpts[k]=!!v;impCsvApply();rImportar();impCsvApply();}
function impToggle(i){impItems[i].on=!impItems[i].on;impReview();}
function impAll(on){impItems.forEach(function(it){it.on=on;});impReview();}
function impField(i,k,v){impItems[i][k]=v;}
function impAmount(i,v){var n=Importer.amountNumber(v);if(!isNaN(n))impItems[i].amount=Math.abs(n);}
function impReview(){
 var box=el('imp-review');if(!box)return;
 var n=impItems.filter(function(i){return i.on;}).length,dups=impItems.filter(function(i){return i.dup;}).length;
 box.innerHTML=(impNote?'<div class="note">'+esc(impNote)+(dups?' · '+dups+' ya estaban registrados (desmarcados)':'')+'</div>':'')
  +(impItems.length?'<div class="card" style="padding:6px 14px">'+impItems.map(function(it,i){
    return '<div class="imp-row'+(it.dup?' dup':'')+'"><button class="chip '+(it.on?'on':'')+'" aria-pressed="'+!!it.on+'" onclick="impToggle('+i+')">'+(it.on?'✓':'')+'</button>'
     +'<div class="imp-m"><input class="imp-in" value="'+esc(it.desc)+'" aria-label="Descripción" oninput="impField('+i+',\'desc\',this.value)">'
     +'<div class="imp-s"><span>'+it.date+' · '+(it.kind==='gasto'?'gasto':'ingreso')+(it.dup?' · posible duplicado':'')+'</span>'
     +(it.kind==='gasto'?'<select aria-label="Categoría" onchange="impField('+i+',\'cat\',this.value)">'+Object.keys(CATS).map(function(c){return '<option'+(c===it.cat?' selected':'')+'>'+c+'</option>';}).join('')+'</select>':'')+'</div></div>'
     +'<div class="imp-a"><input class="imp-in num" inputmode="decimal" value="'+it.amount+'" aria-label="Monto" oninput="impAmount('+i+',this.value)"><span>'+it.currency+'</span></div></div>';
   }).join('')+'</div><div class="dash-actions"><button onclick="impAll(true)">Marcar todo</button><button onclick="impAll(false)">Desmarcar</button></div>'
   +'<button class="btn" style="width:100%" onclick="impCommit()">Importar '+n+(n===1?' movimiento':' movimientos')+'</button>':'');
}
function impCommit(){
 var sel=impItems.filter(function(i){return i.on&&i.amount>0&&i.desc;});
 if(!sel.length)return toast('No hay movimientos marcados');
 var raro=sel.filter(function(it){return montoDudoso(it.amount,it.currency,it.kind==='gasto'?'gasto':'ingreso');})[0];
 if(raro&&!confirm('Hay montos que parecen tener la moneda equivocada, por ejemplo "'+raro.desc+'" ('+raro.amount.toLocaleString('en-US')+' '+raro.currency+').\n\nAceptar = importar así. Cancelar = revisar.'))return;
 var batch=uid();
 sel.forEach(function(it){
  if(it.kind==='gasto')D.expenses.push({id:uid(),date:it.date,desc:it.desc,amount:it.amount,currency:it.currency,category:it.cat||'Otros',spread:1,importBatch:batch});
  else D.income.push({id:uid(),date:it.date,source:it.desc,amount:it.amount,currency:it.currency,importBatch:batch});
 });
 D.settings.lastImport=batch;save();impItems=[];impRows=null;impNote='';rImportar();toast(sel.length+' movimientos importados ✓');
}
function impUndo(){
 var b=D.settings.lastImport;if(!b)return;
 var n=D.expenses.filter(function(o){return o.importBatch===b;}).length+D.income.filter(function(o){return o.importBatch===b;}).length;
 if(!n||!confirm('¿Deshacer la última importación ('+n+' movimientos)?'))return;
 D.expenses=D.expenses.filter(function(o){return o.importBatch!==b;});D.income=D.income.filter(function(o){return o.importBatch!==b;});
 delete D.settings.lastImport;save();rImportar();toast('Importación deshecha');
}
function impCopyLink(){
 var u=impSite()+'#add?monto=MONTO&desc=COMERCIO&moneda=USD';
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(function(){toast('Enlace copiado ✓');});else toast(u);
}
/* Camino corto: copiar el aviso del banco y tocar un botón dentro de Finanzas. */
async function quickNotice(){
 var text='';
 try{if(navigator.clipboard&&navigator.clipboard.readText)text=await navigator.clipboard.readText();}catch(e){}
 var item=Importer.parseMessage(text,{today:today()});
 if(item)return quickNoticeReview(item);
 quickNoticePaste(text);
}
function quickNoticePaste(text){
 sheet('Pegar aviso del banco',
  '<div class="quick-notice-intro"><span>1</span><div><b>Copia la notificación</b><p>Desde Mensajes, correo o la app de tu banco.</p></div></div>'
  +'<div class="quick-notice-intro"><span>2</span><div><b>Pégala aquí</b><p>La revisas antes de añadirla.</p></div></div>'
  +'<div class="f"><textarea id="quick-notice-text" rows="5" placeholder="Pagaste $15.000 en TIENDA D1" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:14px">'+esc(text||'')+'</textarea></div>',
  '<button class="btn" onclick="quickNoticeRead()">Leer aviso</button><button class="btn ghost" onclick="closeSheet()">Cancelar</button>');
}
function quickNoticeRead(){
 var item=Importer.parseMessage(val('quick-notice-text'),{today:today()});
 if(!item)return toast('No encontré el monto. Pega el aviso completo.');
 quickNoticeReview(item);
}
function quickNoticeReview(item){
 quickNoticeItem=Importer.markDuplicates([item],D)[0];
 quickNoticeItem.cat=quickNoticeItem.kind==='gasto'?(detectarCat(quickNoticeItem.desc)||'Otros'):'';
 _cur=quickNoticeItem.currency||'USD';
 sheet('Revisar movimiento',
  (quickNoticeItem.dup?'<div class="warn"><b>Posible duplicado.</b> Ya existe un movimiento parecido.</div>':'')
  +'<div class="seg mini" id="quick-kind"><button data-kind="gasto" class="'+(quickNoticeItem.kind==='gasto'?'on':'')+'" onclick="quickNoticeKind(\'gasto\')">Gasto</button><button data-kind="ingreso" class="'+(quickNoticeItem.kind==='ingreso'?'on':'')+'" onclick="quickNoticeKind(\'ingreso\')">Ingreso</button></div>'
  +fAmount(quickNoticeItem.amount,_cur)+fText('quick-desc','Descripción',quickNoticeItem.desc,'Comercio o concepto')
  +'<div class="f" id="quick-cat-wrap"'+(quickNoticeItem.kind==='ingreso'?' style="display:none"':'')+'><label>Categoría</label><select id="quick-cat">'+Object.keys(CATS).map(function(c){return '<option'+(c===quickNoticeItem.cat?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select></div>'
  +fText('quick-date','Fecha',quickNoticeItem.date||today(),'','date')
  +'<div class="note">Puedes corregir cualquier dato antes de añadirlo.</div>',
  '<button class="btn" onclick="quickNoticeSave()">Añadir</button>'+(quickNoticeItem.kind==='gasto'?'<button class="btn ghost" onclick="quickNoticeDebt()">Me lo deben</button>':'')+'<button class="btn ghost" onclick="closeSheet()">No, descartar</button>');
}
function quickNoticeKind(kind){
 quickNoticeItem.kind=kind;var seg=el('quick-kind');if(seg)Array.prototype.forEach.call(seg.querySelectorAll('button'),function(b){b.classList.toggle('on',b.dataset.kind===kind);});
 var cat=el('quick-cat-wrap');if(cat)cat.style.display=kind==='gasto'?'block':'none';
}
function quickNoticeValues(){return {kind:quickNoticeItem.kind,amount:num('f-amount'),currency:_cur,desc:val('quick-desc'),date:val('quick-date')||today(),cat:el('quick-cat')?val('quick-cat'):'Otros'};}
function quickNoticeSave(){
 var x=quickNoticeValues();if(!(x.amount>0)||!x.desc)return toast('Revisa el monto y la descripción');
 if(!confirmarMonto(x.amount,x.currency,x.kind))return;
 if(x.kind==='gasto')D.expenses.push({id:uid(),date:x.date,desc:x.desc,amount:x.amount,currency:x.currency,category:x.cat||'Otros',spread:1});
 else D.income.push({id:uid(),date:x.date,source:x.desc,amount:x.amount,currency:x.currency});
 save();closeSheet();refresh();toast('Movimiento añadido ✓');
}
function quickNoticeDebt(){
 var x=quickNoticeValues();if(!(x.amount>0)||!x.desc)return toast('Revisa el monto y la descripción');
 quickNoticeItem=Object.assign(quickNoticeItem,x);
 sheet('¿Quién te lo debe?','<div class="card quick-debt-summary"><b>'+esc(x.desc)+'</b><strong class="num">'+fmt(x.amount,x.currency)+'</strong></div>'+fText('quick-debtor','Persona','','Nombre')+'<div class="note">Se guardará el gasto y también una cuenta por cobrar a esa persona.</div>','<button class="btn" onclick="quickNoticeSaveDebt()">Guardar deuda</button><button class="btn ghost" onclick="closeSheet()">Cancelar</button>');
}
function quickNoticeSaveDebt(){
 var who=val('quick-debtor'),x=quickNoticeItem;if(!who)return toast('Escribe quién te lo debe');
 D.expenses.push({id:uid(),date:x.date,desc:x.desc,amount:x.amount,currency:x.currency,category:x.cat||'Otros',spread:1});
 D.receivables.push({id:uid(),debtor:who,concept:x.desc,amount:x.amount,currency:x.currency});
 save();closeSheet();refresh();toast('Gasto y deuda guardados ✓');
}
function rImportar(){
 var last=D.settings.lastImport?D.expenses.concat(D.income).filter(function(o){return o.importBatch===D.settings.lastImport;}).length:0;
 el('s-importar').innerHTML=
  '<div class="dash-intro"><div class="eyebrow">Sin escribir uno por uno</div><h1>Importar movimientos.</h1><p>La forma fácil es copiar un aviso del banco y tocar Pegar aviso. Para muchos movimientos también puedes usar un extracto CSV.</p></div>'
  +'<button class="btn quick-notice-main" onclick="quickNotice()">📋 Pegar un aviso del banco</button>'
  +'<details class="more"><summary>Pegar varios avisos <span>Nequi, Nu y bancos</span></summary><div class="card">'
  +'<div class="f"><textarea id="imp-text" rows="4" placeholder="Pagaste $15.000 en TIENDA D1&#10;Chase: $16.56 transaction with WENDYS" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:14px"></textarea></div>'
  +'<div class="f2"><div class="f"><label for="imp-cur">Moneda</label><select id="imp-cur"><option value="auto">Detectar</option><option value="USD"'+(impMsgCur==='USD'?' selected':'')+'>USD</option><option value="COP"'+(impMsgCur==='COP'?' selected':'')+'>COP</option></select></div><div class="f"><label>&nbsp;</label><button class="btn" onclick="impReadText()">Leer</button></div></div>'
  +'<div class="note" style="padding-bottom:0">Puedes pegar varios mensajes separados por una línea en blanco, o uno por línea.</div></div></details>'
  +'<div class="sec">Archivo CSV del banco</div><div class="card">'
  +'<div class="f2"><div class="f"><label for="imp-ccur">Moneda</label><select id="imp-ccur" onchange="impOpt(\'currency\',this.value)"><option'+(impOpts.currency==='USD'?' selected':'')+'>USD</option><option'+(impOpts.currency==='COP'?' selected':'')+'>COP</option></select></div>'
  +'<div class="f"><label for="imp-dord">Fechas</label><select id="imp-dord" onchange="impOpt(\'dateOrder\',this.value)"><option value="auto"'+(impOpts.dateOrder==='auto'?' selected':'')+'>Automático</option><option value="mdy"'+(impOpts.dateOrder==='mdy'?' selected':'')+'>Mes/día/año</option><option value="dmy"'+(impOpts.dateOrder==='dmy'?' selected':'')+'>Día/mes/año</option></select></div></div>'
  +'<div class="sp-who" style="margin-bottom:10px"><button class="chip '+(impOpts.expensesPositive?'on':'')+'" aria-pressed="'+impOpts.expensesPositive+'" onclick="impOpt(\'expensesPositive\','+(!impOpts.expensesPositive)+')">En mi archivo los gastos son positivos</button></div>'
  +'<button class="btn" style="width:100%" onclick="impPickFile()">Elegir archivo CSV</button>'
  +'<div class="note" style="padding:10px 0 0">Funciona con columnas Fecha, Descripción y Monto, o con Débito y Crédito separados. Los archivos no salen de tu celular.</div></div>'
  +'<div id="imp-review" style="margin-top:14px"></div>'
  +(last?'<div class="dash-actions"><button onclick="impUndo()">Deshacer última importación ('+last+')</button></div>':'')
  +'<details class="more"><summary>Automatización avanzada <span>Opcional</span></summary><div class="card">'
  +'<div class="note" style="padding-top:0"><b>No necesitas configurar esto.</b> Pegar aviso funciona con cualquier banco. Esta opción es solo para quien quiera experimentar con automatizaciones de iPhone.</div>'
  +'<p class="note">En <b>Atajos → Automatización → Transacción</b>:</p>'
  +'<ol class="imp-steps"><li>Acción <b>Abrir URL</b>.</li><li>Escribe <code>'+esc(impSite())+'#add?monto=</code>, inserta la variable <b>Cantidad</b>, luego <code>&amp;desc=</code> y la variable <b>Comerciante</b>.</li><li>Elige <b>Ejecutar inmediatamente</b> si te lo permite.</li></ol>'
  +'<div class="warn" style="margin-bottom:10px"><b>Ojo con iOS:</b> los atajos abren el enlace en Safari, no en la app de tu pantalla de inicio, y las dos guardan sus datos por separado. Úsalo solo si trabajas desde Safari. Para la app instalada hace falta la versión con cuenta en la nube.</div>'
  +'<p class="note" style="padding-bottom:6px">La app se abre con el gasto ya lleno y solo tocas Guardar. Los datos viajan después del <b>#</b>, así que no llegan a ningún servidor. Parámetros: <code>monto</code>, <code>desc</code>, <code>moneda</code> (siempre USD, salvo que pongas <code>moneda=COP</code>), <code>fecha</code>, <code>tipo=ingreso</code>.</p>'
  +'<button class="btn gh" style="width:100%" onclick="impCopyLink()">Copiar enlace de ejemplo</button></div></details>'
  +'<div class="sec">Exportar</div><div class="card"><button class="btn gh" style="width:100%;color:var(--tx)" onclick="impExportCSV()">Descargar todos los movimientos (CSV)</button></div>';
 impReview();
}
/* Enlace profundo: #add?monto=..&desc=..&moneda=..&fecha=..&tipo=ingreso */
function handleDeepLink(){
 var h=String(location.hash||'');
 if(h.indexOf('#add')!==0)return;
 var q={};try{new URLSearchParams(h.split('?')[1]||'').forEach(function(v,k){q[k.toLowerCase()]=v;});}catch(e){}
 try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
 var ing=/^ing/i.test(q.tipo||'');
 var raw=String(q.monto||q.amount||''),amt=Importer.amountNumber(raw);
 // Apple Pay: tus tarjetas son en dólares. Solo es COP si el atajo lo dice (moneda=COP); aquí no se adivina.
 var cur=/^(cop|peso)/i.test(String(q.moneda||q.currency||''))?'COP':'USD';
 openAdd(ing?'ingreso':'gasto');
 if(!isNaN(amt)&&amt!==0){el('f-amount').value=Math.abs(amt);fitAmt(el('f-amount'));}
 setCur(cur);
 var d=q.desc||q.comercio||q.merchant||'';
 if(ing){if(d)el('f-src').value=d;}else{if(d){el('f-desc').value=d;autoCat();}}
 if(q.fecha&&/^\d{4}-\d{2}-\d{2}$/.test(q.fecha))el('f-date').value=q.fecha;
 updWeek();
}
TITLES.importar='Importar';SUBS.importar=1;
