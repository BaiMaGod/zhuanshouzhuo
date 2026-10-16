// Optional platform capability. Unsupported devices keep visual feedback.
export class Haptics {
 private last=-Infinity;
 pulse(kind:'snap'|'blocked'):void{
  const now=performance.now();if(now-this.last<180)return;this.last=now;
  const host=globalThis as unknown as {wx?:{vibrateShort(o:{type:string}):void};tt?:{vibrateShort(o:{type:string}):void};navigator?:{vibrate(n:number):unknown}};
  try{
   const mini=host.wx||host.tt;
   if(mini)mini.vibrateShort({type:kind==='snap'?'light':'medium'});
   else host.navigator?.vibrate?.(kind==='snap'?12:25);
  }catch{/* Capability may be unavailable or disabled by the host. */}
 }
}
