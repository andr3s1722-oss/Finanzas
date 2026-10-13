/* Pure parsing for bank CSV files and pasted SMS/e-mail messages. No network, no storage. */
(function(root){
'use strict';
const norm=s=>String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const p2=n=>String(n).padStart(2,'0');
function amountNumber(raw){
 let t=String(raw==null?'':raw).trim();
 if(!t)return NaN;
 let neg=/^\(.*\)$/.test(t)||/^-|-$/.test(t)||/^[^\d]*-/.test(t);
 t=t.replace(/[^\d.,]/g,'');
 if(!t)return NaN;
 const dot=t.lastIndexOf('.'),com=t.lastIndexOf(',');
 if(dot>=0&&com>=0){const dec=dot>com?'.':',',mil=dec==='.'?',':'.';t=t.split(mil).join('').replace(dec,'.');}
 else if(com>=0){const p=t.split(',');t=(p.length===2&&p[1].length<=2)?p[0]+'.'+p[1]:p.join('');}
 else if(dot>=0){const p=t.split('.');if(!(p.length===2&&p[1].length<=2))t=p.join('');}
 const v=parseFloat(t);
 return isNaN(v)?NaN:(neg?-v:v);
}
/* Looks like Colombian pesos: "15.000", "$1.250.000", "45900". */
function looksCOP(raw){const t=String(raw).replace(/[^\d.,]/g,'');return /^\d{1,3}(\.\d{3})+$/.test(t)||/^\d{5,}$/.test(t);}
function parseCSV(text){
 text=String(text||'').replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/)[0]||'';
 const count=c=>{let n=0,q=false;for(const ch of first){if(ch==='"')q=!q;else if(ch===c&&!q)n++;}return n;};
 const delim=[';','\t',','].sort((a,b)=>count(b)-count(a))[0];
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=ch;}
  else if(ch==='"')q=true;
  else if(ch===delim){row.push(cell);cell='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(c=>c.trim()!==''))rows.push(row);row=[];}
  else cell+=ch;
 }
 row.push(cell);if(row.some(c=>c.trim()!==''))rows.push(row);
 return rows;
}
function detect(headers){
 const idx={date:-1,desc:-1,amount:-1,debit:-1,credit:-1};
 headers.forEach((h,i)=>{
  const n=norm(h);
  if(idx.date<0&&/^(fecha|date|posted|posting date|transaction date|fecha de la transaccion|fecha movimiento)/.test(n))idx.date=i;
  else if(idx.desc<0&&/(descripcion|description|detalle|concepto|merchant|comercio|payee|memo|nombre|name)/.test(n))idx.desc=i;
  else if(idx.debit<0&&/(debito|debit|retiro|cargo|salida|withdrawal)/.test(n))idx.debit=i;
  else if(idx.credit<0&&/(credito|credit|deposito|abono|entrada|deposit)/.test(n))idx.credit=i;
  else if(idx.amount<0&&/(monto|amount|valor|importe|total)/.test(n))idx.amount=i;
 });
 return idx;
}
function dateParts(s){
 s=String(s||'').trim();
 let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
 if(m)return {y:+m[1],a:+m[2],b:+m[3],iso:true};
 m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
 if(m)return {y:m[3].length===2?2000+ +m[3]:+m[3],a:+m[1],b:+m[2],iso:false};
 return null;
}
function parseDate(s,order){
 const d=dateParts(s);if(!d)return null;
 let y=d.y,mo,da;
 if(d.iso){mo=d.a;da=d.b;}else if(order==='mdy'){mo=d.a;da=d.b;}else{da=d.a;mo=d.b;}
 if(mo<1||mo>12||da<1||da>31)return null;
 return y+'-'+p2(mo)+'-'+p2(da);
}
function guessOrder(values,fallback){
 let dmy=false,mdy=false;
 values.forEach(v=>{const d=dateParts(v);if(!d||d.iso)return;if(d.a>12)dmy=true;if(d.b>12)mdy=true;});
 return dmy&&!mdy?'dmy':mdy&&!dmy?'mdy':fallback;
}
/* opts: {currency, dateOrder:'auto'|'dmy'|'mdy', expensesPositive:boolean} */
function fromRows(rows,opts){
 opts=opts||{};
 if(rows.length<2)return {items:[],error:'El archivo no tiene movimientos',columns:null};
 const cols=detect(rows[0]);
 if(cols.date<0||(cols.amount<0&&cols.debit<0&&cols.credit<0))return {items:[],error:'No encontré las columnas de fecha y monto',columns:cols};
 const body=rows.slice(1);
 const order=opts.dateOrder&&opts.dateOrder!=='auto'?opts.dateOrder:guessOrder(body.map(r=>r[cols.date]),opts.currency==='COP'?'dmy':'mdy');
 const items=[];
 body.forEach(r=>{
  const date=parseDate(r[cols.date],order);if(!date)return;
  let amt=NaN,kind='gasto';
  if(cols.amount>=0){
   amt=amountNumber(r[cols.amount]);
   if(isNaN(amt)||amt===0)return;
   if(opts.expensesPositive)kind=amt>0?'gasto':'ingreso';else kind=amt<0?'gasto':'ingreso';
  }else{
   const d=cols.debit>=0?amountNumber(r[cols.debit]):NaN,c=cols.credit>=0?amountNumber(r[cols.credit]):NaN;
   if(!isNaN(d)&&d!==0){amt=d;kind='gasto';}else if(!isNaN(c)&&c!==0){amt=c;kind='ingreso';}else return;
  }
  const desc=(cols.desc>=0?String(r[cols.desc]||'').trim():'')||'Sin descripción';
  items.push({date,desc,amount:Math.abs(amt),kind,currency:opts.currency||'USD'});
 });
 return {items,error:items.length?null:'No encontré movimientos válidos',columns:cols,dateOrder:order};
}
const IN=/\b(recibiste|recibido|recibi|te enviaron|te llegaron|te llego|te pagaron|te consignaron|consignacion|deposito|deposit|abono|reembolso|refund|received|payment received)\b/i;
function cleanDesc(s){return String(s||'').replace(/\s+/g,' ').replace(/[\s.,;:\-–]+$/,'').trim().slice(0,40);}
/* One pasted message (SMS / e-mail line) -> candidate or null. opts: {currency, today} */
function parseMessage(text,opts){
 opts=opts||{};
 const t=String(text||'').replace(/\s+/g,' ').trim();if(!t)return null;
 const m=t.match(/(US\$|USD|COP|\$)\s*([0-9][0-9.,]*[0-9]|[0-9])|([0-9][0-9.,]*[0-9]|[0-9])\s*(COP|USD|pesos|d[oó]lares)/i);
 if(!m)return null;
 const raw=m[2]||m[3],tag=(m[1]||m[4]||'').toLowerCase();
 let amount=Math.abs(amountNumber(raw));if(!amount||isNaN(amount))return null;
 let currency=/cop|peso/.test(tag)?'COP':/usd|us\$|d[oó]lar/.test(tag)?'USD':(opts.currency||(looksCOP(raw)?'COP':'USD'));
 if(!/cop|peso|usd|us\$|d[oó]lar/.test(tag)&&looksCOP(raw))currency='COP';
 const kind=IN.test(t)?'ingreso':'gasto';
 const stop='(?=\\s+(?:por|for|con|el|on|desde|from|using|usando|tarjeta|card|se|ha|fue|saldo|balance|ref)\\b|[.,;]|$)';
 const pats=kind==='ingreso'?['de','from','por']:['en','at','with','con','a','to','para'];
 let desc='';
 for(const p of pats){
  const r=t.match(new RegExp('\\b'+p+'\\s+([A-Za-zÀ-ÿ0-9&\'*#.\\- ]{2,40}?)'+stop,'i'));
  if(r&&!/^\$|^\d/.test(r[1].trim())){desc=cleanDesc(r[1]);if(desc)break;}
 }
 if(!desc)desc=cleanDesc(t.replace(m[0],'')).slice(0,30)||'Movimiento';
 let date=opts.today||null;
 const d=t.match(/\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/);
 if(d){const x=parseDate(d[0],currency==='COP'?'dmy':'mdy');if(x)date=x;}
 return {date,desc,amount,kind,currency};
}
function parseMessages(text,opts){
 const parts=String(text||'').split(/\n\s*\n|\r?\n(?=\s*(?:\[|nequi|nu\b|chase|amex|bancolombia|capital one|discover|bank of america|bofa))/i);
 const lines=parts.length>1?parts:String(text||'').split(/\r?\n/);
 return lines.map(l=>parseMessage(l,opts)).filter(Boolean);
}
/* Mark candidates that already exist (same currency & amount, date within one day, similar text). */
function markDuplicates(items,d){
 const day=s=>Math.round(Date.parse(s+'T12:00:00')/86400000);
 const pool=(d.expenses||[]).map(o=>({k:'gasto',date:o.date,amount:+o.amount,currency:o.currency||'USD',text:o.desc}))
  .concat((d.income||[]).map(o=>({k:'ingreso',date:o.date,amount:+o.amount,currency:o.currency||'USD',text:o.source})));
 return items.map(it=>Object.assign({},it,{dup:pool.some(o=>o.k===it.kind&&o.currency===it.currency&&Math.abs(o.amount-it.amount)<0.005&&Math.abs(day(o.date)-day(it.date))<=1)}));
}
function toCSV(d){
 const q=v=>{v=String(v==null?'':v);return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
 const rows=[['fecha','tipo','descripcion','categoria','area','monto','moneda']];
 const F=root.Finance||(typeof require!=='undefined'?require('./finance.js'):null);
 (d.expenses||[]).forEach(o=>rows.push([o.date,'gasto',o.desc,o.category,F?F.area(o):'',o.amount,o.currency||'USD']));
 (d.income||[]).forEach(o=>rows.push([o.date,'ingreso',o.source,'',F?F.area(o):'',o.amount,o.currency||'USD']));
 rows.sort((a,b)=>a===rows[0]?-1:b===rows[0]?1:String(b[0]).localeCompare(String(a[0])));
 return rows.map(r=>r.map(q).join(',')).join('\n');
}
const api={amountNumber,looksCOP,parseCSV,detect,parseDate,guessOrder,fromRows,parseMessage,parseMessages,markDuplicates,toCSV};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Importer=api;
})(typeof globalThis!=='undefined'?globalThis:this);
