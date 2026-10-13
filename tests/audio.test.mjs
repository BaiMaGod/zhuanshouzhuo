import test from 'node:test';
import assert from 'node:assert/strict';
import {Audio} from '../dist/js/audio.js';

function fixture(){
 let now=1000;const sources=[];
 const param=()=>({value:0,setValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v}});
 const node=()=>({connect(){},disconnect(){},gain:param(),frequency:param()});
 class Context{
  currentTime=1;state='running';destination={};
  createGain(){return node()}createBiquadFilter(){return node()}
  createBufferSource(){const n={...node(),playbackRate:param(),starts:0,stops:0,start(){this.starts++},stop(){this.stops++}};sources.push(n);return n}
 }
 globalThis.AudioContext=Context;globalThis.performance={now:()=>now};
 const a=new Audio();a.wake();a.buffers={ceramic_drag_1:{duration:.4},ceramic_place_1:{duration:.3}};
 return{a,sources,advance:ms=>now+=ms,get now(){return now}};
}
test('motion follows actual rotation, decays when stationary and never starts for selection',()=>{
 const {a,sources,advance,now}=fixture();
 a.play('select');a.motion(0);assert.equal(sources.length,0);
 a.motion(2);assert.equal(sources.length,1);assert.equal(sources[0].loop,true);
 a.motion(5);assert.equal(sources.length,1,'continuous movement reuses one source');
 advance(120);a.tick(now+120);assert.equal(sources[0].stops,1);
});
test('one contact hit per sustained collision, reverse motion permits a new hit',()=>{
 const {a,sources}=fixture();a.motion(3);a.collision('A:L1:B');
 assert.equal(sources[0].stops,1);assert.equal(sources.length,2);
 a.collision('A:L1:B');assert.equal(sources.length,2);
 a.resetContact();a.collision('A:L1:B');assert.equal(sources.length,3);
});
test('mute immediately silences master, stops all voices and prevents playback until enabled',()=>{
 const {a,sources}=fixture();a.motion(3);a.play('clear');a.enabled=false;
 assert.equal(a.master.gain.value,0);assert.ok(sources.every(s=>s.stops===1));
 const n=sources.length;a.motion(5);a.play('win');assert.equal(sources.length,n);
 a.enabled=true;a.motion(3);assert.equal(sources.length,n+1);a.stopAll();assert.equal(a.rotation,null);
});
