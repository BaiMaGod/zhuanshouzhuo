// CC0 recorded ceramic foley approximates jade. Provenance: docs/音效与素材来源_V0.3.md.
type Kind='button'|'tool'|'select'|'align'|'clear'|'block'|'win';
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
// Original modal synthesis for UI/reward feedback; no external sample licence.
// One buffer per cue keeps the voice limit predictable, including the win phrase.
export function cueBuffer(ctx:BaseAudioContext,kind:'button'|'align'|'clear'|'tool'|'win'):AudioBuffer{
 const notes=kind==='win'?[523.25,659.25,783.99]:kind==='tool'?[659.25,987.77]:kind==='clear'?[783.99,1046.5]:kind==='align'?[1174.66]:[880];
 const spacing=kind==='win'?.16:.065,duration=kind==='button'?.065:kind==='align'?.11:.3;
 const rate=ctx.sampleRate||44100,length=Math.ceil((duration+spacing*(notes.length-1))*rate);
 const out=ctx.createBuffer(1,length,rate),data=out.getChannelData(0);
 notes.forEach((frequency,n)=>{
  const start=Math.round(n*spacing*rate);
  for(let i=0;i<Math.floor(duration*rate)&&start+i<length;i++){
   const t=i/rate,envelope=Math.min(1,t/.004)*Math.exp(-t/(duration/5))*Math.min(1,(duration-t)/.012);
   // Quiet inharmonic partials evoke a small rounded chime rather than a beep.
   data[start+i]+=(Math.sin(2*Math.PI*frequency*t)+.22*Math.sin(2*Math.PI*frequency*2.71*t)*Math.exp(-t*35))*envelope*.48;
  }
 });
 return out;
}
export class Audio {
 context:AudioContext|null=null;
 private enabled_=true;private master:GainNode|null=null;
 private bytes:Record<string,ArrayBuffer>={};private buffers:Record<string,AudioBuffer>={};
 private decoding:Promise<void>|null=null;
 private rotation:{source:AudioBufferSourceNode;gain:GainNode}|null=null;
 private voices=new Set<AudioBufferSourceNode>();
 private motionAt=0;private velocity=0;private lastAt=-Infinity;private contact:string|null=null;
 get enabled():boolean{return this.enabled_}
 set enabled(v:boolean){this.enabled_=v;if(!v)this.stopAll();if(this.master)this.master.gain.value=v?.65:0}
 async load():Promise<void>{
  if(typeof AudioContext==='undefined')return;
  await Promise.all(['ceramic_drag_1','ceramic_place_1'].map(async name=>{
   const r=await fetch('assets/audio/'+name+'.wav');if(!r.ok)throw Error('Audio HTTP '+r.status+' '+name);
   this.bytes[name]=await r.arrayBuffer();
  }));
  // Decode while the context is suspended; the first gesture only resumes it.
  this.prepare();await this.decoding;
 }
 private prepare():void{
  if(typeof AudioContext==='undefined')return;
  try{
   if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.enabled?.65:0;this.master.connect(this.context.destination)}
   if(!this.buffers.button)for(const kind of ['button','align','clear','tool','win'] as const)this.buffers[kind]=cueBuffer(this.context,kind);
   if(!this.decoding&&Object.keys(this.bytes).length){
    const ctx=this.context;
    this.decoding=Promise.all(Object.entries(this.bytes).map(async([name,data])=>{
     const decoded=await ctx.decodeAudioData(data.slice(0));
     this.buffers[name]=name==='ceramic_drag_1'?frictionLoop(ctx,decoded):decoded;
    })).then(()=>{}).catch(e=>console.warn('Audio decode failed',e));
   }
  }catch(e){console.warn('Audio unavailable',e)}
 }
 wake():void{
  if(!this.enabled)return;this.prepare();
  if(this.context?.state==='suspended')void this.context.resume().catch(e=>console.warn('Audio resume failed',e));
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
   filter.type='lowpass';filter.frequency.value=2800;gain.gain.setValueAtTime(0,ctx.currentTime);
   source.connect(filter);filter.connect(gain);gain.connect(this.master);
   source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};
   source.start(0,Math.random()*buffer.duration);this.rotation={source,gain};
  }
  const speed=Math.min(1,this.velocity/360);
  this.rotation.source.playbackRate.setTargetAtTime(.72+speed*.36,ctx.currentTime,.025);
  this.rotation.gain.gain.setTargetAtTime(.025+speed*.145,ctx.currentTime,.025);
 }
 tick(now:number):void{if(this.rotation&&now-this.motionAt>110)this.stopMotion()}
 stopMotion():void{
  const v=this.rotation;this.rotation=null;this.velocity=0;this.motionAt=0;if(!v||!this.context)return;
  v.gain.gain.setTargetAtTime(0,this.context.currentTime,.012);v.source.stop(this.context.currentTime+.055);
 }
 resetContact():void{this.contact=null}
 collision(key:string,strength=1):void{
  this.stopMotion();if(this.contact===key)return;this.contact=key;
  this.sample(.24+Math.max(0,Math.min(1,strength))*.12,.94+Math.random()*.06);
 }
 private sample(gain:number,rate:number,delay=0,name='ceramic_place_1'):void{
  if(!this.enabled)return;this.wake();const ctx=this.context,buffer=this.buffers[name];
  if(!ctx||!buffer||!this.master||this.voices.size>=4)return;
  const source=ctx.createBufferSource(),volume=ctx.createGain(),filter=ctx.createBiquadFilter();
  source.buffer=buffer;source.playbackRate.value=rate;filter.type='lowpass';filter.frequency.value=name==='ceramic_place_1'?3400:6200;
  volume.gain.value=gain;source.connect(filter);filter.connect(volume);volume.connect(this.master);this.voices.add(source);
  source.onended=()=>{this.voices.delete(source);source.disconnect();volume.disconnect();filter.disconnect()};
  source.start(ctx.currentTime+delay);
 }
 play(kind:Kind):void{
  if(kind==='select')return;
  if(kind==='block'){this.collision('legacy');return}
  const now=performance.now();if(kind==='align'&&now-this.lastAt<160)return;
  if(kind==='align')this.lastAt=now;
  this.sample(kind==='button'?.12:kind==='align'?.10:kind==='win'?.24:.19,1,0,kind);
 }
 stopAll():void{this.stopMotion();for(const source of this.voices)source.stop();this.voices.clear();this.contact=null}
}

