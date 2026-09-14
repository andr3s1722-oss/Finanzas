/* Pure calculations. Amounts returned in USD; dates are local calendar dates. */
(function(root){
'use strict';
const areas=['Personal','Saava','Inversiones','Carro','Viajes','Extraordinarios'];
function area(o){
 if(areas.includes(o.area)) return o.area;
 if(o.venture==='Saava'||o.category==='Saava') return 'Saava';
 if(['Ninas','Sequo','Inversiones'].includes(o.category)) return 'Inversiones';
 if(['Carro','Viajes','Extraordinarios'].includes(o.category)) return o.category;
 return 'Personal';
}
function usd(d,o,key='amount'){return Number(o[key]||0)/(o.currency==='COP'?Number(d.settings.fx)||4100:1);}
function date(s){return new Date(s+'T12:00:00');}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function plus(s,n){let d=date(s);d.setDate(d.getDate()+n);return iso(d);}
function monday(s){let d=date(s);d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d);}
function isTip(o){return o.incomeKind==='tips'||(!o.incomeKind&&/tip|propina/i.test(o.source||''));}
function weekly(d,start,scope='Todos'){
 const end=plus(start,6), inside=o=>o.date>=start&&o.date<=end;
 const inc=d.income.filter(o=>inside(o)&&(scope==='Todos'||area(o)===scope));
 const exp=d.expenses.filter(o=>inside(o)&&(scope==='Todos'||area(o)===scope));
 const hours=(scope==='Todos'||scope==='Personal')?d.cafe_hours.filter(inside).reduce((s,o)=>s+Number(o.hours),0):0;
 const received=inc.reduce((s,o)=>s+usd(d,o),0), spent=exp.reduce((s,o)=>s+usd(d,o),0);
 return {start,end,hours,received,spent,net:received-spent,tips:inc.filter(isTip).reduce((s,o)=>s+usd(d,o),0),salary:hours*Number(d.settings.rate||0),income:inc,expenses:exp};
}
function projection(d){
 const p=d.settings.colombia||{};
 const net=Number(p.saavaRevenue||0)-Number(p.saavaCosts||0)+Number(p.otherIncome||0)-Number(p.livingCosts||0);
 const liquid=d.assets.filter(a=>a.type==='Liquidez').reduce((s,a)=>s+usd(d,a,'value'),0);
 const debt=d.payables.reduce((s,a)=>s+usd(d,a),0)+d.cards.reduce((s,a)=>s+usd(d,a,'balance'),0);
 const initial=liquid-Number(p.movingCost||0)-(p.reserveDebt?debt:0);
 return {net,liquid,debt,initial,tips:0,salary:0,months:Array.from({length:12},(_,i)=>({month:i+1,balance:initial+(i+1)*net})),runway:initial<0?0:net<0?initial/-net:null};
}
function alerts(d,today){
 const out=[], w=weekly(d,monday(today),'Personal');
 const budget=Number(d.settings.weekly||0);
 // Budget allocation respects spread, while weekly cash flow uses actual payment date.
 let allocated=0;
 d.expenses.filter(o=>area(o)==='Personal').forEach(o=>{
  const count=Math.max(1,Number(o.spread)||1),start=monday(o.date);
  for(let n=0;n<count;n++) if(plus(start,n*7)===w.start) allocated+=usd(d,o)/count;
 });
 if(budget>0&&allocated>=budget*.8) out.push({title:allocated>budget?'Presupuesto personal superado':'Cerca del límite semanal',text:'Asignado '+allocated.toFixed(2)+' USD de '+budget.toFixed(2)+' USD.',target:'presupuesto'});
 d.cards.forEach(c=>{if(Number(c.limit)>0&&Number(c.balance)/c.limit>=.8)out.push({title:'Poco cupo en '+c.name,text:'Has usado '+Math.round(c.balance/c.limit*100)+'% del cupo.',target:'tarjetas'});});
 d.payables.forEach(p=>{const due=p.dueDate||p.vence;if(/^\d{4}-\d{2}-\d{2}$/.test(due||'')&&due<=plus(today,7))out.push({title:due<today?'Pago vencido':'Pago próximo',text:(p.debtor||'Deuda')+' · '+due+' · '+usd(d,p).toFixed(2)+' USD.',target:'pagar'});});
 const month=today.slice(0,7), received=d.income.filter(o=>o.date.slice(0,7)===month).reduce((s,o)=>s+usd(d,o),0), spent=d.expenses.filter(o=>o.date.slice(0,7)===month).reduce((s,o)=>s+usd(d,o),0);
 if(spent>received)out.push({title:'El mes tiene flujo negativo',text:'Salidas superiores a los ingresos registrados por '+(spent-received).toFixed(2)+' USD.',target:'movs'});
 if(d.settings.colombia){let p=projection(d);if(p.net<0||p.initial<0)out.push({title:'Revisa tu plan Colombia',text:p.initial<0?'El efectivo inicial no cubre las reservas y la mudanza.':'El escenario pierde '+(-p.net).toFixed(2)+' USD al mes.',target:'colombia'});}
 return out;
}
const api={areas,area,usd,iso,plus,monday,isTip,weekly,projection,alerts};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Finance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
