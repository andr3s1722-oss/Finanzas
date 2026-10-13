const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../finance.js');
const S=require('../split.js');
const I=require('../importer.js');
const PublicSync=require('../portfolio-bridge.js');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const empty=()=>({expenses:[],income:[],cafe_hours:[],assets:[],payables:[],cards:[],settings:{fx:4000,rate:17,weekly:250}});
test('week boundaries across years and daylight saving',()=>{assert.equal(F.monday('2027-01-03'),'2026-12-28');assert.equal(F.plus('2026-03-02',6),'2026-03-08');assert.equal(F.monday('2026-03-09'),'2026-03-09');});
test('weekly income includes salary plus all recorded income and linked tips once',()=>{let d=empty();d.cafe_hours=[{date:'2026-09-07',hours:6,tipId:'t'}];d.income=[{id:'t',date:'2026-09-07',source:'Propinas',amount:40},{date:'2026-09-08',source:'Pago café',amount:102}];let w=F.weekly(d,'2026-09-07');assert.equal(w.received,244);assert.equal(w.salary,102);assert.equal(w.tips,40);});
test('all six areas, legacy business tags and explicit overrides',()=>{assert.equal(F.area({category:'Saava'}),'Saava');assert.equal(F.area({venture:'Saava'}),'Saava');assert.equal(F.area({category:'Sequo'}),'Inversiones');assert.equal(F.area({category:'Ninas'}),'Inversiones');assert.equal(F.area({category:'Transporte'}),'Personal');F.areas.forEach(area=>assert.equal(F.area({area}),area));assert.equal(F.area({area:'Carro',category:'Saava'}),'Carro');});
test('cash expenses, COP conversion and budget allocations remain distinct',()=>{let d=empty();d.expenses=[{date:'2026-09-07',amount:4000000,currency:'COP',category:'Mercado',spread:4},{date:'2026-09-07',amount:900,area:'Saava'}];assert.equal(F.weekly(d,'2026-09-07').spent,1900);assert.equal(F.weekly(d,'2026-09-07','Personal').spent,1000);assert.equal(F.weekly(d,'2026-09-14').spent,0);assert.equal(F.alerts(d,'2026-09-14')[0].title,'Cerca del límite semanal');});
test('Colombia uses Saava margin and excludes car, investments, historical tips and wages',()=>{let d=empty();d.assets=[{name:'Jetta',type:'Vehículo',value:6000},{type:'Liquidez',value:8000000,currency:'COP'}];d.income=[{source:'Propinas',amount:9999}];d.cafe_hours=[{hours:100}];d.settings.colombia={saavaRevenue:2500,saavaCosts:800,livingCosts:1200,otherIncome:0,movingCost:500,reserveDebt:true};d.cards=[{balance:100}];let p=F.projection(d);assert.equal(p.net,500);assert.equal(p.initial,1400);assert.equal(p.months[11].balance,7400);assert.equal(p.tips,0);assert.equal(p.salary,0);});
test('deficit, zero income, negative initial cash and scheduled debt alerts',()=>{let d=empty();d.settings.colombia={livingCosts:100};let p=F.projection(d);assert.equal(p.runway,0);assert.equal(p.months[11].balance,-1200);d.payables=[{debtor:'A',amount:50,vence:'2026-09-14'},{debtor:'B',amount:50,vence:'fin de mes'}];d.cards=[{name:'Visa',balance:800,limit:1000}];const alerts=F.alerts(d,'2026-09-13');assert(alerts.some(a=>a.title==='Pago próximo'));assert.equal(alerts.filter(a=>a.target==='pagar').length,1);assert(alerts.some(a=>a.target==='tarjetas'));});
function app(){
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{style:{},classList:{add(){},remove(){},toggle(){}},value:'',innerHTML:'',focus(){},setAttribute(){},querySelectorAll(){return []}});return nodes.get(id);};
 const doc={getElementById:el,querySelectorAll(){return []},addEventListener(){},documentElement:{setAttribute(){}}};
 const ctx=vm.createContext({Finance:F,Split:S,Importer:I,URLSearchParams,location:{hash:'',origin:'https://x.test',pathname:'/Finanzas/',search:''},history:{replaceState(){}},document:doc,window:{scrollTo(){},addEventListener(){}},setTimeout(){},clearTimeout(){},console,sessionStorage:{getItem(){return null}},localStorage:{getItem(){return null},setItem(){}},confirm(){return true}});
 const dir=path.join(__dirname,'..'),html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 for(const m of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)){if(m[1]){if(/planning|flow|splitui|importui|metas/.test(m[1]))vm.runInContext(fs.readFileSync(path.join(dir,m[1]),'utf8'),ctx);}else vm.runInContext(m[2],ctx);}
 ctx.D=ctx.normalize(JSON.parse(JSON.stringify(ctx.SEED)));ctx.curMonth='2026-09';return {ctx,el};
}
test('legacy JSON roundtrip preserves custom fields, balances, IDs and references',()=>{const {ctx}=app();const fixture={...empty(),custom:{kept:true},investments:[],income:[{id:'tip',source:'Propinas',date:'2026-09-07',amount:40,currency:'USD',custom:'keep'}],expenses:[{id:'e',date:'2026-09-07',desc:'Groceries',category:'Mercado',amount:80,currency:'USD',spread:4}],cafe_hours:[{id:'h',date:'2026-09-07',hours:6,tipId:'tip'}],assets:[{id:'car',name:'Jetta',type:'Vehículo',value:6000,currency:'USD'}]};let normalized=ctx.normalize(structuredClone(fixture));let roundtrip=ctx.normalize(JSON.parse(JSON.stringify(normalized)));assert.equal(JSON.stringify(roundtrip),JSON.stringify(normalized));assert.equal(roundtrip.custom.kept,true);assert.equal(roundtrip.income[0].custom,'keep');assert.equal(roundtrip.cafe_hours[0].tipId,'tip');assert.equal(roundtrip.assets.length,1);});
test('every screen renders with empty and populated JSON without NaN or undefined styles',()=>{const {ctx,el}=app();for(const populated of [false,true]){if(populated){ctx.D.assets.push({id:'car',name:'Jetta',type:'Vehículo',value:6000,currency:'USD'});ctx.D.settings.colombia={start:'2026-10',saavaRevenue:2500,saavaCosts:800,livingCosts:1200};ctx.D.income.push({id:'i',date:'2026-09-07',source:'Saava',venture:'Saava',amount:2500,currency:'USD'});ctx.D.expenses.push({id:'e',date:'2026-09-07',desc:'Inventario',area:'Saava',category:'Otros',amount:800,currency:'USD'});}for(const screen of Object.keys(ctx.TITLES).filter(s=>s!=='tarjeta')){ctx.go(screen);assert(!el('s-'+screen).innerHTML.includes('NaN'),screen);assert(!el('s-'+screen).innerHTML.includes('undefined'),screen);}}});
test('editing linked tips updates one income and Jetta registration is idempotent',()=>{const {ctx}=app();let h={id:'h',date:'2026-09-07',hours:6};ctx.D.cafe_hours.push(h);ctx.sincronizarPropina(h,40);ctx.sincronizarPropina(h,60);assert.equal(ctx.D.income.length,1);assert.equal(ctx.D.income[0].amount,60);assert.equal(ctx.D.income[0].id,h.tipId);ctx.registerJetta();ctx.registerJetta();assert.equal(ctx.D.assets.length,1);assert.equal(ctx.D.assets[0].value,6000);assert.equal(F.projection(ctx.D).liquid,0);});
test('saving and editing area preserves the original category and custom JSON fields',()=>{const {ctx,el}=app();ctx.D.expenses.push({id:'e',date:'2026-09-07',desc:'Gasolina',amount:20,currency:'USD',category:'Transporte',spread:4,custom:'retained'});el('f-amount').value='35';el('f-desc').value='Gasolina';el('f-date').value='2026-09-07';el('f-area').value='Carro';ctx._cur='USD';ctx._cat='Transporte';ctx.saveExp('e');assert.equal(ctx.D.expenses[0].area,'Carro');assert.equal(ctx.D.expenses[0].spread,4);assert.equal(ctx.D.expenses[0].category,'Transporte');assert.equal(ctx.D.expenses[0].custom,'retained');assert.equal(F.weekly(ctx.D,'2026-09-07','Personal').spent,0);assert.equal(F.weekly(ctx.D,'2026-09-07','Carro').spent,35);});

