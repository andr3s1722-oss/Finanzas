const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../cloud.js');

function server(){
 const s={row:null,calls:[],failNextSave:0,down:false,missing:false,saveHook:null};
 s.request=async (url,o={})=>{
  s.calls.push((o.method||'GET')+' '+url.split('/rest/v1/')[1]);
  if(s.down)throw new Error('offline');
  if(s.missing)return {ok:false,status:404,text:'{"code":"PGRST205","message":"Could not find the table"}',data:null};
  if(url.includes('/rest/v1/user_data'))return {ok:true,status:200,data:s.row?[JSON.parse(JSON.stringify(s.row))]:[],text:''};
  const b=JSON.parse(o.body);
  if(s.saveHook){s.saveHook();s.saveHook=null;}
  if(s.failNextSave>0){s.failNextSave--;return {ok:false,status:409,text:'version_conflict',data:null};}
  const cur=s.row?s.row.version:0;
  if(b.expected_version!==cur)return {ok:false,status:409,text:'{"message":"version_conflict"}',data:null};
  s.row={data:JSON.parse(JSON.stringify(b.new_data)),version:cur+1,device:b.device_name};
  return {ok:true,status:200,data:cur+1,text:''};
 };
 return s;
}
function device(srv,name,initial){
 const store=new Map();let data=initial||{expenses:[],income:[],settings:{fx:3000},prices:[],history:[]};let backups=[];
 const c=C.create({url:'https://x.supabase.co',key:'k',request:srv.request,getSession:async()=>device.signedOut?null:{access_token:'t'},
  storage:{get:k=>store.get(k)||null,set:(k,v)=>store.set(k,v)},getData:()=>data,apply:d=>{data=d;},backup:s=>backups.push(s),device:()=>name,now:()=>'2026-10-13T12:00:00Z'});
 return {c,get data(){return data;},set data(v){data=v;},backups,store};
}
const ex=(id,amount,extra)=>Object.assign({id,date:'2026-10-01',desc:id,amount,currency:'USD'},extra);

