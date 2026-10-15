import {Core} from './model.js';
import type {State} from './types.js';
import {TEACHING_COUNT,FORMAL_INDEX,LEGACY_FORMAL_INDEX} from './levels.js';
export interface Progress {version:2;unlocked:number;records:Record<string,{steps:number;stars:number}>;sound:boolean;tutorial:number}
const KEY='jade-bracelet-laya-v1';
export class Save {
 private runCache=new Map<number,string>();
 data:Progress={version:2,unlocked:0,records:{},sound:true,tutorial:0};
 constructor(){
  try {
   const p=JSON.parse(localStorage.getItem(KEY)||'null');
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
   const r=JSON.parse(localStorage.getItem(KEY+'-run-'+index)||'null'),initial=Core.make(index);
   if(!r||r.version!==1||![0,1].includes(r.hint)||![0,1].includes(r.erase)||r.hintProgress!==undefined&&(!Number.isInteger(r.hintProgress)||r.hintProgress<0||r.hintProgress>10000))return null;
   const s=r.state as State;
   if(!s||!Number.isFinite(s.steps)||s.steps<0||s.rings?.length!==initial.rings.length||s.rods?.length!==initial.rods.length)return null;
   if(s.rings.some((v,i)=>v.id!==initial.rings[i].id||!Number.isFinite(v.a)||!['active','removed'].includes(v.life)))return null;
   if(s.index!==index||s.rings.some((v,i)=>v.x!==initial.rings[i].x||v.y!==initial.rings[i].y)||JSON.stringify(s.rods)!==JSON.stringify(initial.rods))return null;
   if(!s.states||initial.rods.some(z=>!Array.isArray(s.states[z.id])||s.states[z.id].length!==initial.states[z.id].length||s.states[z.id].some(v=>!['latched','aligned','inactive'].includes(v)))||!Array.isArray(s.events)||s.rings.every(v=>v.life==='removed'))return null;
   return r;
  }catch{return null}
 }
 writeRun(index:number,state:State,hint:number,erase:number,hintProgress=0):void{
  try{const payload=JSON.stringify({version:1,state,hint,erase,hintProgress});if(this.runCache.get(index)===payload)return;localStorage.setItem(KEY+'-run-'+index,payload);this.runCache.set(index,payload)}catch{}
 }
 clearRun(index:number):void{this.runCache.delete(index);try{localStorage.setItem(KEY+'-run-'+index,'null')}catch{}}
 persist():void {try{localStorage.setItem(KEY,JSON.stringify(this.data))}catch{}}
 win(index:number,steps:number,baseline:number):number{
  const stars=steps<=baseline+2?3:steps<=baseline+6?2:1;
  const old=this.data.records[index];
  this.data.records[index]={steps:old?Math.min(old.steps,steps):steps,stars:old?Math.max(old.stars,stars):stars};
  if(index<10)this.data.unlocked=Math.max(this.data.unlocked,Math.min(9,index+1));this.persist();return stars;
 }
}


