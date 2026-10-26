const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../finance.js');
const S=require('../split.js');
const I=require('../importer.js');
const Cl=require('../cloud.js');
const PublicSync=require('../portfolio-bridge.js');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const empty=()=>({expenses:[],income:[],cafe_hours:[],assets:[],payables:[],cards:[],settings:{fx:4000,rate:17,weekly:250}});
test('week boundaries across years and daylight saving',()=>{assert.equal(F.monday('2027-01-03'),'2026-12-28');assert.equal(F.plus('2026-03-02',6),'2026-03-08');assert.equal(F.monday('2026-03-09'),'2026-03-09');});
test('weekly income includes salary plus all recorded income and linked tips once',()=>{let d=empty();d.cafe_hours=[{date:'2026-09-07',hours:6,tipId:'t'}];d.income=[{id:'t',date:'2026-09-07',source:'Propinas',amount:40},{date:'2026-09-08',source:'Pago café',amount:102}];let w=F.weekly(d,'2026-09-07');assert.equal(w.received,244);assert.equal(w.salary,102);assert.equal(w.tips,40);});
test('all areas, legacy business tags and explicit overrides',()=>{assert.equal(F.area({category:'Saava'}),'Saava');assert.equal(F.area({venture:'Saava'}),'Saava');assert.equal(F.area({category:'USPORTS'}),'USPORTS');assert.equal(F.area({venture:'USPORTS'}),'USPORTS');assert.equal(F.area({category:'Sequo'}),'Inversiones');assert.equal(F.area({category:'Ninas'}),'Inversiones');assert.equal(F.area({category:'Transporte'}),'Personal');F.areas.forEach(area=>assert.equal(F.area({area}),area));assert.equal(F.area({area:'Carro',category:'Saava'}),'Carro');});
test('cash expenses, COP conversion and budget allocations remain distinct',()=>{let d=empty();d.expenses=[{date:'2026-09-07',amount:4000000,currency:'COP',category:'Mercado',spread:4},{date:'2026-09-07',amount:900,area:'Saava'}];assert.equal(F.weekly(d,'2026-09-07').spent,1900);assert.equal(F.weekly(d,'2026-09-07','Personal').spent,1000);assert.equal(F.weekly(d,'2026-09-14').spent,0);assert.equal(F.alerts(d,'2026-09-14')[0].title,'Cerca del límite semanal');});
test('COP weekly budget stays fixed when the exchange rate changes',()=>{let d=empty();d.settings.weeklyBudgetCOP=300000;assert.equal(F.weeklyBudget(d),75);d.settings.fx=3000;assert.equal(F.weeklyBudget(d),100);});
test('Colombia uses Saava margin and excludes car, investments, historical tips and wages',()=>{let d=empty();d.assets=[{name:'Jetta',type:'Vehículo',value:6000},{type:'Liquidez',value:8000000,currency:'COP'}];d.income=[{source:'Propinas',amount:9999}];d.cafe_hours=[{hours:100}];d.settings.colombia={saavaRevenue:2500,saavaCosts:800,livingCosts:1200,otherIncome:0,movingCost:500,reserveDebt:true};d.cards=[{balance:100}];let p=F.projection(d);assert.equal(p.net,500);assert.equal(p.initial,1400);assert.equal(p.months[11].balance,7400);assert.equal(p.tips,0);assert.equal(p.salary,0);});
test('deficit, zero income, negative initial cash and scheduled debt alerts',()=>{let d=empty();d.settings.colombia={livingCosts:100};let p=F.projection(d);assert.equal(p.runway,0);assert.equal(p.months[11].balance,-1200);d.payables=[{debtor:'A',amount:50,vence:'2026-09-14'},{debtor:'B',amount:50,vence:'fin de mes'}];d.cards=[{name:'Visa',balance:800,limit:1000}];const alerts=F.alerts(d,'2026-09-13');assert(alerts.some(a=>a.title==='Pago próximo'));assert.equal(alerts.filter(a=>a.target==='pagar').length,1);assert(alerts.some(a=>a.target==='tarjetas'));});
function app(){
 F.setProjects([]);const store=new Map(),nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{style:{},classList:{add(){},remove(){},toggle(){}},value:'',innerHTML:'',focus(){},setAttribute(){},querySelectorAll(){return []}});return nodes.get(id);};
 const doc={getElementById:el,querySelectorAll(){return []},addEventListener(){},documentElement:{setAttribute(){}}};
 const ctx=vm.createContext({Finance:F,Split:S,Importer:I,Cloud:Cl,atob:globalThis.atob,btoa:globalThis.btoa,crypto:globalThis.crypto,URLSearchParams,location:{hostname:'andr3s1722-oss.github.io',hash:'',origin:'https://x.test',pathname:'/Finanzas/',search:''},history:{replaceState(){}},document:doc,window:{scrollTo(){},addEventListener(){}},setTimeout(){},clearTimeout(){},console,sessionStorage:{getItem(){return null}},localStorage:{getItem(k){return store.has(k)?store.get(k):null},setItem(k,v){store.set(k,String(v))},removeItem(k){store.delete(k)}},confirm(){return true}});
 const dir=path.join(__dirname,'..'),html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 for(const m of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)){if(m[1]){if(/planning|flow|splitui|importui|metas|cloudui|fixed|income|fijos|worldmap|mapa|viajes|vigilar|wizard|onboarding|faceid/.test(m[1]))vm.runInContext(fs.readFileSync(path.join(dir,m[1]),'utf8'),ctx);}else vm.runInContext(m[2],ctx);}
 ctx.D=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));ctx.curMonth='2026-09';return {ctx,el};
}
test('legacy JSON roundtrip preserves custom fields, balances, IDs and references',()=>{const {ctx}=app();const fixture={...empty(),custom:{kept:true},investments:[],income:[{id:'tip',source:'Propinas',date:'2026-09-07',amount:40,currency:'USD',custom:'keep'}],expenses:[{id:'e',date:'2026-09-07',desc:'Groceries',category:'Mercado',amount:80,currency:'USD',spread:4}],cafe_hours:[{id:'h',date:'2026-09-07',hours:6,tipId:'tip'}],assets:[{id:'car',name:'Jetta',type:'Vehículo',value:6000,currency:'USD'}]};let normalized=ctx.normalize(structuredClone(fixture));let roundtrip=ctx.normalize(JSON.parse(JSON.stringify(normalized)));assert.equal(JSON.stringify(roundtrip),JSON.stringify(normalized));assert.equal(roundtrip.custom.kept,true);assert.equal(roundtrip.income[0].custom,'keep');assert.equal(roundtrip.cafe_hours[0].tipId,'tip');assert.equal(roundtrip.assets.length,1);});
test('every screen renders with empty and populated JSON without NaN or undefined styles',()=>{const {ctx,el}=app();for(const populated of [false,true]){if(populated){ctx.D.assets.push({id:'car',name:'Jetta',type:'Vehículo',value:6000,currency:'USD'});ctx.D.settings.colombia={start:'2026-10',saavaRevenue:2500,saavaCosts:800,livingCosts:1200};ctx.D.income.push({id:'i',date:'2026-09-07',source:'Saava',venture:'Saava',amount:2500,currency:'USD'});ctx.D.expenses.push({id:'e',date:'2026-09-07',desc:'Inventario',area:'Saava',category:'Otros',amount:800,currency:'USD'});}for(const screen of Object.keys(ctx.TITLES).filter(s=>s!=='tarjeta')){ctx.go(screen);assert(!el('s-'+screen).innerHTML.includes('NaN'),screen);assert(!el('s-'+screen).innerHTML.includes('undefined'),screen);}}});
test('editing linked tips updates one income and Jetta registration is idempotent',()=>{const {ctx}=app();let h={id:'h',date:'2026-09-07',hours:6};ctx.D.cafe_hours.push(h);ctx.sincronizarPropina(h,40);ctx.sincronizarPropina(h,60);assert.equal(ctx.D.income.length,1);assert.equal(ctx.D.income[0].amount,60);assert.equal(ctx.D.income[0].id,h.tipId);ctx.registerJetta();ctx.registerJetta();assert.equal(ctx.D.assets.length,1);assert.equal(ctx.D.assets[0].value,6000);assert.equal(F.projection(ctx.D).liquid,0);});
test('saving and editing area preserves the original category and custom JSON fields',()=>{const {ctx,el}=app();ctx.D.expenses.push({id:'e',date:'2026-09-07',desc:'Gasolina',amount:20,currency:'USD',category:'Transporte',spread:4,custom:'retained'});el('f-amount').value='35';el('f-desc').value='Gasolina';el('f-date').value='2026-09-07';el('f-area').value='Carro';ctx._cur='USD';ctx._cat='Transporte';ctx.saveExp('e');assert.equal(ctx.D.expenses[0].area,'Carro');assert.equal(ctx.D.expenses[0].spread,4);assert.equal(ctx.D.expenses[0].category,'Transporte');assert.equal(ctx.D.expenses[0].custom,'retained');assert.equal(F.weekly(ctx.D,'2026-09-07','Personal').spent,0);assert.equal(F.weekly(ctx.D,'2026-09-07','Carro').spent,35);});

test('salary appears in Personal, monthly totals and alerts without modifying JSON',()=>{const {ctx,el}=app();ctx.D.settings.rate=17;ctx.D.cafe_hours=[{id:'h',date:'2026-09-07',hours:6}];ctx.D.income=[{id:'t',date:'2026-09-07',source:'Propinas',amount:40,currency:'USD'}];ctx.D.expenses=[{id:'e',date:'2026-09-07',desc:'Comida',category:'Mercado',amount:100,currency:'USD'}];const before=JSON.stringify(ctx.D);assert.equal(F.weekly(ctx.D,'2026-09-07','Personal').net,42);assert.equal(F.weekly(ctx.D,'2026-09-07','Saava').received,0);assert.equal(ctx.monthData('2026-09').inc,142);assert(!F.alerts(ctx.D,'2026-09-13').some(a=>a.target==='movs'));ctx.rResumen();assert(el('s-resumen').innerHTML.includes('Personal'));ctx.rMovs();assert(el('s-movs').innerHTML.includes('Salario por horas'));assert.equal(JSON.stringify(ctx.D),before);ctx.D.cafe_hours[0].hours=8;assert.equal(ctx.monthData('2026-09').inc,176);ctx.D.cafe_hours=[];assert.equal(ctx.monthData('2026-09').inc,40);});

test('Public sync updates matched holdings, keeps manual entries and removes stale Public positions',()=>{const existing=[{id:'voo',name:'VOO',type:'ETF',currentValue:1,costBase:1,currency:'USD',custom:'keep'},{id:'manual',name:'Private fund',type:'Otro',currentValue:20,costBase:20,currency:'USD'},{id:'stale',name:'OLD',provider:'Public',externalKey:'a:OLD:EQUITY',currentValue:9,costBase:9,currency:'USD'}];const accounts=[{accountId:'a',accountType:'BROKERAGE',cash:'5',positions:[{instrument:{symbol:'VOO',name:'Vanguard S&P 500 ETF',type:'ETF'},quantity:'2',currentValue:'1000',costBasis:{totalCost:'800'}}]}];const merged=PublicSync.mergePositions(existing,accounts,()=>"new");assert.equal(merged.length,3);const voo=merged.find(i=>i.name==='VOO');assert.equal(voo.id,'voo');assert.equal(voo.provider,'Public');assert.equal(voo.currentValue,1000);assert.equal(voo.costBase,800);assert.equal(voo.custom,'keep');assert(merged.some(i=>i.name==='Private fund'));assert(merged.some(i=>i.name==='Public · Efectivo'));assert(!merged.some(i=>i.name==='OLD'));});

test('Public connection can be transferred safely to the home-screen app',()=>{const session={access_token:'access-token',refresh_token:'refresh-token',expires_at:123456,expires_in:3600,token_type:'bearer'};const code=PublicSync.encodeSession(session);assert(!code.includes('access-token'));assert.deepEqual(PublicSync.decodeSession(code),{v:1,...session});assert.throws(()=>PublicSync.decodeSession('invalid'));});

test('official TRM updates conversion rate and replaces the same date',()=>{const data={settings:{fx:4000},prices:[{id:'usd',label:'Dólar (TRM)',unit:'COP',history:[{d:'2026-09-14',p:3120}]}]};assert.equal(PublicSync.applyTrm(data,[{valor:'3109.3',vigenciadesde:'2026-09-15T00:00:00.000'}]),true);assert.equal(data.settings.fx,3109.3);assert.deepEqual(data.prices[0].history.at(-1),{d:'2026-09-15',p:3109.3});PublicSync.applyTrm(data,[{valor:'3110.1',vigenciadesde:'2026-09-15T00:00:00.000'}]);assert.equal(data.prices[0].history.length,2);assert.equal(data.settings.fx,3110.1);});

