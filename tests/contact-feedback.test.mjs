import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const h=installHarness();await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const g=globalThis.jadeDebug.game;
test('blocked rotation flashes the dragged bracelet and clears after expiry',()=>{
 g.load(0);const pulses=[];g.haptics.pulse=k=>pulses.push(k);
 const res=g.perform('A',8);assert.ok(res.blocked);assert.equal(g.board.blockedRing,'A');assert.ok(pulses.includes('blocked'));
 const halo=g.board.rings.get('A').halo;assert.equal(halo.visible,true);
 assert.ok(halo.graphics.ops.some(o=>o[0]==='path'&&o.at(-1)?.strokeStyle==='#ed6670'));
 const geometry=halo.graphics.ops;for(let i=0;i<5;i++)h.tick();
 assert.equal(halo.graphics.ops,geometry,'animation reuses the immutable collision contour');
 for(let i=0;i<40;i++)h.tick();assert.equal(g.board.blockedRing,null);assert.equal(halo.visible,false);
});
