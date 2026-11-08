import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';

const h=installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const game=window.jadeDebug.game,Core=window.jadeDebug.Core;
game.audio.enabled=false;
game.save.data.unlocked=Core.levels.length-1;

const countOps=(sprite,kind)=>sprite.graphics.ops.filter(op=>op[0]===kind).length;
const active=(state,id)=>Core.ring(state,id)?.life==='active';
const removeRings=(source,ids)=>{
 const state=Core.clone(source);
 for(const id of ids)Core.ring(state,id).life='removed';
 Core.update(state);
 return state;
};
const expectedMounted=(state)=>{
 const rods=state.rods.filter(z=>z.kind==='m'&&active(state,z.owner));
 const sleeves=rods.filter(z=>active(state,z.targets[0]));
 return{rods:rods.length,sleeves:sleeves.length};
};
const includeWholeBoard=(board)=>{
 // Keep renderer culling out of this lifecycle test: every configured clasp
 // endpoint must be counted even when a device viewport would clip the board.
 board.rect={x:-1e6,y:-1e6,w:2e6,h:2e6};
};

test('mounted lock receiver sleeves follow receiver lifecycle on every level',()=>{
 let checked=0;
 for(let index=0;index<Core.levels.length;index++){
  game.load(index,true);
  const board=game.board,initial=Core.clone(game.model.state);
  includeWholeBoard(board);
  const mounted=initial.rods.filter(z=>z.kind==='m');
  for(const rod of mounted){
   const receiverRemoved=removeRings(initial,[rod.targets[0]]);
   board.draw(receiverRemoved);
   const expected=expectedMounted(receiverRemoved);
   assert.equal(countOps(board.rods,'poly'),expected.sleeves*3,
    'level '+(index+1)+' '+rod.id+': removed receiver must not leave its sleeve behind');
   assert.equal(countOps(board.rods,'mesh'),expected.rods,
    'level '+(index+1)+' '+rod.id+': owner-mounted rod body remains only with its owner');
   assert.equal(countOps(board.rods,'line'),expected.rods*3+expected.sleeves*2,
    'level '+(index+1)+' '+rod.id+': only live endpoint sleeves contribute end-cap lines');

   // A second frame must not restore a stale cached endpoint.
   board.draw(receiverRemoved);
   assert.equal(countOps(board.rods,'poly'),expected.sleeves*3,
    'level '+(index+1)+' '+rod.id+': cached frame must keep removed sleeve hidden');

   const ownerRemoved=removeRings(initial,[rod.owner]);
   board.draw(ownerRemoved);
   const afterOwner=expectedMounted(ownerRemoved);
   assert.equal(countOps(board.rods,'poly'),afterOwner.sleeves*3,
    'level '+(index+1)+' '+rod.id+': removing the owner removes all of its mounted lock parts');
   assert.equal(countOps(board.rods,'mesh'),afterOwner.rods);
   checked++;
  }
 }
 assert.ok(checked>0,'all-level campaign must contain owner-mounted locks');
 game.home();
});

test('background double-ended lock keeps its shaft but removes each dead endpoint on every level',()=>{
 let checked=0;
 for(let index=0;index<Core.levels.length;index++){
  game.load(index,true);
  const board=game.board,initial=Core.clone(game.model.state);
  includeWholeBoard(board);
  const background=initial.rods.filter(z=>z.kind==='b');
  for(const rod of background){
   const view=board.fixedRodViews.get(rod.id);
   assert.ok(view,'level '+(index+1)+' '+rod.id+': background lock must have its own render node');

   board.draw(initial);
   assert.equal(view.visible,true);
   assert.equal(countOps(view,'poly'),6,'both live endpoint sleeves are visible initially');
   assert.equal(countOps(view,'mesh'),1,'background shaft has one central jewel');

   for(const endpointId of rod.targets){
    const oneRemoved=removeRings(initial,[endpointId]);
    board.draw(oneRemoved);
    assert.equal(view.visible,true,
     'level '+(index+1)+' '+rod.id+': shaft remains while its other endpoint ring exists');
    assert.equal(countOps(view,'poly'),3,
     'level '+(index+1)+' '+rod.id+': only the surviving endpoint sleeve remains');
    assert.equal(countOps(view,'mesh'),1,'background shaft remains until both endpoints are gone');
    assert.equal(countOps(view,'line'),8,'shaft and one live sleeve are rendered without a dangling second sleeve');

    board.draw(oneRemoved);
    assert.equal(countOps(view,'poly'),3,
     'level '+(index+1)+' '+rod.id+': cached redraw cannot restore a removed endpoint');
   }

   const bothRemoved=removeRings(initial,rod.targets);
   board.draw(bothRemoved);
   assert.equal(view.visible,false,
    'level '+(index+1)+' '+rod.id+': background lock disappears when both endpoint rings are gone');
   assert.equal(view.graphics.ops.length,0,'hidden background lock cache is cleared');
   checked++;
  }
 }
 assert.ok(checked>0,'all-level campaign must contain background double-ended locks');
 game.home();
});

test('simultaneous final removal clears both mounted and background clasp layers on every level',()=>{
 for(let index=0;index<Core.levels.length;index++){
  game.load(index,true);
  const board=game.board,initial=Core.clone(game.model.state);
  includeWholeBoard(board);
  const cleared=removeRings(initial,initial.rings.map(r=>r.id));
  board.draw(cleared);
  assert.equal(board.rods.visible,false,'level '+(index+1)+': mounted clasp layer must be hidden');
  assert.equal(board.rods.graphics.ops.length,0,'level '+(index+1)+': mounted clasp graphics must be cleared');
  for(const rod of cleared.rods.filter(z=>z.kind==='b')){
   const view=board.fixedRodViews.get(rod.id);
   assert.equal(view.visible,false,'level '+(index+1)+' '+rod.id+': background clasp must be hidden');
   assert.equal(view.graphics.ops.length,0,'level '+(index+1)+' '+rod.id+': background clasp graphics must be cleared');
  }
 }
 game.home();
});