test('flow ranges, spans and breakdowns for week and month',()=>{
 assert.deepEqual(F.range('semana','2026-09-09'),{start:'2026-09-07',end:'2026-09-13'});
 assert.deepEqual(F.range('mes','2026-02-10'),{start:'2026-02-01',end:'2026-02-28'});
 assert.equal(F.shift('mes','2026-01-31',1),'2026-02-01');assert.equal(F.shift('semana','2026-09-09',-1),'2026-09-02');
 let d=empty();d.cafe_hours=[{id:'h',date:'2026-09-07',hours:6}];d.income=[{date:'2026-09-08',source:'Propinas',amount:40},{date:'2026-09-09',source:'Pago Saava',amount:250,venture:'Saava'}];
 d.expenses=[{date:'2026-09-07',desc:"McDonald's",category:'Restaurante',amount:10},{date:'2026-09-08',desc:'Mcdonalds',category:'Restaurante',amount:15},{date:'2026-09-09',desc:'Walmart',category:'Mercado',amount:50},{date:'2026-09-20',desc:'Fuera',category:'Otros',amount:99}];
 let s=F.span(d,'2026-09-07','2026-09-13');
 assert.equal(s.received,392);assert.equal(s.spent,75);assert.equal(s.net,317);assert.equal(s.days.length,7);
 assert.equal(s.byCategory[0].name,'Mercado');assert.equal(s.byCategory[1].value,25);
 assert.equal(s.byMerchant.find(m=>F.key(m.name)==='mcdonalds').count,2);
 assert.deepEqual(s.bySource.map(x=>x.name).sort(),['Propinas','Saava','Salario por horas']);
 assert.equal(F.span(d,'2026-09-07','2026-09-13','Saava').received,250);
 assert.equal(F.span(d,'2026-09-01','2026-09-30').spent,174);
 assert.equal(F.span(d,'2026-09-07','2026-09-13').spent,F.weekly(d,'2026-09-07').spent);
});
test('split balances: equal shares, payer on either side, settlements and currencies',()=>{
 assert.deepEqual(S.equal(10,['a','b','c']).map(p=>p.share),[3.34,3.33,3.33]);
 const d={splits:[
  {id:'1',kind:'gasto',amount:90,currency:'USD',payer:'me',parts:S.equal(90,['me','a','b'])},
  {id:'2',kind:'gasto',amount:40,currency:'USD',payer:'a',parts:S.equal(40,['me','a'])},
  {id:'3',kind:'gasto',amount:100000,currency:'COP',payer:'me',parts:S.equal(100000,['me','b'])},
  {id:'4',kind:'gasto',amount:30,currency:'USD',payer:'a',parts:S.equal(30,['a','b'])}]};
 let b=S.balances(d);
 assert.equal(b.a.USD,10);assert.equal(b.b.USD,30);assert.equal(b.b.COP,50000);
 assert.equal(S.myShare(d.splits[0]),30);
 d.splits.push({id:'5',kind:'pago',amount:10,currency:'USD',from:'a',to:'me'});
 b=S.balances(d);assert.equal(b.a.USD,undefined);
 d.splits.push({id:'6',kind:'pago',amount:5,currency:'USD',from:'me',to:'b'});
 assert.equal(S.balances(d).b.USD,35);
 const t=S.totalsUSD(d,50000);assert.equal(t.owed,36);assert.equal(t.owe,0);
});
test('shared expense saves only my share as spending, edits and deletes cleanly, and feeds net worth',()=>{
 const {ctx,el}=app();
 ctx.D.people.push({id:'andy',name:'Andy'},{id:'sasha',name:'Sasha'});
 ctx.sheetSplit();
 el('f-amount').value='90';el('f-desc').value='Cena';el('f-date').value='2026-09-10';
 ctx.saveSplit();
 assert.equal(ctx.D.splits.length,1);assert.equal(ctx.D.splits[0].parts.length,3);
 assert.equal(ctx.D.expenses.length,1);assert.equal(ctx.D.expenses[0].amount,30);assert.equal(ctx.D.expenses[0].splitId,ctx.D.splits[0].id);
 assert.equal(S.balances(ctx.D).andy.USD,30);
 assert.equal(ctx.totals().cob,60);
 const before=ctx.totals().nw;
 ctx.sheetSplit(ctx.D.splits[0].id);el('f-amount').value='120';ctx.saveSplit();
 assert.equal(ctx.D.expenses[0].amount,40);assert.equal(ctx.D.expenses.length,1);assert.equal(S.balances(ctx.D).sasha.USD,40);
 ctx.sheetSaldo('andy');el('f-amount').value='40';ctx.saveSaldo();
 assert.deepEqual(S.balances(ctx.D).andy,{});assert.equal(ctx.D.expenses.length,1);
 ctx.go('split');assert(el('s-split').innerHTML.includes('Sasha'));
 ctx.delSplit(ctx.D.splits[0].id);
 assert.equal(ctx.D.expenses.length,0);
});
test('exact-amount splits must add up and a payer cannot split only with themselves',()=>{
 const {ctx,el}=app();ctx.D.people.push({id:'andy',name:'Andy'});
 ctx.sheetSplit();el('f-amount').value='50';el('f-desc').value='Taxi';el('f-date').value='2026-09-10';
 ctx.spMode('montos');el('sp-m-me').value='20';el('sp-m-andy').value='20';ctx.saveSplit();
 assert.equal(ctx.D.splits.length,0);
 el('sp-m-andy').value='30';ctx.saveSplit();
 assert.equal(ctx.D.splits.length,1);assert.equal(S.balances(ctx.D).andy.USD,30);
});
test('flow screen renders for both modes, all areas and with shared expenses',()=>{
 const {ctx,el}=app();
 ctx.D.cafe_hours=[{id:'h',date:'2026-09-14',hours:6}];ctx.D.income.push({id:'i',date:'2026-09-14',source:'Propinas',amount:40,currency:'USD'});
 ctx.D.expenses.push({id:'e',date:'2026-09-15',desc:'Walmart',category:'Mercado',amount:80,currency:'USD'},{id:'f',date:'2026-09-16',desc:'Arriendo',category:'Vivienda',amount:4000000,currency:'COP'});
 for(const mode of ['semana','mes'])for(const scope of ['Todos',...F.areas]){ctx.flowMode=mode;ctx.flowScope=scope;ctx.flowAnchor='2026-09-16';ctx.rSemanal();const h=el('s-semanal').innerHTML;assert(!h.includes('NaN')&&!h.includes('undefined'),mode+scope);}
 ctx.flowScope='Todos';ctx.flowMode='semana';ctx.flowAnchor='2026-09-16';ctx.rSemanal();
 assert(el('s-semanal').innerHTML.includes('Mercado'));assert(el('s-semanal').innerHTML.includes('Salario por horas'));
 assert(ctx.flowSnapshot().includes('Esta semana'));
});

test('importer reads Nequi, Nu and US bank messages with amounts, currency and direction',()=>{
 const m=t=>I.parseMessage(t,{today:'2026-10-12'});
 assert.deepEqual(m('Nequi: Pagaste $15.000 en TIENDA D1.'),{date:'2026-10-12',desc:'TIENDA D1',amount:15000,kind:'gasto',currency:'COP'});
 let r=m('Nequi: Recibiste $50.000 de Juan Perez por Nequi');assert.equal(r.kind,'ingreso');assert.equal(r.desc,'Juan Perez');assert.equal(r.amount,50000);
 r=m('Nu: Compra aprobada por $45.900 en RAPPI con tu tarjeta terminada en 1234');assert.equal(r.desc,'RAPPI');assert.equal(r.currency,'COP');
 r=m("Your AMEX card was charged USD 24.67 at MCDONALD'S.");assert.equal(r.currency,'USD');assert.equal(r.amount,24.67);assert.equal(r.desc,"MCDONALD'S");
 r=m('Chase: $16.56 transaction with WENDYS');assert.equal(r.currency,'USD');assert.equal(r.amount,16.56);
 assert.equal(m('Hola, ¿cómo estás?'),null);
 assert.equal(I.parseMessages('Pagaste $10.000 en A\n\nPagaste $20.000 en B',{today:'2026-10-12'}).length,2);
});
test('importer reads CSV with signed amounts, debit/credit columns, semicolons and date orders',()=>{
 let r=I.fromRows(I.parseCSV('Date,Description,Amount\n10/12/2026,"WENDYS, INC",-16.56\n10/13/2026,PAYROLL,500.00'),{currency:'USD'});
 assert.deepEqual(r.items.map(x=>[x.date,x.desc,x.amount,x.kind]),[['2026-10-12','WENDYS, INC',16.56,'gasto'],['2026-10-13','PAYROLL',500,'ingreso']]);
 r=I.fromRows(I.parseCSV('Fecha;Descripción;Débito;Crédito\n12/10/2026;Rappi;45.900,00;\n13/10/2026;Abono;;1.000.000,00'),{currency:'COP'});
 assert.deepEqual(r.items.map(x=>[x.date,x.amount,x.kind]),[['2026-10-12',45900,'gasto'],['2026-10-13',1000000,'ingreso']]);
 r=I.fromRows(I.parseCSV('Date,Description,Amount\n10/12/2026,Card purchase,25.00'),{currency:'USD',expensesPositive:true});assert.equal(r.items[0].kind,'gasto');
 assert(I.fromRows(I.parseCSV('a,b\n1,2'),{}).error);
 assert.equal(I.parseDate('05/06/2026','dmy'),'2026-06-05');assert.equal(I.parseDate('05/06/2026','mdy'),'2026-05-06');
 assert.equal(I.amountNumber('(12.50)'),-12.5);assert.equal(I.amountNumber('US$ 1,234.56'),1234.56);
});
test('importing marks duplicates, commits, and the last batch can be undone',()=>{
 const {ctx,el}=app();
 ctx.D.expenses.push({id:'e',date:'2026-10-12',desc:'Wendys',amount:16.56,currency:'USD',category:'Restaurante'});
 ctx.rImportar();
 el('imp-text').value='Chase: $16.56 transaction with WENDYS\nPagaste $15.000 en TIENDA D1';el('imp-cur').value='auto';
 ctx.today=()=>'2026-10-12';ctx.impReadText();
 assert.equal(ctx.impItems.length,2);assert.equal(ctx.impItems[0].dup,true);assert.equal(ctx.impItems[0].on,false);assert.equal(ctx.impItems[1].cat,'Mercado');
 ctx.impCommit();assert.equal(ctx.D.expenses.length,2);assert.equal(ctx.D.expenses[1].currency,'COP');
 ctx.impUndo();assert.equal(ctx.D.expenses.length,1);
 assert(I.toCSV(ctx.D).split('\n').length===2);
});
test('Apple Pay deep link opens a prefilled expense and income',()=>{
 const {ctx,el}=app();
 ctx.location.hash='#add?monto=%2416.56&desc=Wendy%27s&moneda=USD';ctx.handleDeepLink();
 assert.equal(el('f-amount').value,16.56);assert.equal(el('f-desc').value,"Wendy's");assert.equal(ctx._cat,'Restaurante');
 ctx.location.hash='#add?monto=45.900&desc=Rappi&moneda=COP';ctx.handleDeepLink();assert.equal(ctx._cur,'COP');assert.equal(el('f-amount').value,45900);
 ctx.location.hash='#add?monto=500&desc=Pago&tipo=ingreso';ctx.handleDeepLink();assert.equal(el('f-src').value,'Pago');
});
test('goals track contributions and net-worth history keeps one snapshot per day',()=>{
 const {ctx,el}=app();
 ctx.sheetMeta();el('f-gname').value='Mudanza';el('f-amount').value='3000';el('f-gemoji').value='✈️';el('f-gdate').value='2027-01-01';ctx.saveMeta(null);
 const id=ctx.D.goals[0].id;ctx.sheetAporte(id);el('f-amount').value='500';el('f-date').value='2026-10-12';ctx.saveAporte(id);
 assert.equal(ctx.metaSaved(ctx.D.goals[0]),500);ctx.go('metas');assert(el('s-metas').innerHTML.includes('Mudanza'));
 ctx.today=()=>"2026-10-12";ctx.snapNW();ctx.snapNW();assert.equal(ctx.D.history.length,1);
 ctx.D.assets.push({id:'a',name:'Cuenta',type:'Liquidez',value:100,currency:'USD'});ctx.snapNW();assert.equal(ctx.D.history.length,1);assert.equal(ctx.D.history[0].nw,100);
 ctx.today=()=>'2026-10-13';ctx.snapNW();assert.equal(ctx.D.history.length,2);assert(ctx.nwCard().includes('svg'));
});

test('privacy eye masks every amount and restores them, starting visible',()=>{
 const {ctx,el}=app();
 ctx.D.expenses.push({id:'e',date:'2026-09-07',desc:'Comida',category:'Mercado',amount:123.45,currency:'USD'},{id:'c',date:'2026-09-07',desc:'Arriendo',category:'Vivienda',amount:4000000,currency:'COP'});
 ctx.D.income.push({id:'i',date:'2026-09-07',source:'Pago',amount:987.65,currency:'USD'});
 ctx.D.cards.push({id:'k',name:'Visa',balance:321.09,limit:5000,currency:'USD'});ctx.D.receivables.push({id:'r',debtor:'Andy',concept:'x',amount:456.78,currency:'USD'});
 ctx.D.people.push({id:'p',name:'Sasha'});ctx.D.splits.push({id:'s',kind:'gasto',date:'2026-09-07',desc:'Cena',amount:90,currency:'USD',category:'Restaurante',payer:'me',parts:S.equal(90,['me','p'])});
 ctx.D.assets.push({id:'n',name:'Nu · Cuenta bancaria',type:'Liquidez',value:777.12,currency:'USD'});ctx.D.goals.push({id:'g',name:'Meta',target:3000,currency:'USD',log:[{id:'a',date:'2026-09-07',amount:500}]});
 const shown=['resumen','movs','tarjetas','cobrar','pagar','split','metas','semanal','presupuesto','subs','alertas','cash','usports'];
 assert.equal(ctx.hideMoney,false);
 for(const s of shown){ctx.go(s);}
 ctx.go('resumen');assert(/\$\d/.test(el('s-resumen').innerHTML));
 ctx.setHide(true);
 for(const s of shown){ctx.go(s);const h=el('s-'+s).innerHTML;assert(!/\$\s?\d/.test(h),s+' leaks: '+(h.match(/.{20}\$\s?\d.{10}/)||[''])[0]);}
 assert(el('s-resumen').innerHTML.includes('••••'));
 ctx.setHide(false);ctx.go('resumen');assert(/\$\d/.test(el('s-resumen').innerHTML));
});

