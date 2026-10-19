export type Capability='login'|'cloud'|'leaderboard'|'ads'|'report';
export interface PlatformError {code:string;message:string}
export function redact(value:unknown):string{
 return String(value??'').replace(/([?&](?:code|token|access_token|secret|session_key|openid|unionid)=)[^&\s]+/gi,'$1[redacted]')
  .replace(/(["']?(?:code|token|access_token|secret|session_key|openid|unionid)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s}]+)/gi,'$1[redacted]').slice(0,240);
}
export function platformError(error:unknown):PlatformError{
 const e=error as {errCode?:unknown;errno?:unknown;errcode?:unknown;code?:unknown;errMsg?:unknown;errmsg?:unknown;message?:unknown};
 return {code:String(e?.errCode??e?.errno??e?.errcode??e?.code??'UNKNOWN').slice(0,40),
  message:redact(e?.errMsg??e?.errmsg??e?.message??(typeof error==='string'?error:'平台调用失败'))};
}
export function retryable(capability:Capability,error:PlatformError):boolean{
 if(error.code==='CLIENT_TIMEOUT')return capability!=='login';
 return ['400007','400100','408','429','500','502','503','504','NETWORK_ERROR'].includes(error.code)||
  error.code==='UNKNOWN'&&/network|offline|timeout|网络|断网|超时/i.test(error.message);
}
interface Event {id:number;capability:Capability;operation:string;phase:string;at:number;elapsed:number;error?:PlatformError}
export class TapDiagnostics {
 readonly session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
 readonly events:Event[]=[];
 private nextId=0;
 private active=new Map<number,{capability:Capability;operation:string;at:number}>();
 begin(capability:Capability,operation:string):number{
  const id=++this.nextId;this.active.set(id,{capability,operation,at:Date.now()});this.record(id,'invoke');return id;
 }
 record(id:number,phase:string,error?:unknown):void{
  const start=this.active.get(id);
  // Keep late callback evidence without retaining any callback payload.
  const previous=this.events.find(e=>e.id===id);
  if(!start&&!previous)return;
  const capability=start?.capability??previous!.capability,operation=start?.operation??previous!.operation;
  const at=Date.now(),elapsed=start?Math.max(0,at-start.at):Math.max(0,at-previous!.at);
  const event={id,capability,operation,phase,at,elapsed,...(error?{error:platformError(error)}:{})};
  this.events.push(event);if(this.events.length>100)this.events.shift();
  console.info('[TapTap trace]',event);
 }
 finish(id:number):void{this.active.delete(id)}
 pending(capability:Capability):string|undefined{
  const current=[...this.active.values()].find(v=>v.capability===capability);
  return current?current.operation+' · '+Math.floor(Math.max(0,Date.now()-current.at)/1000)+'s':undefined;
 }
 bridge(capabilities:Record<Capability,boolean>):void{
  const signature=JSON.stringify(capabilities);
  if(signature===this.signature)return;
  this.signature=signature;
  const id=this.begin('login','bridge');
  this.record(id,'available:'+Object.entries(capabilities).filter(([,v])=>v).map(([k])=>k).join(','));
  this.finish(id);
 }
 private signature='';
 export(version:string,states:unknown):string{
  const locationInfo=typeof location==='undefined'||typeof location.origin!=='string'?'unknown':location.origin+location.pathname;
  const ua=typeof navigator==='undefined'?'unknown':navigator.userAgent;
  const globals=globalThis as {tap?:{version?:unknown};H5GameAPI?:{tapCustomCommandSync?:unknown}};
  const bridge={tap:typeof globals.tap,nativeBridge:typeof globals.H5GameAPI,customCommandSync:typeof globals.H5GameAPI?.tapCustomCommandSync,reportedVersion:typeof globals.tap?.version==='string'?redact(globals.tap.version):'not reported'};
  return JSON.stringify({version,session:this.session,page:locationInfo,userAgent:ua,bridge,
   visibility:typeof document==='undefined'?'unknown':document.visibilityState,states,events:this.events},null,2);
 }
}
