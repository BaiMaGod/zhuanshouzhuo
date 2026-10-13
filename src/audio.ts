// CC0 recorded ceramic foley approximates jade. Provenance: docs/音效与素材来源_V0.3.md.
type Kind='select'|'align'|'clear'|'block'|'win';
// Blend the tail into the head once at decode time, rather than jumping between
// unrelated samples on every loop. Keep the original recording unchanged.
export function frictionLoop(ctx:BaseAudioContext,buffer:AudioBuffer):AudioBuffer{
 const margin=Math.round(buffer.sampleRate*.035),start=Math.min(margin,Math.floor(buffer.length/8));
 const end=buffer.length-start,overlap=Math.min(Math.round(buffer.sampleRate*.025),Math.floor((end-start)/4));
 if(overlap<2)return buffer;
 const length=end-start-overlap,out=ctx.createBuffer(buffer.numberOfChannels,length,buffer.sampleRate);
 for(let channel=0;channel<buffer.numberOfChannels;channel++){
  const input=buffer.getChannelData(channel),output=out.getChannelData(channel);
  for(let i=0;i<overlap;i++){
   const blend=i/(overlap-1);
   output[i]=input[end-overlap+i]*(1-blend)+input[start+i]*blend;
  }
  output.set(input.subarray(start+overlap,end-overlap),overlap);
 }
 return out;
}
export class Audio {
 context:AudioContext|null=null;
 private enabled_=true;private master:GainNode|null=null;
 private bytes:Record<string,ArrayBuffer>={};private buffers:Record<string,AudioBuffer>={};
 private decoding:Promise<void>|null=null;
 private rotation:{source:AudioBufferSourceNode;gain:GainNode}|null=null;
 private voices=new Set<AudioBufferSourceNode>();
 private motionAt=0;private velocity=0;private lastAt=0;private contact:string|null=null;
 get enabled():boolean{return this.enabled_}
 set enabled(v:boolean){this.enabled_=v;if(!v)this.stopAll();if(this.master)this.master.gain.value=v?.65:0}
 async load():Promise<void>{
  if(typeof AudioContext==='undefined')return;
  await Promise.all(['ceramic_drag_1','ceramic_place_1'].map(async name=>{
   const r=await fetch('assets/audio/'+name+'.wav');if(!r.ok)throw Error('Audio HTTP '+r.status+' '+name);
   this.bytes[name]=await r.arrayBuffer();
  }));
 }
 wake():void{
  if(!this.enabled)return;
  try{
   if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.65;this.master.connect(this.context.destination)}
   if(this.context.state==='suspended')void this.context.resume();
   if(!this.decoding&&Object.keys(this.bytes).length){
    const ctx=this.context;
    this.decoding=Promise.all(Object.entries(this.bytes).map(async([name,data])=>{
     const decoded=await ctx.decodeAudioData(data.slice(0));
     this.buffers[name]=name==='ceramic_drag_1'?frictionLoop(ctx,decoded):decoded;
    })).then(()=>{}).catch(e=>console.warn('Audio decode failed',e));
   }
  }catch(e){console.warn('Audio unavailable',e)}
 }
 motion(delta:number):void{
  if(!this.enabled||Math.abs(delta)<.001)return;this.wake();
  const ctx=this.context,buffer=this.buffers.ceramic_drag_1;if(!ctx||!buffer||!this.master)return;
  const now=performance.now(),continuous=!!this.rotation;
  const elapsed=continuous?Math.max(1,now-this.motionAt):1000/60;
  const angularSpeed=Math.abs(delta)*1000/elapsed;
  const blend=1-Math.exp(-elapsed/40);
  this.velocity=continuous?this.velocity+(angularSpeed-this.velocity)*blend:angularSpeed;
  this.motionAt=now;
  if(!this.rotation){
   const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
   source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;
   filter.type='lowpass';filter.frequency.value=3900;gain.gain.setValueAtTime(0,ctx.currentTime);
   source.connect(filter);filter.connect(gain);gain.connect(this.master);
   source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};
   source.start(0,Math.random()*buffer.duration);this.rotation={source,gain};
  }
  const speed=Math.min(1,this.velocity/360);
  this.rotation.source.playbackRate.setTargetAtTime(.72+speed*.36,ctx.currentTime,.025);
  this.rotation.gain.gain.setTargetAtTime(.035+speed*.195,ctx.currentTime,.025);
 }
 tick(now:number):void{if(this.rotation&&now-this.motionAt>110)this.stopMotion()}
 stopMotion():void{
  const v=this.rotation;this.rotation=null;this.velocity=0;this.motionAt=0;if(!v||!this.context)return;
  v.gain.gain.setTargetAtTime(0,this.context.currentTime,.012);v.source.stop(this.context.currentTime+.055);
 }
 resetContact():void{this.contact=null}
 collision(key:string,strength=1):void{
  this.stopMotion();if(this.contact===key)return;this.contact=key;
  this.sample(.35+Math.min(1,strength)*.16,.88+Math.random()*.08);
 }
 private sample(gain:number,rate:number,delay=0):void{
  if(!this.enabled)return;this.wake();const ctx=this.context,buffer=this.buffers.ceramic_place_1;
  if(!ctx||!buffer||!this.master||this.voices.size>=4)return;
  const source=ctx.createBufferSource(),volume=ctx.createGain(),filter=ctx.createBiquadFilter();
  source.buffer=buffer;source.playbackRate.value=rate;filter.type='lowpass';filter.frequency.value=5200;
  volume.gain.value=gain;source.connect(filter);filter.connect(volume);volume.connect(this.master);this.voices.add(source);
  source.onended=()=>{this.voices.delete(source);source.disconnect();volume.disconnect();filter.disconnect()};
  source.start(ctx.currentTime+delay);
 }
 play(kind:Kind):void{
  if(kind==='select')return;
  if(kind==='block'){this.collision('legacy');return}
  const now=performance.now();if(kind==='align'&&now-this.lastAt<250)return;this.lastAt=now;
  this.sample(kind==='align'?.13:.23,kind==='clear'?1.12:1.04);
  if(kind==='win')this.sample(.16,1.22,.12);
 }
 stopAll():void{this.stopMotion();for(const source of this.voices)source.stop();this.voices.clear();this.contact=null}
}
