/* Pure calculations. Amounts returned in USD; dates are local calendar dates. */
(function(root){
'use strict';
/* Áreas fijas + los proyectos/negocios que cada usuario crea (se registran con setProjects al cargar los datos). */
const baseAreas=['Personal','Inversiones','Carro','Viajes','Extraordinarios'];
const areas=baseAreas.slice();
let projectNames=[];
function setProjects(list){
 projectNames=(list||[]).map(p=>typeof p==='string'?p:p&&p.name).filter(Boolean);
 areas.length=0;['Personal'].concat(projectNames,baseAreas.slice(1)).forEach(a=>areas.push(a));
}
function area(o){
 if(areas.includes(o.area)) return o.area;
 if(projectNames.includes(o.venture)) return o.venture;
 if(projectNames.includes(o.category)) return o.category;
 // datos antiguos que todavía no se migraron a proyectos
 if(o.area==='Saava'||o.area==='USPORTS') return o.area;
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
 return d.income.concat(d.cafe_hours.map(h=>({id:h.id,date:h.date,source:'Salario por horas',amount:Number(h.hours)*Number(d.settings.rate||0),currency:d.settings.rateCurrency==='COP'?'COP':'USD',area:'Personal',generatedSalary:true,hours:Number(h.hours)})));
}
function weekly(d,start,scope='Todos'){
 const end=plus(start,6), inside=o=>o.date>=start&&o.date<=end;
 const inc=incomes(d).filter(o=>inside(o)&&(scope==='Todos'||area(o)===scope));
 const exp=d.expenses.filter(o=>inside(o)&&(scope==='Todos'||area(o)===scope));
 const hours=(scope==='Todos'||scope==='Personal')?d.cafe_hours.filter(inside).reduce((s,o)=>s+Number(o.hours),0):0;
 const received=inc.reduce((s,o)=>s+usd(d,o),0), spent=exp.reduce((s,o)=>s+usd(d,o),0);
 return {start,end,hours,received,spent,net:received-spent,tips:inc.filter(isTip).reduce((s,o)=>s+usd(d,o),0),salary:usd(d,{amount:hours*Number(d.settings.rate||0),currency:d.settings.rateCurrency==='COP'?'COP':'USD'}),income:inc,expenses:exp};
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
/* ── Ingresos recurrentes (sueldo, quincena, arriendo, freelance…) ──
   r: {id,name,kind:'sueldo'|'extra',amount,currency,freq:'semanal'|'quincenal'|'mensual',days:[15,30],day:5,weekday:5,start,skipped:[]}
   Los días mayores al último del mes se ajustan al último día (30 en febrero = 28). */
function monthLast(y,m){return new Date(y,m,0,12).getDate();}
function payDates(r,from,to){
 const out=[],lo=r.start&&r.start>from?r.start:from;
 if(!lo||!to||lo>to)return out;
 if(r.freq==='semanal'){
  let t=lo;const wd=Number(r.weekday);
  while(date(t).getDay()!==wd&&t<=to)t=plus(t,1);
  for(;t<=to;t=plus(t,7))out.push(t);
  return out;
 }
 const days=r.freq==='quincenal'?(r.days&&r.days.length?r.days:[15,30]):[r.day||1];
 let y=Number(lo.slice(0,4)),m=Number(lo.slice(5,7));const ey=Number(to.slice(0,4)),em=Number(to.slice(5,7));
 while(y<ey||(y===ey&&m<=em)){
  const last=monthLast(y,m);
  days.forEach(dd=>{const day=Math.min(Math.max(1,Number(dd)||1),last),t=y+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0');if(t>=lo&&t<=to&&!out.includes(t))out.push(t);});
  m++;if(m>12){m=1;y++;}
 }
 return out.sort();
}
function pendingIncome(d,today,lookback){
 const from=plus(today,-(lookback||45)),items=[];
 (d.recurring||[]).forEach(r=>payDates(r,from,today).forEach(dt=>{
  const done=(d.income||[]).some(i=>i.recurringId===r.id&&i.recurringDate===dt),skipped=(r.skipped||[]).includes(dt);
  if(!done&&!skipped)items.push({rec:r,date:dt});
 }));
 return items.sort((a,b)=>a.date.localeCompare(b.date));
}
function nextPay(d,today){
 let best=null;
 (d.recurring||[]).forEach(r=>{const next=payDates(r,plus(today,1),plus(today,62))[0];if(next&&(!best||next<best.date))best={rec:r,date:next};});
 return best;
}
/* ── Gastos fijos (arriendo, servicios, cuota del carro…): mismo calendario que los ingresos recurrentes ── */
function billMonthly(b){const a=Number(b.amount)||0;return b.freq==='quincenal'?a*2:b.freq==='semanal'?a*52/12:a;}
function billDone(d,b,dt){return (d.expenses||[]).some(e=>e.fixedId===b.id&&e.fixedDate===dt);}
function pendingBills(d,today,lookback){
 const from=plus(today,-(lookback||45)),items=[];
 (d.bills||[]).forEach(b=>payDates(b,from,today).forEach(dt=>{if(!billDone(d,b,dt)&&!(b.skipped||[]).includes(dt))items.push({bill:b,date:dt});}));
 return items.sort((a,b)=>a.date.localeCompare(b.date));
}
function nextBill(d,today){
 let best=null;
 (d.bills||[]).forEach(b=>{const next=payDates(b,plus(today,1),plus(today,62))[0];if(next&&(!best||next<best.date))best={bill:b,date:next};});
 return best;
}
/* Lo que falta por pagar este mes en gastos fijos, en USD. Solo cuenta categorías con tope mensual (las demás no restan del presupuesto). */
function billsPendingMonth(d,month,budgets){
 const from=month+'-01',to=lastDay(month);let total=0;
 (d.bills||[]).forEach(b=>{
  if(budgets&&!(Number(budgets[b.category])>0))return;
  payDates(b,from,to).forEach(dt=>{if(!billDone(d,b,dt)&&!(b.skipped||[]).includes(dt))total+=usd(d,b);});
 });
 return total;
}
/* ── Alertas de gasto: reglas por palabras (pádel, fría…) con tope mensual o semanal ──
   rule: {id,name,words:['padel','fria'],cap:USD,period:'mes'|'semana'} */
function watchMatches(rule,desc){
 const n=' '+key(desc)+' ';
 return (rule.words||[]).some(w=>{const k=key(w);return k&&(k.length>=5?n.includes(k):n.includes(' '+k+' '));});
}
function watchRange(rule,today){return rule.period==='semana'?range('semana',today):range('mes',today);}
function watchSpent(d,rule,today){
 const r=watchRange(rule,today);
 return (d.expenses||[]).filter(e=>e.date>=r.start&&e.date<=r.end&&watchMatches(rule,e.desc)).reduce((s,e)=>s+usd(d,e),0);
}
function watchStatus(d,rule,today,extra){
 const cap=Number(rule.cap)||0,spent=watchSpent(d,rule,today)+(Number(extra)||0);
 return {spent,cap,left:cap-spent,pct:cap>0?spent/cap*100:0,over:cap>0&&spent>cap,near:cap>0&&spent>=cap*0.8};
}
/* Cómo te pagan: por horas (como el café), sueldo fijo, variable o nada. Sin elección guardada, se deduce de tus datos. */
function workMode(d){
 const w=(d.settings||{}).work;if(w&&w.mode)return w.mode;
 return (Number((d.settings||{}).rate)>0||(d.cafe_hours||[]).length)?'horas':'ninguno';
}
function workTips(d){
 const w=(d.settings||{}).work;if(w&&w.tips!==undefined)return !!w.tips;
 return (d.cafe_hours||[]).length>0||(d.income||[]).some(isTip);
}
/* CDT y cajitas: rendimiento por tasa efectiva anual (EA). value = capital + rendimiento neto causado hasta hoy. */
function daysBetween(a,b){return Math.round((date(b)-date(a))/86400000);}
function fixedStats(f,today){
 const P=Number(f.principal)||0,r=(Number(f.rate)||0)/100,w=(Number(f.withholding)||0)/100;
 const term=Number(f.days)>0?Number(f.days):null;
 const raw=Math.max(0,daysBetween(f.start,today)),elapsed=term?Math.min(raw,term):raw;
 const gross=n=>P*(Math.pow(1+r,n/365)-1);
 const out={principal:P,elapsed,term,remaining:term?Math.max(0,term-raw):null,maturity:term?plus(f.start,term):null,matured:term?raw>=term:false,
  accruedGross:gross(elapsed),accruedNet:gross(elapsed)*(1-w),perMonth:gross(30)*(1-w),perYear:P*r*(1-w)};
 out.value=P+out.accruedNet;
 if(term){const g=gross(term);out.atMaturity={gross:g,net:g*(1-w),payout:P+g*(1-w)};}
 return out;
}
function colombiaOn(d){const s=d.settings||{};return s.colombiaOn!==undefined?!!s.colombiaOn:!!s.colombia;}
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
 (d.fixed||[]).forEach(x=>{const s=fixedStats(x,today);if(s.term&&!s.matured&&s.remaining<=7)out.push({title:(x.kind||'CDT')+' vence pronto',text:(x.name||'Inversión')+' · '+s.maturity+' · recibirás '+usd(d,{amount:s.atMaturity.payout,currency:x.currency}).toFixed(2)+' USD.',target:'portafolio'});else if(s.matured&&s.term)out.push({title:(x.kind||'CDT')+' vencido',text:(x.name||'Inversión')+' ya venció: puedes retirarlo o renovarlo.',target:'portafolio'});});
 d.cards.forEach(c=>{if(Number(c.limit)>0&&Number(c.balance)/c.limit>=.8)out.push({title:'Poco cupo en '+c.name,text:'Has usado '+Math.round(c.balance/c.limit*100)+'% del cupo.',target:'tarjetas'});});
 d.payables.forEach(p=>{const due=p.dueDate||p.vence;if(/^\d{4}-\d{2}-\d{2}$/.test(due||'')&&due<=plus(today,7))out.push({title:due<today?'Pago vencido':'Pago próximo',text:(p.debtor||'Deuda')+' · '+due+' · '+usd(d,p).toFixed(2)+' USD.',target:'pagar'});});
 const month=today.slice(0,7), received=incomes(d).filter(o=>o.date.slice(0,7)===month).reduce((s,o)=>s+usd(d,o),0), spent=d.expenses.filter(o=>o.date.slice(0,7)===month).reduce((s,o)=>s+usd(d,o),0);
 if(spent>received)out.push({title:'El mes tiene balance negativo',text:'Salidas superiores a los ingresos (incluidas horas) por '+(spent-received).toFixed(2)+' USD.',target:'movs'});
 if(colombiaOn(d)&&d.settings.colombia){let p=projection(d);if(p.net<0||p.initial<0)out.push({title:'Revisa tu plan Colombia',text:p.initial<0?'El efectivo inicial no cubre las reservas y la mudanza.':'El escenario pierde '+(-p.net).toFixed(2)+' USD al mes.',target:'colombia'});}
 return out;
}
const api={incomes,areas,setProjects,area,usd,iso,plus,monday,isTip,weekly,weeklyBudget,projection,alerts,colombiaOn,fixedStats,daysBetween,payDates,pendingIncome,nextPay,workMode,workTips,watchMatches,watchSpent,watchStatus,billMonthly,pendingBills,nextBill,billsPendingMonth,lastDay,range,shift,span,key};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Finance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
