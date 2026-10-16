import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';

installHarness();
await import('../dist/js/main.js');
await new Promise(resolve=>setImmediate(resolve));
const game=window.jadeDebug.game,core=window.jadeDebug.Core;
game.audio.enabled=false;

test('a captive sleeve stops an actual mouse drag and pointer-up never adds magnetic rotation',()=>{
 game.load(LEGACY_FORMAL_INDEX,true);
 const board=game.board,ring=core.ring(game.model.state,'1A'),before=ring.a;
 const theoretical=core.request(core.clone(game.model.state),'1A',10);
 assert.equal(theoretical.blocked?.kind,'captive');
 board.zoomTo(board.fitZoom*3,{x:360,y:500});
 const offset=core.rot({x:ring.x-board.center.x,y:ring.y-board.center.y},board.turn);
 board.panTo({x:360-offset.x*board.zoom,y:500-offset.y*board.zoom});
 const event=(angle)=>{const p=board.toScreen(core.point(ring,angle));return{stageX:p.x*.75,stageY:p.y*.75,pointerId:711,button:0}};
 const start=before+50;
 game.down(event(start));
 assert.equal(game.drag?.id,'1A');
 for(let i=1;i<=4;i++)game.move(event(start+i*2.5));
 assert.equal(game.drag?.blocked,true,'the last sampled drag is physically blocked');
 game.up(event(start+10));
 assert.ok(Math.abs(core.diff(ring.a,before)-theoretical.done)<.251,
  'pointer-up must preserve the authoritative contact stop');
 assert.equal(game.drag,null);
 assert.equal(game.pointers.size,0);
});
