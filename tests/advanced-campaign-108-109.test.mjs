import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../src/core.js';
import solutions from '../src/solutions.js';
import {FORMAL_INDEX} from '../src/levels.js';
import {readFileSync} from 'node:fs';
const design=JSON.parse(readFileSync(new URL('../docs/levels-101-200-design.json',import.meta.url)));
for(const n of [108,109])test('第'+n+'关：配额、完整旋转回放和锁扣清空',()=>{
 const spec=design.levels.find(s=>s.level===n),index=FORMAL_INDEX+n-1,level=C.levels[index],s=C.make(index);
 assert.equal(level.name,'第'+n+'关');assert.equal(s.rings.length,spec.ringCount);
 const counts=Array(7).fill(0);
 for(const r of s.rings)counts[s.rods.filter(z=>z.owner===r.id).length]++;
 assert.deepEqual(counts,spec.ownedClaspRingCounts);
 assert.equal(s.rods.filter(z=>z.kind==='b').length,spec.backgroundPieceCounts[0]);
 assert.equal(s.rings.filter(r=>r.burst).length,spec.burstOnly);
 assert.deepEqual(C.validate(s),[]);assert.equal(C.settle(C.clone(s)).length,0);
 for(const step of solutions[index]){
  const out=C.request(s,step.id,step.delta);
  assert.equal(out.blocked,null,step.id+' '+step.rod);
  assert.ok(Math.abs(out.done-step.delta)<1e-4);
 }
 assert.equal(s.rings.filter(r=>r.life==='active').length,0);
 assert.equal(s.rods.filter(z=>C.exists(s,z)).length,0);
});
