import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';
import {GameModel} from '../dist/js/model.js';

installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const game=window.jadeDebug.game,C=window.jadeDebug.Core;
game.audio.enabled=false;

test('the final bracelet removal clears every fixed clasp before victory on every level',()=>{
 let checkedBackgroundRods=0;
 // Exercise the authoritative lifecycle for every configured level without
 // constructing 110 full Laya scenes.
 for(let index=0;index<C.levels.length;index++){
  const state=C.make(index),model=Object.create(GameModel.prototype),last=state.rings[state.rings.length-1];
  model.state=state;
  for(const ring of state.rings)if(ring.id!==last.id)ring.life='removed';
  last.life='active';C.update(state);
  assert.equal(model.cleared,false,'level '+(index+1)+' must not clear while its final bracelet remains');
  for(const rod of state.rods.filter(z=>z.kind==='b')){
   checkedBackgroundRods++;
   assert.equal(C.exists(state,rod),rod.targets.includes(last.id),'level '+(index+1)+' '+rod.id+' exists only while a target bracelet survives');
  }
  last.life='removed';C.update(state);
  assert.equal(model.cleared,true,'level '+(index+1)+' clears only after every rod is inactive');
  assert.ok(state.rods.every(rod=>!C.exists(state,rod)),'level '+(index+1)+' has no active clasp after the final bracelet is removed');
 }
 assert.ok(checkedBackgroundRods>0,'campaign must include background fixed clasps');

 // Verify the actual Laya render tree on a level that contains background clasps.
 const renderIndex=C.levels.findIndex(level=>level.links.some(link=>link[0]==='b'));
 assert.ok(renderIndex>=0,'a level with background fixed clasps must exist');
 const previousUnlocked=game.save.data.unlocked;
 game.save.data.unlocked=C.levels.length-1;
 try{
  game.load(renderIndex,true);
  const model=game.model,state=model.state,board=game.board;
  assert.equal(state.index,renderIndex,'renderer regression must load the intended level');
  const last=state.rings[state.rings.length-1];
  for(const ring of state.rings)if(ring.id!==last.id)ring.life='removed';
  last.life='active';C.update(state);board.draw(state);
  assert.equal(model.cleared,false,'renderer sample must not clear while its final bracelet remains');
  assert.equal(board.fixedRods.parent,board.space,'fixed clasps live outside the cached moving-rod batch');
  assert.equal(board.fixedRods.cacheAs,'none','fixed clasp layer must not be bitmap-cached');
  assert.equal(board.rods.cacheAs,'normal','moving-rod batch may retain its cache');
  assert.equal(board.rods.numChildren,0,'dynamic clasps must not be nested under the cached batch');
  for(const rod of state.rods.filter(z=>z.kind==='b')){
   const view=board.fixedRodViews.get(rod.id);
   assert.ok(view,'renderer must create a view for '+rod.id);
   assert.equal(view.parent,board.fixedRods,' '+rod.id+' must be outside the cached batch');
   assert.equal(view.visible,rod.targets.includes(last.id),' '+rod.id+' remains only while its final endpoint survives');
  }
  const beforeFinal=C.clone(state);
  last.life='removed';C.update(state);board.release(beforeFinal,state,[last.id]);board.draw(state);
  assert.equal(model.cleared,true,'renderer sample clears after its final bracelet is removed');
  for(const rod of state.rods.filter(z=>z.kind==='b')){
   const view=board.fixedRodViews.get(rod.id);
   assert.equal(view.visible,false,'no visible '+rod.id+' remains after the final bracelet is removed');
   assert.equal(view.graphics.ops.length,0,'all drawing commands for '+rod.id+' are cleared');
  }
  assert.equal(board.hasVisibleFixedRods,false,'renderer has no visible background clasp');
  const anyView=board.fixedRodViews.values().next().value;
  if(anyView){
   anyView.visible=true;game.modalOpen=false;game.win();
   assert.equal(game.modalOpen,false,'victory must wait while any fixed clasp remains visible');
   anyView.visible=false;
  }
 }finally{
  game.save.data.unlocked=previousUnlocked;
  game.home();
 }
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