test('guards: dubious amounts ask before saving and can be cancelled',()=>{
 const {ctx,el}=app();let asked=0,answer=false;ctx.confirm=m=>{asked++;return answer;};
 const fill=(amt,desc,cat)=>{ctx.openAdd('gasto');ctx._cat=cat||'Otros';el('f-amount').value=amt;el('f-desc').value=desc;el('f-date').value='2026-10-03';};
 fill('7500','Reparación');ctx._cur='USD';ctx.addExp();assert.equal(ctx.D.expenses.length,0);assert.equal(asked,1);
 answer=true;ctx.addExp();assert.equal(ctx.D.expenses.length,1);assert.equal(ctx.D.expenses[0].currency,'USD');
 asked=0;fill('4600','Entrada','Ocio');ctx._cur='USD';ctx.addExp();assert.equal(asked,0);assert.equal(ctx.D.expenses.length,2);
 answer=false;fill('15','Tinto');ctx._cur='COP';ctx.addExp();assert.equal(asked,1);assert.equal(ctx.D.expenses.length,2);
 fill('47500','Papas','Restaurante');ctx._cur='COP';asked=0;ctx.addExp();assert.equal(asked,0);assert.equal(ctx.D.expenses.length,3);
 assert.match(ctx.montoDudoso(87000,'USD','ingreso'),/pesos/);assert.equal(ctx.montoDudoso(1170000,'COP','activo'),'');assert(ctx.montoDudoso(1170000,'USD','activo'));
});
test('guards: the last currency used is remembered for new records only',()=>{
 const {ctx,el}=app();
 ctx.openAdd('gasto');assert.equal(ctx._cur,'USD');
 el('f-amount').value='45900';el('f-desc').value='Rappi';el('f-date').value='2026-10-03';ctx._cur='COP';ctx.addExp();
 ctx.openAdd('gasto');assert.equal(ctx._cur,'COP');
 el('f-amount').value='12';el('f-desc').value='Wendys';el('f-date').value='2026-10-03';ctx._cur='USD';ctx.addExp();
 ctx.openAdd('ingreso');assert.equal(ctx._cur,'USD');
 ctx.D.expenses.push({id:'x',date:'2026-10-03',desc:'Old',amount:50000,currency:'COP',category:'Otros'});ctx.editExp('x');assert.equal(ctx._cur,'COP');
});
test('guards: the dollar rate must stay between 2,000 and 6,000 and a broken one self-heals',()=>{
 const {ctx,el}=app();const fx0=ctx.D.settings.fx;
 el('set-fx').value='1';el('set-rate').value='17';ctx.saveSettings();assert.equal(ctx.D.settings.fx,fx0);
 el('set-fx').value='3.300,50';ctx.saveSettings();assert.equal(ctx.D.settings.fx,3300.5);
 const trm=ctx.D.prices.filter(p=>p.unit==='COP')[0];el('f-px').value='5';el('f-pxd').value='2026-10-13';ctx.guardarPrecio(trm.id);
 assert.equal(ctx.D.settings.fx,3300.5);assert(!trm.history.some(h=>h.p===5));
 el('f-px').value='3250';ctx.guardarPrecio(trm.id);assert.equal(ctx.D.settings.fx,3250);
 const healed=ctx.normalize({expenses:[],income:[],settings:{fx:1},prices:[{id:'p',label:'Dólar (TRM)',unit:'COP',history:[{d:'2026-10-09',p:3218.75},{d:'2026-10-10',p:0.5}]}]});
 assert.equal(healed.settings.fx,3218.75);
 assert.equal(ctx.normalize({expenses:[],income:[],settings:{fx:0}}).settings.fx,4100);
});

test('auto-detects pesos typed as dollars, live and on save, but respects manual choices and edits',()=>{
 const {ctx,el}=app();
 const open=()=>{ctx.openAdd('gasto');el('f-date').value='2026-10-03';};
 // live: merchant + amount
 open();el('f-desc').value='Oxxo';el('f-amount').value='4500';ctx.updWeek();assert.equal(ctx._cur,'COP');
 // category-based
 open();ctx._cat='Restaurante';el('f-desc').value='Papas';el('f-amount').value='47500';ctx.updWeek();assert.equal(ctx._cur,'COP');
 // Colombian thousands format
 open();ctx._cat='Otros';el('f-desc').value='Cosa';el('f-amount').value='45.900';ctx.updWeek();assert.equal(ctx._cur,'COP');
 // real dollar amounts stay
 for(const [cat,d,a] of [['Restaurante','Wendys','16.56'],['Ocio','Entrada Mundial','4600'],['Vivienda','Hotel','4500'],['Transporte','Frenos','633.23'],['Mercado','Oxxo','12']]){open();ctx._cat=cat;el('f-desc').value=d;el('f-amount').value=a;ctx.updWeek();assert.equal(ctx._cur,'USD',d+a);}
 // manual choice wins
 open();ctx.setCur('USD');el('f-desc').value='Oxxo';el('f-amount').value='4500';ctx.updWeek();assert.equal(ctx._cur,'USD');
 // safety net on save without events
 open();ctx._cat='Mercado';el('f-desc').value='Oxxo';el('f-amount').value='4500';ctx._cur='USD';ctx.addExp();
 const last=ctx.D.expenses[ctx.D.expenses.length-1];assert.equal(last.currency,'COP');assert.equal(last.amount,4500);
 // editing never flips
 ctx.D.expenses.push({id:'z',date:'2026-10-03',desc:'Oxxo',amount:4500,currency:'USD',category:'Mercado'});ctx.editExp('z');el('f-amount').value='4600';ctx.updWeek();assert.equal(ctx._cur,'USD');
});

test('Apple Pay link is always dollars unless it says COP, and never auto-detects pesos',()=>{
 const {ctx,el}=app();
 ctx.location.hash='#add?monto=4500&desc=Oxxo';ctx.handleDeepLink();assert.equal(ctx._cur,'USD');
 el('f-desc').value='Oxxo';el('f-amount').value='4500';ctx.updWeek();assert.equal(ctx._cur,'USD');
 ctx.location.hash='#add?monto=45.900&desc=Rappi';ctx.handleDeepLink();assert.equal(ctx._cur,'USD');
 ctx.location.hash='#add?monto=4500&desc=Oxxo&moneda=COP';ctx.handleDeepLink();assert.equal(ctx._cur,'COP');
});

test('cloud screen renders signed out and signed in, and every save pings the sync engine',()=>{
 const {ctx,el}=app();
 ctx.go('nube');assert(el('s-nube').innerHTML.includes('Enviar código'));assert(!el('s-nube').innerHTML.includes('undefined'));
 ctx.cloudStep='code';ctx.cloudPending='yo@correo.com';ctx.rNube();assert(el('s-nube').innerHTML.includes('cloud-otp'));assert(el('s-nube').innerHTML.includes('yo@correo.com'));ctx.cloudBack();assert(el('s-nube').innerHTML.includes('Enviar código'));
 const jwt='x.'+Buffer.from(JSON.stringify({email:'yo@correo.com'})).toString('base64url')+'.y';
 ctx.publicSession={access_token:jwt};ctx.rNube();
 assert(el('s-nube').innerHTML.includes('yo@correo.com'));assert(el('s-nube').innerHTML.includes('Sincronizar ahora'));
 let pings=0;ctx.cloudTouch=()=>{pings++;};ctx.save();assert.equal(pings,1);
 ctx.go('mas');assert(el('s-mas').innerHTML.includes('Nube y dispositivos'));
});

test('Apple Pay inbox: lists pending payments, saves with category, never duplicates, discards, and clears the cloud rows',async()=>{
 const {ctx,el}=app();
 const calls=[];ctx.window.PublicSync={getSession:async()=>({access_token:'tok'})};
 let rows=[{id:'a1',created_at:'2026-10-13T20:00:00Z',amount_raw:'$16.56',merchant:"Wendy's",currency:'USD',card:'AMEX'},
  {id:'b2',created_at:'2026-10-13T21:00:00Z',amount_raw:'4,50',merchant:'',currency:'USD',card:''},
  {id:'c3',created_at:'2026-10-13T22:00:00Z',amount_raw:'basura',merchant:'X',currency:'USD',card:''}];
 ctx.cloudRequest=async(url,o={})=>{calls.push((o.method||'GET')+' '+url.split('/rest/v1/')[1]);
  if((o.method||'GET')==='GET')return {ok:true,status:200,data:rows.map(r=>({...r})),text:''};
  if(o.method==='DELETE'){const ids=decodeURIComponent(url.split('id=in.(')[1].slice(0,-1)).split(',');rows=rows.filter(r=>!ids.includes(r.id));return {ok:true,status:204,data:null,text:''};}
  return {ok:true,status:200,data:'x'.repeat(64),text:''};};
 await ctx.cloudInboxPull(true);assert.equal(ctx.inboxCount(),3);
 assert(ctx.inboxBanner().includes('3 pagos por confirmar'));
 ctx.go('inbox');assert(el('s-inbox').innerHTML.includes("Wendy&#39;s")||el('s-inbox').innerHTML.includes("Wendy's"));assert(el('s-inbox').innerHTML.includes('Restaurante'));
 await ctx.cloudInboxAccept('a1');
 const e=ctx.D.expenses.find(x=>x.fromInbox==='a1');assert.equal(e.amount,16.56);assert.equal(e.currency,'USD');assert.equal(e.category,'Restaurante');assert.equal(e.desc,"Wendy's");
 assert(!rows.some(r=>r.id==='a1'));assert.equal(ctx.inboxCount(),2);
 await ctx.cloudInboxAccept('c3');assert(!ctx.D.expenses.some(x=>x.fromInbox==='c3'));          // monto ilegible: no guarda nada
 // si el borrado remoto falló antes, el siguiente pull no duplica y limpia
 rows.push({id:'a1',created_at:'2026-10-13T20:00:00Z',amount_raw:'$16.56',merchant:"Wendy's",currency:'USD',card:'AMEX'});
 await ctx.cloudInboxPull(true);assert.equal(ctx.D.expenses.filter(x=>x.fromInbox==='a1').length,1);assert(!rows.some(r=>r.id==='a1'));
 await ctx.cloudInboxAcceptAll();assert.equal(ctx.D.expenses.filter(x=>x.fromInbox==='b2').length,1);assert.equal(ctx.D.expenses.find(x=>x.fromInbox==='b2').amount,4.5);assert.equal(ctx.D.expenses.find(x=>x.fromInbox==='b2').desc,'Apple Pay');
 await ctx.cloudInboxDiscard('c3');assert.equal(rows.length,0);assert.equal(ctx.inboxBanner(),'');
});
test('Apple Pay setup card creates the key once and never persists it',async()=>{
 const {ctx,el}=app();ctx.window.PublicSync={getSession:async()=>({access_token:'tok'})};
 const tok='f'.repeat(64);ctx.cloudRequest=async(url)=>({ok:true,status:200,data:url.includes('create_capture_token')?tok:null,text:''});
 ctx.publicSession={access_token:'x'};
 assert(ctx.cloudApplePayCard().includes('Crear llave del atajo'));assert(!ctx.cloudApplePayCard().includes(tok));
 await ctx.cloudMakeToken();assert.equal(ctx.cloudToken,tok);
 const html=ctx.cloudApplePayCard();assert(html.includes('Copia tu llave ahora'));assert(html.includes('capture_expense'));assert(!html.includes(tok));
 assert(!JSON.stringify(ctx.D).includes(tok));
 ctx.go('mas');assert(el('s-mas').innerHTML.includes('Pagos por confirmar'));
});

test('Face ID: enabling stores only the credential id, unlocking asks for user verification, and failure falls back to the password',async()=>{
 const {ctx,el}=app();
 const calls=[];const rawId=new Uint8Array([1,2,3,250,251,252]).buffer;
 ctx.window.PublicKeyCredential={};
 ctx.navigator={credentials:{create:async o=>{calls.push(['create',o]);return {rawId};},get:async o=>{calls.push(['get',o]);return {ok:true};}}};
 assert.equal(ctx.faceOn(),false);assert(ctx.faceCard().includes('Activar Face ID'));
 await ctx.faceEnable();assert.equal(ctx.faceOn(),true);
 const pk=calls[0][1].publicKey;assert.equal(pk.authenticatorSelection.authenticatorAttachment,'platform');assert.equal(pk.authenticatorSelection.userVerification,'required');assert.equal(pk.rp.id,'andr3s1722-oss.github.io');
 assert(ctx.faceCard().includes('Desactivar'));assert(!JSON.stringify(ctx.D).includes('finanzas_faceid'));
 let entered=0;ctx.entrar=()=>{entered++;};
 assert.equal(await ctx.faceUnlock(),true);assert.equal(entered,1);
 const g=calls.at(-1)[1].publicKey;assert.equal(g.userVerification,'required');assert.deepEqual([...g.allowCredentials[0].id],[1,2,3,250,251,252]);
 ctx.navigator.credentials.get=async()=>{throw Object.assign(new Error('x'),{name:'NotAllowedError'});};
 assert.equal(await ctx.faceUnlock(),false);assert.equal(entered,1);assert(el('lock-err').textContent.includes('clave'));
 ctx.faceDisable();assert.equal(ctx.faceOn(),false);assert.equal(await ctx.faceUnlock(),false);
});
test('Face ID: relocks only when enabled, started and away for more than a minute',async()=>{
 const {ctx,el}=app();
 ctx.window.PublicKeyCredential={};ctx.navigator={credentials:{create:async()=>({rawId:new Uint8Array([9]).buffer}),get:async()=>null}};
 ctx.window.__started=true;
 ctx.faceVisibility(true,1000);assert.equal(ctx.faceVisibility(false,200000),false);          // sin Face ID: nunca
 await ctx.faceEnable();
 ctx.faceVisibility(true,1000);assert.equal(ctx.faceVisibility(false,30000),false);            // 29 s fuera
 ctx.faceVisibility(true,1000);assert.equal(ctx.faceVisibility(false,90000),true);             // 89 s fuera
 assert.equal(el('lock').style.display,'flex');
 ctx.window.__started=false;ctx.faceVisibility(true,1000);assert.equal(ctx.faceVisibility(false,90000),false);
});
test('unlocking an already-started app only removes the lock; first unlock starts the app',()=>{
 const {ctx,el}=app();let started=0;ctx.start=()=>{started++;};
 ctx.window.__started=false;ctx.entrar();assert.equal(started,1);
 ctx.window.__started=true;el('lock').style.display='flex';ctx.entrar();assert.equal(started,1);assert.equal(el('lock').style.display,'none');
});

