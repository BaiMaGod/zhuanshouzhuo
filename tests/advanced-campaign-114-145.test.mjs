import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../src/core.js';
import solutions from '../src/solutions.js';
import {FORMAL_INDEX,FORMAL_COUNT} from '../src/levels.js';

// These levels are shipped only when runtime registration and a complete
// Core.request replay both succeed. Keep this gate independent of the generator.
test('formal campaign registers every level from 1 through 145',()=>{
 assert.equal(FORMAL_COUNT,145);
 assert.equal(C.levels.length,155);
 for(let n=1;n<=145;n++)assert.equal(C.levels[FORMAL_INDEX+n-1].name,'第'+n+'关');
});

for(let number=114;number<=145;number++)test('正式第'+number+'关可通过真实物理操作完整通关',()=>{
 const index=FORMAL_INDEX+number-1,level=C.levels[index],state=C.make(index),route=solutions[index];
 assert.equal(level.name,'第'+number+'关');
 assert.equal(state.rings.length,number);
 assert.ok(Array.isArray(route)&&route.length>0,'完整无道具路线缺失');
 assert.deepEqual(C.validate(state),[]);
 assert.deepEqual(C.settle(C.clone(state)),[],'初始盘面不能自动清空');
 if(level.proof?.steps!==undefined)assert.equal(level.proof.steps,route.length);
 if(level.timed)assert.equal(level.timed.routeSteps,route.length);
 for(const [stepIndex,action] of route.entries()){
  const ring=C.ring(state,action.id);
  assert.ok(ring&&ring.life==='active','第'+(stepIndex+1)+'步引用了已消除玉镯 '+action.id);
  const result=C.request(state,action.id,action.delta);
  assert.equal(result.blocked,null,'第'+(stepIndex+1)+'步发生物理阻挡：'+(result.blocked?.text||''));
  assert.ok(Math.abs(result.done)>.001,'第'+(stepIndex+1)+'步没有产生旋转');
 }
 assert.equal(state.rings.filter(r=>r.life==='active').length,0,'路线结束仍有玉镯');
 assert.equal(state.rods.filter(z=>C.exists(state,z)).length,0,'路线结束仍有活动锁扣');
});
