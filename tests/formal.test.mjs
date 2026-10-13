import test from 'node:test';import assert from 'node:assert/strict';import C from '../dist/js/core.js';import solutions from '../dist/js/solutions.js';import {Save} from '../dist/js/storage.js';
test('54镯正式关卡为相连九宫结构，跨宫杆真实阻挡且完整路线通关',()=>{
 const s=C.make(10);assert.equal(s.rings.length,54);assert.equal(s.rods.length,62);assert.deepEqual(C.validate(s),[]);assert.equal(C.settle(C.clone(s)).length,0);
 // Keep the dense layout without shrinking the physical rings or relaxing collisions.
 const width=Math.max(...s.rings.map(r=>r.x))-Math.min(...s.rings.map(r=>r.x))+92,height=Math.max(...s.rings.map(r=>r.y))-Math.min(...s.rings.map(r=>r.y))+92;
 assert.ok(width*height<1_000_000,'54 rings occupy at most half the former sparse board');
 assert.ok(s.rings.every(r=>s.rings.some(t=>t!==r&&C.dist(r,t)<=107)),'No isolated outlying rings');
 const seen=new Set(['1G']);for(let pass=0;pass<54;pass++)for(const z of s.rods){const ids=z.kind==='m'?[z.owner,...z.targets]:z.targets;if(ids.some(id=>seen.has(id)))ids.forEach(id=>seen.add(id))}assert.equal(seen.size,54);
 const blocked=C.request(C.clone(s),'1C',-10);assert.equal(blocked.blocked?.kind,'captive');assert.equal(C.ring(s,'1C').life,'active');
 assert.equal(s.rods.filter(z=>z.kind==='b').length,9);assert.equal(solutions[10].length,63);
 for(const a of solutions[10]){
  let delta=a.delta;
  while(Math.abs(delta)>.001){const res=C.request(s,a.id,Math.sign(delta)*Math.min(5,Math.abs(delta)));assert.equal(res.blocked,null,JSON.stringify(res.blocked));assert.ok(Math.abs(res.done)>.001);delta-=res.done;if(C.ring(s,a.id).life==='removed')break}
 }
 assert.equal(s.rings.filter(r=>r.life==='active').length,0);assert.equal(s.rods.filter(z=>C.exists(s,z)).length,9);
});
test('正式挑战保存最佳成绩，不跳过教学关的解锁',()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const save=new Save();save.win(10,63,63);assert.equal(save.data.unlocked,0);assert.equal(new Save().data.records[10].stars,3);save.win(10,100,63);assert.equal(new Save().data.records[10].steps,63);delete globalThis.localStorage;
});
