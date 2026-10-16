import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const h=installHarness();await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const g=globalThis.jadeDebug.game;
test('blocked rotation flashes the dragged bracelet and clears after expiry',()=>{
 g.load(0);const pulses=[];g.haptics.pulse=k=>pulses.push(k);
 const res=g.perform('A',8);assert.ok(res.blocked);assert.equal(g.board.blockedRing,'A');assert.ok(pulses.includes('blocked'));
 const halo=g.board.rings.get('A').halo;assert.ok(halo.graphics.ops.some(o=>o[0]==='line'&&o.includes('#ed6670')));
 for(let i=0;i<40;i++)h.tick();assert.equal(g.board.blockedRing,null);assert.equal(halo.graphics.ops.length,0);
});
