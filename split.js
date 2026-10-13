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
const api={equal,balances,myShare,totalsUSD,involving,cents};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Split=api;
})(typeof globalThis!=='undefined'?globalThis:this);
