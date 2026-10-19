import {TAP_CONFIG} from './taptap-config.js';
import {Save,containerCloud} from './storage.js';
type Options=Record<string,unknown>;
interface Manager {[method:string]:((options:Options)=>unknown)|undefined}
interface Ad {load():Promise<void>;show():Promise<void>;onClose(fn:(r?:{isEnded?:boolean})=>void):void;onError(fn:(e:unknown)=>void):void;offClose?(fn:(r?:{isEnded?:boolean})=>void):void;offError?(fn:(e:unknown)=>void):void}
export interface TapAPI {login?(options:Options):void;reportScene?(options:Options):void;getCloudSaveManager?():Manager;getFileSystemManager?():Manager;getLeaderboardManager?():Manager;createRewardedVideoAd?(options:{adUnitId:string}):Ad;env?:{USER_DATA_PATH?:string}}
type Capability='login'|'cloud'|'leaderboard'|'ads'|'report';
type CapabilityState='unsupported'|'idle'|'busy'|'ready'|'error';
interface Diagnostic {capability:Capability;operation:string;code:string;message:string;at:number}
interface Archive {name:string;uuid:string;fileId:string;modifiedTime?:number;extra?:string}
const WINDOW=65000,SLOT='jade_save_v1';
function runtime():TapAPI|undefined{return (globalThis as {tap?:TapAPI}).tap}
function configured(value?:string):boolean{return !!value?.trim()&&!value.startsWith('__')}
function detail(error:unknown):{code:string;message:string}{
 const e=error as {errCode?:unknown;code?:unknown;errMsg?:unknown;message?:unknown};
 // Only retain the platform error fields; never log login responses or codes.
 return {code:String(e?.errCode??e?.code??'UNKNOWN').slice(0,40),message:String(e?.errMsg??e?.message??'平台调用失败').slice(0,240)};
}
// The low-level wrapper rejects internally. Public platform methods catch failures.
export function tapCall<T>(manager:Manager,method:string,options:Options={},board=false):Promise<T>{
 return new Promise((resolve,reject)=>{
  let finished=false;const timer=setTimeout(()=>end(false,Error('平台响应超时，请重试')),15000);
  const end=(ok:boolean,value:unknown)=>{if(finished)return;finished=true;clearTimeout(timer);ok?resolve(value as T):reject(value)};
  const success=(r:unknown)=>end(true,r),fail=(r:unknown)=>end(false,r);
  try{const call=manager[method];if(typeof call!=='function')throw Error('当前客户端不支持此功能');
   const result=call.call(manager,{...options,...(board?{callback:{onSuccess:success,onFailure:(code:unknown,message:unknown)=>fail({code,message})}}:{success,fail})});
   if(result&&typeof (result as Promise<T>).then==='function')(result as Promise<T>).then(success,fail);
  }catch(e){fail(e)}
 });
}
export class TapPlatform {
 status='本地存档';ready=false;adBusy=false;syncing=false;
 states:Record<Capability,CapabilityState>={login:'unsupported',cloud:'unsupported',leaderboard:'unsupported',ads:'unsupported',report:'unsupported'};
 diagnostics:Diagnostic[]=[];
 onChange:()=>void=()=>{};
 canRestore:()=>boolean=()=>true;
 private archive:Archive|null=null;
 private lastAttempt=-Infinity;private retryAt=0;private ad:Ad|null=null;
 private loginTask:Promise<void>|null=null;private syncTask:Promise<void>|null=null;
 private ranked={levels:0,stars:0};private rankAt=-Infinity;private rankBusy=false;
 private retryTimer:ReturnType<typeof setTimeout>|null=null;private reportSent=false;private disposed=false;
 private sessionOwner='';
 constructor(readonly save:Save,readonly debug=false,readonly api=runtime(),readonly config=TAP_CONFIG){
  if(this.capabilities.login||this.capabilities.cloud||this.capabilities.leaderboard||this.capabilities.ads){this.save.beginContainerSession();this.sessionOwner=save.owner}
  this.refreshCapabilities();
 }
 get available():boolean{return Object.values(this.capabilities).some(Boolean)}
 get capabilities():Record<Capability,boolean>{return {
  login:typeof this.api?.login==='function',
  cloud:typeof this.api?.getCloudSaveManager==='function'&&typeof this.api?.getFileSystemManager==='function'&&!!this.api?.env?.USER_DATA_PATH,
  leaderboard:typeof this.api?.getLeaderboardManager==='function'&&(configured(this.config.levelsBoard)||configured(this.config.starsBoard)),
  ads:typeof this.api?.createRewardedVideoAd==='function'&&configured(this.config.rewardedAdUnitId),
  report:typeof this.api?.reportScene==='function'
 }}
 get adsAvailable():boolean{return this.capabilities.ads}
 boardAvailable(stars=false):boolean{return this.capabilities.leaderboard&&configured(stars?this.config.starsBoard:this.config.levelsBoard)}
 private refreshCapabilities():void{for(const key of Object.keys(this.states) as Capability[])if(this.capabilities[key]&&this.states[key]==='unsupported')this.states[key]='idle'}
 private state(message:string):void{this.status=message;this.onChange()}
 private failure(capability:Capability,operation:string,error:unknown):void{
  const d={capability,operation,...detail(error),at:Date.now()};this.diagnostics.push(d);if(this.diagnostics.length>20)this.diagnostics.shift();
  this.states[capability]='error';console.warn('[TapTap]',d);this.onChange();
 }
 errorMessage(capability:Capability):string{
  const d=this.diagnostics.filter(d=>d.capability===capability).at(-1);
  if(capability==='ads')return ({'1001':'广告配置有误，请稍后再试','1002':'广告配置有误，请稍后再试','1004':'暂无可播放广告，请稍后再试','1005':'广告审核中，请稍后再试','1006':'广告暂不可用，请稍后再试','1007':'广告暂不可用，请稍后再试','1008':'广告暂不可用，请稍后再试'} as Record<string,string>)[d?.code||'']||'广告暂不可用，请稍后再试';
  return capability==='leaderboard'?'排行榜暂不可用，请稍后再试':'云同步失败，稍后重试';
 }
 diagnosticLines():string[]{return (Object.keys(this.states) as Capability[]).map(k=>k+': '+this.states[k]+(this.diagnostics.filter(d=>d.capability===k).at(-1)?' ['+this.diagnostics.filter(d=>d.capability===k).at(-1)!.code+']':''))}
 localChanged():void{if(this.ready&&!this.syncing){this.state('待同步');this.scheduleSync()}}
 login():Promise<void>{
  if(this.loginTask)return this.loginTask;
  this.loginTask=this.connect().finally(()=>{this.loginTask=null});return this.loginTask;
 }
 private async connect():Promise<void>{
  if(!this.api||this.disposed)return;
  this.refreshCapabilities();
  // These tasks are independent. A failed login must not lock cloud, boards or ads.
  await Promise.allSettled([this.loginOnly(),this.restore()]);
 }
 private async loginOnly():Promise<void>{
  if(!this.capabilities.login)return;
  this.states.login='busy';this.onChange();
  try{await tapCall(this.api as unknown as Manager,'login',{timeout:12000});this.states.login='ready';if(!this.capabilities.cloud)this.state('已登录 · 本地存档');else this.onChange()}
  catch(e){this.failure('login','login',e)}
 }
 pendingCloud:unknown=null;
 private async restore():Promise<void>{
  if(!this.capabilities.cloud)return;
  if(this.syncTask)await this.syncTask;
  this.ready=false;this.states.cloud='busy';this.state('正在读取云存档…');
  try{
   const {slot,value}=await this.download();
   if(!this.canRestore()){this.states.cloud='idle';this.state('回首页后同步');return}
   // Container-owned archive UUID is the local identity boundary. Neither a login
   // code nor an unverified openid is used as an account identifier.
   const owner=slot?'archive:'+slot.uuid:this.sessionOwner;
   const remote=value===null?null:containerCloud(value,owner);
   if(this.save.owner!==owner){this.ranked={levels:0,stars:0};this.rankAt=-Infinity}
   this.save.bindAccount(owner,this.save.owner===this.sessionOwner);this.archive=slot;
   if(remote&&this.save.hasRunConflict(remote)){this.pendingCloud=remote;this.states.cloud='idle';this.state('存档冲突待选择');return}
   if(remote)this.save.mergeCloud(remote);
   this.pendingCloud=null;this.ready=true;this.states.cloud='ready';this.state('云存档已连接');await this.sync();
  }catch(e){this.failure('cloud','restore',e);this.state('云档读取失败，点击重试')}
 }
 resolveConflict(useCloud:boolean):void{
  if(!this.pendingCloud)return;
  try{this.save.mergeCloud(this.pendingCloud,useCloud);this.pendingCloud=null;this.ready=true;this.states.cloud='ready';this.state('待同步');void this.sync()}
  catch(e){this.failure('cloud','resolveConflict',e)}
 }
 private async download():Promise<{slot:Archive|null;value:unknown|null}>{
  const api=this.api!,cloud=api.getCloudSaveManager!(),fs=api.getFileSystemManager!();
  const {saves}=await tapCall<{saves:Archive[]}>(cloud,'getArchiveList');
  if(!Array.isArray(saves))throw Error('云档列表格式错误');
  const candidates=saves.filter(s=>s.name===SLOT).sort((a,b)=>Number(b.modifiedTime||0)-Number(a.modifiedTime||0));
  const slot=candidates[0];if(!slot)return {slot:null,value:null};
  if(!slot.uuid||!slot.fileId)throw Error('云档标识缺失');
  const targetFilePath=api.env!.USER_DATA_PATH+'/jade_download.json';
  const file=await tapCall<{filePath:string}>(cloud,'getArchiveData',{archiveUUID:slot.uuid,archiveFileId:slot.fileId,targetFilePath});
  const {data}=await tapCall<{data:string}>(fs,'readFile',{filePath:file.filePath,encoding:'utf8'});
  return {slot,value:JSON.parse(data)};
 }
 private scheduleSync():void{
  if(this.retryTimer||!this.ready||this.disposed||!this.save.cloudDirty)return;
  const delay=Math.max(0,this.lastAttempt+WINDOW-Date.now(),this.retryAt-Date.now());
  this.retryTimer=setTimeout(()=>{this.retryTimer=null;void this.sync()},delay);
  // Node test runners can exit; browsers ignore this optional method.
  (this.retryTimer as unknown as {unref?:()=>void}).unref?.();
 }
 sync():Promise<void>{
  // Ranking does not depend on cloud restore, uploads or conflicts. Only records
  // from this launch/current container archive may reach it.
  void this.submitScores();
  if(this.syncTask)return this.syncTask;
  this.syncTask=this.syncNow().finally(()=>{this.syncTask=null;this.scheduleSync()});return this.syncTask;
 }
 private async syncNow():Promise<void>{
  if(!this.api||!this.capabilities.cloud||!this.ready||this.syncing||!this.save.cloudDirty||this.disposed)return;
  if(Date.now()<this.retryAt||Date.now()-this.lastAttempt<WINDOW){this.scheduleSync();return}
  this.syncing=true;this.lastAttempt=Date.now();this.states.cloud='busy';this.state('正在同步…');
  const revision=this.save.revision,owner=this.save.owner;
  try{
   const filePath=this.api.env!.USER_DATA_PATH+'/jade_save.json';
   await tapCall(this.api.getFileSystemManager!(),'writeFile',{filePath,data:JSON.stringify(this.save.exportCloud()),encoding:'utf8'});
   const result=await tapCall<{uuid?:string;fileId:string}>(this.api.getCloudSaveManager!(),this.archive?'updateArchive':'createArchive',{
    ...(this.archive?{archiveUUID:this.archive.uuid}:{}),archiveMetaData:{name:SLOT,summary:'Jade bracelet progress',extra:JSON.stringify({revision,savedAt:Date.now()})},archiveFilePath:filePath
   });
   const uuid=this.archive?.uuid||result.uuid;if(!uuid||!result.fileId)throw Error('云档上传响应格式错误');
   if(this.save.owner!==owner)return;
   this.archive={name:SLOT,uuid,fileId:result.fileId};
   // Keep local unsynced progress addressable by the container's stable slot ID.
   this.save.moveAccount('archive:'+uuid);
   this.save.markSynced(revision);this.retryAt=0;this.states.cloud='ready';this.state(this.save.cloudDirty?'待同步':'云存档已同步');
  }catch(e){this.retryAt=Date.now()+WINDOW;this.failure('cloud','upload',e);this.state('云同步失败，稍后重试')}
  finally{this.syncing=false}
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
  try{await tapCall(this.api!.getLeaderboardManager!(),'submitScores',{scores},true);this.ranked={levels,stars};this.states.leaderboard='ready'}
  catch(e){this.failure('leaderboard','submitScores',e)}finally{this.rankBusy=false}
 }
 async openBoard(stars=false):Promise<boolean>{
  if(!this.boardAvailable(stars))return false;
  try{await tapCall(this.api!.getLeaderboardManager!(),'openLeaderboard',{leaderboardId:stars?this.config.starsBoard:this.config.levelsBoard,collection:'public'},true);this.states.leaderboard='ready';return true}
  catch(e){this.failure('leaderboard','openLeaderboard',e);return false}
 }
 async reportReady(costTime:number):Promise<void>{
  if(this.reportSent||!this.capabilities.report)return;this.reportSent=true;
  try{await tapCall(this.api as unknown as Manager,'reportScene',{sceneId:7,costTime:Number.isFinite(costTime)?Math.max(0,Math.round(costTime)):0});this.states.report='ready'}
  catch(e){this.failure('report','reportScene',e)}
 }
 async rewarded():Promise<boolean|null>{
  if(this.adBusy||!this.adsAvailable)return null;
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
 dispose():void{this.disposed=true;if(this.retryTimer)clearTimeout(this.retryTimer);this.retryTimer=null}
}
