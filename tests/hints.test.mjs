import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';
import solutions from '../dist/js/solutions.js';
import {routeHint,formalHint} from '../dist/js/hint-route.js';

test('正式提示覆盖保持机关的开局、半途拖动、对齐与消除后状态，不改变玩家状态',()=>{
 const s=C.make(LEGACY_FORMAL_INDEX);
 for(const index of [0,1,2,3,4,5,6,7,8,9]){
  const action=solutions[LEGACY_FORMAL_INDEX][index],before=C.clone(s),hint=routeHint(s);
  assert.deepEqual(s,before);assert.equal(hint.id,action.id);
  assert.equal(Math.sign(hint.delta),Math.sign(action.delta));
  const trial=C.clone(s),result=C.request(trial,hint.id,hint.delta);
  assert.equal(result.blocked,null);assert.ok(Math.abs(result.done)>.001);
  const partial=C.clone(s);C.request(partial,action.id,action.delta/2);
  if(C.ring(partial,action.id).life==='active'){
   const next=routeHint(partial);assert.equal(next.id,action.id);
   assert.equal(Math.sign(next.delta),Math.sign(action.delta));
   assert.equal(C.request(partial,next.id,next.delta).blocked,null);
  }
  C.request(s,action.id,action.delta);
 }
});

test('偏离标准路线时，只提示真实碰撞规则允许的动作',()=>{
 const s=C.make(LEGACY_FORMAL_INDEX);C.request(s,'9D',5);C.request(s,'9E',-5);
 const before=C.clone(s),hint=formalHint(s);assert.ok(hint);assert.deepEqual(s,before);
 const res=C.request(C.clone(s),hint.id,hint.delta);
 assert.equal(res.blocked,null);assert.ok(Math.abs(res.done)>.001);
});
