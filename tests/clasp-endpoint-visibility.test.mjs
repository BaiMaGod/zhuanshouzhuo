import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';

installHarness();
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
const includeWholeBoard=(board)=>{
 // Remove camera culling from the lifecycle contract: check EVERY configured
 // clasp even if the real game viewport would clip this particular section.
 board.rect={x:-1e6,y:-1e6,w:2e6,h:2e6};
};
function assertMountedComplete(board,state,where){
 const surviving=state.rods.filter(z=>z.kind==='m'&&Core.exists(state,z));
 const n=surviving.length;
 assert.equal(board.rods.visible,n>0,
  where+': mounted layer is visible only when it contains a surviving clasp');
 assert.equal(countOps(board.rods,'mesh'),n,
  where+': precisely one ornamental mounting for every surviving rod');
 assert.equal(countOps(board.rods,'poly'),3*n,
  where+': EVERY surviving rod keeps its entire receiver-end sleeve (three polygons)');
 assert.equal(countOps(board.rods,'line'),6*n,
  where+': each surviving rod keeps its shaft and BOTH sleeve edge lines');
 for(const z of surviving){
  // Collision geometry still includes the sleeve even if its receiver ring has gone.
  // The rendering must not silently remove that fitting.
  assert.equal(Core.rodSegments(state,z).length,5,where+': physical mounted clasp includes fitting segments');
 }
}
function assertBackgroundComplete(board,state,z,where){
 const surviving=state.rods.filter(rod=>rod.kind==='b'&&Core.exists(state,rod));
 const n=surviving.length;
 assert.equal(board.fixedRods.visible,n>0,where+': batched background layer follows all surviving clasp lifecycles');
 assert.equal(board.fixedRods.numChildren,0,where+': background clasps share one render node, not one Sprite per rod');
 assert.equal(countOps(board.fixedRods,'mesh'),n,where+': one central anchor is drawn for every surviving background clasp');
 assert.equal(countOps(board.fixedRods,'poly'),6*n,where+': both end sleeves of every surviving background clasp remain complete');
 const shaftSegments=rod=>rod.paths?.reduce((sum,path)=>sum+path.length-1,0)??1;
 const lines=surviving.reduce((sum,rod)=>sum+(rod.paths?3*shaftSegments(rod)+4:10),0);
 assert.equal(countOps(board.fixedRods,'line'),lines,where+': each surviving background clasp keeps its entire shaft');
 if(Core.exists(state,z))assert.equal(Core.rodSegments(state,z).length,shaftSegments(z)+8,where+': collision includes both complete end fittings');
}

test('across ALL levels removing a receiver never cuts another living bracelet clasp in half',()=>{
 let checked=0;
 for(let index=0;index<Core.levels.length;index++){
  game.load(index,true);
  const board=game.board,initial=Core.clone(game.model.state);
  includeWholeBoard(board);
  board.draw(initial);
  assertMountedComplete(board,initial,'level '+(index+1)+' initial');
  for(const rod of initial.rods.filter(z=>z.kind==='m')){
   const receiverRemoved=removeRings(initial,[rod.targets[0]]);
   board.draw(receiverRemoved);
   assertMountedComplete(board,receiverRemoved,'level '+(index+1)+' '+rod.id+' receiver gone');
   // A cached or second frame must NOT make the surviving clasp half disappear.
   board.draw(receiverRemoved);
   assertMountedComplete(board,receiverRemoved,'level '+(index+1)+' '+rod.id+' receiver gone redraw');

   const ownerRemoved=removeRings(initial,[rod.owner]);
   board.draw(ownerRemoved);
   assertMountedComplete(board,ownerRemoved,'level '+(index+1)+' '+rod.id+' owner gone');

   const bothRemoved=removeRings(initial,[rod.owner,...rod.targets]);
   board.draw(bothRemoved);
   assertMountedComplete(board,bothRemoved,'level '+(index+1)+' '+rod.id+' owner and receiver gone');
   checked++;
  }
 }
 assert.ok(checked>0,'all-level campaign contains owner-mounted locks');
 game.home();
});

test('across ALL levels background double-ended clasp is always complete until both endpoint rings disappear',()=>{
 let checked=0;
 for(let index=0;index<Core.levels.length;index++){
  game.load(index,true);
  const board=game.board,initial=Core.clone(game.model.state);
  includeWholeBoard(board);
  for(const rod of initial.rods.filter(z=>z.kind==='b')){
   board.draw(initial);
   assertBackgroundComplete(board,initial,rod,'level '+(index+1)+' '+rod.id+' initial');
   for(const endpointId of rod.targets){
    const oneRemoved=removeRings(initial,[endpointId]);
    board.draw(oneRemoved);
    assertBackgroundComplete(board,oneRemoved,rod,'level '+(index+1)+' '+rod.id+' only '+endpointId+' removed');
    board.draw(oneRemoved);
    assertBackgroundComplete(board,oneRemoved,rod,'level '+(index+1)+' '+rod.id+' cached redraw');
   }
   const bothRemoved=removeRings(initial,rod.targets);
   board.draw(bothRemoved);
   assertBackgroundComplete(board,bothRemoved,rod,'level '+(index+1)+' '+rod.id+' both removed');
   checked++;
  }
 }
 assert.ok(checked>0,'all-level campaign contains background double-ended locks');
 game.home();
});

test('removing EVERY bracelet in the same settle pass clears ALL lock layers and ghosts across all levels',()=>{
 for(let index=0;index<Core.levels.length;index++){
  game.load(index,true);
  const board=game.board,initial=Core.clone(game.model.state);
  includeWholeBoard(board);
  const cleared=removeRings(initial,initial.rings.map(r=>r.id));
  board.draw(cleared);
  assert.equal(board.rods.visible,false,'level '+(index+1)+': mounted clasp layer must hide');
  assert.equal(board.rods.graphics.ops.length,0,'level '+(index+1)+': mounted clasp graphics must clear');
  for(const rod of cleared.rods.filter(z=>z.kind==='b'))
   assertBackgroundComplete(board,cleared,rod,'level '+(index+1)+' '+rod.id+' all rings removed');
 }
 game.home();
});

test('a burst removes an entire fixed piece even with both receiver bracelets active',()=>{
 game.load(116,true);
 const {board}=game,state=Core.clone(game.model.state);
 includeWholeBoard(board);
 const rod=state.rods.find(z=>z.kind==='b');
 assertBackgroundComplete(board,state,rod,'before burst');
 rod.broken=true;Core.update(state);board.draw(state);
 assert.ok(rod.targets.every(id=>active(state,id)));
 assertBackgroundComplete(board,state,rod,'after burst');
 game.home();
});
