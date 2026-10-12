export class Audio {
 context:AudioContext|null=null;
 enabled=true;
 private last=0;
 wake():void{
  if(!this.enabled)return;
  try{this.context??=new AudioContext();if(this.context.state==='suspended')void this.context.resume()}catch{}
 }
 play(kind:'select'|'align'|'clear'|'block'|'win'):void{
  if(!this.enabled)return;this.wake();if(!this.context)return;
  const now=performance.now();if((kind==='select'||kind==='block'||kind==='align')&&now-this.last<90)return;this.last=now;
  const ctx=this.context,notes=kind==='win'?[523,659,784,1046]:kind==='clear'?[660,990]:kind==='align'?[880,1320]:[kind==='block'?170:520];
  notes.forEach((n,i)=>{
   const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+i*.075;
   o.type='sine';o.frequency.setValueAtTime(n,t);o.frequency.exponentialRampToValueAtTime(n*.82,t+.22);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.06,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.3);
   o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.32);
  });
 }
}