test('first sync uploads, a fresh device downloads, and nothing is pushed when nothing changed',async()=>{
 const srv=server(),A=device(srv,'A');A.data.expenses.push(ex('e1',10));
 assert.equal((await A.c.sync()).state,'ok');assert.equal(srv.row.version,1);assert.equal(srv.row.data.expenses.length,1);
 const B=device(srv,'B');assert.equal((await B.c.sync()).state,'ok');
 assert.deepEqual(B.data.expenses.map(e=>e.id),['e1']);assert.equal(B.backups.length,1);
 srv.calls.length=0;await A.c.sync();assert.equal(srv.calls.filter(c=>c.startsWith('POST')).length,0);
 assert.equal(srv.row.version,1);
});
test('two devices editing in parallel are merged without losing anything',async()=>{
 const srv=server(),A=device(srv,'A'),B=device(srv,'B');
 A.data.expenses.push(ex('e1',10),ex('e2',20));A.data.prices=[{id:'p',label:'Dólar',unit:'COP',history:[{d:'1',p:3000}]}];
 await A.c.sync();await B.c.sync();
 A.data.expenses.push(ex('e3',30));A.data.prices[0].history.push({d:'2',p:3100});A.data.settings.fx=3100;
 B.data.income.push({id:'i1',source:'Pago',amount:50,currency:'USD',date:'2026-10-02'});B.data.expenses[0].amount=11;B.data.prices[0].history.push({d:'3',p:3200});
 await A.c.sync();await B.c.sync();await A.c.sync();
 for(const D of [A,B]){
  assert.deepEqual(D.data.expenses.map(e=>e.id).sort(),['e1','e2','e3']);assert.equal(D.data.expenses.find(e=>e.id==='e1').amount,11);
  assert.equal(D.data.income.length,1);assert.deepEqual(D.data.prices[0].history.map(h=>h.d).sort(),['1','2','3']);assert.equal(D.data.settings.fx,3100);
 }
 assert(C.eq(A.data,srv.row.data));
});
test('deletions propagate, but a record edited elsewhere survives a delete',async()=>{
 const srv=server(),A=device(srv,'A'),B=device(srv,'B');
 A.data.expenses.push(ex('e1',10),ex('e2',20),ex('e3',30));await A.c.sync();await B.c.sync();
 A.data.expenses=A.data.expenses.filter(e=>e.id!=='e1'&&e.id!=='e2');
 B.data.expenses.find(e=>e.id==='e2').amount=99;
 await A.c.sync();await B.c.sync();await A.c.sync();
 assert.deepEqual(A.data.expenses.map(e=>e.id).sort(),['e2','e3']);assert.equal(A.data.expenses.find(e=>e.id==='e2').amount,99);
 assert.deepEqual(B.data.expenses.map(e=>e.id).sort(),['e2','e3']);
});
test('a simultaneous write by another device is retried and merged',async()=>{
 const srv=server(),A=device(srv,'A'),B=device(srv,'B');
 A.data.expenses.push(ex('e1',10));await A.c.sync();await B.c.sync();
 A.data.expenses.push(ex('a2',1));B.data.expenses.push(ex('b2',2));
 srv.saveHook=()=>{srv.row.version+=1;srv.row.data.expenses.push(ex('x9',9));};   // otro dispositivo escribe justo antes
 const st=await A.c.sync();assert.equal(st.state,'ok');
 assert.deepEqual(A.data.expenses.map(e=>e.id).sort(),['a2','e1','x9']);
 await B.c.sync();assert.deepEqual(B.data.expenses.map(e=>e.id).sort(),['a2','b2','e1','x9']);
 srv.failNextSave=1;A.data.expenses.push(ex('a3',3));assert.equal((await A.c.sync()).state,'ok');
});
test('offline, missing table and signed-out leave local data untouched and report a clear state',async()=>{
 const srv=server(),A=device(srv,'A');A.data.expenses.push(ex('e1',10));const before=JSON.stringify(A.data);
 srv.down=true;let st=await A.c.sync();assert.equal(st.state,'offline');assert.equal(JSON.stringify(A.data),before);
 srv.down=false;srv.missing=true;st=await A.c.sync();assert.equal(st.state,'not-setup');
 srv.missing=false;device.signedOut=true;st=await A.c.sync();assert.equal(st.state,'signed-out');device.signedOut=false;
 assert.equal(srv.row,null);assert.equal((await A.c.sync()).state,'ok');
});
test('force push replaces the cloud copy; force pull replaces this device and keeps a backup',async()=>{
 const srv=server(),A=device(srv,'A'),B=device(srv,'B');
 A.data.expenses.push(ex('e1',10));await A.c.sync();await B.c.sync();
 B.data.expenses=[ex('only-b',5)];await B.c.sync({force:'push'});assert.deepEqual(srv.row.data.expenses.map(e=>e.id),['only-b']);
 const beforeBackups=A.backups.length;await A.c.sync({force:'pull'});
 assert.deepEqual(A.data.expenses.map(e=>e.id),['only-b']);assert.equal(A.backups.length,beforeBackups+1);assert(A.backups.at(-1).includes('"e1"'));
 const empty=server(),D=device(empty,'D');assert.equal((await D.c.sync({force:'pull'})).state,'error');
});
test('merge keeps goal contributions from both devices and card promos by id',()=>{
 const base={goals:[{id:'g',target:100,log:[{id:'a',amount:1}]}],cards:[{id:'c',name:'V',promos:[]}]};
 const l=JSON.parse(JSON.stringify(base)),r=JSON.parse(JSON.stringify(base));
 l.goals[0].log.push({id:'l',amount:2});r.goals[0].log.push({id:'r',amount:3});r.goals[0].target=200;l.cards[0].promos.push({id:'p1'});
 const m=C.merge(base,l,r);
 assert.deepEqual(m.goals[0].log.map(x=>x.id).sort(),['a','l','r']);assert.equal(m.goals[0].target,200);assert.equal(m.cards[0].promos.length,1);
});