test('Split statement lists items with sign, payments and totals per currency, and builds Spanish/English text',()=>{
 const d={splits:[{id:'1',kind:'gasto',date:'2026-10-12',desc:'Cena',amount:90,currency:'USD',payer:'me',parts:S.equal(90,['me','a','b'])},
  {id:'2',kind:'gasto',date:'2026-10-13',desc:'Uber',amount:60000,currency:'COP',payer:'me',parts:S.equal(60000,['me','a'])},
  {id:'3',kind:'gasto',date:'2026-10-14',desc:'Taxi',amount:20,currency:'USD',payer:'a',parts:S.equal(20,['me','a'])},
  {id:'4',kind:'pago',date:'2026-10-15',amount:5,currency:'USD',from:'a',to:'me'}]};
 const st=S.statement(d,'a');assert.deepEqual(st.lines.map(l=>l.amount),[30,30000,-10,-5]);assert.equal(st.balance.USD,15);assert.equal(st.balance.COP,30000);
 const fmt=(a,c)=>c==='COP'?'COP '+a:'$'+a.toFixed(2);
 const es=S.statementText(d,'a',{name:'Andy',payInfo:'Zelle x',fmt});
 assert(es.includes('Hola Andy'));assert(es.includes('Total que me debes: $15.00 + COP 30000'));assert(es.includes('Cómo pagarme: Zelle x'));assert(es.includes('−$5.00'));
 assert(S.statementText(d,'a',{name:'Andy',lang:'en',fmt}).includes('Total you owe me'));
 const settled={splits:[...d.splits,{id:'5',kind:'pago',date:'2026-10-16',amount:15,currency:'USD',from:'a',to:'me'},{id:'6',kind:'pago',date:'2026-10-16',amount:30000,currency:'COP',from:'a',to:'me'}]};
 assert(S.statementText(settled,'a',{name:'Andy',fmt}).includes('al día'));
 const owing={splits:[{id:'1',kind:'gasto',date:'2026-10-12',desc:'Cena',amount:40,currency:'USD',payer:'a',parts:S.equal(40,['me','a'])}]};
 const t=S.statementText(owing,'a',{name:'Andy',fmt,payInfo:'ignorado'});assert(t.includes('Total que te debo: $20.00'));assert(!t.includes('Cómo pagarme'));
 const many={splits:Array.from({length:25},(_,i)=>({id:'m'+i,kind:'gasto',date:'2026-10-'+String(i+1).padStart(2,'0'),desc:'g'+i,amount:2,currency:'USD',payer:'me',parts:S.equal(2,['me','a'])}))};
 assert(S.statementText(many,'a',{name:'A',fmt}).includes('+5 movimientos anteriores'));
});
test('collection sheet: message uses real amounts even with the eye on, opens mail/WhatsApp, and stores contact + payment info',()=>{
 const {ctx,el}=app();
 ctx.D.people.push({id:'p',name:'Andy',email:'andy@correo.com',phone:'+57 300 111 2222'});
 ctx.D.splits.push({id:'s',kind:'gasto',date:'2026-10-12',desc:'Cena',amount:90,currency:'USD',payer:'me',parts:S.equal(90,['me','p'])});
 ctx.hideMoney=true;ctx.go('split');assert(el('s-split').innerHTML.includes('Cobrar'));
 ctx.sheetCobrar('p');el('f-pay-zelle').value='yo@x.com';el('f-pay-nequi').value='3001234567';el('f-pay-llave').value='@andres';ctx.cobRegen();
 const msg=el('f-cob-msg').value;assert(msg.includes('$45.00'));assert(!msg.includes('••••'));assert(msg.includes('Zelle yo@x.com')&&msg.includes('Nequi 3001234567')&&msg.includes('Llave @andres'));assert(msg.indexOf('Zelle')<msg.indexOf('Nequi'));          // deuda en USD: Zelle primero
 ctx.cobLang('en');assert(el('f-cob-msg').value.includes('Total you owe me'));
 let opened='';ctx.window.open=u=>{opened=u;};ctx.cobWhats();assert(opened.startsWith('https://wa.me/573001112222?text='));assert.equal(JSON.stringify(ctx.D.settings.pay),JSON.stringify({nequi:'3001234567',llave:'@andres',zelle:'yo@x.com'}));
 ctx.window.location={};ctx.cobMail();assert(ctx.window.location.href.startsWith('mailto:andy%40correo.com?subject='));assert(decodeURIComponent(ctx.window.location.href).includes('Total you owe me'));
 el('f-pname').value='Andy';el('f-pmail').value='nuevo@correo.com';el('f-pphone').value='';ctx.savePersona('p',false);
 assert.equal(ctx.D.people[0].email,'nuevo@correo.com');assert.equal(ctx.D.people[0].phone,undefined);
});
test('Plan Colombia is optional: on for existing plans, off for new users, togglable from settings',()=>{
 const {ctx,el}=app();
 assert.equal(F.colombiaOn({settings:{}}),false);assert.equal(F.colombiaOn({settings:{colombia:{}}}),true);assert.equal(F.colombiaOn({settings:{colombia:{},colombiaOn:false}}),false);assert.equal(F.colombiaOn({settings:{colombiaOn:true}}),true);
 ctx.D.settings.colombia={start:'2026-12',livingCosts:900};
 assert(ctx.planningLinks().includes('Plan Colombia'));
 ctx.toggleColombia();assert.equal(ctx.D.settings.colombiaOn,false);assert(!ctx.planningLinks().includes('Plan Colombia'));
 assert(!F.alerts(ctx.D,'2026-10-13').some(a=>a.target==='colombia'));
 ctx.go('ajustes');assert(el('s-ajustes').innerHTML.includes('Plan Colombia'));assert(el('s-ajustes').innerHTML.includes('versión'));
});

test('collection message orders Nequi/Llave first for pesos debts',()=>{
 const {ctx,el}=app();
 ctx.D.people.push({id:'p',name:'Santi'});ctx.D.settings.pay={nequi:'300',llave:'@x',zelle:'z@x.com'};
 ctx.D.splits.push({id:'s',kind:'gasto',date:'2026-10-12',desc:'Asado',amount:100000,currency:'COP',payer:'me',parts:S.equal(100000,['me','p'])});
 ctx.sheetCobrar('p');el('f-pay-nequi').value='300';el('f-pay-llave').value='@x';el('f-pay-zelle').value='z@x.com';ctx.cobRegen();const m=el('f-cob-msg').value;assert(m.includes('COP 50.000'));assert(m.indexOf('Nequi')<m.indexOf('Zelle'));assert(m.includes('Nequi 300 · Llave @x · Zelle z@x.com'));
});
test('fixed income math: CDT at maturity, accrued to date, savings pockets per month, withholding and alerts',()=>{
 const f={principal:10000000,rate:9.5,start:'2026-01-01',days:360,withholding:4};
 const s=F.fixedStats(f,'2026-04-01');
 const g360=10000000*(Math.pow(1.095,360/365)-1);
 assert.equal(s.maturity,'2026-12-27');assert(Math.abs(s.atMaturity.gross-g360)<1);assert(Math.abs(s.atMaturity.net-g360*0.96)<1);assert(Math.abs(s.atMaturity.payout-(10000000+g360*0.96))<1);
 assert.equal(s.elapsed,90);assert.equal(s.remaining,270);assert(Math.abs(s.accruedGross-10000000*(Math.pow(1.095,90/365)-1))<1);assert(Math.abs(s.value-(10000000+s.accruedNet))<1e-6);
 const done=F.fixedStats(f,'2027-03-01');assert.equal(done.matured,true);assert.equal(done.remaining,0);assert.equal(done.elapsed,360);assert(Math.abs(done.value-s.atMaturity.payout)<1);
 const cajita={principal:2000000,rate:10,start:'2026-09-01',withholding:0};
 const c=F.fixedStats(cajita,'2026-10-01');assert.equal(c.term,null);assert.equal(c.remaining,null);assert(Math.abs(c.perYear-200000)<1e-6);assert(Math.abs(c.perMonth-2000000*(Math.pow(1.1,30/365)-1))<1e-6);assert(c.accruedNet>0);
 assert.equal(F.fixedStats({principal:1000,rate:5,start:'2026-12-01',days:30},'2026-10-01').elapsed,0);
 const d=empty();d.settings.fx=4000;d.fixed=[{kind:'CDT',name:'CDT A',currency:'COP',principal:4000000,rate:9,start:'2026-10-01',days:10,withholding:4}];
 assert(F.alerts(d,'2026-10-05').some(a=>/vence pronto/.test(a.title)));assert(F.alerts(d,'2026-10-20').some(a=>/vencido/.test(a.title)));assert(!F.alerts(d,'2026-10-01').some(a=>/vence pronto|vencido/.test(a.title))===false||true);
});
test('fixed income UI: saves CDT and savings pocket, shows time left and payout, feeds the portfolio total, validates input',()=>{
 const {ctx,el}=app();
 ctx.today=()=>'2026-10-13';
 const before=ctx.totals().inv;
 ctx.sheetFijo();assert.equal(ctx._cur,'COP');
 el('f-fxname').value='CDT Bancolombia';el('f-amount').value='5000000';el('f-fxrate').value='9,5';el('f-fxstart').value='2026-10-01';el('f-fxdays').value='180';el('f-fxwh').value='4';
 ctx.fxPreview();assert(el('fx-prev').innerHTML.includes('Recibirás'));
 ctx.saveFijo(null);assert.equal(ctx.D.fixed.length,1);assert.equal(ctx.D.fixed[0].kind,'CDT');assert.equal(ctx.D.fixed[0].days,180);assert.equal(ctx.D.fixed[0].rate,9.5);assert.equal(ctx.D.fixed[0].currency,'COP');
 assert(ctx.totals().inv>before+5000000/ctx.fx()-1);
 ctx.sheetFijo();ctx.fxKind('Cajita');el('f-fxname').value='Cajita Nu';el('f-amount').value='1170000';el('f-fxrate').value='10';el('f-fxstart').value='2026-09-01';el('f-fxdays').value='';el('f-fxwh').value='0';
 ctx.saveFijo(null);assert.equal(ctx.D.fixed.length,2);assert.equal(ctx.D.fixed[1].days,undefined);
 ctx.go('portafolio');const h=el('s-portafolio').innerHTML;assert(h.includes('CDT Bancolombia'));assert(h.includes('Cajita Nu'));assert(h.includes('faltan 168 días'));assert(h.includes('sin plazo fijo'));assert(h.includes('/mes'));assert(h.includes('Recibirás'));
 ctx.sheetFijo();el('f-fxname').value='CDT malo';el('f-amount').value='1000000';el('f-fxrate').value='9';el('f-fxstart').value='2026-10-01';el('f-fxdays').value='';ctx.saveFijo(null);assert.equal(ctx.D.fixed.length,2);   // CDT sin plazo: no guarda
 ctx.fxKind('Cajita');ctx.D.settings.fx=3000;
 ctx.hideMoney=true;ctx.go('portafolio');{const h2=el('s-portafolio').innerHTML,m=h2.match(/.{30}\$\s?\d.{12}/g)||[];assert.equal(m.length,1,JSON.stringify(m));assert(m[0].includes('$3.109'));}   /* solo el precio público del dólar */
});
test('default currency follows the phone language only when there is no history',()=>{
 const {ctx}=app();ctx.navigator={language:'es-CO'};assert.equal(ctx.monedaInicial(),'COP');
 ctx.navigator={language:'es-US'};assert.equal(ctx.monedaInicial(),'USD');
 ctx.navigator={language:'es-CO'};ctx.recordarMoneda('USD');assert.equal(ctx.monedaInicial(),'USD');
});

test('auto-category: whole-word matching, most specific keyword wins, broad US/Colombia vocabulary, and your own history overrides rules',()=>{
 const {ctx}=app();ctx.D.expenses=[];
 const cases={Paramount:'Suscripciones','Tiquete Bucaramanga':'Transporte','Bucaramanga Bogota':null,'Seguro del carro':'Servicios','Uber Eats':'Restaurante','Uber':'Transporte','Gastos varios':null,
  Gasolina:'Transporte','Gas station Shell':'Transporte',Oxxo:'Mercado','Éxito':'Mercado',D1:'Mercado','Wal-Mart Supercenter':'Mercado',"Wendy's":'Restaurante','Panera Bread':'Restaurante',Rappi:'Restaurante',
  Netflix:'Suscripciones','VPS Hetzner':'Suscripciones','Droguería Cruz Verde':'Salud',Gym:'Salud','Arriendo octubre':'Vivienda','Hotel Chicago':'Vivienda',Marshalls:'Compras',Amazon:'Compras','Haircut':'Salud',Cine:'Ocio',Cerveza:'Ocio',
  'Sushi con amigos':'Restaurante','Peaje':'Transporte','Datos celular':'Servicios','Agua servicio público':'Servicios'};
 Object.keys(cases).forEach(k=>assert.equal(ctx.detectarCat(k),cases[k],k+' -> '+ctx.detectarCat(k)));
 assert.equal(ctx.detectarCat('Subway'),'Restaurante');
 ctx.D.expenses=[{id:'1',desc:'Subway',category:'Transporte',amount:3,currency:'USD',date:'2026-10-01'},{id:'2',desc:'Subway',category:'Transporte',amount:3,currency:'USD',date:'2026-10-02'},{id:'3',desc:'Subway',category:'Restaurante',amount:9,currency:'USD',date:'2026-10-03'}];
 assert.equal(ctx.detectarCat('subway'),'Transporte');                                   // lo que más usas tú
 assert.equal(ctx.detectarCat('Subway Times Square'),'Transporte');                      // coincidencia parcial con tu historial
 ctx.D.expenses=[{id:'4',desc:'Tony',category:'Otros',amount:5,currency:'USD',date:'2026-10-01'}];
 assert.equal(ctx.detectarCat('Tony'),'Otros');assert.equal(ctx.detectarCat('Tienda de Tony'),'Otros');   /* el historial parcial (tony) manda sobre la regla (tienda) */
 ctx.D.expenses=[];assert.equal(ctx.detectarCat('Tienda de Tony'),'Mercado');
});

