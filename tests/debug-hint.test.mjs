import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
import {debugHintEnabled} from '../dist/js/web-shell.js';
const h=installHarness();
await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const normal=globalThis.jadeDebug.game,C=globalThis.jadeDebug.Core;
globalThis.location.search='?debug=1';
await import('../dist/js/main.js?auto-hint');await new Promise(r=>setImmediate(r));
const g=globalThis.jadeDebug.game;
g.audio.enabled=false;
test('automatic hint requires explicit debug=1 and is safe without Web globals',()=>{
 for(const query of ['', '?debug=0', '?debug=false', '?debug', '?other=1']){
  globalThis.location.search=query;assert.equal(debugHintEnabled(),false,query);
 }
 globalThis.location.search='?level=2&debug=1';assert.equal(debugHintEnabled(),true);
 const location=globalThis.location;delete globalThis.location;
 assert.equal(debugHintEnabled(),false);globalThis.location=location;
 assert.equal(normal.debugMode,false);assert.equal(g.debugMode,true);
});
test('normal hint leaves angles, steps and lifecycle unchanged',async()=>{
 normal.load(10,true);const before=C.clone(normal.model.state);
 await normal.hint();for(let i=0;i<200;i++)h.tick();
 assert.deepEqual(normal.model.state,before);assert.ok(normal.guide?.action);
 normal.home();
});
test('debug hand follows legal frame-by-frame rotation and counts one action',async()=>{
 g.load(10,true);const action=g.model.hints.next(g.model.state);
 const expected=C.clone(g.model.state);C.request(expected,action.id,action.delta);
 const angles=[],hands=[],perform=g.perform.bind(g);
 g.perform=(id,delta)=>{const result=perform(id,delta);angles.push(C.ring(g.model.state,id).a);return result};
 const pending=g.hint(),guide=g.guide;
 assert.equal(g.busy,true);assert.equal(g.model.state.steps,1);
 assert.equal(guide.followRotation,true);assert.equal(g.hintLeft,0);
 const draw=guide.draw.bind(guide);
 guide.draw=(state,now,dragging)=>{draw(state,now,dragging);if(guide.hand.visible){
  const ring=C.ring(state,action.id),p=g.board.toScreen(C.point(ring,ring.a));
  hands.push([guide.hand.x-(p.x-g.board.rect.x+6),guide.hand.y-(p.y-g.board.rect.y+6)]);
 }};
 await g.hint();assert.equal(g.model.state.steps,1,'repeated click cannot start another turn');
 await pending;g.perform=perform;
 assert.ok(angles.length>2);assert.ok(hands.length>2);
 assert.ok(hands.every(([x,y])=>Math.abs(x)<1e-7&&Math.abs(y)<1e-7),'hand stays on the moving gap');
 assert.deepEqual(g.model.state.rings.map(r=>r.life),expected.rings.map(r=>r.life));
 assert.ok(g.model.state.rings.every((r,i)=>Math.abs(C.diff(r.a,expected.rings[i].a))<.3));
 assert.equal(g.model.state.steps,1);assert.equal(g.busy,false);assert.equal(g.guide,null);
 assert.equal(g.save.readRun(10).state.steps,1);
});
test('debug hint handles held alignment stages and teaching release',async()=>{
 const index=C.levels.findIndex((l,i)=>i>=11&&l.hintGraph?.kind==='stages');assert.ok(index>=11);
 g.load(index,true);const a=g.model.hints.next(g.model.state),expected=C.clone(g.model.state);
 C.request(expected,a.id,a.delta);await g.hint();
 assert.ok(g.model.state.rings.every((r,i)=>r.life===expected.rings[i].life&&Math.abs(C.diff(r.a,expected.rings[i].a))<.3));
 assert.equal(g.model.state.steps,1);
 g.load(0);await g.hint();h.tick();
 assert.equal(g.model.cleared,true);assert.equal(g.model.state.steps,1);assert.equal(g.guide,null);
});
test('cancel and scene changes stop debug motion without changing the next board',async()=>{
 g.load(10,true);const pending=g.hint();assert.equal(g.busy,true);
 g.cancel();const before=C.clone(g.model.state);await pending;
 assert.deepEqual(g.model.state,before);assert.equal(g.busy,false);assert.equal(g.guide,null);
 g.load(10,true);const next=g.hint();g.load(11,true);
 const newState=C.clone(g.model.state);await next;
 assert.deepEqual(g.model.state,newState);assert.equal(g.model.state.steps,0);assert.equal(g.busy,false);
});
test('debug mode retains collision checks and stops a blocked action',async()=>{
 g.load(10,true);const a=g.model.hints.next(g.model.state),original=g.model.turn.bind(g.model);
 let calls=0;g.model.turn=()=>{calls++;return{done:0,removed:[],blocked:{kind:'ring',rod:a.rod,target:a.id,text:'blocked'}}};
 await g.hint();g.model.turn=original;
 assert.equal(calls,1);assert.equal(g.busy,false);assert.equal(g.guide,null);assert.equal(g.board.blockedRing,a.id);
});
