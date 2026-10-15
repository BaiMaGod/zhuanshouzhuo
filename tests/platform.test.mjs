import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
import {search} from '../dist/js/solver.js';
import {Core as C} from '../dist/js/model.js';
const h=installHarness();
await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const g=globalThis.jadeDebug.game;
test('engine event dispatch preserves touch identity and cancellation cannot consume erase',()=>{
 g.load(10);g.eraseMode=true;
 const r=g.model.state.rings[0],p=g.board.toScreen(C.point(r,r.a+60));
 const evt={touchId:42,stageX:p.x*.75,stageY:p.y*.75,button:0};
 const dispatch=(type,e)=>{for(const fn of h.stage.events[type]||[])fn(e)};
 dispatch('mousedown',evt);assert.ok(g.pointers.has(42));
 dispatch('mouseup',{...evt,nativeEvent:{type:'touchcancel'}});
 assert.equal(g.pointers.size,0);assert.equal(g.eraseLeft,1);assert.equal(g.modalOpen,false);
});
test('engine blur saves a live turn and stops input and sound',()=>{
 g.load(10);let stops=0;g.audio.stopAll=()=>stops++;
 g.perform(g.model.state.rings[0].id,2);
 for(const fn of h.stage.events.blur)fn({});
 assert.equal(g.pointers.size,0);assert.ok(stops>0);assert.ok(g.save.readRun(10));
});
test('teaching solver yields while preserving legal completion from a changed state',()=>{
 const state=C.make(1);C.request(state,'B',5);
 const it=search(state);let result,yields=0;
 do{result=it.next();yields++;assert.ok(yields<100000)}while(!result.done);
 assert.ok(yields>1);assert.ok(result.value?.length);
 const copy=C.clone(state);for(const a of result.value){const r=C.request(copy,a.id,a.delta);assert.equal(r.blocked,null)}
 assert.ok(copy.rings.every(r=>r.life==='removed'));
});
test('boot and storage run without browser globals',async()=>{
 const saved={};for(const key of ['document','window','location','localStorage','innerWidth','innerHeight','Worker','AudioContext']){saved[key]=globalThis[key];delete globalThis[key]}
 const count=h.stage.children.length;
 try{await import('../dist/js/main.js?no-browser');await new Promise(r=>setImmediate(r));assert.ok(h.stage.children.length>count);g.save.persist();assert.ok(g.save.data)}
 finally{Object.assign(globalThis,saved)}
});
