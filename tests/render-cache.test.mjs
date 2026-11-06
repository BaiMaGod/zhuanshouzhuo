import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';

installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const game=window.jadeDebug.game,C=window.jadeDebug.Core;
game.audio.enabled=false;

test('the final bracelet removal clears every fixed clasp before victory on every level',()=>{
 let checkedBackgroundRods=0;
 for(let index=0;index<C.levels.length;index++){
  game.load(index,true);
  const model=game.model,state=model.state,board=game.board;
  const last=state.rings[state.rings.length-1];
  for(const ring of state.rings)if(ring.id!==last.id)ring.life='removed';
  C.update(state);board.draw(state);
  assert.equal(model.cleared,false,'level '+(index+1)+' must not clear while the final bracelet remains');
  assert.equal(board.fixedRods.parent,board.space,'level '+(index+1)+' fixed clasps live outside the cached rod batch');
  assert.equal(board.fixedRods.cacheAs,'none','level '+(index+1)+' fixed clasp layer must not be bitmap-cached');
  assert.equal(board.rods.cacheAs,'normal','level '+(index+1)+' moving-rod batch may retain its cache');
  assert.equal(board.rods.numChildren,0,'level '+(index+1)+' must not nest dynamic clasps under the cached batch');
  for(const rod of state.rods.filter(z=>z.kind==='b')){
   checkedBackgroundRods++;
   const view=board.fixedRodViews.get(rod.id);
   assert.ok(view,'level '+(index+1)+' must create a view for '+rod.id);
   assert.equal(view.parent,board.fixedRods,'level '+(index+1)+' '+rod.id+' must be outside the cached batch');
   const shouldRemain=rod.targets.includes(last.id);
   assert.equal(view.visible,shouldRemain,'level '+(index+1)+' '+rod.id+' remains only while its last endpoint bracelet survives');
  }
  const beforeFinal=C.clone(state);
  last.life='removed';C.update(state);
  board.release(beforeFinal,state,[last.id]);
  board.draw(state);
  assert.equal(model.cleared,true,'level '+(index+1)+' clears only after every rod is inactive');
  for(const rod of state.rods.filter(z=>z.kind==='b')){
   const view=board.fixedRodViews.get(rod.id);
   assert.equal(view.visible,false,'level '+(index+1)+' leaves no visible '+rod.id+' after the final bracelet is removed');
   assert.equal(view.graphics.ops.length,0,'level '+(index+1)+' clears all drawing commands for '+rod.id);
  }
  assert.equal(board.hasVisibleFixedRods,false,'level '+(index+1)+' must have no visible background clasp');
  // Even if a stale view is accidentally marked visible, victory must wait.
  const anyView=board.fixedRodViews.values().next().value;
  if(anyView){
   anyView.visible=true;
   game.modalOpen=false;
   game.win();
   assert.equal(game.modalOpen,false,'level '+(index+1)+' must not cover a visible fixed clasp with victory');
   anyView.visible=false;
  }
 }
 assert.ok(checkedBackgroundRods>0,'campaign must include background fixed clasps');
 game.home();
});
test('54-ring board keeps its jade and clasp batches cached across unchanged frames',()=>{
 game.load(LEGACY_FORMAL_INDEX,true);
 const b=game.board,s=game.model.state;
 assert.equal(s.rings.length,54);
 assert.equal(b.rods.cacheAs,'normal','static clasp batch uses an isolated cache');
 assert.ok([...b.rings.values()].every(x=>x.body.cacheAs==='normal'));
 const rods=b.rods.graphics.ops,fx=b.effects;
 for(let i=0;i<5;i++)b.draw(s);
 assert.equal(b.rods.graphics.ops,rods,'unchanged physics and camera must not rebuild rods');
 assert.equal(b.effects,fx,'effects root must survive every draw');
 assert.equal(fx.numChildren,0,'no leftover ghost sprites in a steady frame');
 b.zoomTo(b.fitZoom*2,{x:360,y:500});
 assert.notEqual(b.rods.graphics.ops,rods,'camera change must re-cull and rebuild clasps');
 const afterZoom=b.rods.graphics.ops;
 b.draw(s);assert.equal(b.rods.graphics.ops,afterZoom);
 const ring=C.ring(s,'1A');
 C.request(s,'1A',.5);b.draw(s);
 assert.notEqual(b.rods.graphics.ops,afterZoom,'real ring motion must refresh clasps');
 // An active collision highlight must be fully cleared after expiration.
 b.blocked={kind:'captive',rod:'L3',target:'1C',text:'blocked'};
 b.blockedRing='1A';b.blockUntil=performance.now()+300;
 b.draw(s);assert.ok(b.rings.get('1A').halo.graphics.ops.length);
 const hot=b.rods.graphics.ops;b.blockUntil=performance.now()-1;b.draw(s);
 assert.notEqual(b.rods.graphics.ops,hot,'expired hot clasp must redraw normally');
 assert.equal(b.rings.get('1A').halo.visible,false);
 game.home();
});
