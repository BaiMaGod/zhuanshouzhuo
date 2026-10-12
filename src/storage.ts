export interface Progress {version:1;unlocked:number;records:Record<string,{steps:number;stars:number}>;sound:boolean}
const KEY='jade-bracelet-laya-v1';
export class Save {
 data:Progress={version:1,unlocked:0,records:{},sound:true};
 constructor(){
  try {
   const p=JSON.parse(localStorage.getItem(KEY)||'null');
   if(p?.version===1){
    if(Number.isInteger(p.unlocked))this.data.unlocked=Math.max(0,Math.min(9,p.unlocked));
    if(typeof p.sound==='boolean')this.data.sound=p.sound;
    if(p.records&&typeof p.records==='object')for(const [i,r] of Object.entries(p.records)){
     const v=r as {steps:number;stars:number};
     if(/^\d$/.test(i)&&Number.isFinite(v.steps)&&v.steps>=0&&Number.isInteger(v.stars)&&v.stars>=1&&v.stars<=3)this.data.records[i]=v;
    }
   }
  } catch {}
 }
 persist():void {try{localStorage.setItem(KEY,JSON.stringify(this.data))}catch{}}
 win(index:number,steps:number,baseline:number):number{
  const stars=steps<=baseline+2?3:steps<=baseline+6?2:1;
  const old=this.data.records[index];
  this.data.records[index]={steps:old?Math.min(old.steps,steps):steps,stars:old?Math.max(old.stars,stars):stars};
  this.data.unlocked=Math.max(this.data.unlocked,Math.min(9,index+1));this.persist();return stars;
 }
}
