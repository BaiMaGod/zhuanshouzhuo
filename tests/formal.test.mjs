globalThis.Laya={LocalStorage:{getItem:k=>globalThis.localStorage.getItem(k),setItem:(k,v)=>globalThis.localStorage.setItem(k,v)}};
import test from 'node:test';import assert from 'node:assert/strict';import C from '../dist/js/core.js';import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';import solutions from '../dist/js/solutions.js';import {Save} from '../dist/js/storage.js';
test('54镯正式关卡为相连九宫结构，跨宫杆真实阻挡且完整路线通关',()=>{
 const s=C.make(LEGACY_FORMAL_INDEX);assert.equal(s.rings.length,54);assert.equal(s.rods.length,62);assert.deepEqual(C.validate(s),[]);assert.equal(C.settle(C.clone(s)).length,0);
 // Keep the dense layout without shrinking the physical rings or relaxing collisions.
 const width=Math.max(...s.rings.map(r=>r.x))-Math.min(...s.rings.map(r=>r.x))+92,height=Math.max(...s.rings.map(r=>r.y))-Math.min(...s.rings.map(r=>r.y))+92;
 assert.ok(width*height<700_000,'No empty bands between clusters');
 const rows=new Map;for(const r of s.rings){const y=Math.round(r.y*1000);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(r.x)}
 const bands=[...rows].sort((a,b)=>a[0]-b[0]);assert.ok(bands.length>=9,'Oval has tapered ends');const mid=bands.slice(3,-3);assert.ok(Math.max(...mid.map(([,xs])=>xs.length))>Math.max(bands[0][1].length,bands.at(-1)[1].length),'Centre is wider than both ends');
 for(const [,xs]of bands){xs.sort((a,b)=>a-b);for(let i=1;i<xs.length;i++)assert.ok(Math.abs(xs[i]-xs[i-1]-92.0001)<1e-6,'Every interior lattice cell is filled');}
 assert.deepEqual(bands.map(([,xs])=>xs.length),bands.map(([,xs])=>xs.length).reverse(),'Oval tapers symmetrically at both ends');
 for(const [,xs] of bands)assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2)<24,'Every row stays centred on the tray');

 assert.ok(s.rings.every(r=>s.rings.some(t=>t!==r&&C.dist(r,t)<=107)),'No isolated outlying rings');
 const seen=new Set(['1G']);for(let pass=0;pass<54;pass++)for(const z of s.rods){const ids=z.kind==='m'?[z.owner,...z.targets]:z.targets;if(ids.some(id=>seen.has(id)))ids.forEach(id=>seen.add(id))}assert.equal(seen.size,54);
 const blocked=C.request(C.clone(s),'1A',10);assert.equal(blocked.blocked?.kind,'captive');assert.equal(C.ring(s,'1C').life,'active');
 assert.equal(s.rods.filter(z=>z.kind==='b').length,9);assert.equal(solutions[LEGACY_FORMAL_INDEX].length,54);
 for(const a of solutions[LEGACY_FORMAL_INDEX]){
  let delta=a.delta;
  while(Math.abs(delta)>.001){const res=C.request(s,a.id,Math.sign(delta)*Math.min(5,Math.abs(delta)));assert.equal(res.blocked,null,JSON.stringify(res.blocked));assert.ok(Math.abs(res.done)>.001);delta-=res.done;if(C.ring(s,a.id).life==='removed')break}
 }
 assert.equal(s.rings.filter(r=>r.life==='active').length,0);assert.equal(s.rods.filter(z=>C.exists(s,z)).length,9);
});
test('正式挑战保存最佳成绩，不跳过教学关的解锁',()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const save=new Save();save.win(10,63,63);assert.equal(save.data.unlocked,0);assert.equal(new Save().data.records[10].stars,3);save.win(10,100,63);assert.equal(new Save().data.records[10].steps,63);delete globalThis.localStorage;
});