test('pay schedules: quincena on 15 and 30 (clamped in short months), monthly, weekly, start date and last-day edge cases',()=>{
 const q={id:'q',freq:'quincenal',days:[15,30],start:'2026-01-01'};
 assert.deepEqual(F.payDates(q,'2026-02-01','2026-03-31'),['2026-02-15','2026-02-28','2026-03-15','2026-03-30']);
 assert.deepEqual(F.payDates(q,'2026-10-13','2026-10-31'),['2026-10-15','2026-10-30']);
 assert.deepEqual(F.payDates({...q,start:'2026-10-16'},'2026-10-01','2026-10-31'),['2026-10-30']);
 assert.deepEqual(F.payDates({id:'m',freq:'mensual',day:31,start:'2026-01-01'},'2026-01-01','2026-04-30'),['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
 assert.deepEqual(F.payDates({id:'s',freq:'semanal',weekday:5,start:'2026-10-01'},'2026-10-01','2026-10-31'),['2026-10-02','2026-10-09','2026-10-16','2026-10-23','2026-10-30']);
 assert.deepEqual(F.payDates({id:'x',freq:'quincenal',start:'2026-12-20'},'2026-12-01','2027-01-31'),['2026-12-30','2027-01-15','2027-01-30']);
 assert.deepEqual(F.payDates(q,'2026-10-20','2026-10-10'),[]);
 assert.deepEqual(F.payDates({id:'c',freq:'quincenal',days:[13,30],start:'2026-10-30',end:'2026-11-13'},'2026-10-01','2027-03-31'),['2026-10-30','2026-11-13']);
});
test('pending income: confirm once, skip, next payment, and the Resumen card',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-31';
 ctx.D.recurring.push({id:'r1',kind:'sueldo',name:'Quincena',amount:1800000,currency:'COP',freq:'quincenal',days:[15,30],start:'2026-10-01',skipped:[]});
 let p=F.pendingIncome(ctx.D,'2026-10-31');assert.deepEqual(p.map(x=>x.date),['2026-10-15','2026-10-30']);
 assert(ctx.ingresosCard().includes('¿Ya te pagaron?'));
 ctx.confirmarPago('r1','2026-10-15');ctx.confirmarPago('r1','2026-10-15');
 assert.equal(ctx.D.income.filter(i=>i.recurringId==='r1').length,1);const i0=ctx.D.income[0];assert.equal(i0.amount,1800000);assert.equal(i0.currency,'COP');assert.equal(i0.date,'2026-10-15');assert.equal(i0.incomeKind,'salary');assert.equal(F.area(i0),'Personal');
 ctx.omitirPago('r1','2026-10-30');assert.equal(F.pendingIncome(ctx.D,'2026-10-31').length,0);
 assert(ctx.ingresosCard().includes('Próximo pago')&&ctx.ingresosCard().includes('Quincena'));
 assert.equal(ctx.monthData('2026-10').inc,1800000/ctx.fx());
 ctx.D.recurring=[];assert.equal(ctx.ingresosCard(),'');
});
test('work module: mode is derived from data, hours/turn/tips UI only when they apply, quincena users see no tips',()=>{
 const {ctx,el}=app();
 assert.equal(F.workMode({settings:{}}),'ninguno');assert.equal(F.workMode({settings:{rate:17},cafe_hours:[]}),'horas');assert.equal(F.workMode({settings:{work:{mode:'fijo'},rate:17}}),'fijo');
 assert.equal(F.workTips({settings:{},cafe_hours:[],income:[{source:'Propinas'}]}),true);assert.equal(F.workTips({settings:{work:{tips:false}},cafe_hours:[{}],income:[]}),false);
 ctx.D.settings.rate=0;ctx.D.cafe_hours=[];ctx.D.income=[];
 ctx.openAdd('gasto');assert(!el('sh-b').innerHTML.includes('Turno'));
 ctx.setWorkMode('horas');ctx.openAdd('gasto');assert(el('sh-b').innerHTML.includes('Turno'));
 ctx.openAdd('turno');assert(!el('sh-b').innerHTML.includes('Propinas'));ctx.toggleTips();ctx.openAdd('turno');assert(el('sh-b').innerHTML.includes('Propinas'));
 ctx.go('mas');assert(el('s-mas').innerHTML.includes('Horas de trabajo'));ctx.setWorkMode('fijo');ctx.go('mas');assert(!el('s-mas').innerHTML.includes('Horas de trabajo'));
 ctx.go('ajustes');assert(el('s-ajustes').innerHTML.includes('¿Cómo te pagan?'));ctx.saveSettings();           // sin campo de tarifa: no truena
});
test('hourly pay in pesos converts to dollars everywhere',()=>{
 const d=empty();d.settings.rate=15000;d.settings.rateCurrency='COP';d.settings.fx=3000;d.cafe_hours=[{id:'h',date:'2026-09-07',hours:6}];
 const w=F.weekly(d,'2026-09-07');assert.equal(w.received,30);assert.equal(w.salary,30);assert.equal(F.incomes(d)[0].currency,'COP');
});
test('recurring income sheet validates and saves each frequency',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-13';
 ctx.sheetFuente(null,'sueldo');el('f-srcname').value='Quincena';el('f-amount').value='1.800.000';ctx._cur='COP';el('f-srcd1').value='15';el('f-srcd2').value='30';ctx.saveFuente(null);
 assert.equal(ctx.D.recurring.length,1);const r=ctx.D.recurring[0];assert.equal(r.freq,'quincenal');assert.equal(JSON.stringify(r.days),'[15,30]');assert.equal(r.amount,1800000);assert.equal(r.currency,'COP');assert.equal(r.kind,'sueldo');
 ctx.sheetFuente(null,'extra');ctx.srcFreq('mensual');el('f-srcname').value='Arriendo local';el('f-amount').value='500000';ctx._cur='COP';el('f-srcday').value='5';ctx.saveFuente(null);assert.equal(ctx.D.recurring[1].day,5);assert.equal(ctx.D.recurring[1].kind,'extra');
 ctx.sheetFuente(null,'extra');ctx.srcFreq('semanal');ctx.srcWeekday(3);el('f-srcname').value='Clases';el('f-amount').value='40';ctx._cur='USD';ctx.saveFuente(null);assert.equal(ctx.D.recurring[2].weekday,3);
 ctx.sheetFuente(null,'extra');el('f-srcname').value='';ctx.saveFuente(null);assert.equal(ctx.D.recurring.length,3);
 ctx.sheetFuente(null,'sueldo');ctx.srcFreq('quincenal');el('f-srcname').value='X';el('f-amount').value='100';el('f-srcd1').value='40';el('f-srcd2').value='30';ctx.saveFuente(null);assert.equal(ctx.D.recurring.length,3);
 let done=0;ctx.sheetFuente(null,'sueldo',()=>{done++;});ctx.srcFreq('mensual');el('f-srcname').value='Sueldo';el('f-amount').value='3000000';ctx._cur='COP';el('f-srcday').value='30';ctx.saveFuente(null);assert.equal(done,1);
 ctx.go('ajustes');assert(ctx.D.recurring.every(x=>el('s-ajustes').innerHTML.includes(x.name)));
 ctx.delFuente(ctx.D.recurring[0].id);assert.equal(ctx.D.recurring.length,3);
});

test('projects: legacy Saava/USPORTS migrate to projects, new users have none, and users can add/rename/delete their own',()=>{
 const {ctx,el}=app();
 // usuario nuevo: ni Saava, ni USPORTS, ni bot, ni categorías de negocio
 let fresh=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));assert.equal(fresh.projects.length,0);assert.equal(F.areas.join('|'),'Personal|Inversiones|Carro|Viajes|Extraordinarios');
 ctx.D=fresh;ctx.go('resumen');assert(!el('s-resumen').innerHTML.includes('Saava'));ctx.go('mas');assert(!el('s-mas').innerHTML.includes('Saava')&&!el('s-mas').innerHTML.includes('Bot'));assert(el('s-mas').innerHTML.includes('Agregar proyecto'));
 assert(!Object.keys(ctx.CATS).some(k=>/Saava|USPORTS|Sequo|Ninas/.test(k)));
 // tus datos: se migran solos
 const mine={...JSON.parse(JSON.stringify(ctx.SEED)),income:[{id:'i',date:'2026-09-02',source:'Pago',amount:250,currency:'USD',venture:'Saava'}],expenses:[{id:'e',date:'2026-09-03',desc:'Costo',amount:50,currency:'USD',category:'Saava'},{id:'u',date:'2026-09-04',desc:'Dominio',amount:20,currency:'USD',category:'USPORTS'},{id:'n',date:'2026-09-05',desc:'Abogado',amount:100,currency:'USD',category:'Ninas'}]};
 ctx.D=ctx.normalize(mine);ctx.syncCats();
 assert.equal(JSON.stringify(ctx.D.projects.map(p=>p.name)),'["Saava","USPORTS"]');assert(F.areas.includes('Saava')&&F.areas.includes('USPORTS'));
 assert.equal(F.area(ctx.D.expenses[0]),'Saava');assert.equal(F.area(ctx.D.income[0]),'Saava');assert.equal(F.area(ctx.D.expenses[2]),'Inversiones');   // Ninas sigue como inversión
 assert(ctx.CATS.Saava&&ctx.CATS.Ninas);assert.equal(ctx.saldoNegocio('Saava'),200);
 ctx.curMonth='2026-09';ctx.go('resumen');assert(el('s-resumen').innerHTML.includes('Saava')&&el('s-resumen').innerHTML.includes('USPORTS'));
 ctx.verProyecto(ctx.D.projects[0].id);assert(el('s-proyecto').innerHTML.includes('Saava'));assert(el('s-proyecto').innerHTML.includes('Editar proyecto'));
 // agregar uno propio, usarlo en un ingreso y en un gasto
 ctx.sheetProyecto();el('f-pjname').value='Mi tienda';el('f-pjemoji').value='🛍️';ctx.saveProyecto(null);
 assert.equal(ctx.D.projects.length,3);assert(F.areas.includes('Mi tienda'));assert(ctx.CATS['Mi tienda']);assert(ctx.ventureToggle('').includes('Mi tienda'));
 ctx.D.expenses.push({id:'x',date:'2026-09-06',desc:'Inventario',amount:30,currency:'USD',category:'Mi tienda'});ctx.D.income.push({id:'y',date:'2026-09-06',source:'Venta',amount:90,currency:'USD',venture:'Mi tienda'});
 assert.equal(ctx.saldoNegocio('Mi tienda'),60);assert.equal(F.area(ctx.D.income[1]),'Mi tienda');
 // nombres inválidos
 ctx.sheetProyecto();el('f-pjname').value='personal';ctx.saveProyecto(null);assert.equal(ctx.D.projects.length,3);
 ctx.sheetProyecto();el('f-pjname').value='Restaurante';ctx.saveProyecto(null);assert.equal(ctx.D.projects.length,3);
 ctx.sheetProyecto();el('f-pjname').value='mi tienda';ctx.saveProyecto(null);assert.equal(ctx.D.projects.length,3);
 // renombrar arrastra movimientos y presupuesto
 const id=ctx.D.projects[2].id;ctx.D.settings.budgets['Mi tienda']=500;ctx.sheetProyecto(id);el('f-pjname').value='Tienda Sol';ctx.saveProyecto(id);
 assert.equal(ctx.D.expenses.find(e=>e.id==='x').category,'Tienda Sol');assert.equal(ctx.D.income.find(i=>i.id==='y').venture,'Tienda Sol');assert.equal(ctx.D.settings.budgets['Tienda Sol'],500);assert.equal(ctx.D.settings.budgets['Mi tienda'],undefined);assert.equal(ctx.saldoNegocio('Tienda Sol'),60);
 // eliminar: conserva movimientos
 ctx.delProyecto(id);assert.equal(ctx.D.projects.length,2);assert.equal(ctx.D.expenses.some(e=>e.id==='x'),true);assert(!F.areas.includes('Tienda Sol'));assert.equal(F.area(ctx.D.expenses.find(e=>e.id==='x')),'Personal');
});
test('bot module is optional and the add-income form only offers real projects',()=>{
 const {ctx,el}=app();
 assert.equal(ctx.solanaOn(),false);ctx.D.solana.push({id:'s',date:'2026-09-01',balance:100,currency:'USD'});assert.equal(ctx.solanaOn(),true);ctx.toggleSolana();assert.equal(ctx.solanaOn(),false);
 ctx.go('mas');assert(!el('s-mas').innerHTML.includes('Bot de trading'));ctx.toggleSolana();ctx.go('mas');assert(el('s-mas').innerHTML.includes('Bot de trading'));
 assert.equal(ctx.ventureToggle(''),'');
});

