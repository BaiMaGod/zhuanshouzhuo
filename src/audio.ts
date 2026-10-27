// Playback through Laya's platform sound adapter. Rotation uses one recorded ratchet tick
// paced by actual angular speed, not a repeating loop or a pitch-shifted motor.
type Kind='button'|'tool'|'select'|'align'|'clear'|'block'|'win';
export class Audio {
 private enabled_=true;
 private musicGain=.6;
 private effectsGain=.8;
 private gains=new WeakMap<Laya.SoundChannel,number>();
 constructor(){
  try{const v=JSON.parse(Laya.LocalStorage.getItem('jade-audio-volumes-v1')||'null');
   if(Number.isFinite(v?.music))this.musicGain=Math.max(0,Math.min(1,v.music));
   if(Number.isFinite(v?.effects))this.effectsGain=Math.max(0,Math.min(1,v.effects));
  }catch{}
 }
 get musicVolume():number{return this.musicGain}
 set musicVolume(value:number){
  if(!Number.isFinite(value))return;this.musicGain=Math.max(0,Math.min(1,value));
  if(this.music)this.music.volume=this.musicGain;this.saveVolumes();
 }
 get effectsVolume():number{return this.effectsGain}
 set effectsVolume(value:number){
  if(!Number.isFinite(value))return;this.effectsGain=Math.max(0,Math.min(1,value));
  for(const v of [...this.voices,...this.rotationVoices])if(!v.isStopped)v.volume=(this.gains.get(v)||0)*this.effectsGain;
  this.saveVolumes();
 }
 private saveVolumes():void{try{Laya.LocalStorage.setItem('jade-audio-volumes-v1',JSON.stringify({music:this.musicGain,effects:this.effectsGain}))}catch{}}

 private music:Laya.SoundChannel|null=null;
 private musicReady=false;
 private suspended=false;
 private rotation:Laya.SoundChannel|null=null;
 private rotationVoices=new Set<Laya.SoundChannel>();
 private voices=new Set<Laya.SoundChannel>();
 private fading=new Set<Laya.SoundChannel>();
 private motionAt=0;private velocity=0;private lastTickAt=-Infinity;private lastAt=-Infinity;private lastCollisionAt=-Infinity;private contact:string|null=null;
 get enabled():boolean{return this.enabled_}
 set enabled(v:boolean){this.enabled_=v;if(!v){this.stopAll();this.stopMusic()}else this.wake()}
 async load():Promise<void>{
  this.musicReady=true;this.wake();
  await Laya.loader.load(['ratchet_tick.wav','crystal_block.mp3','button.wav','align_glass_tink.mp3','clear.wav','tool.wav','win.wav'].map(n=>'assets/audio/'+n));
 }
 wake():void{
  if(!this.enabled||this.suspended)return;
  // Music uses HTMLAudio; effects use a separate WebAudio context. A playing
  // music channel must never skip gesture-based recovery of the effect context.
  const context=Laya.PAL?.media?.audioCtx;
  if(context&&(context.state==='suspended'||context.state==='interrupted')){
   try{void context.resume().catch(()=>{})}catch{}
  }
  if(!this.musicReady||(this.music&&!this.music.isStopped))return;
  this.music=Laya.SoundManager.playMusic('assets/audio/blossom-valley.mp3',0);
  if(this.music)this.music.volume=this.musicGain;
 }
 private stopMusic():void{this.music?.stop();this.music=null}
 suspend():void{this.suspended=true;this.stopMusic();this.stopAll()}
 resume():void{this.suspended=false;this.wake()}

