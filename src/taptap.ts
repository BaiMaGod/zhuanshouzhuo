import {TAP_CONFIG} from './taptap-config.js';
import {Save} from './storage.js';
type Options=Record<string,unknown>;
interface Manager {[method:string]:(options:Options)=>unknown}
interface Ad {load():Promise<void>;show():Promise<void>;onClose(fn:(r?:{isEnded?:boolean})=>void):void;onError(fn:(e:unknown)=>void):void;offClose(fn:(r?:{isEnded?:boolean})=>void):void;offError(fn:(e:unknown)=>void):void}
export interface TapAPI {login(options:Options):void;request(options:Options):void;getCloudSaveManager():Manager;getFileSystemManager():Manager;getLeaderboardManager():Manager;createRewardedVideoAd(options:{adUnitId:string}):Ad;env:{USER_DATA_PATH:string}}
function runtime():TapAPI|undefined{return (globalThis as {tap?:TapAPI}).tap}
function configured(value:string):boolean{return !!value&&!value.startsWith('__')}
// Runtime APIs use success/fail except leaderboard APIs, which use callback.
export function tapCall<T>(manager:Manager,method:string,options:Options={},board=false):Promise<T>{
 return new Promise((resolve,reject)=>{
  let finished=false;const timer=setTimeout(()=>end(false,Error('平台响应超时，请重试')),15000);
  const end=(ok:boolean,value:unknown)=>{if(finished)return;finished=true;clearTimeout(timer);ok?resolve(value as T):reject(value)};
  const success=(r:unknown)=>end(true,r),fail=(r:unknown)=>end(false,r);
  try{if(typeof manager[method]!=='function')throw Error('当前客户端不支持此功能');
   const result=manager[method]({...options,...(board?{callback:{onSuccess:success,onFailure:(code:unknown,message:unknown)=>fail({code,message})}}:{success,fail})});
   if(result&&typeof (result as Promise<T>).then==='function')(result as Promise<T>).then(success,fail);
  }catch(e){fail(e)}
 });
}
export class TapPlatform {
 readonly api:TapAPI|undefined;
 status='本地存档';ready=false;adBusy=false;syncing=false;
 onChange:()=>void=()=>{};
 private archive:{uuid:string;fileId:string}|null=null;
 private lastAttempt=0;private retryAt=0;private ad:Ad|null=null;
 private loginTask:Promise<void>|null=null;
 private syncTask:Promise<void>|null=null;
 private lastRankAt=0;private rankedSignature='';
 constructor(readonly save:Save,readonly debug=false,api=runtime(),readonly config=TAP_CONFIG){this.api=api}
 get available():boolean{return !!this.api}
 get adsAvailable():boolean{return !!this.api&&configured(this.config.rewardedAdUnitId)}
 private state(message:string):void{this.status=message;this.onChange()}
 localChanged():void{if(this.ready&&!this.syncing)this.state('待同步')}
 login():Promise<void>{
  if(this.loginTask)return this.loginTask;
  this.loginTask=this.connect().finally(()=>{this.loginTask=null});return this.loginTask;
 }
 private async connect():Promise<void>{
  if(!this.api)return;
  if(!configured(this.config.loginUrl)){this.state('登录服务待配置');return}
  this.ready=false;this.pendingCloud=null;this.state('正在登录…');
  if(this.syncTask)await this.syncTask;
  try{
   const {code}=await tapCall<{code:string}>(this.api as unknown as Manager,'login',{timeout:12000});
   if(!code)throw Error('未取得登录凭证');
   const response=await tapCall<{statusCode:number;data:{openid?:string}}>(this.api as unknown as Manager,'request',{url:this.config.loginUrl,method:'POST',header:{'content-type':'application/json'},data:{code},timeout:12000});
   if(response.statusCode!==200||typeof response.data.openid!=='string'||!response.data.openid)throw Error('登录验证失败');
   this.save.bindAccount(response.data.openid);this.archive=null;this.rankedSignature='';this.lastRankAt=0;
   const remote=await this.download();
   // A divergent in-progress board requires a user decision before uploads.
   if(remote&&this.save.hasRunConflict(remote)){
    this.pendingCloud=remote;this.state('存档冲突待选择');return;
   }
   if(remote)this.save.mergeCloud(remote);
   this.ready=true;this.state('已登录 · 待同步');await this.sync();
  }catch{this.state('登录或读取存档失败，点击重试')}
 }
 pendingCloud:unknown=null;
 resolveConflict(useCloud:boolean):void{
  if(!this.pendingCloud)return;
  this.save.mergeCloud(this.pendingCloud,useCloud);this.pendingCloud=null;this.ready=true;
  this.state('已登录 · 待同步');void this.sync();
 }
 private async download():Promise<unknown|null>{
  const api=this.api!,cloud=api.getCloudSaveManager(),fs=api.getFileSystemManager();
  const {saves}=await tapCall<{saves:Array<{name:string;uuid:string;fileId:string}>}>(cloud,'getArchiveList');
  const slot=saves.find(s=>s.name==='jade_save_v1');if(!slot)return null;
  this.archive=slot;const targetFilePath=api.env.USER_DATA_PATH+'/jade_download.json';
  const file=await tapCall<{filePath:string}>(cloud,'getArchiveData',{archiveUUID:slot.uuid,archiveFileId:slot.fileId,targetFilePath});
  const {data}=await tapCall<{data:string}>(fs,'readFile',{filePath:file.filePath,encoding:'utf8'});
  return JSON.parse(data);
 }
 sync():Promise<void>{
  if(this.syncTask)return this.syncTask;
  this.syncTask=this.syncNow().finally(()=>{this.syncTask=null});return this.syncTask;
 }
 private async syncNow():Promise<void>{
  if(this.api&&this.ready&&!this.save.cloudDirty){void this.submitScores().catch(()=>{});return}
  if(!this.api||!this.ready||this.syncing||!this.save.cloudDirty||Date.now()<this.retryAt||Date.now()-this.lastAttempt<61000)return;
  this.syncing=true;this.lastAttempt=Date.now();this.state('正在同步…');
  const revision=this.save.revision;
  try{
   const filePath=this.api.env.USER_DATA_PATH+'/jade_save.json';
   await tapCall(this.api.getFileSystemManager(),'writeFile',{filePath,data:JSON.stringify(this.save.exportCloud()),encoding:'utf8'});
   const result=await tapCall<{uuid:string;fileId:string}>(this.api.getCloudSaveManager(),this.archive?'updateArchive':'createArchive',{
    ...(this.archive?{archiveUUID:this.archive.uuid}:{}),archiveMetaData:{name:'jade_save_v1',summary:'Jade bracelet progress',extra:JSON.stringify({revision})},archiveFilePath:filePath
   });
   this.archive={uuid:result.uuid||this.archive!.uuid,fileId:result.fileId};
   this.save.markSynced(revision);this.state(this.save.cloudDirty?'待同步':'云存档已同步');
   await this.submitScores().catch(()=>{});
  }catch{this.retryAt=Date.now()+61000;this.state('云同步失败，稍后重试')}finally{this.syncing=false}
 }
 async submitScores():Promise<void>{
  if(!this.ready||!this.api||this.debug)return;
  const records=Object.entries(this.save.rankRecords).filter(([i])=>Number(i)>=10);
  if(!records.length)return;
  const signature=JSON.stringify(records);if(signature===this.rankedSignature||Date.now()-this.lastRankAt<61000)return;this.lastRankAt=Date.now();
  await tapCall(this.api.getLeaderboardManager(),'submitScores',{scores:[{leaderboardId:this.config.levelsBoard,score:records.length},{leaderboardId:this.config.starsBoard,score:records.reduce((sum,[,r])=>sum+r.stars,0)}]},true);
  this.rankedSignature=signature;
 }
 async openBoard(stars=false):Promise<void>{
  if(!this.ready||!this.api)throw Error('请先登录并同步存档');
  await tapCall(this.api.getLeaderboardManager(),'openLeaderboard',{leaderboardId:stars?this.config.starsBoard:this.config.levelsBoard},true);
 }
 async rewarded():Promise<boolean>{
  if(this.adBusy)throw Error('广告播放中');
  if(!this.api||!this.adsAvailable)throw Error('广告暂不可用');
  if(!this.ready)throw Error('请先登录');
  this.adBusy=true;
  try{
   const ad=this.ad??=this.api.createRewardedVideoAd({adUnitId:this.config.rewardedAdUnitId});
   return await new Promise<boolean>((resolve,reject)=>{
    let done=false,shown=false;
    const finish=(value:boolean,error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);ad.offClose(close);ad.offError(fail);error?reject(Error('广告暂不可用，请稍后再试')):resolve(value)};
    const close=(r?:{isEnded?:boolean})=>finish(shown&&r?.isEnded===true);
    const fail=(e:unknown)=>finish(false,e||Error('广告失败'));
    const timer=setTimeout(()=>fail(Error('广告超时')),180000);
    ad.onClose(close);ad.onError(fail);
    // Mark before show: some runtimes dispatch close before the show Promise resolves.
    const show=async()=>{try{shown=true;await ad.show()}catch{shown=false;await ad.load();if(done)return;shown=true;await ad.show()}};
    void show().catch(fail);
   });
  }finally{this.adBusy=false}
 }
}
