import {TAP_CONFIG} from './taptap-config.js';
import {Save,containerCloud} from './storage.js';
import {TapDiagnostics,platformError as detail,retryable,type Capability} from './taptap-diagnostics.js';
type Options=Record<string,unknown>;
interface Manager {[method:string]:((options:Options)=>unknown)|undefined}
interface Ad {load():Promise<void>;show():Promise<void>;onClose(fn:(r?:{isEnded?:boolean})=>void):void;onError(fn:(e:unknown)=>void):void;offClose?(fn:(r?:{isEnded?:boolean})=>void):void;offError?(fn:(e:unknown)=>void):void}
export interface TapAPI {login?(options:Options):void;reportScene?(options:Options):void;getCloudSaveManager?():Manager;getFileSystemManager?():Manager;getLeaderboardManager?():Manager;createRewardedVideoAd?(options:{adUnitId:string}):Ad;showShareboard?(options:Options):void;onShareMessage?(options:Options):void;offShareMessage?():void;env?:{USER_DATA_PATH?:string}}
type CapabilityState='unsupported'|'idle'|'busy'|'ready'|'error';
interface Diagnostic {capability:Capability;operation:string;code:string;message:string;at:number}
interface Archive {name:string;uuid:string;fileId:string;modifiedTime?:number;extra?:string}
const WINDOW=65000,SLOT='jade_save_v1';
function runtime():TapAPI|undefined{return (globalThis as {tap?:TapAPI}).tap}
function configured(value?:string):boolean{return !!value?.trim()&&!value.startsWith('__')}
interface CallTrace {log:TapDiagnostics;capability:Capability;signal?:AbortSignal}
// Every call settles once. Late native callbacks are recorded, never applied.
export function tapCall<T>(manager:Manager,method:string,options:Options={},board=false,timeoutMs=30000,trace?:CallTrace):Promise<T>{
 return new Promise((resolve,reject)=>{
  const id=trace?.log.begin(trace.capability,method);let finished=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const event=(phase:string,error?:unknown)=>{if(id!==undefined)trace!.log.record(id,phase,error)};
  const end=(ok:boolean,value:unknown)=>{if(finished)return;finished=true;if(timer)clearTimeout(timer);
   trace?.signal?.removeEventListener('abort',abort);if(id!==undefined)trace!.log.finish(id);ok?resolve(value as T):reject(value)};
  const abort=()=>{event('cancel');end(false,{code:'CANCELLED',message:'连接已结束'})};
  const success=(r:unknown)=>{event(finished?'late-success':'success');end(true,r)};
  const fail=(r:unknown)=>{event(finished?'late-fail':'fail',r);end(false,r)};
  const complete=()=>event(finished?'complete':'complete-without-result');
  if(trace?.signal?.aborted){abort();return}
  trace?.signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{const error={code:'CLIENT_TIMEOUT',message:'游戏等待平台回调超时，非平台返回错误'};event('client-timeout',error);end(false,error)},timeoutMs);
  try{const call=manager[method];if(typeof call!=='function')throw {code:'UNSUPPORTED_API',message:'当前客户端不支持此功能'};
   const result=call.call(manager,{...options,...(board?{callback:{onSuccess:success,onFailure:(code:unknown,message:unknown)=>fail({code,message})}}:{success,fail,complete})});
   if(result&&typeof (result as Promise<T>).then==='function')(result as Promise<T>).then(r=>{event('promise-success');success(r)},e=>{event('promise-fail',e);fail(e)});
  }catch(e){event('throw',e);end(false,e)}
 });
}
export class TapPlatform {
 status='本地存档';ready=false;adBusy=false;shareBusy=false;syncing=false;cloudBlocked=false;
 states:Record<Capability,CapabilityState>={login:'unsupported',cloud:'unsupported',leaderboard:'unsupported',ads:'unsupported',report:'unsupported'};
 diagnostics:Diagnostic[]=[];
 readonly trace=new TapDiagnostics();
 private lifecycle=new AbortController();
 private authTask:Promise<void>|null=null;
 private blocked=new Set<Capability>();
 onChange:()=>void=()=>{};
 canRestore:()=>boolean=()=>true;
 private archive:Archive|null=null;
 private lastAttempt=-Infinity;private retryAt=0;private ad:Ad|null=null;
 private loginTask:Promise<void>|null=null;private syncTask:Promise<void>|null=null;private retryTask:Promise<void>|null=null;
 private ranked={levels:0,stars:0};private rankAt=-Infinity;private rankBusy=false;
 private retryTimer:ReturnType<typeof setTimeout>|null=null;private reportSent=false;private disposed=false;
 private sessionOwner='';private uncertainWrite=false;
 private autoEnabled=false;private discoveryUntil=0;private reconnectAttempt=0;
 private reconnectTimer:ReturnType<typeof setTimeout>|null=null;private readyCostTime:number|null=null;
 constructor(readonly save:Save,readonly debug=false,private readonly suppliedAPI?:TapAPI,readonly config=TAP_CONFIG){
  this.ensureSession();
  this.refreshCapabilities();
 }
 // Re-read an injected bridge: the object/methods can become available after boot.
 get api():TapAPI|undefined{return this.suppliedAPI??runtime()}
 private ensureSession():boolean{
  if(this.sessionOwner)return true;
  if(this.requiresCloud&&!this.capabilities.cloud)return false;
  if(!this.capabilities.cloud)return true;
  if(!this.canRestore())return false;
  this.save.beginContainerSession();this.sessionOwner=this.save.owner;return true;
 }
 get requiresCloud():boolean{return this.config.target==='taptap-h5'}
 get playAllowed():boolean{return !this.requiresCloud||(this.ready&&!this.cloudBlocked)}
 get available():boolean{return Object.values(this.capabilities).some(Boolean)}
 get capabilities():Record<Capability,boolean>{return {
  login:typeof this.api?.login==='function',
  cloud:typeof this.api?.getCloudSaveManager==='function'&&typeof this.api?.getFileSystemManager==='function'&&!!this.api?.env?.USER_DATA_PATH,
  leaderboard:typeof this.api?.getLeaderboardManager==='function'&&(configured(this.config.levelsBoard)||configured(this.config.starsBoard)),
  ads:typeof this.api?.createRewardedVideoAd==='function'&&configured(this.config.rewardedAdUnitId),
  report:typeof this.api?.reportScene==='function'
 }}
 get rewardBusy():boolean{return this.adBusy||this.shareBusy}
 get shareAvailable():boolean{return configured(this.config.shareTemplateId)&&typeof this.api?.showShareboard==='function'&&typeof this.api?.onShareMessage==='function'&&typeof this.api?.offShareMessage==='function'}
 get adsAvailable():boolean{return this.capabilities.ads}
 boardAvailable(stars=false):boolean{return this.capabilities.leaderboard&&configured(stars?this.config.starsBoard:this.config.levelsBoard)}
 private refreshCapabilities():void{this.trace.bridge(this.capabilities);for(const key of Object.keys(this.states) as Capability[])if(this.capabilities[key]&&this.states[key]==='unsupported')this.states[key]='idle'}
 private state(message:string):void{this.status=message;this.onChange()}
 private failure(capability:Capability,operation:string,error:unknown):void{
  const d={capability,operation,...detail(error),at:Date.now()};this.diagnostics.push(d);if(this.diagnostics.length>20)this.diagnostics.shift();
  if(!retryable(capability,d))this.blocked.add(capability);
  this.states[capability]='error';console.warn('[TapTap]',d);this.onChange();
 }
 errorMessage(capability:Capability):string{
  const d=this.diagnostics.filter(d=>d.capability===capability).at(-1);
  if(capability==='ads')return ({'1001':'广告配置有误，请稍后再试','1002':'广告配置有误，请稍后再试','1004':'暂无可播放广告，请稍后再试','1005':'广告审核中，请稍后再试','1006':'广告暂不可用，请稍后再试','1007':'广告暂不可用，请稍后再试','1008':'广告暂不可用，请稍后再试'} as Record<string,string>)[d?.code||'']||'广告暂不可用，请稍后再试';
  return capability==='leaderboard'?'排行榜暂不可用，请稍后再试':'云同步失败，稍后重试';
 }
 diagnosticLines():string[]{return (Object.keys(this.states) as Capability[]).map(k=>k+': '+this.states[k]+(this.diagnostics.filter(d=>d.capability===k).at(-1)?' ['+this.diagnostics.filter(d=>d.capability===k).at(-1)!.code+']':''))}
 connectionLines():string[]{
  return (['login','cloud'] as const).flatMap(k=>{
   const names={login:'登录凭证',cloud:'云存档'},states={unsupported:'当前客户端不支持',idle:'待连接',busy:'连接中',ready:'已连接',error:'失败'};
   const error=this.diagnostics.filter(d=>d.capability===k).at(-1);
   const pending=this.trace.pending(k);
   return [names[k]+'：'+states[this.states[k]]+(pending?' · '+pending:''),
    this.states[k]==='error'&&error?error.operation+' ['+error.code+'] '+error.message.slice(0,60):k==='login'?'接口存在不代表原生调用已就绪。':'本机进度仅在云档读取成功后上传。'];
  });
 }
 start():Promise<void>{this.autoEnabled=true;this.discoveryUntil=Date.now()+10000;return this.login()}
 resume():Promise<void>{
  if(!this.autoEnabled||this.disposed||this.adBusy)return Promise.resolve();
  this.discoveryUntil=Date.now()+10000;return this.login();
 }
 private scheduleReconnect():void{
  if(!this.autoEnabled||this.disposed||this.reconnectTimer)return;
  const missingLogin=!this.capabilities.cloud&&this.capabilities.login&&this.states.login!=='ready'&&!this.authTask&&!this.blocked.has('login');
  const missingCloud=(this.requiresCloud||this.capabilities.cloud)&&!this.ready&&!this.pendingCloud&&!this.blocked.has('cloud');
  let delay:number;
  if((!this.sessionOwner||!missingLogin&&missingCloud)&&!this.canRestore())delay=1000;
  else if(missingLogin||missingCloud){if(this.reconnectAttempt>=3)return;delay=[5000,15000,30000][this.reconnectAttempt++]!;}
  else if(Date.now()<this.discoveryUntil)delay=500;
  else{this.reconnectAttempt=0;return}
  this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;void this.login()},delay);
  (this.reconnectTimer as unknown as {unref?:()=>void}).unref?.();
 }
 get connecting():boolean{return !!this.loginTask||!!this.authTask&&!this.capabilities.cloud}
 private call<T>(capability:Capability,manager:Manager,method:string,options:Options={},board=false,timeout=30000):Promise<T>{
  return tapCall<T>(manager,method,options,board,timeout,{log:this.trace,capability,signal:this.lifecycle.signal});
 }
 exportDiagnostics(version:string):string{return this.trace.export(version,this.states)}
 localChanged():void{
  if(!this.save.storageHealthy){
   this.cloudBlocked=true;this.failure('cloud','local-cache',this.save.storageError||Error('本机待同步缓存写入失败'));
   this.state('本机进度缓存异常，请检查存储后重试');return;
  }
  if(this.ready&&!this.syncing&&!this.cloudBlocked){this.state('待同步');this.scheduleSync()}
 }
 login(manual=false):Promise<void>{
  if(this.disposed)return Promise.resolve();
  if(this.loginTask)return this.loginTask;
  if(manual){this.blocked.clear();this.reconnectAttempt=0}
  if(this.reconnectTimer)clearTimeout(this.reconnectTimer);this.reconnectTimer=null;
  this.loginTask=this.connect().finally(()=>{this.loginTask=null;this.scheduleReconnect()});return this.loginTask;
 }
 private async connect():Promise<void>{
  if(!this.api||this.disposed)return;
  this.refreshCapabilities();
  if(this.requiresCloud&&!this.capabilities.cloud){
   if(this.ready)this.cloudBlocked=true;
   if(this.diagnostics.at(-1)?.code!=='CLOUD_SAVE_UNAVAILABLE')this.failure('cloud','capability-check',{code:'CLOUD_SAVE_UNAVAILABLE',message:'当前 TapTap 客户端未提供完整云存档接口'});
   this.blocked.delete('cloud');
   this.state('TapTap 云存档接口不可用，无法进入游戏');return;
  }
  if(!this.ensureSession()){this.state('等待安全场景恢复云存档');return}
  // The H5 cloud-save API is container-owned. The independent login code is
  // diagnostic only and must never be treated as a stable account identifier.
  const authentication=this.loginOnly();
  if(this.capabilities.cloud){
   if(!this.ready&&!this.pendingCloud&&!this.blocked.has('cloud'))await this.restore();
   else if(this.ready&&!this.cloudBlocked)await this.sync();
  }else await authentication;
  if(this.readyCostTime!==null&&!this.disposed)void this.reportReady(this.readyCostTime);
 }
 private loginOnly():Promise<void>{
  if(this.authTask)return this.authTask;
  if(!this.capabilities.login||this.states.login==='ready'||this.blocked.has('login'))return Promise.resolve();
  this.states.login='busy';if(!this.ready)this.state('正在连接 TapTap…');
  this.authTask=(async()=>{
   try{
    const response=await this.call<{code?:string}>('login',this.api as unknown as Manager,'login',{timeout:120000},false,125000);
    if(this.disposed)return;
    if(typeof response?.code!=='string'||!response.code.trim())throw {code:'INVALID_LOGIN_RESPONSE',message:'平台未返回有效登录凭证'};
    this.states.login='ready';
    if(!this.capabilities.cloud)this.state('登录凭证已获取 · 本地存档');else this.onChange();
   }catch(e){
    if(this.disposed)return;
    this.failure('login','login',e);
    if(!this.capabilities.cloud)this.state('登录凭证获取失败，请查看平台检查');
   }
  })().finally(()=>{
   this.authTask=null;
   // If the first cloud call failed during native initialization, retry it after
   // the native result, never re-read an already restored archive.
   if(!this.disposed&&this.states.login==='ready'&&this.capabilities.cloud&&!this.ready&&!this.blocked.has('cloud'))void this.login();
   else this.scheduleReconnect();
  });
  return this.authTask;
 }
 pendingCloud:unknown=null;
 private async restore():Promise<void>{
  if(!this.capabilities.cloud)return;
  if(!this.canRestore()){this.states.cloud='idle';this.state('等待安全场景恢复云存档');return}
  this.ready=false;this.cloudBlocked=false;this.states.cloud='busy';this.state('正在读取云存档…');
  try{
   const {slot,value}=await this.download();
   if(this.disposed)return;
   if(!this.canRestore()){this.states.cloud='idle';this.state('等待安全场景恢复云存档');return}
   if(!slot){
    // A valid empty list is a new cloud user, not an error. Create the first
    // archive now; never unlock gameplay while the first archive is absent.
    if(!this.sessionOwner)throw Error('新用户云存档会话身份缺失');
    this.save.bindAccount(this.sessionOwner,false);
    this.archive=null;this.lastAttempt=this.save.lastAttemptAt;
    this.syncing=true;this.state('正在创建首次云存档…');
    try{await this.uploadSnapshot(true)}finally{this.syncing=false}
    this.ready=true;this.cloudBlocked=false;this.states.cloud='ready';this.state('首次云存档已创建');
    return;
   }
   // The archive UUID is the stable local namespace. Never import another
   // session/guest cache into this account.
   const owner='archive:'+slot.uuid;
   const remote=containerCloud(value,owner);
   if(this.save.owner!==owner){this.ranked={levels:0,stars:0};this.rankAt=-Infinity}
   this.save.bindAccount(owner,false);this.archive=slot;this.lastAttempt=this.save.lastAttemptAt;
   const localRevision=this.save.revision,localBase=this.save.baseRevision,localDirty=this.save.cloudDirty,localInFlight=this.save.inFlightRevision;
   const remoteRevision=remote.meta.revision;
   const confirmedInFlight=localInFlight===remoteRevision&&localRevision>remoteRevision;
   const pendingOnCurrentCloud=localBase===remoteRevision&&localRevision>remoteRevision;
   if(localDirty&&localRevision>remoteRevision&&(pendingOnCurrentCloud||confirmedInFlight)){
    if(confirmedInFlight&&localBase!==remoteRevision)this.save.markSynced(remoteRevision);
    // This is the only restart case in which a local transaction is safe to
    // replay: it is based exactly on the cloud revision just downloaded.
    containerCloud(this.save.exportCloud(),owner);
    const wait=Math.max(0,this.lastAttempt+WINDOW-Date.now());
    if(wait>0){this.state('等待云存档写入冷却…');await new Promise<void>(resolve=>setTimeout(resolve,wait))}
    this.syncing=true;this.state('正在补传上次未确认的进度…');
    try{await this.uploadSnapshot(false)}finally{this.syncing=false}
   }else{
    // Cloud is authoritative. This also resolves an upload that reached the
    // server before the app closed but whose local acknowledgement was missed.
    this.save.replaceCloud(remote);
   }
   this.pendingCloud=null;this.ready=true;this.cloudBlocked=false;this.states.cloud='ready';this.state('云存档已恢复');
  }catch(e){
   if(!this.disposed){this.ready=false;this.failure('cloud','restore',e);this.state('云档读取失败，请检查网络后重试')}
  }
 }
 resolveConflict(useCloud:boolean):void{
  // Legacy conflict UI is retained for non-strict preview builds only.
  if(this.requiresCloud){this.pendingCloud=null;return}
  if(!this.pendingCloud)return;
  try{this.save.mergeCloud(this.pendingCloud,useCloud);this.pendingCloud=null;this.ready=true;this.states.cloud='ready';this.state('待同步');void this.sync()}
  catch(e){this.failure('cloud','resolveConflict',e)}
 }
 private async download():Promise<{slot:Archive|null;value:unknown|null}>{
  const api=this.api!,cloud=api.getCloudSaveManager!(),fs=api.getFileSystemManager!();
  const {saves}=await this.call<{saves:Archive[]}>('cloud',cloud,'getArchiveList');
  if(!Array.isArray(saves))throw Error('云档列表格式错误');
  const candidates=saves.filter(s=>s.name===SLOT).sort((a,b)=>Number(b.modifiedTime||0)-Number(a.modifiedTime||0));
  const slot=candidates[0];if(!slot)return {slot:null,value:null};
  if(!slot.uuid||!slot.fileId)throw Error('云档标识缺失');
  const targetFilePath=api.env!.USER_DATA_PATH+'/jade_download.json';
  const file=await this.call<{filePath:string}>('cloud',cloud,'getArchiveData',{archiveUUID:slot.uuid,archiveFileId:slot.fileId,targetFilePath},false,60000);
  const {data}=await this.call<{data:string}>('cloud',fs,'readFile',{filePath:file.filePath,encoding:'utf8'});
  return {slot,value:JSON.parse(data)};
 }
 private scheduleSync():void{
  if(this.retryTimer||!this.ready||this.disposed||this.cloudBlocked||this.blocked.has('cloud')||!this.save.cloudDirty)return;
  const delay=Math.max(0,this.lastAttempt+WINDOW-Date.now(),this.retryAt-Date.now());
  this.retryTimer=setTimeout(()=>{this.retryTimer=null;void this.sync()},delay);
  (this.retryTimer as unknown as {unref?:()=>void}).unref?.();
 }
 sync():Promise<void>{
  if(this.cloudBlocked)return Promise.resolve();
  if(this.ready)void this.submitScores();
  if(this.syncTask)return this.syncTask;
  this.syncTask=this.syncNow(false).finally(()=>{this.syncTask=null;this.scheduleSync()});return this.syncTask;
 }
 private async syncNow(force:boolean):Promise<void>{
  if(!this.api||!this.capabilities.cloud||!this.ready||this.syncing||!this.save.cloudDirty||this.disposed||this.blocked.has('cloud')||(!force&&this.cloudBlocked))return;
  if(!force&&(Date.now()<this.retryAt||Date.now()-this.lastAttempt<WINDOW)){this.scheduleSync();return}
  this.syncing=true;this.states.cloud='busy';this.state('正在后台同步云存档…');
  try{
   await this.uploadSnapshot(false);
   this.cloudBlocked=false;this.uncertainWrite=false;this.retryAt=0;
   this.states.cloud='ready';this.state(this.save.cloudDirty?'有新进度待同步':'云存档已同步');
  }catch(e){
   if(!this.disposed){
    const d=detail(e),rateLimited=d.code==='400001';
    this.retryAt=Math.max(this.lastAttempt+WINDOW,Date.now()+(rateLimited?WINDOW:0));
    this.uncertainWrite=true;this.cloudBlocked=true;
    this.failure('cloud','upload',e);this.state('云存档同步异常，游戏已暂停');
   }
  }finally{this.syncing=false}
 }
 private async uploadSnapshot(create:boolean):Promise<void>{
  if(!this.api||!this.capabilities.cloud)throw {code:'CLOUD_SAVE_UNAVAILABLE',message:'TapTap 云存档接口不可用'};
  const cooldown=Math.max(0,this.lastAttempt+WINDOW-Date.now());
  if(cooldown>0)await new Promise<void>(resolve=>setTimeout(resolve,cooldown));
  const revision=this.save.revision,owner=this.save.owner,snapshot=this.save.exportCloud();
  const filePath=this.api.env!.USER_DATA_PATH+'/jade_save.json';
  await this.call('cloud',this.api.getFileSystemManager!(),'writeFile',{filePath,data:JSON.stringify(snapshot),encoding:'utf8'});
  const attempted=Date.now();this.save.markAttempt(attempted,revision);this.lastAttempt=attempted;
  const useCreate=create||!this.archive;
  const result=await this.call<{uuid?:string;fileId:string}>('cloud',this.api.getCloudSaveManager!(),useCreate?'createArchive':'updateArchive',{
   ...(!useCreate&&this.archive?{archiveUUID:this.archive.uuid}:{}),
   archiveMetaData:{name:SLOT,summary:'Jade bracelet progress',extra:JSON.stringify({revision,savedAt:Date.now()})},
   archiveFilePath:filePath
  });
  const uuid=this.archive?.uuid||result.uuid;
  if(!uuid||!result.fileId){this.uncertainWrite=true;throw Error('云档上传响应格式不完整，需重新查询确认')}
  if(this.disposed||this.save.owner!==owner)return;
  this.archive={name:SLOT,uuid,fileId:result.fileId};
  this.save.moveAccount('archive:'+uuid);
  this.save.markSynced(revision);
  this.uncertainWrite=false;this.retryAt=0;
 }
 async retrySync():Promise<void>{
  if(this.disposed||!this.requiresCloud||!this.ready)return;
  if(this.retryTask)return this.retryTask;
  this.retryTask=(async()=>{
   if(this.syncTask)await this.syncTask;
   this.refreshCapabilities();
   if(!this.api||!this.capabilities.cloud)throw {code:'CLOUD_SAVE_UNAVAILABLE',message:'TapTap 云存档接口仍不可用'};
   this.blocked.delete('cloud');
   const wait=Math.max(0,this.lastAttempt+WINDOW-Date.now(),this.retryAt-Date.now());
   if(wait>0){this.state('等待云存档写入冷却…');await new Promise<void>(resolve=>setTimeout(resolve,wait))}
   if(this.uncertainWrite)await this.reconcileUncertainWrite();
   if(this.cloudBlocked)await this.syncNow(true);
  })().catch(e=>{
   if(!this.disposed){this.cloudBlocked=true;this.failure('cloud','retry-reconcile',e);this.state('云存档仍未确认，请检查网络后重试')}
  }).finally(()=>{this.retryTask=null});
  return this.retryTask;
 }
 private async reconcileUncertainWrite():Promise<void>{
  const {slot,value}=await this.download();
  if(!slot){
   if(this.archive)throw Error('原云存档暂时无法在云端列表中确认，禁止重复创建');
   this.uncertainWrite=false;return;
  }
  const owner='archive:'+slot.uuid,remote=containerCloud(value,owner);
  if(this.save.owner!==owner){
   const preserve=this.save.owner===this.sessionOwner;
   this.save.bindAccount(owner,preserve);
  }
  this.archive=slot;
  const localRevision=this.save.revision,remoteRevision=remote.meta.revision;
  if(remoteRevision>=localRevision){
   this.save.replaceCloud(remote);this.cloudBlocked=false;this.uncertainWrite=false;this.retryAt=0;
   this.ready=true;this.states.cloud='ready';this.state('云存档已确认');return;
  }
  if(this.save.inFlightRevision===remoteRevision&&localRevision>remoteRevision){
   // The previous request committed its snapshot, but its callback was lost.
   // Advance the base to that confirmed revision while retaining newer local work.
   this.save.markSynced(remoteRevision);
  }
  if(this.save.cloudDirty&&this.save.baseRevision===remoteRevision){
   // The server is still at the transaction's base revision, or just confirmed
   // the in-flight snapshot; the latest complete local snapshot is safe to send.
   this.lastAttempt=this.save.lastAttemptAt;return;
  }
  // A different cloud revision won. Do not overwrite it with a stale cache.
  this.save.replaceCloud(remote);this.cloudBlocked=false;this.uncertainWrite=false;this.retryAt=0;
  this.ready=true;this.states.cloud='ready';this.state('已恢复云端最新进度');
 }
 async submitScores():Promise<void>{
  if(!this.capabilities.leaderboard||this.debug||this.rankBusy||this.disposed)return;
  const records=Object.entries(this.save.rankRecords).filter(([i])=>Number(i)>=10);
  const levels=records.length,stars=Math.round(records.reduce((sum,[,r])=>sum+r.stars,0));
  const scores=[];
  if(this.boardAvailable()&&levels>this.ranked.levels)scores.push({leaderboardId:this.config.levelsBoard,score:Math.round(levels)});
  if(this.boardAvailable(true)&&stars>this.ranked.stars)scores.push({leaderboardId:this.config.starsBoard,score:stars});
  if(!scores.length||Date.now()-this.rankAt<WINDOW)return;
  this.rankBusy=true;this.rankAt=Date.now();
  try{await this.call('leaderboard',this.api!.getLeaderboardManager!(),'submitScores',{scores},true);this.ranked={levels,stars};this.states.leaderboard='ready'}
  catch(e){this.failure('leaderboard','submitScores',e)}finally{this.rankBusy=false}
 }
 async openBoard(stars=false):Promise<boolean>{
  if(!this.boardAvailable(stars))return false;
  try{await this.call('leaderboard',this.api!.getLeaderboardManager!(),'openLeaderboard',{leaderboardId:stars?this.config.starsBoard:this.config.levelsBoard,collection:'public'},true);this.states.leaderboard='ready';return true}
  catch(e){this.failure('leaderboard','openLeaderboard',e);return false}
 }
 async reportReady(costTime:number):Promise<void>{
  this.readyCostTime=costTime;
  if(this.reportSent||!this.capabilities.report)return;this.reportSent=true;
  try{await this.call('report',this.api as unknown as Manager,'reportScene',{sceneId:7,costTime:Number.isFinite(costTime)?Math.max(0,Math.round(costTime)):0});this.states.report='ready'}
  catch(e){this.failure('report','reportScene',e)}
 }
 async rewarded():Promise<boolean|null>{
  if(this.adBusy||this.shareBusy||!this.adsAvailable)return null;
  this.adBusy=true;this.states.ads='busy';
  try{
   const ad=this.ad??=this.api!.createRewardedVideoAd!({adUnitId:this.config.rewardedAdUnitId});
   return await new Promise<boolean|null>(resolve=>{
    let done=false,shown=false;
    const finish=(value:boolean|null,error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);
     try{ad.offClose?.(close);ad.offError?.(fail)}catch{/* Listener cleanup cannot suppress settlement. */}
     if(error)this.failure('ads','rewarded',error);else this.states.ads='ready';resolve(value)};
    const close=(r?:{isEnded?:boolean})=>finish(shown&&r?.isEnded===true);
    const fail=(e:unknown)=>finish(null,e||Error('广告失败'));
    const timer=setTimeout(()=>fail(Error('广告超时')),180000);
    try{ad.onClose(close);ad.onError(fail)}catch(e){fail(e);return}
    // Some containers dispatch close before the show Promise resolves.
    const show=async()=>{try{shown=true;await ad.show()}catch{shown=false;if(done)return;await ad.load();if(done)return;shown=true;await ad.show()}};
    void show().catch(fail);
   });
  }catch(e){this.failure('ads','createRewardedVideoAd',e);return null}
  finally{this.adBusy=false;this.onChange()}
 }
 /** Opening the share sheet is not a completed share. Only onShareMessage grants. */
 async shareReward(sceneParam:string):Promise<boolean|null>{
  if(this.disposed||this.adBusy||this.shareBusy||!this.shareAvailable)return null;
  const api=this.api!;this.shareBusy=true;
  try{return await new Promise<boolean|null>(resolve=>{
   let done=false;let timer:ReturnType<typeof setTimeout>|undefined;
   const finish=(value:boolean|null)=>{if(done)return;done=true;if(timer)clearTimeout(timer);
    this.lifecycle.signal.removeEventListener('abort',abort);
    try{api.offShareMessage!()}catch{}
    resolve(value);
   };
   const abort=()=>finish(false);
   this.lifecycle.signal.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>finish(false),120000);
   try{
    api.onShareMessage!({success:()=>finish(true),fail:()=>finish(false)});
    api.showShareboard!({templateId:this.config.shareTemplateId,sceneParam,success:()=>{},fail:()=>finish(null)});
   }catch{finish(null)}
  })}finally{this.shareBusy=false;this.onChange()}
 }
 dispose():void{this.disposed=true;this.lifecycle.abort();if(this.retryTimer)clearTimeout(this.retryTimer);this.retryTimer=null;if(this.reconnectTimer)clearTimeout(this.reconnectTimer);this.reconnectTimer=null}
}