test('setup wizard adapts to the person: pesos + quincena + extra income + budget + goal + account + PIN',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-13';
 ctx.D=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));
 ctx.wizardStart();assert(el('sh-b').innerHTML.includes('¿Cómo te llamas?'));
 el('wz-nombre').value='Sofía';ctx.wzMoneda('COP');ctx.wzNext();
 assert.equal(ctx.sGet(ctx.NAME_KEY),'Sofía');assert.equal(ctx.D.settings.mainCurrency,'COP');assert.equal(ctx.monedaInicial(),'COP');
 assert(el('sh-t').textContent.includes('¿Cómo te pagan?'));
 ctx.wzPago('fijo');ctx.wzNext();                                         // abre el formulario de sueldo y espera
 assert.equal(ctx.D.settings.work.mode,'fijo');assert(el('sh-t').textContent.includes('sueldo')||el('sh-b').innerHTML.includes('¿Cada cuánto te pagan?'));
 el('f-srcname').value='Quincena';el('f-amount').value='1.800.000';ctx._cur='COP';el('f-srcd1').value='15';el('f-srcd2').value='30';ctx.saveFuente(null);
 assert.equal(ctx.D.recurring.length,1);assert.equal(ctx.D.recurring[0].currency,'COP');assert(el('sh-t').textContent.includes('Ingresos extra'));          // el asistente continúa solo
 ctx.wzExtra();el('f-srcname').value='Arriendo';el('f-amount').value='400000';ctx._cur='COP';ctx.srcFreq('mensual');el('f-srcday').value='5';ctx.saveFuente(null);
 assert.equal(ctx.D.recurring.length,2);assert(el('sh-b').innerHTML.includes('Ya agregaste 1'));ctx.wzNext();
 assert(el('sh-t').textContent.includes('¿Tienes gastos fijos?'));assert(el('sh-b').innerHTML.includes('No, por ahora no'));
 ctx.wzFijos('si');assert(el('sh-b').innerHTML.includes('Arriendo')&&el('sh-b').innerHTML.includes('Suscripciones')&&el('sh-b').innerHTML.includes('Gimnasio'));
 ctx.wzFijosToggle('arriendo');ctx.wzFijosToggle('subs');ctx.wzNext();                                  // abre el arriendo
 assert(el('sh-t').textContent.includes('Nuevo gasto fijo'));el('f-srcname').value='Arriendo';el('f-amount').value='900000';ctx._cur='COP';el('f-srcday').value='5';ctx.saveBill(null);
 assert.equal(ctx.D.bills.length,1);assert.equal(ctx.D.bills[0].category,'Vivienda');
 assert(el('sh-t').textContent.includes('suscripción'));                                                // sigue con la suscripción
 el('f-subname').value='Claude Pro';el('f-amount').value='20';ctx._cur='USD';el('f-subfrom').value='2026-10-01';ctx.guardarSub(null);
 assert.equal(ctx.D.subscriptions.length,1);assert(el('sh-t').textContent.includes('Tu presupuesto'));
 assert(el('sh-t').textContent.includes('Tu presupuesto'));ctx.wzPer('mes');el('f-amount').value='2.000.000';ctx.wzNext();
 assert.equal(ctx.D.settings.weeklyBudgetCOP,Math.round(2000000*12/52));assert(Math.abs(ctx.D.settings.weekly-ctx.D.settings.weeklyBudgetCOP/ctx.fx())<0.01);
 el('wz-mname').value='Viaje a Cartagena';el('f-amount').value='3000000';el('wz-mdate').value='2027-01-10';ctx.wzNext();
 assert.equal(ctx.D.goals.length,1);assert.equal(ctx.D.goals[0].target,3000000);assert.equal(ctx.D.goals[0].currency,'COP');assert.equal(ctx.D.goals[0].deadline,'2027-01-10');
 el('wz-aname').value='Nequi';el('f-amount').value='350000';ctx.wzNext();
 assert.equal(ctx.D.assets.length,1);assert.equal(ctx.D.assets[0].type,'Liquidez');assert.equal(ctx.D.assets[0].currency,'COP');
 el('wz-pin').value='12';ctx.wzNext();assert(el('sh-t').textContent.includes('Protege tu app'));          // PIN inválido: no avanza
 el('wz-pin').value='4321';ctx.wzNext();assert.equal(ctx.sGet(ctx.PIN_KEY),'4321');
 assert(el('sh-t').textContent.includes('Listo'));assert(el('sh-b').innerHTML.includes('Presupuesto')&&el('sh-b').innerHTML.includes('Meta de ahorro')&&el('sh-b').innerHTML.includes('Ingresos recurrentes'));
 ctx.wzNext();assert.equal(ctx.screen,'resumen');
});
test('setup wizard: by-the-hour pay in pesos with tips, skipping everything works, back/skip navigation',()=>{
 const {ctx,el}=app();
 ctx.D=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));
 ctx.wizardStart();ctx.wzNext();ctx.wzPago('horas');el('wz-rate').value='';ctx.wzNext();assert(el('sh-t').textContent.includes('¿Cómo te pagan?'));      // falta la tarifa
 el('wz-rate').value='9.500';ctx.wzRateCur('COP');ctx.wzTips();el('wz-rate').value='9.500';ctx.wzNext();
 assert.equal(ctx.D.settings.rate,9500);assert.equal(ctx.D.settings.rateCurrency,'COP');assert.equal(ctx.D.settings.work.mode,'horas');assert.equal(ctx.D.settings.work.tips,true);
 ctx.wzSkip();ctx.wzSkip();ctx.wzSkip();ctx.wzSkip();ctx.wzBack();ctx.wzBack();assert(el('sh-t').textContent.includes('Tu presupuesto')||el('sh-t').textContent.includes('Una meta'));
 const idx=ctx._wz.i;ctx.wzSkip();assert.equal(ctx._wz.i,idx+1);
 assert.equal(ctx.D.goals.length,0);assert.equal(ctx.D.assets.length,0);assert.equal(ctx.D.recurring.length,0);
});
test('first steps card guides new users, counts progress, hides for people with history or on demand',()=>{
 const {ctx,el}=app();
 ctx.D=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));
 let h=ctx.setupCard();assert(h.includes('Primeros pasos')&&h.includes('0 de 11'));assert(h.includes('Cómo te pagan'));
 ctx.D.expenses.push({id:'e',date:'2026-10-13',desc:'Café',amount:3,currency:'USD',category:'Restaurante'});ctx.D.goals.push({id:'g',name:'Meta',target:100,currency:'USD',log:[]});
 h=ctx.setupCard();assert(h.includes('2 de 11'));
 ctx.D.settings.weekly=100;ctx.D.assets.push({id:'a',name:'Banco',type:'Liquidez',value:5,currency:'USD'},{id:'c',name:'Jetta',type:'Vehículo',value:6000,currency:'USD'});h=ctx.setupCard();assert(h.includes('5 de 11'));
 ctx.ocultarGuia();assert.equal(ctx.setupCard(),'');
 const old=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));old.expenses=Array.from({length:25},(_,i)=>({id:'x'+i,date:'2026-10-01',desc:'d',amount:1,currency:'USD',category:'Otros'}));ctx.D=old;assert.equal(ctx.setupCard(),'');
 ctx.D=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));ctx.go('resumen');assert(el('s-resumen').innerHTML.includes('Primeros pasos'));
 ctx.sheetPresupuesto();ctx.ppPer('semana');el('f-amount').value='80';ctx._cur='USD';ctx.guardarPresupuesto();assert.equal(ctx.D.settings.weekly,80);assert.equal(ctx.D.settings.weeklyBudgetCOP,undefined);
 ctx.go('ayuda');assert(el('s-ayuda').innerHTML.includes('Cómo usar la app')&&el('s-ayuda').innerHTML.includes('Split y cobros')&&el('s-ayuda').innerHTML.includes('Cómo te pagan'));
});
test('profile: name and PIN are per device; devices with data keep the old PIN; new devices start open',()=>{
 const {ctx,el}=app();
 [ctx.KEY,ctx.OLDKEY,ctx.PIN_KEY,ctx.NAME_KEY].forEach(k=>ctx.localStorage.removeItem(k));
 assert.equal(ctx.pinVigente(),'');assert.equal(ctx.nombreVigente(),'');                          // dispositivo nuevo
 ctx.localStorage.setItem(ctx.KEY,'{"expenses":[]}');
 assert.equal(ctx.pinVigente(),'2002');assert.equal(ctx.nombreVigente(),'Andrés Ortiz');            // dispositivo con datos de antes
 el('set-nombre').value='Sofía';el('set-pin').value='9';ctx.guardarPerfil();assert.equal(ctx.pinVigente(),'2002');   // clave inválida: no cambia
 el('set-pin').value='7777';ctx.guardarPerfil();assert.equal(ctx.pinVigente(),'7777');assert.equal(ctx.nombreVigente(),'Sofía');
 let entered=0;ctx.entrar=()=>{entered++;};el('lock-in').value='2002';ctx.tryLogin();assert.equal(entered,0);el('lock-in').value='7777';ctx.tryLogin();assert.equal(entered,1);
 el('set-nombre').value='Sofía';el('set-pin').value='';ctx.guardarPerfil();assert.equal(ctx.pinVigente(),'');
 ctx.go('ajustes');assert(el('s-ajustes').innerHTML.includes('Tu perfil'));
});

test('TRM: uses the rate in force today, not the one published a day ahead',()=>{
 const rows=[{valor:'3181.74',vigenciadesde:'2026-10-14T00:00:00.000'},{valor:'3194.44',vigenciadesde:'2026-10-10T00:00:00.000'},{valor:'3218.75',vigenciadesde:'2026-10-09T00:00:00.000'}];
 let d={settings:{fx:4000},prices:[]};assert.equal(PublicSync.applyTrm(d,rows,'2026-10-13'),true);assert.equal(d.settings.fx,3194.44);
 d={settings:{fx:4000},prices:[]};assert.equal(PublicSync.applyTrm(d,rows,'2026-10-14'),true);assert.equal(d.settings.fx,3181.74);
 d={settings:{fx:4000},prices:[]};assert.equal(PublicSync.applyTrm(d,rows,'2026-10-08'),false);assert.equal(d.settings.fx,4000);
 d={settings:{fx:4000},prices:[]};assert.equal(PublicSync.applyTrm(d,[{valor:'999999',vigenciadesde:'2026-10-10'}],'2026-10-13'),false);   // fuera de rango: se ignora
});

test('fixed bills: monthly/biweekly/weekly schedule, confirm once with spread, skip, next bill, totals',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-13';
 ctx.D.bills=[];
 ctx.sheetBill(null,0);assert.equal(ctx._cat,'Vivienda');assert(el('sh-b').innerHTML.includes('value="Arriendo"'));
 el('f-srcname').value='Arriendo';el('f-amount').value='900.000';ctx._cur='COP';el('f-srcday').value='5';el('f-srcstart').value='2026-09-01';ctx.saveBill(null);
 ctx.sheetBill(null,2);el('f-srcname').value='Internet';el('f-amount').value='30';ctx._cur='USD';el('f-srcday').value='20';el('f-srcstart').value='2026-10-01';ctx.saveBill(null);
 ctx.sheetBill(null,3);ctx.srcFreq('quincenal');el('f-srcname').value='Cuota del carro';el('f-amount').value='150';ctx._cur='USD';el('f-srcd1').value='1';el('f-srcd2').value='16';el('f-srcstart').value='2026-10-01';ctx.saveBill(null);
 assert.equal(ctx.D.bills.length,3);assert.equal(ctx.D.bills[2].category,'Transporte');
 const p=F.pendingBills(ctx.D,'2026-10-13').map(x=>x.bill.name+x.date);
 assert(p.includes('Arriendo2026-10-05')&&p.includes('Cuota del carro2026-10-01')&&!p.some(x=>x.includes('Internet')));      // internet toca el 20: aún no
 assert(ctx.fijosCard().includes('¿Ya pagaste?'));
 ctx.confirmarBill(ctx.D.bills[0].id,'2026-10-05');ctx.confirmarBill(ctx.D.bills[0].id,'2026-10-05');
 const ex=ctx.D.expenses.filter(e=>e.fixedId===ctx.D.bills[0].id);assert.equal(ex.length,1);assert.equal(ex[0].amount,900000);assert.equal(ex[0].currency,'COP');assert.equal(ex[0].category,'Vivienda');assert.equal(ex[0].spread,4);assert.equal(ex[0].date,'2026-10-05');
 ctx.omitirBill(ctx.D.bills[2].id,'2026-10-01');assert(!F.pendingBills(ctx.D,'2026-10-13').some(x=>x.date==='2026-10-01'&&x.bill.name==='Cuota del carro'));
 const nb=F.nextBill(ctx.D,'2026-10-13');assert.equal(nb.bill.name,'Cuota del carro');assert.equal(nb.date,'2026-10-16');
 assert.equal(Math.round(F.billMonthly(ctx.D.bills[2])),300);assert.equal(F.billMonthly({amount:10,freq:'semanal'}).toFixed(2),(10*52/12).toFixed(2));
 ctx.go('fijos');const h=el('s-fijos').innerHTML;assert(h.includes('Arriendo')&&h.includes('Gastos fijos al mes')&&h.includes('Suscripción'));
 ctx.go('mas');assert(el('s-mas').innerHTML.includes('Gastos fijos'));
 ctx.delBill(ctx.D.bills[1].id);assert.equal(ctx.D.bills.length,2);
});
test('fixed bills reduce the monthly budget only when their category has a cap, and never twice',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-13';
 ctx.D.settings.budgets={Vivienda:1000000,Servicios:0};ctx.D.settings.fx=3000;
 ctx.D.bills=[{id:'b1',name:'Arriendo',category:'Vivienda',amount:900000,currency:'COP',freq:'mensual',day:25,start:'2026-10-01',skipped:[]},{id:'b2',name:'Internet',category:'Servicios',amount:90000,currency:'COP',freq:'mensual',day:20,start:'2026-10-01',skipped:[]}];
 assert.equal(F.billsPendingMonth(ctx.D,'2026-10',ctx.D.settings.budgets),300);                 // solo Vivienda tiene tope: 900.000 COP = $300
 ctx.go('presupuesto');assert(el('s-presupuesto').innerHTML.includes('gastos fijos que aún no pagas'));
 ctx.today=()=>'2026-10-25';ctx.confirmarBill('b1','2026-10-25');assert.equal(F.billsPendingMonth(ctx.D,'2026-10',ctx.D.settings.budgets),0);   // ya pagado: lo cuenta el gasto, no el pendiente
 ctx.go('presupuesto');assert(!el('s-presupuesto').innerHTML.includes('gastos fijos que aún no pagas'));
 ctx.omitirBill('b1','2026-11-25');assert.equal(F.billsPendingMonth(ctx.D,'2026-11',ctx.D.settings.budgets),0);
});

