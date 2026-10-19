import {Core} from './model.js';
import type {State} from './types.js';
import {TEACHING_COUNT,FORMAL_INDEX,LEGACY_FORMAL_INDEX} from './levels.js';
export interface Progress {version:2;unlocked:number;records:Record<string,{steps:number;stars:number}>;sound:boolean;tutorial:number}
const LEGACY_KEY='jade-bracelet-laya-v1';
export type RewardKind='hint'|'erase';
export type RewardSource='video'|'share';
type RewardKey=RewardKind|'shareHint'|'shareErase';
const REWARD_KEYS:RewardKey[]=['hint','erase','shareHint','shareErase'];
const rewardKey=(kind:RewardKind,source:RewardSource):RewardKey=>source==='video'?kind:kind==='hint'?'shareHint':'shareErase';
interface Reward {claimed:boolean;remaining:number;generation?:number}
interface SaveMeta {revision:number;dirty:boolean;tainted:boolean;rankRecords:Progress['records'];rewards:Record<string,Partial<Record<RewardKey,Reward>>>}
interface CloudSave {version:1;owner:string;progress:Progress;runs:Record<string,unknown>;meta:SaveMeta}
const freshProgress=():Progress=>({version:2,unlocked:0,records:{},sound:true,tutorial:0});
export class Save {
 private key=LEGACY_KEY;
 owner='';
 meta:SaveMeta={revision:0,dirty:false,tainted:false,rankRecords:{},rewards:{}};
 onChange:()=>void=()=>{};
 get cloudDirty():boolean{return this.meta.dirty}
 get revision():number{return this.meta.revision}
 get rankTainted():boolean{return this.meta.tainted}
 get rankRecords():Progress['records']{return this.meta.rankRecords}
 private changed():void{this.meta.revision++;this.meta.dirty=true;Laya.LocalStorage.setItem(this.key+'-meta',JSON.stringify(this.meta));this.onChange()}
 private runCache=new Map<number,string>();
 data:Progress={version:2,unlocked:0,records:{},sound:true,tutorial:0};
 constructor(key=LEGACY_KEY){
  this.key=key;
  try{const m=JSON.parse(Laya.LocalStorage.getItem(key+'-meta')||'null');if(m)this.meta=validateMeta(m)}catch{}
  try {
   const p=JSON.parse(Laya.LocalStorage.getItem(this.key)||'null');
   if(p?.version===1||p?.version===2){
    if(Number.isInteger(p.unlocked))this.data.unlocked=Math.max(0,Math.min(9,p.unlocked));
    if(typeof p.sound==='boolean')this.data.sound=p.sound;
    if(Number.isInteger(p.tutorial))this.data.tutorial=Math.max(0,Math.min(3,p.tutorial));
    else if(p.records?.[0])this.data.tutorial=1;
    if(p.records&&typeof p.records==='object')for(const [i,r] of Object.entries(p.records)){
     const v=r as {steps:number;stars:number};
     if(/^(?:0|[1-9]\d*)$/.test(i)&&Number(i)<1000&&Number.isFinite(v.steps)&&v.steps>=0&&Number.isInteger(v.stars)&&v.stars>=1&&v.stars<=3)this.data.records[p.version===1&&Number(i)===FORMAL_INDEX?LEGACY_FORMAL_INDEX:i]=v;
    }
    // Completed teaching records are authoritative if an older save has stale unlock data.
    // The separate "tutorial" field only tracks the first three guide prompts.
    let repaired=false;
    for(let i=0;i<TEACHING_COUNT;i++)if(this.data.records[i]&&this.data.unlocked<Math.min(TEACHING_COUNT-1,i+1)){
     this.data.unlocked=Math.min(TEACHING_COUNT-1,i+1);repaired=true;
    }
    // Migrate old scores only once and preserve all completed levels across reloads.
    if(p.version===1||repaired)this.persist();
   }
  } catch {}
 }
 readRun(index:number):{state:State;hint:number;erase:number;hintProgress?:number}|null{
  try{
   const r=JSON.parse(Laya.LocalStorage.getItem(this.key+'-run-'+index)||'null');
   if(!validRun(r,index))return null;
   return r;
  }catch{return null}
 }
 writeRun(index:number,state:State,hint:number,erase:number,hintProgress=0):void{
  try{const payload=JSON.stringify({version:1,levelRevision:Core.levels[index].revision||0,state,hint,erase,hintProgress});if(this.runCache.get(index)===payload)return;Laya.LocalStorage.setItem(this.key+'-run-'+index,payload);this.runCache.set(index,payload);this.changed()}catch{}
 }
 clearRun(index:number):void{this.runCache.delete(index);try{Laya.LocalStorage.setItem(this.key+'-run-'+index,'null');this.changed()}catch{}}
 persist():void {try{Laya.LocalStorage.setItem(this.key,JSON.stringify(this.data));this.changed()}catch{}}
 // Device/account-scoped onboarding gate; do not change the versioned cloud save.
 shouldAutoStartTutorial():boolean{
  try{
   if(Laya.LocalStorage.getItem(this.key+'-tutorial-opened')==='1')return false;
   if(this.data.unlocked>0||this.data.tutorial>0||Object.keys(this.data.records).length>0)return false;
   // Older saves might contain an unfinished formal board without a completed level.
   for(let i=TEACHING_COUNT;i<Core.levels.length;i++){
    const run=Laya.LocalStorage.getItem(this.key+'-run-'+i);
    if(run&&run!=='null')return false;
   }
   return true;
  }catch{return false}
 }
 markTutorialOpened():void{
  try{Laya.LocalStorage.setItem(this.key+'-tutorial-opened','1')}catch{}
 }
 bindAccount(owner:string,preserveSession=false):void{
  if(owner===this.owner)return;
  if(!owner||owner.length>256)throw Error('Invalid account');
  const current=preserveSession?this.exportCloud():null;
  const key=LEGACY_KEY+'-tap-'+encodeURIComponent(owner),saved=new Save(key);
  this.key=key;this.owner=owner;this.data=saved.data;this.meta=saved.meta;this.runCache.clear();
  if(current){current.owner=owner;this.mergeCloud(current)}
 }
 beginContainerSession():void{
  const id=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
  this.bindAccount('session:'+id);this.rememberScope();
 }
 private rememberScope():void{
  try{const scopes=JSON.parse(Laya.LocalStorage.getItem(LEGACY_KEY+'-recovery')||'[]');Laya.LocalStorage.setItem(LEGACY_KEY+'-recovery',JSON.stringify([this.owner,...(Array.isArray(scopes)?scopes:[]).filter(x=>typeof x==='string'&&x!==this.owner)].slice(0,16)))}catch{}
 }
 moveAccount(owner:string):void{
  if(owner===this.owner)return;
  const snapshot=this.exportCloud(),oldOwner=this.owner,opened=Laya.LocalStorage.getItem(this.key+'-tutorial-opened');
  this.key=LEGACY_KEY+'-tap-'+encodeURIComponent(owner);this.owner=owner;this.runCache.clear();
  Laya.LocalStorage.setItem(this.key,JSON.stringify(this.data));Laya.LocalStorage.setItem(this.key+'-meta',JSON.stringify(this.meta));
  for(let i=TEACHING_COUNT;i<Core.levels.length;i++)Laya.LocalStorage.setItem(this.key+'-run-'+i,JSON.stringify(snapshot.runs[i]??null));
  if(opened)Laya.LocalStorage.setItem(this.key+'-tutorial-opened',opened);
  try{const scopes=JSON.parse(Laya.LocalStorage.getItem(LEGACY_KEY+'-recovery')||'[]');if(Array.isArray(scopes))Laya.LocalStorage.setItem(LEGACY_KEY+'-recovery',JSON.stringify(scopes.filter(x=>x!==oldOwner)))}catch{}
  this.rememberScope();
 }
 private recoveryOwner():string|null{
  try{const scopes=JSON.parse(Laya.LocalStorage.getItem(LEGACY_KEY+'-recovery')||'[]');
   if(Array.isArray(scopes))for(const owner of scopes)if(typeof owner==='string'&&owner!==this.owner){const s=new Save(LEGACY_KEY+'-tap-'+encodeURIComponent(owner));if(Object.keys(s.data.records).length||Object.keys(s.exportCloud().runs).length)return owner}
  }catch{}return null;
 }
 hasRecoveryProgress():boolean{return !!this.recoveryOwner()}
 importRecovery():void{
  const owner=this.recoveryOwner();if(!owner)return;
  const value=new Save(LEGACY_KEY+'-tap-'+encodeURIComponent(owner)).exportCloud();value.owner=this.owner;value.meta.tainted=true;value.meta.rankRecords={};this.mergeCloud(value);
 }
 resetRewards(index:number):void{
  const items=this.meta.rewards[index];
  const generation=Math.max(0,...REWARD_KEYS.map(key=>items?.[key]?.generation||0))+1;
  this.meta.rewards[index]=Object.fromEntries(REWARD_KEYS.map(key=>[key,{claimed:false,remaining:0,generation}]));this.changed();
 }
 canClaim(index:number,kind:RewardKind,source:RewardSource='video'):boolean{return !this.meta.rewards[index]?.[rewardKey(kind,source)]?.claimed}
 claim(index:number,kind:RewardKind,source:RewardSource='video'):boolean{
  if(!this.canClaim(index,kind,source))return false;
  const key=rewardKey(kind,source);
  (this.meta.rewards[index]??={})[key]={claimed:true,remaining:1,generation:this.meta.rewards[index]?.[key]?.generation||0};this.changed();return true;
 }
 rewardLeft(index:number,kind:RewardKind):number{return (['video','share'] as const).reduce((sum,source)=>sum+(this.meta.rewards[index]?.[rewardKey(kind,source)]?.remaining||0),0)}
 consumeReward(index:number,kind:RewardKind):boolean{
  for(const source of ['video','share'] as const){const reward=this.meta.rewards[index]?.[rewardKey(kind,source)];if(reward?.remaining){reward.remaining=0;this.changed();return true}}
  return false;
 }
 taint():void{if(!this.meta.tainted){this.meta.tainted=true;this.changed()}}
 markSynced(revision:number):void{if(revision===this.revision){this.meta.dirty=false;Laya.LocalStorage.setItem(this.key+'-meta',JSON.stringify(this.meta))}}
 exportCloud():CloudSave{
  const runs:Record<string,unknown>={};
  for(let i=TEACHING_COUNT;i<Core.levels.length;i++){
   const run=this.readRun(i);if(run)runs[i]=run;
  }
  return JSON.parse(JSON.stringify({version:1,owner:this.owner,progress:this.data,runs,meta:this.meta}));
 }
 hasRunConflict(value:unknown):boolean{
  const cloud=validateCloud(value,this.owner),local=this.exportCloud();
  return Object.entries(cloud.runs).some(([i,r])=>local.runs[i]&&JSON.stringify(local.runs[i])!==JSON.stringify(r));
 }
 mergeCloud(value:unknown,preferCloud=false):void{
  const cloud=validateCloud(value,this.owner);
  for(const [i,r] of Object.entries(cloud.progress.records)){
   const old=this.data.records[i];this.data.records[i]={steps:old?Math.min(old.steps,r.steps):r.steps,stars:old?Math.max(old.stars,r.stars):r.stars};
  }
  this.data.unlocked=Math.max(this.data.unlocked,cloud.progress.unlocked);this.data.tutorial=Math.max(this.data.tutorial,cloud.progress.tutorial);
  this.meta.revision=Math.max(this.meta.revision,cloud.meta.revision);
  this.meta.tainted ||= cloud.meta.tainted;
  for(const [i,r] of Object.entries(cloud.meta.rankRecords)){
   const old=this.meta.rankRecords[i];this.meta.rankRecords[i]={steps:old?Math.min(old.steps,r.steps):r.steps,stars:old?Math.max(old.stars,r.stars):r.stars};
  }
  for(const [i,items] of Object.entries(cloud.meta.rewards))for(const kind of REWARD_KEYS){
   const remote=items[kind];if(!remote)continue;
   const local=this.meta.rewards[i]?.[kind];
   if((local?.generation||0)!==(remote.generation||0)){
    if((remote.generation||0)>(local?.generation||0))(this.meta.rewards[i]??={})[kind]={...remote};
    continue;
   }
   // Never resurrect a spent reward when merging a stale cloud snapshot.
   (this.meta.rewards[i]??={})[kind]={generation:local?.generation||remote.generation||0,claimed:!!(local?.claimed||remote.claimed),remaining:local?.claimed&&remote.claimed?Math.min(local.remaining,remote.remaining):local?.claimed?local.remaining:remote.remaining};
  }
  for(const [i,r] of Object.entries(cloud.runs))if(preferCloud||!this.readRun(Number(i))){
   Laya.LocalStorage.setItem(this.key+'-run-'+i,JSON.stringify(r));
   if(!this.readRun(Number(i)))Laya.LocalStorage.setItem(this.key+'-run-'+i,'null');
  }
  this.runCache.clear();this.persist();
 }
 hasGuestProgress():boolean{return Object.keys(new Save().data.records).length>0||!!new Save().readRun(10)}
 importGuest():void{
  const guest=new Save().exportCloud();guest.owner=this.owner;
  // Legacy preview progress may have been produced with Debug; never rank it.
  guest.meta.tainted=true;guest.meta.rankRecords={};this.mergeCloud(guest);this.changed();
 }
 win(index:number,steps:number,baseline:number,ranked=true):number{
  const stars=steps<=baseline+2?3:steps<=baseline+6?2:1;
  if(ranked&&index>=TEACHING_COUNT){const old=this.meta.rankRecords[index];this.meta.rankRecords[index]={steps:old?Math.min(old.steps,steps):steps,stars:old?Math.max(old.stars,stars):stars}}
  const old=this.data.records[index];
  this.data.records[index]={steps:old?Math.min(old.steps,steps):steps,stars:old?Math.max(old.stars,stars):stars};
  if(index<10)this.data.unlocked=Math.max(this.data.unlocked,Math.min(9,index+1));this.persist();return stars;
 }
}



