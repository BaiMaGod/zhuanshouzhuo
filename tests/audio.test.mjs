import test from 'node:test';
import assert from 'node:assert/strict';
import {Audio,frictionLoop,cueBuffer} from '../dist/js/audio.js';

function fixture(){
 let now=1000;const sources=[];
 const param=()=>({value:0,setValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v}});
 const node=()=>({connect(){},disconnect(){},gain:param(),frequency:param()});
 class Context{
  currentTime=1;state='running';destination={};sampleRate=44100;
  createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return{sampleRate,length,duration:length/sampleRate,numberOfChannels:channels,getChannelData:i=>data[i]}}
  async decodeAudioData(){return this.createBuffer(1,4410,44100)}
  async resume(){this.state='running'}
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
test('equal physical speed gives equal friction loudness at different touch event rates',()=>{
 const fast=fixture();fast.a.motion(1);
 for(let i=0;i<30;i++){fast.advance(16);fast.a.motion(1)}
 const fastGain=fast.a.rotation.gain.gain.value,fastRate=fast.a.rotation.source.playbackRate.value;
 const slow=fixture();slow.a.motion(2);
 for(let i=0;i<15;i++){slow.advance(32);slow.a.motion(2)}
 assert.ok(Math.abs(fastGain-slow.a.rotation.gain.gain.value)<.00001);
 assert.ok(Math.abs(fastRate-slow.a.rotation.source.playbackRate.value)<.00001);
 slow.advance(32);slow.a.motion(10);
 assert.ok(slow.a.rotation.gain.gain.value>fastGain);
});
test('friction loop blends each channel without a discontinuity at the wrap boundary',()=>{
 const input=[Float32Array.from({length:1000},(_,i)=>i/1000),Float32Array.from({length:1000},(_,i)=>-i/2000)];
 const buffer={sampleRate:1000,length:1000,numberOfChannels:2,getChannelData:i=>input[i]};
 const ctx={createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return{sampleRate,length,numberOfChannels:channels,getChannelData:i=>data[i]}}};
 const loop=frictionLoop(ctx,buffer);
 assert.equal(loop.length,905);assert.equal(loop.numberOfChannels,2);
 for(let channel=0;channel<2;channel++){
  const output=loop.getChannelData(channel);
  assert.ok(Math.abs(output[0]-output[output.length-1])<.0011,'wrap retains a normal sample step');
  assert.ok(Math.abs(output[25]-output[24])<.0011,'blend rejoins the original recording smoothly');
 }
 assert.equal(input[0][999],Math.fround(.999),'original recording remains intact');
});


test('reward cues have different waveforms, bounded peaks and quiet endpoints',()=>{
 const {a}=fixture();const cues=['button','align','clear','tool','win'].map(kind=>cueBuffer(a.context,kind));
 assert.equal(new Set(cues.map(b=>b.length)).size,4);
 for(const b of cues){const data=b.getChannelData(0);assert.equal(data[0],0);assert.ok(Math.abs(data.at(-1))<.001);assert.ok(data.some(v=>Math.abs(v)>.05));assert.ok(data.every(v=>Number.isFinite(v)&&Math.abs(v)<1))}
 assert.notDeepEqual(cues[2].getChannelData(0),cues[3].getChannelData(0));
});
test('buttons sound, selection stays silent, win uses one bounded voice',()=>{
 const {a,sources}=fixture();a.play('select');assert.equal(sources.length,0);
 a.play('button');a.play('clear');a.play('tool');a.play('win');
 assert.equal(sources.length,4);assert.notEqual(sources[0].buffer,sources[1].buffer);
 assert.ok(sources[3].buffer.duration>.6);a.enabled=false;assert.ok(sources.every(s=>s.stops===1));
});
test('load completes decoding before the first interaction without resuming autoplay',async()=>{
 const oldFetch=globalThis.fetch;const {a}=fixture();a.buffers={};a.context.state='suspended';
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
 try{await a.load();assert.ok(a.buffers.ceramic_drag_1);assert.ok(a.buffers.ceramic_place_1);assert.equal(a.context.state,'suspended');a.wake();assert.equal(a.context.state,'running')}
 finally{globalThis.fetch=oldFetch}
});