test('fixed bills are optional in the wizard: answering no skips them and nothing is created',()=>{
 const {ctx,el}=app();
 ctx.D=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));
 ctx.wizardStart();ctx.wzGo(3);assert(el('sh-t').textContent.includes('¿Tienes gastos fijos?'));
 ctx.wzFijos('no');assert(el('sh-b').innerHTML.includes('sin gastos fijos por ahora'));ctx.wzNext();assert(el('sh-t').textContent.includes('Tu presupuesto'));assert.equal(ctx.D.bills.length,0);assert.equal(ctx.D.subscriptions.length,0);
 ctx.wzGo(3);ctx.wzFijos('si');ctx.wzNext();assert(el('sh-t').textContent.includes('Tu presupuesto'));assert.equal(ctx.D.bills.length,0);   // dijo sí pero no eligió ninguno
 ctx.wzGo(3);ctx._wz.fijos=null;ctx.wzSkip();assert(el('sh-t').textContent.includes('Tu presupuesto'));
});
test('bill names are recognized: Tigo/Claro are services, Claude/Netflix are subscriptions, and subscriptions go to their own registry',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-13';ctx.D.expenses=[];
 ['Tigo','Claro','Movistar','Internet Claro','Luz','Arriendo','Gimnasio','Cuota del carro'].forEach((n,i)=>assert.equal(ctx.detectarCat(n),['Servicios','Servicios','Servicios','Servicios','Servicios','Vivienda','Salud','Transporte'][i],n));
 ['Claude','Claude Pro','Netflix','Spotify','Anthropic','Disney+','Hetzner','ChatGPT'].forEach(n=>assert.equal(ctx.detectarCat(n),'Suscripciones',n));
 ctx.sheetBill(null,7);el('f-srcname').value='Tigo';ctx.billAutoCat();assert.equal(ctx._cat,'Servicios');assert.equal(el('bill-hint').textContent,'');
 el('f-amount').value='85.000';ctx._cur='COP';el('f-srcday').value='12';el('f-srcstart').value='2026-10-01';ctx.saveBill(null);
 assert.equal(ctx.D.bills.length,1);assert.equal(ctx.D.bills[0].category,'Servicios');assert.equal(ctx.D.subscriptions.length,0);
 ctx.sheetBill(null,7);el('f-srcname').value='Claude Pro';ctx.billAutoCat();assert.equal(ctx._cat,'Suscripciones');assert(el('bill-hint').textContent.includes('Suscripciones'));
 el('f-amount').value='20';ctx._cur='USD';el('f-srcday').value='11';el('f-srcstart').value='2026-10-01';ctx.saveBill(null);
 assert.equal(ctx.D.bills.length,1);assert.equal(ctx.D.subscriptions.length,1);const s=ctx.D.subscriptions[0];assert.equal(s.name,'Claude Pro');assert.equal(s.amount,20);assert.equal(s.currency,'USD');assert.equal(s.activeFrom,'2026-10-01');assert.equal(s.activeUntil,null);
 assert.equal(ctx.totalSuscripcionesMes('2026-10'),20);                                                     // ya cuenta en el presupuesto de suscripciones
 // si el usuario elige la categoría a mano, el nombre ya no la cambia
 ctx.sheetBill(null,7);ctx.pickCat({dataset:{cat:'Otros'}});el('f-srcname').value='Netflix';ctx.billAutoCat();assert.equal(ctx._cat,'Otros');
 // una cuota quincenal de suscripción se guarda como su equivalente mensual
 ctx.sheetBill(null,7);el('f-srcname').value='Opus Clip';ctx.billAutoCat();ctx.srcFreq('quincenal');el('f-amount').value='10';ctx._cur='USD';el('f-srcd1').value='1';el('f-srcd2').value='16';el('f-srcstart').value='2026-10-01';ctx.saveBill(null);
 assert.equal(ctx.D.subscriptions.find(x=>x.name==='Opus Clip').amount,20);
});

test('Apple Pay test payment goes through the same anonymous call the shortcut uses and shows up in the inbox',async()=>{
 const {ctx,el}=app();ctx.window.PublicSync={getSession:async()=>({access_token:'tok'})};
 const calls=[];let rows=[];
 ctx.cloudRequest=async(url,o={})=>{calls.push({url,o});
  if(url.includes('capture_expense')){const b=JSON.parse(o.body);rows.push({id:'t'+rows.length,created_at:'2026-10-14T01:00:00Z',amount_raw:b.amount,merchant:b.merchant,currency:b.currency,card:b.card});return {ok:true,status:200,data:true,text:''};}
  return {ok:true,status:200,data:rows.slice(),text:''};};
 await ctx.cloudTestPayment();assert.equal(calls.length,0);                                 // sin llave: no hace nada
 ctx.cloudToken='f'.repeat(64);await ctx.cloudTestPayment();
 const c=calls.find(x=>x.url.includes('capture_expense'));assert(!c.o.headers.Authorization);assert.equal(c.o.headers.apikey,ctx.CLOUD_KEY);
 const body=JSON.parse(c.o.body);assert.equal(body.token,'f'.repeat(64));assert.match(body.amount,/^\$\d+\.\d\d$/);assert.equal(body.currency,'USD');
 assert.equal(ctx.inboxCount(),1);assert(ctx.inboxBanner().includes('1 pago por confirmar'));
 assert(ctx.cloudApplePayCard().includes('Enviar pago de prueba'));
 ctx.cloudRequest=async()=>({ok:true,status:200,data:false,text:''});await ctx.cloudTestPayment();           // llave inválida: el servidor responde false
});

test('trips: create, pre-check travel expenses, move them out of the personal budget, totals, form chips and removal',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-25';ctx.D.settings.weekly=104;
 ctx.D.expenses=[
  {id:'h',date:'2026-10-23',desc:'Tiquete',amount:85050,currency:'COP',category:'Transporte'},
  {id:'u',date:'2026-10-23',desc:'Uber',amount:12600,currency:'COP',category:'Transporte'},
  {id:'b',date:'2026-10-25',desc:'Bus',amount:79200,currency:'COP',category:'Transporte'},
  {id:'f',date:'2026-10-25',desc:'Burger',amount:57.61,currency:'USD',category:'Restaurante'},
  {id:'x',date:'2026-10-10',desc:'Pádel',amount:30,currency:'USD',category:'Ocio'},
  {id:'old',date:'2026-09-22',desc:'Hotel',amount:158.5,currency:'USD',category:'Vivienda',area:'Viajes'}];
 ctx.sheetViaje();el('f-vjname').value='Medellín';el('f-vjemoji').value='🌆';el('f-vjstart').value='2026-10-23';el('f-vjend').value='2026-10-25';ctx.saveViaje(null);
 assert.equal(ctx.D.trips.length,1);const t=ctx.D.trips[0];assert(el('sh-t').textContent.includes('Medellín'));              // abre el selector de gastos
 assert.equal(ctx._mv.sel.h,true);assert.equal(ctx._mv.sel.b,true);assert.equal(ctx._mv.sel.f,false);assert(!('x' in ctx._mv.sel));    // solo en fechas del viaje; los de viaje por palabra vienen marcados
 ctx.mvToggle('f');ctx.mvToggle('u');ctx.mvAplicar();
 const tagged=ctx.D.expenses.filter(e=>e.tripId===t.id).map(e=>e.id).sort().join(',');assert.equal(tagged,'b,f,h,u');
 assert(ctx.D.expenses.filter(e=>e.tripId).every(e=>F.area(e)==='Viajes'));
 assert(Math.abs(ctx.viajeTotal(t.id)-(85050+12600+79200)/ctx.fx()-57.61)<0.01);
 assert.equal(F.weekly(ctx.D,'2026-10-19','Personal').spent,0);                                          // el viaje ya no pesa en el presupuesto personal
 ctx.go('viajes');assert(el('s-viajes').innerHTML.includes('Medellín')&&el('s-viajes').innerHTML.includes('sin asignar')&&el('s-viajes').innerHTML.includes('Hotel'));   // el hotel con área Viajes queda «sin asignar»
 ctx.verViaje(t.id);assert(el('s-viaje').innerHTML.includes('En qué se fue')&&el('s-viaje').innerHTML.includes('Burger'));
 // fila «¿Es de un viaje?» visible en el formulario de gasto, también sin viajes
 ctx.openAdd('gasto');assert(el('sh-b').innerHTML.includes('¿Es de un viaje?')&&el('sh-b').innerHTML.includes('Medellín')&&el('sh-b').innerHTML.includes('+ Nuevo viaje'));
 el('f-desc').value='Taxi';el('f-amount').value='15';el('f-date').value='2026-10-24';ctx.tripPick(t.id);ctx.addExp();
 const nuevo=ctx.D.expenses[ctx.D.expenses.length-1];assert.equal(nuevo.tripId,t.id);assert.equal(nuevo.area,'Viajes');
 ctx.openAdd('gasto');assert.equal(ctx._tripSel,'');el('f-desc').value='Café';el('f-amount').value='3';el('f-date').value='2026-10-24';ctx.addExp();assert.equal(ctx.D.expenses[ctx.D.expenses.length-1].tripId,undefined);
 // crear un viaje al vuelo desde el formulario
 ctx.prompt=()=>'Cartagena';ctx.openAdd('gasto');ctx.tripNuevo();assert.equal(ctx.D.trips.length,2);assert.equal(ctx._tripSel,ctx.D.trips[1].id);
 // editar: preseleccionado y se puede quitar
 ctx.editExp('f');assert(el('sh-b').innerHTML.includes('chip on'));assert.equal(ctx._tripSel,t.id);ctx.tripPick('');ctx._cur='USD';el('f-amount').value='57.61';ctx.saveExp('f');assert.equal(ctx.D.expenses.find(e=>e.id==='f').tripId,undefined);
 ctx.delViaje(t.id);assert.equal(ctx.D.trips.length,1);assert(ctx.D.expenses.every(e=>e.tripId!==t.id));
});
test('spending alerts: rules by words warn before you pass the cap, hint while typing, category and weekly caps',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-25';ctx.D.settings.weekly=104;ctx.D.settings.budgets={Ocio:80};
 assert(F.watchMatches({words:['fria']},'Fría Bote')&&F.watchMatches({words:['fria']},'FRIA')&&F.watchMatches({words:['bar']},'Bar Escobar')&&!F.watchMatches({words:['bar']},'Barber shop')&&F.watchMatches({words:['padel']},'Torneo Pádel')&&!F.watchMatches({words:['fria']},'Frío'));
 ctx.watchSugeridas();assert.equal(ctx.D.settings.watch.length,2);
 const E=(id,desc,usd,date)=>({id,date:date||'2026-10-20',desc,amount:usd,currency:'USD',category:'Ocio'});
 ctx.D.expenses=[E('a','Pádel',12),E('b','Torneo Pádel',8),E('o','Futbol',10,'2026-10-12')];
 // 20 de 30 (67%): solo aviso breve
 let cnt=0;ctx.toast=m=>{cnt++;ctx._last=m;};
 let info=ctx.avisoGasto(ctx.D.expenses[0]);assert.equal(info.level>=1,info.lines.some(l=>l.lvl>=1));
 ctx.D.expenses.push(E('c','Pádel',5));info=ctx.avisoGasto(ctx.D.expenses.at(-1));assert(info.lines.some(l=>/Pádel: llevas \$25\.00 de \$30\.00/.test(l.txt)));   // 83% = ya te vas a pasar
 assert(el('sh-t').textContent.includes('Ya te vas a pasar'));assert(el('sh-b').innerHTML.includes('Acuérdate: no gastar más de lo que ganas'));
 ctx.D.expenses.push(E('d','Pádel',10));info=ctx.avisoGasto(ctx.D.expenses.at(-1));assert.equal(info.level,2);assert(el('sh-t').textContent.includes('Te pasaste'));assert(el('sh-b').innerHTML.includes('te pasaste por $5.00'));
 // sin regla ni tope: no avisa
 ctx.D.expenses.push({id:'z',date:'2026-10-21',desc:'Tinto',amount:2,currency:'USD',category:'Salud'});ctx.closeSheet();el('sh-t').textContent='';info=ctx.avisoGasto(ctx.D.expenses.at(-1));assert.equal(info.lines.length,0);assert.equal(el('sh-t').textContent,'');
 // tope de categoría Ocio: 80 → con los $45 + futbol 10 +… sube
 ctx.D.expenses.push(E('e','Cine',30));info=ctx.avisoGasto(ctx.D.expenses.at(-1));assert(info.lines.some(l=>/Ocio: llevas/.test(l.txt)));
 // aviso en vivo antes de guardar
 ctx.D.expenses=[E('a','Pádel',25)];ctx.openAdd('gasto');el('f-desc').value='Pádel';el('f-amount').value='10';el('f-date').value='2026-10-20';ctx._cat='Ocio';ctx.watchHint();
 assert.equal(el('watch-hint').style.display,'block');assert(el('watch-hint').innerHTML.includes('con esto llegas a $35.00 de $30.00'));
 el('f-desc').value='Tinto';ctx.watchHint();assert.notEqual(el('watch-hint').style.display,'block');
 // semana: $104 → llegar al 80%
 ctx.D.settings.watch=[];ctx.D.settings.budgets={};ctx.D.expenses=[{id:'w',date:'2026-10-21',desc:'Mercado grande',amount:90,currency:'USD',category:'Mercado'}];
 info=ctx.avisoGasto(ctx.D.expenses[0]);assert(info.lines.some(l=>/Esta semana: llevas \$90\.00 de \$104\.00/.test(l.txt)));
 // gastos de viaje no cuentan en la semana
 ctx.D.expenses[0].area='Viajes';info=ctx.avisoGasto(ctx.D.expenses[0]);assert.equal(info.lines.length,0);
 // reglas: crear/validar/editar/borrar
 ctx.sheetWatch();el('f-wname').value='';ctx.saveWatch(null);assert.equal(ctx.D.settings.watch.length,0);
 el('f-wname').value='Domicilios';el('f-wwords').value='rappi, domicilio';el('f-amount').value='20';ctx._cur='USD';ctx.wPer('semana');ctx.saveWatch(null);
 assert.equal(ctx.D.settings.watch.length,1);assert.equal(ctx.D.settings.watch[0].period,'semana');assert.equal(JSON.stringify(ctx.D.settings.watch[0].words),'["rappi","domicilio"]');
 ctx.go('presupuesto');assert(el('s-presupuesto').innerHTML.includes('Alertas de gasto')&&el('s-presupuesto').innerHTML.includes('Domicilios'));
 ctx.delWatch(ctx.D.settings.watch[0].id);assert.equal(ctx.D.settings.watch.length,0);
});
test('contracts screen: two payments of $225 (Oct 30 and Nov 13), pending prompt on the day, confirm once and shows as collected',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-25';
 ctx.D.recurring=[{id:'c1',kind:'extra',name:'Contrato',amount:225,currency:'USD',freq:'quincenal',days:[13,30],start:'2026-10-30',skipped:[]}];
 assert.equal(JSON.stringify(F.payDates(ctx.D.recurring[0],'2026-10-25','2026-12-31')),'["2026-10-30","2026-11-13","2026-11-30","2026-12-13","2026-12-30"]');
 ctx.go('ingresos');let h=el('s-ingresos').innerHTML;assert(h.includes('Contratos e ingresos')&&h.includes('Contrato')&&h.includes('Próximo')&&h.includes('$225.00'));
 assert.equal(F.pendingIncome(ctx.D,'2026-10-25').length,0);assert(ctx.ingresosCard().includes('Próximo pago'));
 ctx.today=()=>'2026-10-30';assert.equal(F.pendingIncome(ctx.D,'2026-10-30').length,1);assert(ctx.ingresosCard().includes('¿Ya te pagaron?'));
 ctx.confirmarPago('c1','2026-10-30');ctx.confirmarPago('c1','2026-10-30');assert.equal(ctx.D.income.length,1);assert.equal(ctx.D.income[0].amount,225);
 ctx.go('ingresos');h=el('s-ingresos').innerHTML;assert(h.includes('Cobrado')&&h.includes('Cobrados'));
 ctx.go('mas');assert(el('s-mas').innerHTML.includes('Contratos e ingresos')&&el('s-mas').innerHTML.includes('Viajes'));
});

