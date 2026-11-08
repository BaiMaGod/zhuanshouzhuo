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
 const initialAngleById=new Map(level.points.map(([id,x,y,a])=>[id,a]));
 const adjacent=(a,b)=>Math.abs(Core.dist(a,b)-92.0001)<.01;
 const neighbors=new Map(state.rings.map(r=>[r.id,state.rings.filter(t=>t.id!==r.id&&adjacent(r,t)).map(t=>t.id)]));
 const sinks=state.rings.filter(r=>out.get(r.id)===0);
 const sinkCandidates=state.rings.map(owner=>({
  id:owner.id,degree:neighbors.get(owner.id).length,outDegree:out.get(owner.id),removedAt:removedAt.get(owner.id),firstMoveAt:firstMoveAt.get(owner.id),
  targetCandidates:state.rings.filter(target=>target.id!==owner.id&&removedAt.get(target.id)!==undefined&&!level.links.some(e=>e[0]==='m'&&((e[1]===owner.id&&e[2]===target.id)||(e[1]===target.id&&e[2]===owner.id)))).map(target=>{const id=target.id;const step=removedAt.get(id),moveAt=firstMoveAt.get(owner.id),ownerRemovedAt=removedAt.get(owner.id),releasedBeforeOwnerMoves=step<moveAt,releasedAfterOwnerRemoved=step>ownerRemovedAt,ownerRing=byId.get(owner.id),targetRing=byId.get(id),ownerAngle=angleSnapshots[step]?.[owner.id]??ownerRing.a,initialBearing=Core.angle(ownerRing,targetRing),initialEnd=Core.point(targetRing,initialBearing+180),offset={x:initialEnd.x-ownerRing.x,y:initialEnd.y-ownerRing.y},rotatedEnd=Core.rot(offset,ownerAngle-initialAngleById.get(owner.id)),worldEnd={x:ownerRing.x+rotatedEnd.x,y:ownerRing.y+rotatedEnd.y},requiredAngle=Core.angle(targetRing,worldEnd),angleAtRemoval=removalAngles.get(id),delta=Core.diff(requiredAngle,angleAtRemoval),compatible=step<ownerRemovedAt&&step<moveAt&&Math.abs(delta)<=Core.tolerance;return{id,step,ownerAngle,requiredAngle,angleAtRemoval,delta,releasedBeforeOwnerMoves,releasedAfterOwnerRemoved,compatible}}).filter(x=>x.compatible)
 }));
 const removedIndex=level.links.findIndex((_,i)=>'L'+(i+1)==='L122');
 const replayCandidatePair=(owner,target)=>{
  const candidate=structuredClone(level);
  candidate.links=candidate.links.filter((_,i)=>i!==removedIndex);
  candidate.links.push(['m',owner,target]);
  candidate.special={rings:['R90','R98'].map(id=>({id,attribute:'burst',silkLayers:0})),silkEdges:[]};
  const candidateIndex=Core.levels.push(candidate)-1;
  try{
   const s=Core.make(candidateIndex),errors=Core.validate(s);
   if(errors.length)return{valid:false,reason:'geometry',detail:errors.slice(0,4)};
   const premature=Core.settle(Core.clone(s));
   if(premature.length)return{valid:false,reason:'premature',detail:premature};
   const extraRodId='L'+candidate.links.length,targetStep=removedAt.get(target);
   for(let i=0;i<solution.length;i++){
    const action=solution[i],oldRod=action.rod&&/^L\\d+$/.test(action.rod)?Number(action.rod.slice(1)):null;
    const rodId=!oldRod||oldRod===removedIndex+1?null:'L'+(oldRod>removedIndex+1?oldRod-1:oldRod);
    if(rodId&&Core.ring(s,action.id)?.life==='active'){
     const rod=s.rods.find(item=>item.id===rodId),endpoint=rod&&Core.endpoints(s,rod).find(item=>item.id===action.id);
     if(!endpoint)return{valid:false,reason:'missing-base-endpoint',step:i,ring:action.id,rod:rodId};
     const ring=Core.ring(s,action.id),delta=Core.diff(Core.angle(ring,endpoint.p),ring.a);
     if(Math.abs(delta)>.001){
      const result=Core.request(s,action.id,delta);
      if(result.blocked)return{valid:false,reason:'base-route-blocked',step:i,ring:action.id,rod:rodId,blocked:result.blocked};
     }else Core.settle(s);
    }
    if(i===targetStep&&Core.ring(s,target)?.life==='active'){
     const rod=s.rods.find(item=>item.id===extraRodId),endpoint=rod&&Core.endpoints(s,rod).find(item=>item.id===target);
     if(!endpoint)return{valid:false,reason:'missing-new-endpoint',step:i,target,rod:extraRodId};
     const ring=Core.ring(s,target),delta=Core.diff(Core.angle(ring,endpoint.p),ring.a);
     if(Math.abs(delta)>.001){
      const result=Core.request(s,target,delta);
      if(result.blocked)return{valid:false,reason:'receiver-blocked',step:i,target,rod:extraRodId,blocked:result.blocked};
     }else Core.settle(s);
     if(Core.ring(s,target)?.life==='active')return{valid:false,reason:'receiver-not-released',step:i,target};
    }
   }
   const remaining=s.rings.filter(r=>r.life==='active').map(r=>r.id);
   if(remaining.length)return{valid:false,reason:'remaining-rings',remaining:remaining.slice(0,12)};
   return{valid:true};
  }catch(error){return{valid:false,reason:'exception',detail:String(error.message||error)}}
  finally{Core.levels.pop()}
 };
 const physicalOwnerCandidates=[];
 const usedOwners=new Set(),usedTargets=new Set();
 const ownerPool=sinkCandidates.filter(owner=>owner.outDegree===0&&owner.targetCandidates.length>=2)
  .sort((a,b)=>b.targetCandidates.length-a.targetCandidates.length||b.removedAt-a.removedAt);
 for(const owner of ownerPool){
  if(usedOwners.has(owner.id))continue;
  const accepted=[];
  for(const target of [...owner.targetCandidates].sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))){
   if(usedTargets.has(target.id))continue;
   const result=replayCandidatePair(owner.id,target.id);
   if(result.valid)accepted.push({id:target.id,step:target.step,delta:target.delta});
   if(accepted.length===2)break;
  }
  if(accepted.length===2){
   physicalOwnerCandidates.push({owner:owner.id,outDegree:owner.outDegree,removedAt:owner.removedAt,firstMoveAt:owner.firstMoveAt,targets:accepted});
   usedOwners.add(owner.id);for(const target of accepted)usedTargets.add(target.id);
  }
  if(physicalOwnerCandidates.length===4)break;
 }
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
  physicalOwnerCandidates,
  selectedMountCandidates:physicalOwnerCandidates.flatMap(item=>item.targets.map(target=>({owner:item.owner,target:target.id,ownerRelease:removedBy.get(item.owner),targetRelease:removedBy.get(target.id)}))),
  ownersWithTwoAlignedTargets:sinkCandidates.filter(x=>x.targetCandidates.length>=2).sort((a,b)=>b.targetCandidates.length-a.targetCandidates.length),
  ownersWithOneAlignedTarget:sinkCandidates.filter(x=>x.targetCandidates.length>=1).sort((a,b)=>b.targetCandidates.length-a.targetCandidates.length),
  removals
 };
 mkdirSync('tests/results',{recursive:true});
 writeFileSync('tests/results/level107-base-analysis.json',JSON.stringify(report,null,2)+'\n');
 console.log('LEVEL107_BASE_ANALYSIS='+JSON.stringify({
  selectedMountCandidates:report.selectedMountCandidates,
  physicalOwnerCandidates:report.physicalOwnerCandidates,
  ownersWithTwoAlignedTargets:report.ownersWithTwoAlignedTargets.map(({id,outDegree,removedAt,firstMoveAt,targetCandidates})=>({id,outDegree,removedAt,firstMoveAt,targetCandidates:targetCandidates.slice(0,6)})),
  ownersWithOneAlignedTarget:report.ownersWithOneAlignedTarget.slice(0,24).map(({id,removedAt,firstMoveAt,targetCandidates})=>({id,removedAt,firstMoveAt,targetCandidates:targetCandidates.slice(0,4)})),
  bestSinkPairs:report.bestSinkPairs.slice(0,16)
 }));
});
