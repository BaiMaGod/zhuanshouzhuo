import test from 'node:test';
import assert from 'node:assert/strict';
import {Core as C} from '../dist/js/model.js';
import {snapDelta} from '../dist/js/snap.js';
import {Haptics} from '../dist/js/haptics.js';
test('nearby sleeve snaps legally without mutating the probe state',()=>{
 const s=C.make(0),r=C.ring(s,'B'),e=C.endpoints(s,s.rods[0]).find(e=>e.id==='B');
 r.a=C.norm(C.angle(r,e.p)-6);C.update(s);
 const before=C.clone(s),d=snapDelta(s,'B',1);
 assert.ok(Math.abs(d-6)<.01);assert.deepEqual(s,before);
 assert.equal(snapDelta(s,'B',-1),null);
 const res=C.request(s,'B',d);assert.equal(res.blocked,null);assert.ok(res.removed.includes('B'));
});
test('distant gaps and captive owners are not pulled through obstacles',()=>{
 const s=C.make(0);assert.equal(snapDelta(s,'B'),null);
 for(let i=0;i<10;i++){
  const state=C.make(i);
  for(const r of state.rings){const d=snapDelta(state,r.id);if(d!==null){const res=C.request(C.clone(state),r.id,d);assert.equal(res.blocked,null);assert.ok(res.removed.includes(r.id)||Math.abs(res.done-d)<.01)}}
 }
});
test('haptics throttle repeated contact and tolerate unavailable platforms',()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator'),calls=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:n=>calls.push(n)}});
 try{const h=new Haptics();h.pulse('snap');h.pulse('blocked');assert.deepEqual(calls,[12]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:()=>{throw Error('unsupported')}}});assert.doesNotThrow(()=>new Haptics().pulse('blocked'))}
 finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator}
});
