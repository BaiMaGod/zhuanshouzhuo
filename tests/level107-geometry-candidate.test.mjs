import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import Core from '../src/core.js';
import {buildLevel107GeometryCandidate} from '../src/level107-geometry-candidate.js';

test('level107: compile original quotas and background endpoint IDs into physical candidate geometry',()=>{
 const source=JSON.parse(readFileSync(new URL('../docs/levels-101-200-level107-source.json',import.meta.url),'utf8')).levels[0];
 const {level,diagnostics}=buildLevel107GeometryCandidate(source);
 assert.equal(level.points.length,109);
 assert.equal(level.mountedRods.length,125);
 assert.equal(level.backgroundPieces.length,14);
 assert.equal(level.special.rings.filter(r=>r.attribute==='burst').length,2);
 assert.deepEqual(level.special.rings.filter(r=>r.attribute==='burst').map(r=>r.id),['R001','R002']);
 assert.deepEqual(level.backgroundPieces[0].endpoints.map(e=>e.receiverId),['R064','R003']);
 assert.deepEqual(level.backgroundPieces[1].endpoints.map(e=>e.receiverId),['R066','R004']);
 assert.equal(diagnostics.receiverGraphAuthoritative,false);
 assert.equal(diagnostics.physicalRouteVerified,false);
 assert.equal(diagnostics.releaseReady,false);
 const index=Core.levels.push(level)-1;
 try{
  const state=Core.make(index);
  assert.equal(state.rings.filter(r=>r.life==='active').length,109);
  const errors=Core.validate(state);
  assert.deepEqual(errors,[],errors.join(' | '));
  assert.deepEqual(Core.settle(Core.clone(state)),[],'board must not clear before any player action');
  for(const ring of state.rings){
   for(const other of state.rings){
    if(ring.id<other.id)assert.ok(Core.dist(ring,other)>=92-0.0001,'jade bodies cannot overlap '+ring.id+'/'+other.id);
   }
  }
  const candidateIds=new Set(state.rings.map(r=>r.id));
  for(const mount of state.rods.filter(r=>r.kind==='m')){
   assert.ok(candidateIds.has(mount.owner));
   assert.ok(candidateIds.has(mount.targets[0]));
   assert.equal(Core.endpoints(state,mount).length,1);
  }
  const snapshot={level,diagnostics,staticChecks:{coreValidationPassed:true,initialAutoRemovalCount:0}};
  mkdirSync('tests/results',{recursive:true});
  writeFileSync('tests/results/level107-geometry-candidate.json',JSON.stringify(snapshot,null,2)+'\n');
 }finally{Core.levels.pop()}
});