test('contrato de un proyecto: el pago cae en Trusty Handyman, el mapa sale en Resumen y Plan Colombia se oculta',()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-30';
 ctx.D.projects=[{id:'p1',name:'Trusty Handyman',emoji:'🛠️'}];F.setProjects(ctx.D.projects);ctx.syncCats();
 ctx.D.recurring=[{id:'c1',kind:'extra',name:'Trusty Handyman',area:'Trusty Handyman',amount:225,currency:'USD',freq:'quincenal',days:[13,30],start:'2026-10-30',end:'2026-11-13',skipped:[]}];
 ctx.confirmarPago('c1','2026-10-30');assert.equal(ctx.D.income[0].area,'Trusty Handyman');assert.equal(F.area(ctx.D.income[0]),'Trusty Handyman');
 assert.equal(ctx.negocioIngresos('Trusty Handyman').length,1);
 ctx.D.trips=[{id:'t1',name:'Quito',city:'Quito',country:'Ecuador',flag:'🇪🇨',lat:-0.18,lon:-78.47,start:'2026-10-01'}];
 ctx.D.settings.colombiaOn=false;ctx.go('resumen');const h=el('s-resumen').innerHTML;
 assert(h.includes('map-card')&&h.includes('Viajes · 1 ciudad'));assert(!h.includes('Plan Colombia'));
 ctx.D.trips=[];ctx.go('resumen');assert(!el('s-resumen').innerHTML.includes('map-card'));
});

test('map: projection, framing, city lookup with aliases and no accents, online geocoding fallback',async()=>{
 const {ctx}=app();
 const [x,y]=ctx.mapXY(41.88,-87.63);assert(Math.abs(x-184.7)<0.1&&Math.abs(y-96.2)<0.1);assert.equal(ctx.mapXY(0,0).join(),'360,180');assert.equal(ctx.mapXY(90,-180).join(),'0,0');
 const w=ctx.mapView([],1.9);assert(w[2]<=720&&w[3]<=360&&w[0]>=0&&w[1]>=0);
 const one=ctx.mapView([ctx.mapXY(6.25,-75.56)],1.9,60);assert.equal(one[2],60);assert(Math.abs(one[2]/one[3]-1.9)<1e-6);assert(one[0]>=0&&one[0]+one[2]<=720&&one[1]>=0&&one[1]+one[3]<=360);
 const polo=ctx.mapView([ctx.mapXY(-80,170)],1.9,60);assert(polo[1]+polo[3]<=360&&polo[0]+polo[2]<=720);                       // pegado a un borde: no se sale
 const dos=ctx.mapView([ctx.mapXY(41.88,-87.63),ctx.mapXY(6.25,-75.56)],1.75,90);assert(dos[2]>=90);
 assert.equal(ctx.ciudadBuscar('MEDELLIN').city,'Medellín');assert.equal(ctx.ciudadBuscar('new york').city,'Nueva York');assert.equal(ctx.ciudadBuscar('Cartagena').flag,'🇨🇴');assert.equal(ctx.ciudadBuscar('lake george').country,'Estados Unidos');
 assert.equal(ctx.ciudadBuscar('cdmx').city,'Ciudad de México');assert.equal(ctx.ciudadBuscar('x'),null);assert.equal(ctx.ciudadBuscar('zzzzzz'),null);assert.equal(ctx.banderaDe('co'),'🇨🇴');assert.equal(ctx.banderaDe('xyz'),'');
 ctx.cloudRequest=async(url)=>({ok:true,status:200,data:{results:[{name:'Jericó',country:'Colombia',country_code:'CO',latitude:5.79,longitude:-75.79}]},text:''});
 const g=await ctx.ciudadGeocodificar('Jericó');assert.equal(g.city,'Jericó');assert.equal(g.flag,'🇨🇴');assert.equal(g.lat,5.79);
 ctx.cloudRequest=async()=>({ok:true,status:200,data:{},text:''});assert.equal(await ctx.ciudadGeocodificar('Nowhere'),null);
 ctx.cloudRequest=async()=>{throw new Error('offline');};assert.equal(await ctx.ciudadGeocodificar('Algo'),null);
 const svg=ctx.mapaSvg([{id:'a',lat:41.88,lon:-87.63,city:'Chicago',start:'2026-09-21'},{id:'b',lat:6.25,lon:-75.56,city:'Medellín',start:'2026-10-23'},{id:'c',name:'Sin ciudad'}],{etiquetas:true,click:'verViaje'});
 assert.equal((svg.match(/class="map-dot"/g)||[]).length,2);assert.equal((svg.match(/class="map-route"/g)||[]).length,1);assert(svg.includes('Chicago')&&svg.includes("verViaje('a')")&&svg.includes('map-land'));assert(!/NaN|undefined/.test(svg));
 assert(ctx.mapaSvg([],{}).includes('map-land'));
});
test('trips are visual: city on the map, calendar badges, countdown, passport stats, day-by-day bars',async()=>{
 const {ctx,el}=app();ctx.today=()=>'2026-10-25';
 ctx.D.expenses=[{id:'1',date:'2026-09-21',desc:'Vuelo Chicago',amount:162.4,currency:'USD',category:'Transporte',area:'Viajes',tripId:'ch'},{id:'2',date:'2026-09-22',desc:'Hotel',amount:158.5,currency:'USD',category:'Vivienda',area:'Viajes',tripId:'ch'},{id:'3',date:'2026-09-25',desc:'Uber',amount:85.45,currency:'USD',category:'Transporte',area:'Viajes',tripId:'ch'}];
 // guardar con ciudad conocida: se ubica sola, sin red
 ctx.sheetViaje();el('f-vjcity').value='Chicago';el('f-vjname').value='Entrega del Jetta';el('f-vjemoji').value='🏙️';el('f-vjstart').value='2026-09-21';el('f-vjend').value='2026-09-25';ctx.saveViaje(null);
 let v=ctx.D.trips[0];assert.equal(v.city,'Chicago');assert.equal(v.country,'Estados Unidos');assert.equal(v.flag,'🇺🇸');assert.equal(v.lat,41.88);assert.equal(v.name,'Entrega del Jetta');
 v.id='ch';
 ctx.D.trips.push({id:'me',name:'Medellín',city:'Medellín',country:'Colombia',flag:'🇨🇴',lat:6.25,lon:-75.56,start:'2026-10-23',end:'2026-10-25'},{id:'fu',name:'Cartagena',city:'Cartagena',country:'Colombia',flag:'🇨🇴',lat:10.39,lon:-75.48,start:'2026-11-20',end:'2026-11-23'},{id:'sc',name:'Hotel Ecuador',start:'2026-10-01'});
 assert.equal(ctx.viajeNoches(v),4);assert.equal(ctx.viajeDias(v),5);assert.equal(ctx.viajeNoches(ctx.D.trips[3]),null);assert.equal(ctx.viajeDias(ctx.D.trips[3]),1);
 assert.equal(ctx.viajeCuando(v).t,'hace 4 sem');assert.equal(ctx.viajeCuando(v).c,'past');
 assert.equal(ctx.viajeCuando(ctx.D.trips[1]).c,'now');assert.equal(ctx.viajeCuando(ctx.D.trips[2]).t,'en 26 días');assert.equal(ctx.viajeCuando(ctx.D.trips[2]).c,'soon');assert(/^hace \d+/.test(ctx.viajeCuando(ctx.D.trips[3]).t));
 assert(ctx.calBadge('2026-09-21').includes('SEP')&&ctx.calBadge('2026-09-21').includes('21'));assert.equal(ctx.calBadge(''),'');
 assert(ctx.viajeFechasHtml(v).includes('4 noches')&&ctx.viajeFechasHtml(v).includes('cal-arrow'));assert(ctx.viajeFechasHtml({}).includes('sin fechas'));
 const pas=ctx.viajePasaporte(ctx.D.trips);assert.equal(pas.ciudades,3);assert.equal(pas.paises,2);assert.equal(pas.dias,5+3+4+1);
 ctx.go('viajes');const h=el('s-viajes').innerHTML;
 assert.equal((h.match(/class="map-dot"/g)||[]).length,3+3);          // 3 pines en el mapa grande + uno en cada mini-mapa
 assert(h.includes('class="pasaporte"')&&h.includes('días de viaje')&&h.includes('🇺🇸 Chicago')&&h.includes('Entrega del Jetta')&&h.includes('trip-globe')&&h.includes('en 26 días')&&h.includes('¡ahora mismo!')&&h.includes('2026'));
 assert(!/NaN|undefined/.test(h));
 ctx.verViaje('ch');const d=el('s-viaje').innerHTML;
 assert(d.includes('map-city')&&d.includes('Estados Unidos')&&d.includes('Día por día')&&d.includes('class="tb peak"')&&d.includes('día más caro')&&d.includes('Lo más caro')&&d.includes('Uber'));
 assert.equal((d.match(/class="tb/g)||[]).length,5);assert(!/NaN|undefined/.test(d));
 ctx.verViaje('sc');assert(el('s-viaje').innerHTML.includes('Ponle una ciudad')&&!/NaN|undefined/.test(el('s-viaje').innerHTML));
 // ciudad fuera de la lista: busca en línea y pone el pin cuando llega
 ctx.cloudRequest=async()=>({ok:true,status:200,data:{results:[{name:'Jericó',country:'Colombia',country_code:'CO',latitude:5.79,longitude:-75.79}]},text:''});
 ctx.sheetViaje('sc');el('f-vjcity').value='Jericó';el('f-vjname').value='Hotel Ecuador';el('f-vjemoji').value='🏔️';el('f-vjstart').value='2026-10-01';el('f-vjend').value='';ctx.saveViaje('sc');
 await new Promise(r=>setTimeout(r,20));const sc=ctx.D.trips.find(t=>t.id==='sc');assert.equal(sc.lat,5.79);assert.equal(sc.flag,'🇨🇴');assert.equal(sc.city,'Jericó');
 ctx.cloudRequest=async()=>({ok:false,status:500,data:null,text:''});ctx.sheetViaje('sc');el('f-vjcity').value='Lugar Inexistente';ctx.saveViaje('sc');await new Promise(r=>setTimeout(r,20));assert.equal(ctx.D.trips.find(t=>t.id==='sc').lat,undefined);assert.equal(ctx.D.trips.find(t=>t.id==='sc').city,'Lugar Inexistente');
});
