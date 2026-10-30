import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const h=installHarness();
await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const g=window.jadeDebug.game,C=window.jadeDebug.Core;
const route=(await import('../dist/js/solutions.js')).default[10];
g.audio.enabled=false;
const wait=ms=>{for(let i=0;i<Math.ceil(ms/16);i++)h.tick()};

test('held ring emphasizes only the real gap and returns to normal on release, cancel and reload',()=>{
 g.load(10,true);const b=g.board,ring=g.model.state.rings[0],v=b.rings.get(ring.id);
 const state=JSON.stringify(g.model.state);b.focus(ring.id);b.draw(g.model.state);
 assert.equal(v.focus.visible,true);assert.equal(v.focus.rotation,ring.a);
 assert.equal(v.body.alpha,1,'jade and neighbours remain opaque');assert.equal(v.root.scaleX,1);
 assert.equal(v.halo.visible,false,'holding a ring must not draw an outline');
 assert.equal(JSON.stringify(g.model.state),state,'emphasis cannot change physics');
 g.releaseDrag();assert.equal(v.focus.visible,false);assert.equal(v.shadow.scaleX,1);
 b.focus(ring.id);g.cancel();assert.equal(v.focus.visible,false);
 b.focus(ring.id);g.load(10,true);assert.ok([...g.board.rings.values()].every(v=>!v.focus.visible));
});

test('real removal presentation preserves rules and awards one result, then releases all transient nodes',()=>{
 g.load(10,true);const b=g.board;
 for(const a of route){g.model.begin();g.perform(a.id,a.delta);wait(g.model.cleared?1200:500)}
 assert.equal(g.model.cleared,true);assert.equal(g.model.state.steps,route.length);
 assert.equal(g.modalCard.name,'victory-card');
 const result=g.modalCard;wait(1400);
 assert.equal(g.modalCard,result,'no duplicate result while ticking');
 assert.equal(b.animating,false);assert.equal(b.ghosts.length,0);assert.equal(b.sparks.length,0);
 assert.equal(b.effects.numChildren,0,'departing clasp nodes are released');
 const stars=result.children.filter(n=>n.name?.startsWith('victory-star:'));
 assert.equal(stars.length,3);assert.ok(stars.every(s=>s.children[0].visible));
 result.children.find(n=>n.label?.text==='再挑战一次').click();wait(100);
 assert.equal(g.victory,null);assert.equal(g.modalOpen,false);
 assert.equal(g.board.effects.numChildren,0);assert.equal(g.board.hasFeedback,false);
 assert.equal(g.model.state.steps,0);assert.equal(g.model.state.rings.filter(r=>r.life==='active').length,10);
});

test('reduced motion skips moving shards and immediately reveals earned stars, without changing results',()=>{
 globalThis.matchMedia=()=>({matches:true});g.load(10,true);
 for(const a of route){g.model.begin();g.perform(a.id,a.delta);assert.equal(g.board.sparks.length,0);wait(200)}
 assert.equal(g.model.cleared,true);assert.equal(g.model.state.steps,route.length);
 assert.equal(g.modalCard.name,'victory-card');
 assert.ok(g.modalCard.children.filter(n=>n.name?.startsWith('victory-star:')).every(s=>s.children[0].visible));
 g.home();wait(50);assert.equal(g.victory,null);assert.equal(g.modalOpen,false);
 delete globalThis.matchMedia;
});