test('salary appears in Personal, monthly totals and alerts without modifying JSON',()=>{const {ctx,el}=app();ctx.D.cafe_hours=[{id:'h',date:'2026-09-07',hours:6}];ctx.D.income=[{id:'t',date:'2026-09-07',source:'Propinas',amount:40,currency:'USD'}];ctx.D.expenses=[{id:'e',date:'2026-09-07',desc:'Comida',category:'Mercado',amount:100,currency:'USD'}];const before=JSON.stringify(ctx.D);assert.equal(F.weekly(ctx.D,'2026-09-07','Personal').net,42);assert.equal(F.weekly(ctx.D,'2026-09-07','Saava').received,0);assert.equal(ctx.monthData('2026-09').inc,142);assert(!F.alerts(ctx.D,'2026-09-13').some(a=>a.target==='movs'));ctx.rResumen();assert(el('s-resumen').innerHTML.includes('Personal'));ctx.rMovs();assert(el('s-movs').innerHTML.includes('Salario por horas'));assert.equal(JSON.stringify(ctx.D),before);ctx.D.cafe_hours[0].hours=8;assert.equal(ctx.monthData('2026-09').inc,176);ctx.D.cafe_hours=[];assert.equal(ctx.monthData('2026-09').inc,40);});

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
 ctx.location.hash='#add?monto=45.900&desc=Rappi';ctx.handleDeepLink();assert.equal(ctx._cur,'COP');assert.equal(el('f-amount').value,45900);
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
 ctx.D.goals.push({id:'g',name:'Meta',target:3000,currency:'USD',log:[{id:'a',date:'2026-09-07',amount:500}]});
 const shown=['resumen','movs','tarjetas','cobrar','pagar','split','metas','semanal','presupuesto','subs','alertas'];
 assert.equal(ctx.hideMoney,false);
 for(const s of shown){ctx.go(s);}
 ctx.go('resumen');assert(/\$\d/.test(el('s-resumen').innerHTML));
 ctx.setHide(true);
 for(const s of shown){ctx.go(s);const h=el('s-'+s).innerHTML;assert(!/\$\s?\d/.test(h),s+' leaks: '+(h.match(/.{20}\$\s?\d.{10}/)||[''])[0]);}
 assert(el('s-resumen').innerHTML.includes('••••'));
 ctx.setHide(false);ctx.go('resumen');assert(/\$\d/.test(el('s-resumen').innerHTML));
});
