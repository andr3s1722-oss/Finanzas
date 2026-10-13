/* Pure calculations. Amounts returned in USD; dates are local calendar dates. */
(function(root){
'use strict';
const areas=['Personal','Saava','USPORTS','Inversiones','Carro','Viajes','Extraordinarios'];
function area(o){
 if(areas.includes(o.area)) return o.area;
 if(o.venture==='Saava'||o.category==='Saava') return 'Saava';
 if(o.venture==='USPORTS'||o.category==='USPORTS') return 'USPORTS';
 if(['Ninas','Sequo','Inversiones'].includes(o.category)) return 'Inversiones';
 if(['Carro','Viajes','Extraordinarios'].includes(o.category)) return o.category;
 return 'Personal';
}
function weeklyBudget(d){
 const cop=Number(d.settings.weeklyBudgetCOP||0),rate=Number(d.settings.fx)||4100;
 return cop>0?cop/rate:Number(d.settings.weekly||0);
}
function usd(d,o,key='amount'){return Number(o[key]||0)/(o.currency==='COP'?Number(d.settings.fx)||4100:1);}
function date(s){return new Date(s+'T12:00:00');}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function plus(s,n){let d=date(s);d.setDate(d.getDate()+n);return iso(d);}
function monday(s){let d=date(s);d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d);}
function isTip(o){return o.incomeKind==='tips'||(!o.incomeKind&&/tip|propina/i.test(o.source||''));}
function incomes(d){
 return d.income.concat(d.cafe_hours.map(h=>({id:h.id,date:h.date,source:'Salario por horas',amount:Number(h.hours)*Number(d.settings.rate||0),currency:'USD',area:'Personal',generatedSalary:true,hours:Number(h.hours)})));
}
function weekly(d,start,scope='Todos'){
 const end=plus(start,6), inside=o=>o.date>=start&&o.date<=end;
 const inc=incomes(d).filter(o=>inside(o)&&(scope==='Todos'||area(o)===scope));
 const exp=d.expenses.filter(o=>inside(o)&&(scope==='Todos'||area(o)===scope));
 const hours=(scope==='Todos'||scope==='Personal')?d.cafe_hours.filter(inside).reduce((s,o)=>s+Number(o.hours),0):0;
 const received=inc.reduce((s,o)=>s+usd(d,o),0), spent=exp.reduce((s,o)=>s+usd(d,o),0);
 return {start,end,hours,received,spent,net:received-spent,tips:inc.filter(isTip).reduce((s,o)=>s+usd(d,o),0),salary:hours*Number(d.settings.rate||0),income:inc,expenses:exp};
}

function lastDay(m){const [y,mo]=m.split('-').map(Number);return iso(new Date(y,mo,0,12));}
function range(mode,anchor){
 if(mode==='mes'){const m=anchor.slice(0,7);return {start:m+'-01',end:lastDay(m)};}
 const start=monday(anchor);return {start,end:plus(start,6)};
}
function shift(mode,anchor,n){
 if(mode==='mes'){const [y,m]=anchor.slice(0,7).split('-').map(Number),x=new Date(y,m-1+n,1,12);return iso(x);}
 return plus(anchor,7*n);
}
function key(s){return String(s||'').toLowerCase().replace(/['’`]/g,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function sourceName(o){
 if(o.generatedSalary)return 'Salario por horas';
 if(isTip(o))return 'Propinas';
 if(area(o)==='Saava')return 'Saava';
 return o.source||'Otros';
}
function group(list,name,d,extra){
 const m={};
 list.forEach(o=>{const k=key(name(o))||'otros',g=m[k]||(m[k]={name:name(o),value:0,count:0,items:[]});g.value+=usd(d,o);g.count++;g.items.push(o);});
 return Object.keys(m).map(k=>m[k]).sort((a,b)=>b.value-a.value);
}
/* Totals, breakdowns and daily series for an inclusive date range. */
function span(d,start,end,scope='Todos'){
 const pick=o=>o.date>=start&&o.date<=end&&(scope==='Todos'||area(o)===scope);
 const income=incomes(d).filter(pick),expenses=d.expenses.filter(pick);
 const received=income.reduce((s,o)=>s+usd(d,o),0),spent=expenses.reduce((s,o)=>s+usd(d,o),0);
 const days=[];
 for(let t=start;t<=end;t=plus(t,1))days.push({date:t,in:0,out:0});
 const at={};days.forEach(x=>at[x.date]=x);
 income.forEach(o=>{if(at[o.date])at[o.date].in+=usd(d,o);});
 expenses.forEach(o=>{if(at[o.date])at[o.date].out+=usd(d,o);});
 return {start,end,received,spent,net:received-spent,income,expenses,days,
  byCategory:group(expenses,o=>o.category||'Otros',d),
  byMerchant:group(expenses,o=>o.desc||'Sin descripción',d),
  bySource:group(income,sourceName,d)};
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
 const budget=weeklyBudget(d);
 // Budget allocation respects spread, while weekly cash flow uses actual payment date.
 let allocated=0;
 d.expenses.filter(o=>area(o)==='Personal').forEach(o=>{
  const count=Math.max(1,Number(o.spread)||1),start=monday(o.date);
  for(let n=0;n<count;n++) if(plus(start,n*7)===w.start) allocated+=usd(d,o)/count;
 });
 if(budget>0&&allocated>=budget*.8) out.push({title:allocated>budget?'Presupuesto personal superado':'Cerca del límite semanal',text:'Asignado '+allocated.toFixed(2)+' USD de '+budget.toFixed(2)+' USD.',target:'presupuesto'});
 d.cards.forEach(c=>{if(Number(c.limit)>0&&Number(c.balance)/c.limit>=.8)out.push({title:'Poco cupo en '+c.name,text:'Has usado '+Math.round(c.balance/c.limit*100)+'% del cupo.',target:'tarjetas'});});
 d.payables.forEach(p=>{const due=p.dueDate||p.vence;if(/^\d{4}-\d{2}-\d{2}$/.test(due||'')&&due<=plus(today,7))out.push({title:due<today?'Pago vencido':'Pago próximo',text:(p.debtor||'Deuda')+' · '+due+' · '+usd(d,p).toFixed(2)+' USD.',target:'pagar'});});
 const month=today.slice(0,7), received=incomes(d).filter(o=>o.date.slice(0,7)===month).reduce((s,o)=>s+usd(d,o),0), spent=d.expenses.filter(o=>o.date.slice(0,7)===month).reduce((s,o)=>s+usd(d,o),0);
 if(spent>received)out.push({title:'El mes tiene balance negativo',text:'Salidas superiores a los ingresos (incluidas horas) por '+(spent-received).toFixed(2)+' USD.',target:'movs'});
 if(d.settings.colombia){let p=projection(d);if(p.net<0||p.initial<0)out.push({title:'Revisa tu plan Colombia',text:p.initial<0?'El efectivo inicial no cubre las reservas y la mudanza.':'El escenario pierde '+(-p.net).toFixed(2)+' USD al mes.',target:'colombia'});}
 return out;
}
const api={incomes,areas,area,usd,iso,plus,monday,isTip,weekly,weeklyBudget,projection,alerts,lastDay,range,shift,span,key};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Finance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
