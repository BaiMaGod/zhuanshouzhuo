import test from 'node:test';
import assert from 'node:assert/strict';
import {Audio} from '../dist/js/audio.js';
import {frictionLoop,cueBuffer} from '../scripts/audio-dsp.mjs';

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
 globalThis.Laya={loader:{load:async()=>{}},SoundManager:{playMusic(url,loops){const n={url,loop:loops===0,volume:1,isStopped:false,stops:0,stop(){this.stops++;this.isStopped=true}};sources.push(n);return n},playSound(url,loops,complete){const n={url,loop:loops===0,volume:1,playbackRate:1,starts:1,stops:0,isStopped:false,stop(){this.stops++;this.isStopped=true},complete};sources.push(n);return n}}};
 const a=new Audio();a.context=new Context();
 return{a,sources,advance:ms=>now+=ms,get now(){return now}};
}
test('motion follows actual rotation, decays when stationary and never starts for selection',()=>{
 const {a,sources,advance,now}=fixture();
 a.play('select');a.motion(0);assert.equal(sources.length,0);
 a.motion(2);assert.equal(sources.length,1);assert.equal(sources[0].loop,false);assert.equal(sources[0].url,'assets/audio/ratchet_tick.wav');assert.equal(sources[0].playbackRate,1);
 a.motion(5);assert.equal(sources.length,1,'continuous movement reuses one source');
 advance(120);a.tick(now+120);assert.equal(sources[0].stops,1);
});
test('one contact hit per sustained collision, reverse motion permits a new hit',()=>{
 const {a,sources,advance}=fixture();a.motion(3);a.collision('A:L1:B');
 assert.equal(sources[0].stops,1);assert.equal(sources.length,2);
 assert.equal(sources[1].url,'assets/audio/crystal_block.mp3');
 assert.equal(sources[1].playbackRate,1,'the uploaded crystal impact keeps its original pitch');
 a.collision('A:L1:B');assert.equal(sources.length,2);
 a.resetContact();advance(100);a.collision('A:L2:C');assert.equal(sources.length,2,'rapid contact change must not layer impacts');
 a.resetContact();advance(160);a.collision('A:L1:B');assert.equal(sources.length,3);
});
test('mute immediately silences master, stops all voices and prevents playback until enabled',()=>{
 const {a,sources}=fixture();a.motion(3);a.play('clear');a.enabled=false;
 assert.ok(sources.every(s=>s.stops===1));
 const n=sources.length;a.motion(5);a.play('win');assert.equal(sources.length,n);
 a.enabled=true;a.motion(3);assert.equal(sources.length,n+1);a.stopAll();assert.equal(a.rotation,null);
});
function runRotation(speed,step=16){
 const {a,sources,advance}=fixture();
 for(let t=0;t<2000;t+=step){advance(step);a.motion(speed*step/1000)}
 return {a,sources};
}
test('recorded ratchet cadence follows angular speed without high-frequency chatter',()=>{
 const slow=runRotation(25),normal=runRotation(90),fast=runRotation(360);
 assert.ok(slow.sources.length>=4&&slow.sources.length<=8);
 assert.ok(slow.sources.length<normal.sources.length);
 assert.ok(normal.sources.length<fast.sources.length);
 assert.ok(fast.sources.length<=21,'caps at ten clicks per second');
 assert.ok(fast.sources.every(v=>!v.loop&&v.playbackRate===1));
});
test('half-length cadence and high speed do not cut off the earlier click',()=>{
 const s=fixture();const {a,sources,advance}=s;
 for(let i=0;i<23;i++){advance(10);a.motion(3.6)}
 assert.ok(sources.length>=3,'100ms cadence starts at least three clicks in 230ms');
 assert.equal(sources[0].stops,0,'the first click is not truncated at the next onset');
 a.stopMotion();
 assert.ok(sources.every(v=>v.stops===1),'stopping the ring silences every overlapping tick');
});
test('same physical speed yields same click cadence across touch event rates',()=>{
 const fast=runRotation(90,16),slow=runRotation(90,32);
 assert.ok(Math.abs(fast.sources.length-slow.sources.length)<=1);
 assert.ok(Math.abs(fast.a.velocity-slow.a.velocity)<.01);
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
 assert.equal(sources.length,4);assert.notEqual(sources[0].url,sources[1].url);
 assert.ok(sources[3].url.endsWith('win.wav'));a.enabled=false;assert.ok(sources.every(s=>s.stops===1));
});
test('load starts one quiet looping music channel alongside effect assets',async()=>{
 const {a,sources}=fixture();let loaded;Laya.loader.load=async urls=>{loaded=urls};
 await a.load();assert.equal(loaded.length,7);
 assert.deepEqual(loaded.filter(u=>u.endsWith('.mp3')),['assets/audio/crystal_block.mp3','assets/audio/align_glass_tink.mp3']);
 assert.equal(loaded.filter(u=>u.endsWith('.wav')).length,5);assert.equal(sources.length,1);assert.equal(sources[0].loop,true);assert.equal(sources[0].volume,.18);
});

test('Glass Tink replaces the generated alignment cue and preserves the 160ms debounce',()=>{
 const {a,sources,advance}=fixture();
 a.play('align');a.play('align');
 assert.equal(sources.length,1);
 assert.equal(sources[0].url,'assets/audio/align_glass_tink.mp3');
 assert.equal(sources[0].playbackRate,1);
 advance(160);a.play('align');assert.equal(sources.length,2);
});

test('music survives scene effect cleanup, mutes and resumes without duplicate channels',async()=>{
 const {a,sources}=fixture();await a.load();const first=sources[0];
 a.wake();a.stopAll();a.wake();assert.equal(sources.length,1);assert.equal(first.isStopped,false);
 a.suspend();assert.equal(first.isStopped,true);a.wake();assert.equal(sources.length,1);
 a.resume();assert.equal(sources.length,2);a.resume();assert.equal(sources.length,2);
 a.enabled=false;assert.equal(sources[1].isStopped,true);a.resume();assert.equal(sources.length,2);
 a.enabled=true;assert.equal(sources.length,3);assert.equal(sources[2].url,'assets/audio/blossom-valley.mp3');
});
