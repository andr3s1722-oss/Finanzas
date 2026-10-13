/* Pure Splitwise-style maths. Balance = what each person owes ME, per currency (negative = I owe them). */
(function(root){
'use strict';
function cents(n){return Math.round((Number(n)||0)*100)/100;}
function equal(amount,who){
 const n=who.length;if(!n)return [];
 const total=Math.round((Number(amount)||0)*100),base=Math.floor(total/n),extra=total-base*n;
 return who.map((w,i)=>({who:w,share:(base+(i<extra?1:0))/100}));
}
function balances(d){
 const out={};
 const add=(id,cur,v)=>{if(id==='me'||!id)return;out[id]=out[id]||{};out[id][cur]=cents((out[id][cur]||0)+v);};
 (d.splits||[]).forEach(e=>{
  const cur=e.currency||'USD';
  if(e.kind==='pago'){
   const a=Number(e.amount)||0;
   if(e.from==='me')add(e.to,cur,a);else if(e.to==='me')add(e.from,cur,-a);
  }else(e.parts||[]).forEach(p=>{
   const s=Number(p.share)||0;
   if(p.who===e.payer)return;
   if(e.payer==='me')add(p.who,cur,s);else if(p.who==='me')add(e.payer,cur,-s);
  });
 });
 Object.keys(out).forEach(id=>Object.keys(out[id]).forEach(c=>{if(Math.abs(out[id][c])<0.005)delete out[id][c];}));
 return out;
}
function myShare(e){const p=(e.parts||[]).find(x=>x.who==='me');return p?cents(p.share):0;}
function totalsUSD(d,fx){
 const b=balances(d);let owed=0,owe=0;
 Object.keys(b).forEach(id=>Object.keys(b[id]).forEach(c=>{
  const v=c==='COP'?b[id][c]/(Number(fx)||4100):b[id][c];
  if(v>0)owed+=v;else owe+=-v;
 }));
 return {owed,owe,net:owed-owe};
}
function involving(d,id){
 return (d.splits||[]).filter(e=>e.kind==='pago'?(e.from===id||e.to===id):(e.payer===id||(e.parts||[]).some(p=>p.who===id)));
}
/* Movimientos entre tú y una persona, con signo desde tu punto de vista: + te debe, − le debes. */
function statement(d,id){
 const lines=[];
 (d.splits||[]).forEach(e=>{
  const cur=e.currency||'USD';
  if(e.kind==='pago'){
   if(e.from===id&&e.to==='me')lines.push({date:e.date,desc:'Pago recibido',amount:-Number(e.amount),currency:cur,type:'pago'});
   else if(e.from==='me'&&e.to===id)lines.push({date:e.date,desc:'Pago que hice',amount:Number(e.amount),currency:cur,type:'pago'});
   return;
  }
  const mine=(e.parts||[]).find(p=>p.who==='me'),theirs=(e.parts||[]).find(p=>p.who===id);
  if(e.payer==='me'&&theirs)lines.push({date:e.date,desc:e.desc,amount:Number(theirs.share),currency:cur,type:'gasto'});
  else if(e.payer===id&&mine)lines.push({date:e.date,desc:e.desc,amount:-Number(mine.share),currency:cur,type:'gasto'});
 });
 lines.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 return {lines,balance:balances(d)[id]||{}};
}
/* Mensaje de cobro. opts: {name, lang:'es'|'en', payInfo, fmt(amount,currency), day(date), limit} */
function statementText(d,id,opts){
 opts=opts||{};
 const es=opts.lang!=='en',st=statement(d,id),fmt=opts.fmt||((a,c)=>c+' '+Math.abs(a).toFixed(2)),day=opts.day||(x=>x),limit=opts.limit||20;
 const cur=Object.keys(st.balance).filter(c=>Math.abs(st.balance[c])>=0.005);
 const owe=cur.filter(c=>st.balance[c]>0),iowe=cur.filter(c=>st.balance[c]<0);
 const shown=st.lines.slice(-limit),hidden=st.lines.length-shown.length;
 const out=[];
 out.push(es?('Hola '+(opts.name||'')+'! Te dejo el resumen de lo que hemos dividido:'):('Hi '+(opts.name||'')+'! Here is the summary of what we have split:'));
 out.push('');
 if(hidden>0)out.push(es?('(+'+hidden+' movimientos anteriores)'):('(+'+hidden+' earlier items)'));
 shown.forEach(l=>out.push('• '+day(l.date)+' · '+l.desc+': '+(l.amount>=0?'+':'−')+fmt(Math.abs(l.amount),l.currency)));
 out.push('');
 if(!cur.length)out.push(es?'Estamos al día. ¡Gracias!':'We are all settled. Thanks!');
 else{
  if(owe.length)out.push((es?'Total que me debes: ':'Total you owe me: ')+owe.map(c=>fmt(st.balance[c],c)).join(' + '));
  if(iowe.length)out.push((es?'Total que te debo: ':'Total I owe you: ')+iowe.map(c=>fmt(-st.balance[c],c)).join(' + '));
  if(opts.payInfo&&owe.length){out.push('');out.push((es?'Cómo pagarme: ':'How to pay me: ')+opts.payInfo);}
  out.push('');out.push(es?'¡Gracias!':'Thanks!');
 }
 return out.join('\n');
}
const api={equal,balances,myShare,totalsUSD,involving,cents,statement,statementText};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Split=api;
})(typeof globalThis!=='undefined'?globalThis:this);
