import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import Core from '../src/core.js';
import {buildLevel107GeometryCandidate} from '../src/level107-geometry-candidate.js';
const source=JSON.parse(readFileSync(new URL('../docs/levels-101-200-level107-source.json',import.meta.url),'utf8')).levels[0];

test('level107: identify actual first-move physics, angle conflicts and clasp dependency cycles',()=>{
 const {level,diagnostics}=buildLevel107GeometryCandidate(source);
 const index=Core.levels.push(level)-1;
 try{
  const state=Core.make(index);
  const angleConflicts=[];
  for(const r of state.rings){
   const heads=state.rods.filter(z=>Core.exists(state,z)).flatMap(z=>Core.endpoints(state,z).filter(e=>e.id===r.id).map(e=>({
    rod:z.id,owner:z.owner||null,kind:z.kind,worldAngle:Core.angle(r,e.p),
    aligned:Math.abs(Core.diff(r.a,Core.angle(r,e.p)))<=Core.tolerance
   })));
   for(let i=0;i<heads.length;i++)for(let j=i+1;j<heads.length;j++){
    const degrees=Math.abs(Core.diff(heads[i].worldAngle,heads[j].worldAngle));
    if(degrees>2*Core.tolerance+0.1)angleConflicts.push({ring:r.id,heads:[heads[i].rod,heads[j].rod],degrees});
   }
  }
  const graph=new Map(state.rings.map(r=>[r.id,[]]));
  for(const z of state.rods)if(z.kind==='m')graph.get(z.owner).push(z.targets[0]);
  const indices=new Map,low=new Map,stack=[],onstack=new Set,cyclic=[];
  let counter=0;
  const visit=id=>{
   indices.set(id,counter);low.set(id,counter++);stack.push(id);onstack.add(id);
   for(const to of graph.get(id)){
    if(!indices.has(to)){visit(to);low.set(id,Math.min(low.get(id),low.get(to)))}
    else if(onstack.has(to))low.set(id,Math.min(low.get(id),indices.get(to)));
   }
   if(low.get(id)===indices.get(id)){
    const group=[];let node;
    do{node=stack.pop();onstack.delete(node);group.push(node)}while(node!==id);
    if(group.length>1)cyclic.push(group.sort());
   }
  };
  for(const ring of state.rings)if(!indices.has(ring.id))visit(ring.id);
  const initialMoves=[];
  // Only a handful of controlled actions here; a complete no-tool replay is
  // the separate release gate and must not be inferred from this probe.
  for(const id of ['R003','R004','R005','R006']){
   const copy=Core.clone(state),r=Core.ring(copy,id);
   const eligible=copy.rods.flatMap(z=>Core.endpoints(copy,z).filter(e=>e.id===id).map(e=>({rod:z.id,delta:Core.diff(Core.angle(r,e.p),r.a)})));
   const selected=eligible.find(e=>Math.abs(e.delta)>0.01);
   if(!selected){initialMoves.push({id,reason:'no nonzero alignment move'});continue}
   const outcome=Core.request(copy,id,selected.delta);
   initialMoves.push({id,targetRod:selected.rod,attempted:selected.delta,done:outcome.done,
    removed:outcome.removed,blocked:outcome.blocked?.kind||null,
    activeAfter:copy.rings.filter(r=>r.life==='active').length,
    remainingLatched:Core.connections(copy,id).map(item=>item.z.id)});
  }
  const report={stage:'preflight_only',releaseReady:false,physicalRouteVerified:false,
   sourceRings:source.rings.length,angleConflicts:angleConflicts.slice(0,120),
   angleConflictPairCount:angleConflicts.length,cyclicOwnerGroups:cyclic,
   initialMoves,underlyingCandidate:diagnostics};
  mkdirSync('tests/results',{recursive:true});
  writeFileSync('tests/results/level107-geometry-probe.json',JSON.stringify(report,null,2)+'\n');
  assert.equal(report.releaseReady,false);
  assert.equal(report.physicalRouteVerified,false);
  assert.equal(state.rings.filter(r=>r.life==='active').length,109);
  console.log('LEVEL107_PREFLIGHT='+JSON.stringify({
   conflictPairs:report.angleConflictPairCount,cyclicComponents:cyclic.length,
   initialMoves:initialMoves.map(x=>({id:x.id,removed:x.removed,blocked:x.blocked}))}));
 }finally{Core.levels.pop()}
});
