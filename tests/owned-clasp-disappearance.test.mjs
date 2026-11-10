import test from 'node:test';
import assert from 'node:assert/strict';
import solutions from '../src/solutions.js';
import {installHarness} from './scene-harness.mjs';

const harness=installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const game=window.jadeDebug.game,Core=window.jadeDebug.Core;
game.audio.enabled=false;
game.save.data.unlocked=Core.levels.length-1;

test('formal level 4: the last five mounted clasps vanish while five other bracelets remain',()=>{
 const index=13;
 game.load(index,true);
 const {board,model}=game;
 const standard=solutions[index];
 // Release R7 and the R3–R8 pair early. R4 then leaves on rotation 17.
 const route=[...standard.slice(0,9),...standard.slice(15,18),...standard.slice(9,14)];
 for(const [i,a] of route.entries()){
  model.begin();
  const result=game.perform(a.id,a.delta);
  assert.equal(result.blocked,null);
  if(i===8){
   assert.deepEqual(result.removed,['R2']);
   assert.equal(board.rods.visible,true,'R4 mounted clasps remain after R2 leaves');
   assert.equal(board.rods.graphics.ops.filter(op=>op[0]==='mesh').length,5);
  }
  if(i===15)assert.equal(board.rods.graphics.ops.filter(op=>op[0]==='mesh').length,5);
  if(i===16)assert.deepEqual(result.removed,['R4']);
  else while(board.animating)harness.tick();
 }

 const {state}=model;
 assert.equal(state.steps,17);
 assert.deepEqual(state.rings.filter(r=>r.life==='active').map(r=>r.id),['R1','R5','R6','R9','R12']);
 assert.deepEqual(state.rods.filter(z=>Core.exists(state,z)).map(z=>z.id),['L15','L17','L18']);
 assert.equal(board.rods.graphics.ops.length,0);
 assert.equal(board.rods.visible,false,'hide the empty mounted layer in the removal frame');
 assert.equal(board.fixedRods.visible,true,'the three independent background clasps still render');
 assert.equal(board.fixedRods.graphics.ops.filter(op=>op[0]==='mesh').length,3);
 assert.equal(board.ghosts.length,1,'jade disappearance animation remains active');
 assert.equal(board.effects.numChildren,board.petals.count+board.ghosts.filter(g=>g.glow).length);

 for(let frame=0;frame<80;frame++)harness.tick();
 assert.equal(board.rods.visible,false,'subsequent redraws keep the empty layer hidden');
 assert.equal(board.ghosts.length,0);
 assert.equal(board.effects.numChildren,0);
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