function validateMeta(value:unknown):SaveMeta{
 const m=value as SaveMeta;if(!m||!Number.isSafeInteger(m.revision)||m.revision<0||typeof m.dirty!=='boolean'||typeof m.tainted!=='boolean'||!m.rewards||typeof m.rewards!=='object')throw Error('Invalid save metadata');
 const rewards:SaveMeta['rewards']={};
 for(const [i,items] of Object.entries(m.rewards)){
  if(!/^(?:0|[1-9]\d*)$/.test(i)||Number(i)>=Core.levels.length||!items||typeof items!=='object')throw Error('Invalid reward');
  for(const kind of REWARD_KEYS){const r=items[kind];if(r){if(r.generation!==undefined&&(!Number.isSafeInteger(r.generation)||r.generation<0)||typeof r.claimed!=='boolean'||![0,1].includes(r.remaining)||!r.claimed&&r.remaining!==0)throw Error('Invalid reward');(rewards[i]??={})[kind]={claimed:r.claimed,remaining:r.remaining,generation:r.generation||0}}};
 }
 const rankRecords:Progress['records']={};
 for(const [i,r] of Object.entries(m.rankRecords||{})){
  if(!/^(?:0|[1-9]\d*)$/.test(i)||Number(i)<TEACHING_COUNT||Number(i)>=Core.levels.length||!r||!Number.isInteger(r.steps)||r.steps<0||!Number.isInteger(r.stars)||r.stars<1||r.stars>3)throw Error('Invalid ranked score');
  rankRecords[i]={steps:r.steps,stars:r.stars};
 }
 return {revision:m.revision,dirty:m.dirty,tainted:m.tainted,rankRecords,rewards};
}
function validateCloud(value:unknown,owner:string):CloudSave{
 const v=value as CloudSave;
 if(!v||v.version!==1||v.owner!==owner||!v.progress||v.progress.version!==2||!v.runs||typeof v.runs!=='object')throw Error('Invalid cloud save');
 const p=v.progress,progress=freshProgress();
 if(!Number.isInteger(p.unlocked)||p.unlocked<0||p.unlocked>=TEACHING_COUNT||!Number.isInteger(p.tutorial)||p.tutorial<0||p.tutorial>3||typeof p.sound!=='boolean'||!p.records||typeof p.records!=='object')throw Error('Invalid progress');
 progress.unlocked=p.unlocked;progress.tutorial=p.tutorial;progress.sound=p.sound;
 for(const [i,r] of Object.entries(p.records)){
  if(!/^(?:0|[1-9]\d*)$/.test(i)||Number(i)>=Core.levels.length||!r||!Number.isInteger(r.steps)||r.steps<0||!Number.isInteger(r.stars)||r.stars<1||r.stars>3)throw Error('Invalid score');
  progress.records[i]={steps:r.steps,stars:r.stars};
 }
 for(const [i,run] of Object.entries(v.runs))if(!/^(?:0|[1-9]\d*)$/.test(i)||Number(i)<TEACHING_COUNT||Number(i)>=Core.levels.length||!validRun(run,Number(i)))throw Error('Invalid run');
 return {version:1,owner,progress,runs:v.runs,meta:validateMeta(v.meta)};
}

