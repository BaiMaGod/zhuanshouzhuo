import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';

const harness=installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const game=window.jadeDebug.game,Core=window.jadeDebug.Core;
game.audio.enabled=false;
game.save.data.unlocked=Core.levels.length-1;

test('formal level 4: all five R2 mounted clasps vanish in the removal frame, not as floating ghosts',()=>{
 const index=13; // 10 tutorial levels + formal level 4 (1-based)
 game.load(index,true);
 const board=game.board,state=game.model.state;
 const survivorIds=new Set(['R1','R3','R6','R8','R2']);
 for(const r of state.rings)r.life=survivorIds.has(r.id)?'active':'removed';
 Core.update(state);
 const owned=state.rods.filter(rod=>rod.kind==='m'&&rod.owner==='R2');
 assert.equal(owned.length,5,'R2 owns five distinct mounted clasps');
 board.draw(state);
 assert.ok(board.rods.graphics.ops.length>0,'all five clasps appear while their owner is present');

 const before=Core.clone(state);
 Core.ring(state,'R2').life='removed';
 Core.update(state);
 board.release(before,state,['R2']);
 board.draw(state);

 assert.equal(state.rings.filter(r=>r.life==='active').length,4,'the screenshot has exactly four surviving bracelets');
 assert.ok(owned.every(rod=>!Core.exists(state,rod)),'every R2 clasp is inactive with its owner');
 assert.equal(board.rods.graphics.ops.length,0,'no R2 mounted clasp drawing survives the removal');
 assert.equal(board.effects.numChildren,board.petals.count+board.ghosts.filter(g=>g.glow).length,
  'the effect layer contains only release glows, NEVER a copy of removed clasps');
 assert.equal(board.ghosts.length,1,'jade disappearance animation remains active');
 assert.equal(board.fixedRods.visible,true,'unrelated background clasp geometry remains intact');

 for(let frame=0;frame<80;frame++)harness.tick();
 assert.equal(board.ghosts.length,0,'all remaining jade release ghosts finish');
 assert.equal(board.effects.numChildren,0,'no release nodes survive');
 game.home();
});

test('owner clasp ghosts stay absent on both tutorial and late-game boards',()=>{
 for(const index of [0,54,109]){
  game.load(index,true);
  const board=game.board,state=game.model.state;
  const owner=state.rods.find(rod=>rod.kind==='m')?.owner;
  assert.ok(owner,'level '+index+' has an owner-mounted clasp');
  const before=Core.clone(state);
  Core.ring(state,owner).life='removed';
  Core.update(state);
  board.release(before,state,[owner]);
  board.draw(state);
  assert.equal(board.effects.numChildren,board.petals.count+board.ghosts.filter(g=>g.glow).length,
   'level '+index+': no removed-owner clasp is duplicated onto the effect layer');
 }
 game.home();
});
