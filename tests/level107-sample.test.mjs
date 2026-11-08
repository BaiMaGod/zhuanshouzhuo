import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import Core from '../src/core.js';
import {buildLevel107Sample} from '../src/level107-sample.js';

function stateHash(state){
 const stable={
  rings:state.rings.map(r=>({id:r.id,x:r.x,y:r.y,a:r.a,life:r.life,burst:!!r.burst,silkRemaining:r.silkRemaining})),
  rods:state.rods.map(r=>({id:r.id,kind:r.kind,owner:r.owner,targets:r.targets,broken:!!r.broken,states:state.states[r.id]})),
  processedRemovals:state.processedRemovals
 };
 return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

test('第107关候选：109镯、125自带扣、14背景双头扣、双爆裂接续、无道具物理通关',{timeout:120_000},()=>{
 console.log('[Level107] start sample geometry and physical route replay');
 const sample=buildLevel107Sample(),level=sample.level;
 console.log('[Level107] sample route generated:',sample.route.length,'steps');
 assert.equal(sample.metrics.ringCount,109);
 assert.equal(sample.metrics.mountedCount,125);
 assert.equal(sample.metrics.backgroundCount,14);
 assert.deepEqual(sample.metrics.ownerDistribution,{0:61,1:7,2:11,3:24,4:6,5:0,6:0});
 assert.deepEqual(sample.metrics.burstRings,['R90','R98']);
 assert.equal(sample.metrics.receiverReleaseAngles.length,8);
 assert.ok(sample.metrics.receiverReleaseAngles.every(item=>Math.abs(item.delta)<=65));
 assert.deepEqual(sample.metrics.burstNeighbors.R90,['R50','R62','R78','R98']);
 assert.deepEqual(sample.metrics.burstNeighbors.R98,['R62','R74','R90']);
 assert.equal(level.links.length,139);
 assert.equal(level.special.rings.length,2);
 assert.ok(sample.route.length>0);

 const index=Core.levels.push(level)-1;
 try{
  const state=Core.make(index);
  assert.deepEqual(Core.validate(state),[]);
  assert.equal(state.rings.filter(r=>r.burst).length,2);
  assert.deepEqual(Core.settle(Core.clone(state)),[],'开局不得自动消除');
  const initialStateHash=stateHash(state);
  const routeLog=[];
  for(let i=0;i<sample.route.length;i++){
   const action=sample.route[i],result=Core.request(state,action.id,action.delta);
   assert.equal(result.blocked,null,'route step '+i+' '+JSON.stringify(result.blocked));
   assert.ok(Math.abs(result.done)>.001,'route step '+i+' must rotate');
   routeLog.push({step:i+1,id:action.id,rod:action.rod,delta:result.done,removed:result.removed});
  }
  assert.ok(state.rings.every(r=>r.life==='removed'),'all rings removed');
  assert.ok(state.rods.every(rod=>!Core.exists(state,rod)),'no clasp remains after victory');
  const burstEvents=state.events.filter(event=>event.kind==='burst');
  assert.deepEqual(burstEvents.map(event=>event.source).sort(),['R90','R98']);
  assert.ok(burstEvents.every(event=>event.brokenRodIds.length>0),'both burst rings must physically break neighboring clasp rods');
  const finalStateHash=stateHash(state);
  const proof={
   status:'candidate_physics_verified_not_publishable',
   level:107,ringCount:109,mountedCount:125,backgroundCount:14,
   ownerDistribution:sample.metrics.ownerDistribution,
   burstRings:sample.metrics.burstRings,burstNeighbors:sample.metrics.burstNeighbors,
   addedOwnerTargets:sample.metrics.addedOwnerTargets,receiverReleaseAngles:sample.metrics.receiverReleaseAngles,
   burstEvents,removedBackgroundRod:sample.metrics.removedBackgroundRod,
   baseRouteSteps:sample.metrics.baseRouteSteps,verifiedRouteSteps:sample.route.length,
   toolsUsed:0,blockedRotations:0,remainingRings:state.rings.filter(r=>r.life==='active').length,
   remainingClaspObjects:state.rods.filter(rod=>Core.exists(state,rod)).length,
   initialStateHash,finalStateHash,route:routeLog,
   pending:['真实手机试玩','难度与平均通关时长校准','与原始工作簿逐镯分配表对齐','美术/布局截图验收']
  };
  mkdirSync('tests/results',{recursive:true});
  writeFileSync('tests/results/level107-sample-candidate.json',JSON.stringify({level,metrics:sample.metrics,proof},null,2)+'\n');
  console.log('LEVEL107_SAMPLE_PROOF='+JSON.stringify(proof));
 }finally{
  Core.levels.pop();
 }
});