function validRun(value:unknown,index:number):boolean{
 try{
  const r=value as {version:number;levelRevision:number;hint:number;erase:number;hintProgress?:number;state:State},initial=Core.make(index);
   if(!r||r.version!==1||(r.levelRevision||0)!==(Core.levels[index].revision||0)||![0,1].includes(r.hint)||![0,1].includes(r.erase)||r.hintProgress!==undefined&&(!Number.isInteger(r.hintProgress)||r.hintProgress<0||r.hintProgress>10000))return false;
   const s=r.state as State;
   if(!s||!Number.isFinite(s.steps)||s.steps<0||s.rings?.length!==initial.rings.length||s.rods?.length!==initial.rods.length)return false;
   if(s.rings.some((v,i)=>v.id!==initial.rings[i].id||!Number.isFinite(v.a)||!['active','removed'].includes(v.life)))return false;
   if(s.index!==index||s.rings.some((v,i)=>v.x!==initial.rings[i].x||v.y!==initial.rings[i].y)||JSON.stringify(s.rods)!==JSON.stringify(initial.rods))return false;
   if(!s.states||initial.rods.some(z=>!Array.isArray(s.states[z.id])||s.states[z.id].length!==initial.states[z.id].length||s.states[z.id].some(v=>!['latched','aligned','inactive'].includes(v)))||!Array.isArray(s.events)||s.rings.every(v=>v.life==='removed'))return false;
  return true;
 }catch{return false}
}

// The container authenticates archive ownership. Validate the entire old payload
// before translating its legacy owner field to a UUID-scoped local account.
export function containerCloud(value:unknown,owner:string):CloudSave{
 const original=(value as CloudSave)?.owner;
 if(typeof original!=='string'||!original||original.length>256)throw Error('Invalid cloud owner');
 return {...validateCloud(value,original),owner};
}
