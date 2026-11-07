// Monotonic, overlap-safe timed challenge. All times are milliseconds.
// A cleared board is adjudicated from its logical removal event, not animation.
export class ChallengeClock {
 /**
  * @param {number} durationSeconds
  * @param {{started:boolean,elapsedMs:number,result:string|null}|null} [snapshot]
  */
 constructor(durationSeconds,snapshot=null){
  if(!Number.isFinite(durationSeconds)||durationSeconds<=0)throw Error('Invalid challenge duration');
  this.limitMs=durationSeconds*1000;
  this.elapsedMs=Math.max(0,Math.min(this.limitMs,Number(snapshot?.elapsedMs)||0));
  this.started=!!snapshot?.started;
  this.lastAt=null;
  this.pauses=new Set();
  this.result=snapshot?.result||null;
 }
 advance(now){
  if(!Number.isFinite(now))throw Error('Invalid monotonic clock');
  if(this.lastAt!==null&&this.started&&!this.pauses.size&&!this.result)
   this.elapsedMs+=Math.max(0,now-this.lastAt);
  this.lastAt=now;
 }
 begin(now){this.advance(now);if(!this.started&&!this.result)this.started=true}
 pause(reason,now){this.advance(now);this.pauses.add(reason)}
 resume(reason,now){this.advance(now);this.pauses.delete(reason)}
 syncPaused(reason,active,now){if(active){if(!this.pauses.has(reason))this.pause(reason,now)}else if(this.pauses.has(reason))this.resume(reason,now);else this.advance(now)}
 remainingMs(now){this.advance(now);return Math.max(0,this.limitMs-this.elapsedMs)}
 timeOut(now){
  this.advance(now);
  if(this.result)return this.result==='failed';
  if(this.started&&this.elapsedMs>=this.limitMs){this.result='failed';return true}
  return false;
 }
 clearAt(now){
  // Invoke synchronously when the final bracelet *logically* disappears.
  this.advance(now);
  if(this.result==='failed')return this.elapsedMs===this.limitMs&&now===this.lastAt;
  if(this.result==='won')return true;
  if(this.started&&this.elapsedMs>this.limitMs){this.result='failed';return false}
  this.result='won';return true;
 }
 snapshot(now){this.advance(now);return{started:this.started,elapsedMs:this.elapsedMs,result:this.result}}
}
