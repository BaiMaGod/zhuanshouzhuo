import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import Core from '../src/core.js';
import {planPhysicalProgress} from '../src/advanced-physical-planner.js';
import {buildLevel107GeometryCandidate} from '../src/level107-geometry-candidate.js';

const source=JSON.parse(readFileSync(new URL('../docs/levels-101-200-level107-source.json',import.meta.url),'utf8')).levels[0];

// A bounded constructive physics probe. It never advances state unless an
// actual Core.request removes one or more rings through continuous rotation.
// Returning a NEW state is essential: Core has a state-keyed WeakMap ring cache.
function ownerCycles(state){
 const graph=new Map(state.rings.filter(r=>r.life==='active').map(r=>[r.id,[]]));
 for(const z of state.rods)if(z.kind==='m'&&Core.exists(state,z)&&graph.has(z.owner)&&graph.has(z.targets[0]))graph.get(z.owner).push(z.targets[0]);
 const visiting=new Set,visited=new Set,cycles=[];
 function dfs(id,path=[]){
  if(visiting.has(id)){cycles.push(path.slice(path.indexOf(id)).concat(id));return}
  if(visited.has(id))return;
  visiting.add(id);for(const next of graph.get(id)||[])dfs(next,[...path,id]);
  visiting.delete(id);visited.add(id);
 }
 for(const id of graph.keys())dfs(id);
 return cycles;
}

test('107: clear all 109 bracelets through legitimate no-tool rotations',()=>{
 const {level}=buildLevel107GeometryCandidate(source);
 const index=Core.levels.push(level)-1;
 try{
  let state=Core.make(index);const actions=[];
  assert.deepEqual(Core.validate(state),[]);
  for(let number=3;number<=14;number++){
   const piece=state.rods.find(z=>z.id==='F'+String(number).padStart(3,'0'));
   for(const endpoint of Core.endpoints(state,piece)){
    const ring=Core.ring(state,endpoint.id),delta=Core.diff(Core.angle(ring,endpoint.p),ring.a);
    const out=Core.request(state,ring.id,delta);
    assert.equal(out.blocked,null);
    assert.ok(out.removed.includes(ring.id));
    actions.push({ringId:ring.id,delta:out.done,removed:out.removed,rod:piece.id});
   }
   if(number===3){
    // These are deliberately preparatory rotations: the first may remove
    // no rings, but it positions the receiver to release the first burst.
    // The second rotates R004 toward M002 before M004, so the engine must
    // emit R001 first and then R002. No state or rod is manually removed.
    for(const [id,rodId] of [['R003','M001'],['R004','M002']]){
     const r=Core.ring(state,id),rod=state.rods.find(z=>z.id===rodId);
     const end=Core.endpoints(state,rod).find(e=>e.id===id);
     assert.ok(end,'burst route endpoint missing');
     const delta=Core.diff(Core.angle(r,end.p),r.a);
     const out=Core.request(state,id,delta);
     assert.equal(out.blocked,null,'burst setup collision '+id);
     assert.ok(Math.abs(out.done)>0.01,'burst setup must rotate '+id);
     actions.push({ringId:id,delta:out.done,removed:out.removed,rod:rodId});
    }
    assert.deepEqual(state.events.filter(e=>e.kind==='burst').map(e=>e.source),['R001','R002'],
     'R001 must explode first and then R002');
   }
  }
  assert.ok(state.rings.filter(r=>r.life==='removed').length>=35,'opening rotations must clear at least 35 bracelets');
  // Extend one-ring releases with strictly legal, non-clearing setup turns:
  // prepare targets for an owner, then release that owner in actual physics.
  const planner=planPhysicalProgress(Core,state);
  state=planner.state;
  actions.push(...planner.actions.map(a=>({ringId:a.id,delta:a.delta,removed:a.removed,rod:a.rod})));
  assert.ok(planner.removed>=44,'multi-step physical planner must extend early route');
  const active=state.rings.filter(r=>r.life==='active');
  const incompatible=active.flatMap(r=>{
   const heads=state.rods.filter(z=>Core.exists(state,z)).flatMap(z=>
    Core.endpoints(state,z).flatMap((e,i)=>e.id===r.id&&state.states[z.id][i]==='latched'
     ?[{rod:z.id,owner:z.owner||null,angle:Core.angle(r,e.p)}]:[]));
   return heads.length>1&&heads.some(h=>Math.abs(Core.diff(h.angle,heads[0].angle))>2*Core.tolerance)
    ?[{id:r.id,heads}]:[];
  });
  const report={stage:active.length===0?'verified_full_engine_route':'verified_partial_engine_route',fullRouteVerified:active.length===0,
   verifiedSteps:actions.length,removedCount:109-active.length,activeRemaining:active.length,
   activeIds:active.map(r=>r.id),actualBurstEvents:state.events.filter(e=>e.kind==='burst'),
   cyclicOwnerChains:ownerCycles(state),incompatibleReceiverRings:incompatible,actions};

  assert.deepEqual(report.actualBurstEvents.map(e=>e.source),['R001','R002']);
  assert.ok(report.actualBurstEvents.every(e=>e.brokenRodIds.length>0));
  assert.ok(actions.every(a=>Math.abs(a.delta)>0));
  assert.ok(actions.some(a=>a.removed.length===0),'must exercise true non-clearing preparatory turn');
  const replay=Core.make(index);
  for(const [i,a] of actions.entries()){
   const result=Core.request(replay,a.ringId,a.delta);
   assert.equal(result.blocked,null,'blocked on replay action '+i);
   assert.deepEqual(result.removed,a.removed,'different removal sequence at '+i);
  }
  assert.deepEqual(replay.rings.filter(r=>r.life==='active').map(r=>r.id),report.activeIds);
  const liveClaspIds=replay.rods.filter(rod=>Core.exists(replay,rod)).map(rod=>rod.id);
  assert.deepEqual(replay.events.filter(e=>e.kind==='burst'),report.actualBurstEvents);
  mkdirSync('tests/results',{recursive:true});
  writeFileSync('tests/results/level107-progressive-physical-route.json',JSON.stringify({...report,liveClaspIds},null,2)+'\n');
  console.log('LEVEL107_PROGRESSIVE='+JSON.stringify({steps:report.verifiedSteps,removed:report.removedCount,remaining:report.activeRemaining,bursts:report.actualBurstEvents.length,macros:planner.statistics.macroPlans,cycles:report.cyclicOwnerChains}));
  console.log('LEVEL107_BLOCKERS='+JSON.stringify({activeIds:report.activeIds,cycles:report.cyclicOwnerChains,incompatible:report.incompatibleReceiverRings,liveClaspIds}));
  assert.equal(report.removedCount,109,'complete route must remove all bracelets');
  assert.deepEqual(liveClaspIds,[],'no clasp may remain after the last rotation');
 }finally{Core.levels.pop()}
});
