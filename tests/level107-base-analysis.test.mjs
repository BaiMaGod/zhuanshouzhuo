import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import Core from '../src/core.js';
import {formalLevels,formalSolutions} from '../src/formal-campaign.js';

test('inspect verified 109-ring base for level107 geometry reuse',()=>{
 const index=Core.levels.indexOf(formalLevels[99]);
 assert.equal(index,109);
 const level=formalLevels[99],state=Core.make(index),solution=formalSolutions[99];
 assert.equal(state.rings.length,109);
 assert.deepEqual(Core.validate(state),[]);
 const removedAt=new Map(),removalAngles=new Map(),removedBy=new Map(),removals=[],angleSnapshots=[];
 for(let i=0;i<solution.length;i++){
  const action=solution[i],result=Core.request(state,action.id,action.delta);
  assert.equal(result.blocked,null,'base action '+i+' '+JSON.stringify(result.blocked));
  for(const id of result.removed){if(!removedAt.has(id)){removedAt.set(id,i);removalAngles.set(id,Core.ring(state,id).a);removedBy.set(id,{step:i,actionRing:action.id,actionRod:action.rod,actionDelta:action.delta})}removals.push({step:i,id,angle:Core.ring(state,id).a,actionRing:action.id,actionRod:action.rod});}
  angleSnapshots[i]=Object.fromEntries(state.rings.map(r=>[r.id,r.a]));
 }
 assert.ok(state.rings.every(r=>r.life==='removed'));
 const firstMoveAt=new Map(state.rings.map(r=>[r.id,Infinity]));
 for(let i=0;i<solution.length;i++)if(Math.abs(solution[i].delta)>.001&&firstMoveAt.get(solution[i].id)===Infinity)firstMoveAt.set(solution[i].id,i);
 const out=new Map(state.rings.map(r=>[r.id,0]));
 for(const link of level.links)if(link[0]==='m')out.set(link[1],out.get(link[1])+1);
 const dist={};for(const n of out.values())dist[n]=(dist[n]||0)+1;
 const byId=new Map(state.rings.map(r=>[r.id,r]));
 const adjacent=(a,b)=>Math.abs(Core.dist(a,b)-92.0001)<.01;
 const neighbors=new Map(state.rings.map(r=>[r.id,state.rings.filter(t=>t.id!==r.id&&adjacent(r,t)).map(t=>t.id)]));
 const sinks=state.rings.filter(r=>out.get(r.id)===0);
 const sinkCandidates=sinks.map(owner=>({
  id:owner.id,degree:neighbors.get(owner.id).length,removedAt:removedAt.get(owner.id),firstMoveAt:firstMoveAt.get(owner.id),
  targetCandidates:neighbors.get(owner.id).filter(id=>removedAt.get(id)!==undefined&&!level.links.some(e=>e[0]==='m'&&((e[1]===owner.id&&e[2]===id)||(e[1]===id&&e[2]===owner.id)))).map(id=>{const step=removedAt.get(id),moveAt=firstMoveAt.get(owner.id),ownerRemovedAt=removedAt.get(owner.id),releasedBeforeOwnerMoves=step<moveAt,releasedAfterOwnerRemoved=step>ownerRemovedAt,ownerAngle=angleSnapshots[step]?.[owner.id]??byId.get(owner.id).a,a=Core.angle(byId.get(owner.id),byId.get(id)),initialEnd=Core.point(byId.get(id),a+180),localEnd=Core.rot({x:initialEnd.x-byId.get(owner.id).x,y:initialEnd.y-byId.get(owner.id).y},-byId.get(owner.id).a),rotatedEnd=Core.rot(localEnd,ownerAngle),worldEnd={x:byId.get(owner.id).x+rotatedEnd.x,y:byId.get(owner.id).y+rotatedEnd.y},requiredAngle=Core.angle(byId.get(id),worldEnd),angleAtRemoval=removalAngles.get(id),delta=Core.diff(requiredAngle,angleAtRemoval),compatible=releasedAfterOwnerRemoved||(releasedBeforeOwnerMoves&&Math.abs(delta)<=Core.tolerance);return{id,step,ownerAngle,requiredAngle,angleAtRemoval,delta,releasedBeforeOwnerMoves,releasedAfterOwnerRemoved,compatible}}).filter(x=>x.compatible)
 }));
 const burstPairs=[];
 for(const a of sinks)for(const b of sinks)if(a.id<b.id&&adjacent(a,b)&&removedAt.get(a.id)<removedAt.get(b.id)&&neighbors.get(a.id).length<=4&&neighbors.get(b.id).length<=4)
  burstPairs.push({first:a.id,second:b.id,firstRemovedAt:removedAt.get(a.id),secondRemovedAt:removedAt.get(b.id),firstNeighbors:neighbors.get(a.id),secondNeighbors:neighbors.get(b.id)});
 const background=level.links.filter(e=>e[0]==='b').map((e,i)=>({id:'L'+(level.links.findIndex(x=>x===e)+1),a:e[1],b:e[2]}));
 const report={
  levelName:level.name,removedBy:Object.fromEntries(removedBy),ringCount:state.rings.length,routeSteps:solution.length,
  mountedCount:level.links.filter(e=>e[0]==='m').length,backgroundCount:background.length,
  ownerDistribution:dist,sinkCount:sinks.length,outDegree:Object.fromEntries(out),background,
  burstPairCandidates:burstPairs.slice(0,30),newOwnerCandidates:sinkCandidates.filter(x=>x.targetCandidates.length>=2).sort((a,b)=>b.removedAt-a.removedAt).slice(0,40),
  alreadyAlignedOwnerCandidates:sinkCandidates.map(x=>({...x,targetCandidates:x.targetCandidates.filter(t=>t.alreadyAligned)})).filter(x=>x.targetCandidates.length>=2).sort((a,b)=>b.removedAt-a.removedAt),
  bestSinkPairs:sinkCandidates.filter(x=>x.targetCandidates.length>=2).map(x=>({...x,targetCandidates:x.targetCandidates.slice(0,8)})).sort((a,b)=>b.targetCandidates.length-a.targetCandidates.length),
  selectedMountCandidates:[['R70','R44'],['R70','R104'],['R69','R82'],['R69','R103'],['R68','R80'],['R68','R101'],['R98','R74'],['R98','R90']].map(([owner,target])=>({owner,target,ownerRelease:removedBy.get(owner),targetRelease:removedBy.get(target),dynamic: sinkCandidates.find(x=>x.id===owner)?.targetCandidates.find(x=>x.id===target)})),
  ownersWithTwoAlignedTargets:sinkCandidates.filter(x=>x.targetCandidates.length>=2).sort((a,b)=>b.targetCandidates.length-a.targetCandidates.length),
  ownersWithOneAlignedTarget:sinkCandidates.filter(x=>x.targetCandidates.length>=1).sort((a,b)=>b.targetCandidates.length-a.targetCandidates.length),
  removals
 };
 mkdirSync('tests/results',{recursive:true});
 writeFileSync('tests/results/level107-base-analysis.json',JSON.stringify(report,null,2)+'\n');
 console.log('LEVEL107_BASE_ANALYSIS='+JSON.stringify({
  selectedMountCandidates:report.selectedMountCandidates,
  ownersWithTwoAlignedTargets:report.ownersWithTwoAlignedTargets.map(({id,removedAt,firstMoveAt,targetCandidates})=>({id,removedAt,firstMoveAt,targetCandidates:targetCandidates.slice(0,6)})),
  ownersWithOneAlignedTarget:report.ownersWithOneAlignedTarget.slice(0,24).map(({id,removedAt,firstMoveAt,targetCandidates})=>({id,removedAt,firstMoveAt,targetCandidates:targetCandidates.slice(0,4)})),
  bestSinkPairs:report.bestSinkPairs.slice(0,16)
 }));
});