 motion(delta:number):void{
  if(!this.enabled||Math.abs(delta)<.001)return;
  const now=performance.now(),continuous=this.motionAt>0&&now-this.motionAt<=110;
  const elapsed=continuous?Math.max(1,now-this.motionAt):1000/60;
  const angularSpeed=Math.min(720,Math.abs(delta)*1000/elapsed);
  const blend=1-Math.exp(-elapsed/75);
  this.velocity=continuous?this.velocity+(angularSpeed-this.velocity)*blend:angularSpeed;
  this.motionAt=now;
  if(!continuous)this.lastTickAt=-Infinity;
  // Keep the sample's crisp natural pitch. Faster angular motion causes closer
  // ticks; halve the old delay, capped at 10 clicks per second.
  const interval=Math.max(100,450/(1+this.velocity/85));
  if(now-this.lastTickAt<interval)return;
  // The 116ms click can naturally overlap the next click at high speed.
  // Do not truncate its tail; keep at most three concurrent rotation channels.
  for(const v of this.rotationVoices)if(v.isStopped)this.rotationVoices.delete(v);
  if(this.rotationVoices.size>=3){
   const oldest=this.rotationVoices.values().next().value;
   if(oldest){oldest.stop();this.rotationVoices.delete(oldest)}
  }
  let voice:Laya.SoundChannel;
  voice=Laya.SoundManager.playSound('assets/audio/ratchet_tick.wav',1,()=>this.rotationVoices.delete(voice));
  if(voice){
   voice.playbackRate=1;
   const gain=.36+.16*Math.min(1,this.velocity/360);this.gains.set(voice,gain);voice.volume=gain*this.effectsGain;
   this.rotationVoices.add(voice);
   this.rotation=voice;
   this.lastTickAt=now;
  }
 }
 tick(now:number):void{
  if(this.motionAt&&now-this.motionAt>110)this.stopMotion();
  for(const v of this.rotationVoices)if(v.isStopped)this.rotationVoices.delete(v);
  for(const v of this.voices)if(v.isStopped)this.voices.delete(v);
 }
 stopMotion():void{
  const current=[...this.rotationVoices];this.rotationVoices.clear();
  this.rotation=null;this.velocity=0;this.motionAt=0;this.lastTickAt=-Infinity;
  for(const v of current){
   if(v.isStopped)continue;
   if(Laya.Tween&&Laya.Handler){this.fading.add(v);Laya.Tween.to(v,{volume:0},45,undefined,Laya.Handler.create(this,()=>{this.fading.delete(v);v.stop()}))}
   else v.stop();
  }
 }
 resetContact():void{this.contact=null}
 collision(key:string,strength=1):void{
  this.stopMotion();if(this.contact===key)return;this.contact=key;
  // Do not stack the recorded crystal impact across rapidly changing contact points.
  const now=performance.now();if(now-this.lastCollisionAt<150)return;this.lastCollisionAt=now;
  this.sample('crystal_block.mp3',.42+Math.max(0,Math.min(1,strength))*.12);
 }
 private sample(name:string,gain:number,rate=1):void{
  if(!this.enabled)return;
  for(const v of this.voices)if(v.isStopped)this.voices.delete(v);
  if(this.voices.size>=4)return;
  let channel:Laya.SoundChannel;
  channel=Laya.SoundManager.playSound('assets/audio/'+name,1,()=>this.voices.delete(channel));
  if(channel){this.gains.set(channel,gain);channel.volume=gain*this.effectsGain;channel.playbackRate=rate;this.voices.add(channel)}
 }
 play(kind:Kind):void{
  if(kind==='select')return;if(kind==='block'){this.collision('legacy');return}
  const now=performance.now();if(kind==='align'&&now-this.lastAt<160)return;if(kind==='align')this.lastAt=now;
  this.sample(kind==='align'?'align_glass_tink.mp3':kind+'.wav',kind==='button'?.28:kind==='align'?.36:kind==='win'?.45:.38);
 }
 stopAll():void{
  this.stopMotion();for(const v of this.fading){Laya.Tween?.clearAll(v);v.stop()}this.fading.clear();
  for(const v of this.voices)v.stop();this.voices.clear();this.contact=null;this.lastCollisionAt=-Infinity;
 }
}
