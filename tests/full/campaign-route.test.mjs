import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../../dist/js/core.js';
import solutions from '../../dist/js/solutions.js';
import {FORMAL_INDEX,FORMAL_COUNT,LEGACY_FORMAL_INDEX} from '../../dist/js/levels.js';
test('107个正式关卡的盘面与无道具旋转路线',()=>{
 assert.equal(C.levels.length,117);assert.equal(FORMAL_COUNT,107);assert.equal(solutions.length,C.levels.length);
 assert.equal(C.levels[LEGACY_FORMAL_INDEX].name,'第45关');
 for(let number=1;number<=FORMAL_COUNT;number++){
  const index=FORMAL_INDEX+number-1,s=C.make(index),level=C.levels[index];
  assert.equal(level.name,'第'+number+'关');assert.equal(s.rings.length,Math.min(number+9,109));
  assert.deepEqual(C.validate(s),[],'geometry '+number);assert.deepEqual(C.settle(C.clone(s)),[],'start '+number);
  const seen=new Set([s.rings[0].id]);
  for(let pass=0;pass<s.rings.length;pass++)for(const z of s.rods){
   const ids=z.kind==='m'?[z.owner,...z.targets]:z.targets;
   if(ids.some(id=>seen.has(id)))ids.forEach(id=>seen.add(id));
  }
  if(number<=100)assert.equal(seen.size,s.rings.length,'connected '+number);
  for(const a of solutions[index]){
   const result=C.request(s,a.id,a.delta);
   assert.equal(result.blocked,null,'level '+number+' '+JSON.stringify(result.blocked));
   assert.ok(Math.abs(result.done)>.001,'route action '+number+'/'+a.id);
  }
  assert.ok(s.rings.every(r=>r.life==='removed'),'cleared '+number);
  assert.ok(s.rods.every(z=>!C.exists(s,z)));
 }
});
