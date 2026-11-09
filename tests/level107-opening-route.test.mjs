import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import Core from '../src/core.js';
import {buildLevel107GeometryCandidate} from '../src/level107-geometry-candidate.js';

test('level107: physically remove 12 background pairs without tools and without half-clasp remnants',()=>{
 const source=JSON.parse(readFileSync(new URL('../docs/levels-101-200-level107-source.json',import.meta.url),'utf8')).levels[0];
 const {level}=buildLevel107GeometryCandidate(source);
 const index=Core.levels.push(level)-1;
 const actions=[],removals=[];
 try{
  const state=Core.make(index);
  for(let number=3;number<=14;number++){
   const pieceId='F'+String(number).padStart(3,'0'),piece=state.rods.find(r=>r.id===pieceId);
   assert.ok(piece);
   for(let endpointIndex=0;endpointIndex<2;endpointIndex++){
    const endpoint=Core.endpoints(state,piece)[endpointIndex],ring=Core.ring(state,endpoint.id);
    assert.equal(ring.life,'active',endpoint.id+' should remain active until its own action');
    const delta=Core.diff(Core.angle(ring,endpoint.p),ring.a);
    assert.ok(Math.abs(delta)>0.1);
    const result=Core.request(state,ring.id,delta);
    assert.equal(result.blocked,null,ring.id+' '+JSON.stringify(result.blocked));
    assert.ok(result.removed.includes(ring.id),ring.id+' must be removed by physical rotation');
    removals.push(...result.removed);
    actions.push({ringId:ring.id,delta:result.done,backgroundPiece:pieceId,removed:result.removed});
    assert.equal(Core.exists(state,piece),endpointIndex===0,
      pieceId+' must remain WHOLE until all receiver rings are removed');
   }
  }
  assert.equal(state.rings.filter(r=>r.life==='removed').length,24);
  assert.equal(state.rings.filter(r=>r.life==='active').length,85);
  assert.equal(state.rods.filter(r=>r.kind==='b'&&!Core.exists(state,r)).length,12);
  assert.ok(state.rings.find(r=>r.id==='R001').life==='active');
  assert.ok(state.rings.find(r=>r.id==='R002').life==='active');
  const report={sourceLevel:107,stage:'verified_partial_physics_route_not_full_board',
   fullRouteVerified:false,steps:actions.length,removedCount:removals.length,activeRemaining:85,
   disconnectedBackgroundPieces:Array.from({length:12},(_,i)=>'F'+String(i+3).padStart(3,'0')),
   actions};
  mkdirSync('tests/results',{recursive:true});
  writeFileSync('tests/results/level107-opening-physical-route.json',JSON.stringify(report,null,2)+'\n');
  console.log('LEVEL107_PARTIAL_ROUTE='+JSON.stringify({steps:report.steps,removed:report.removedCount,remaining:report.activeRemaining}));
 }finally{Core.levels.pop()}
});
