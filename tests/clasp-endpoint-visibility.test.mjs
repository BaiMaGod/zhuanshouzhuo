import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';

const h=installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const g=window.jadeDebug.game,C=window.jadeDebug.Core;
g.audio.enabled=false;

const countOps=(sprite,kind)=>sprite.graphics.ops.filter(op=>op[0]===kind).length;
const removeRings=(source,ids)=>{
 const state=C.clone(source);
 for(const id of ids)C.ring(state,id).life='removed';
 C.update(state);
 return state;
};

test('owner-mounted rod keeps its body but hides only the clasp on a removed receiver',()=>{
 g.save.data.unlocked=9; // The scene guard otherwise keeps a fresh profile on tutorial level 1.
 g.load(3,true);
 const board=g.board,initial=C.clone(g.model.state);
 const mounted=initial.rods.filter(rod=>rod.kind==='m');
 assert.equal(mounted.length,3,'the three-leaf teaching board has three owner-mounted rods');

 board.draw(initial);
 assert.equal(countOps(board.rods,'poly'),9,'three active receiver sleeves each draw three outlines');
 assert.equal(countOps(board.rods,'mesh'),3,'all three owner-mounted rod jewels are present');
 assert.equal(countOps(board.rods,'line'),18,'all rod bodies and receiver sleeves are drawn');

 const removed=removeRings(initial,[mounted[0].targets[0]]);
 board.draw(removed);
 assert.equal(board.rods.visible,true,'the surviving owner keeps its rods');
 assert.equal(countOps(board.rods,'poly'),6,'the removed receiver sleeve is no longer drawn');
 assert.equal(countOps(board.rods,'mesh'),3,'the surviving owner-mounted rod jewels remain');
 assert.equal(countOps(board.rods,'line'),16,'the rod body remains while only the removed endpoint sleeve lines disappear');

 board.draw(removed);
 assert.equal(countOps(board.rods,'poly'),6,'a subsequent cached frame cannot bring the removed clasp back');

 board.draw(initial);
 assert.equal(countOps(board.rods,'poly'),9,'an active receiver sleeve returns when the original active state is restored');

 const ownerRemoved=removeRings(initial,[mounted[0].owner]);
 board.draw(ownerRemoved);
 assert.equal(countOps(board.rods,'poly'),0,'removing the owner still removes all of its mounted rods');
 assert.equal(countOps(board.rods,'mesh'),0,'removing the owner also removes its rod jewels');
});

test('background double-ended rod hides each removed endpoint clasp independently',()=>{
 g.save.data.unlocked=9; // Open tutorial level 2 explicitly in this isolated scene test.
 g.load(1,true);
 const board=g.board,initial=C.clone(g.model.state);
 const rod=initial.rods.find(item=>item.kind==='b');
 assert.ok(rod,'the background double-ended teaching board contains a fixed rod');
 board.draw(initial);
 const view=board.fixedRodViews.get(rod.id);
 assert.ok(view);
 assert.equal(view.visible,true);
 assert.equal(countOps(view,'poly'),6,'both active endpoint sleeves are drawn');
 assert.equal(countOps(view,'mesh'),1,'the shared centre jewel is drawn');

 for(const endpointId of rod.targets){
  const oneRemoved=removeRings(initial,[endpointId]);
  board.draw(oneRemoved);
  assert.equal(view.visible,true,'the background rod remains while its other endpoint ring survives');
  assert.equal(countOps(view,'poly'),3,'only the surviving endpoint sleeve is drawn');
  assert.equal(countOps(view,'mesh'),1,'the shared rod jewel remains with the rod');
  assert.ok(countOps(view,'line')>0,'the background rod body remains visible');
 }

 board.draw(initial);
 assert.equal(countOps(view,'poly'),6,'both endpoint sleeves return when both rings are active');
 const bothRemoved=removeRings(initial,rod.targets);
 board.draw(bothRemoved);
 assert.equal(view.visible,false,'the background rod disappears after both endpoint rings are removed');
 assert.equal(view.graphics.ops.length,0,'the hidden background rod cache is cleared completely');
});
