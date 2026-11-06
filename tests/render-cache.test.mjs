import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';

installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const game=window.jadeDebug.game,C=window.jadeDebug.Core;
game.audio.enabled=false;

test('background double-ended rods disappear only after both endpoint rings are removed in every level',()=>{
 for(let index=0;index<C.levels.length;index++){
  game.load(index,true);
  const state=game.model.state,board=game.board;
  for(const rod of state.rods.filter(z=>z.kind==='b')){
   const view=board.fixedRodViews.get(rod.id);
   assert.ok(view,'level '+(index+1)+' must create a separate view for '+rod.id);
   const first=C.ring(state,rod.targets[0]),second=C.ring(state,rod.targets[1]);
   assert.ok(first&&second,'background rod endpoints must resolve to rings');
   assert.equal(view.visible,true,'level '+(index+1)+' starts with '+rod.id+' visible');
   first.life='removed';C.update(state);board.draw(state);
   assert.equal(view.visible,true,'level '+(index+1)+' keeps '+rod.id+' while one endpoint survives');
   second.life='removed';C.update(state);board.draw(state);
   assert.equal(view.visible,false,'level '+(index+1)+' removes the entire '+rod.id+' after both endpoints disappear');
   first.life='active';second.life='active';C.update(state);board.draw(state);
   assert.equal(view.visible,true,'level '+(index+1)+' restores '+rod.id+' when both endpoints return');
  }
 }
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
