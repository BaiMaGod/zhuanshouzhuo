// Playback through Laya's platform sound adapter; cues are generated at build time.
type Kind='button'|'tool'|'select'|'align'|'clear'|'block'|'win';
export class Audio {
 private enabled_=true;
 private rotation:Laya.SoundChannel|null=null;
 private voices=new Set<Laya.SoundChannel>();
 private fading=new Set<Laya.SoundChannel>();
 private motionAt=0;private velocity=0;private lastAt=-Infinity;private contact:string|null=null;
 get enabled():boolean{return this.enabled_}
 set enabled(v:boolean){this.enabled_=v;if(!v)this.stopAll()}
 async load():Promise<void>{
  await Laya.loader.load(['friction','collision','button','align','clear','tool','win'].map(n=>'assets/audio/'+n+'.wav'));
 }
 wake():void{/* Laya handles platform gesture unlock. */}
 motion(delta:number):void{
  if(!this.enabled||Math.abs(delta)<.001)return;
  const now=performance.now(),continuous=!!this.rotation,elapsed=continuous?Math.max(1,now-this.motionAt):1000/60;
  const angularSpeed=Math.abs(delta)*1000/elapsed,blend=1-Math.exp(-elapsed/40);
  this.velocity=continuous?this.velocity+(angularSpeed-this.velocity)*blend:angularSpeed;this.motionAt=now;
  if(!this.rotation||this.rotation.isStopped)this.rotation=Laya.SoundManager.playSound('assets/audio/friction.wav',0);
  const speed=Math.min(1,this.velocity/360);
  if(this.rotation){this.rotation.playbackRate=.72+speed*.36;this.rotation.volume=(.025+speed*.145)*.65}
 }
 tick(now:number):void{
  if(this.rotation&&now-this.motionAt>110)this.stopMotion();
  for(const v of this.voices)if(v.isStopped)this.voices.delete(v);
 }
 stopMotion():void{
  const v=this.rotation;this.rotation=null;this.velocity=0;this.motionAt=0;if(!v)return;
  if(Laya.Tween&&Laya.Handler){this.fading.add(v);Laya.Tween.to(v,{volume:0},55,undefined,Laya.Handler.create(this,()=>{this.fading.delete(v);v.stop()}))}
  else v.stop();
 }
 resetContact():void{this.contact=null}
 collision(key:string,strength=1):void{
  this.stopMotion();if(this.contact===key)return;this.contact=key;
  this.sample('collision',.24+Math.max(0,Math.min(1,strength))*.12,.94+Math.random()*.06);
 }
 private sample(name:string,gain:number,rate=1):void{
  if(!this.enabled)return;
  for(const v of this.voices)if(v.isStopped)this.voices.delete(v);
  if(this.voices.size>=4)return;
  let channel:Laya.SoundChannel;
  channel=Laya.SoundManager.playSound('assets/audio/'+name+'.wav',1,()=>this.voices.delete(channel));
  if(channel){channel.volume=gain*.65;channel.playbackRate=rate;this.voices.add(channel)}
 }
 play(kind:Kind):void{
  if(kind==='select')return;if(kind==='block'){this.collision('legacy');return}
  const now=performance.now();if(kind==='align'&&now-this.lastAt<160)return;if(kind==='align')this.lastAt=now;
  this.sample(kind,kind==='button'?.12:kind==='align'?.10:kind==='win'?.24:.19);
 }
 stopAll():void{
  this.stopMotion();for(const v of this.fading){Laya.Tween?.clearAll(v);v.stop()}this.fading.clear();
  for(const v of this.voices)v.stop();this.voices.clear();this.contact=null;
 }
}
