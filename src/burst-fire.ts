import C0 from './core.js';
import type {CoreAPI} from './types.js';

const C=C0 as unknown as CoreAPI;
const inner=C.R-C.BAND/2,outer=C.R+C.BAND/2;
const gap=Math.asin(C.GAP/(2*inner))+.065;
const sweep=Math.PI*2-2*gap;
const frameCount=16;
// The jade body sits above the flame roots, leaving its full texture visible.
const fireEdges=[inner+2,outer-2];

// Keep the tongues in local ring coordinates so the empty sector follows the gap.
function point(angle:number,radius:number):number[]{
 return [Math.cos(angle)*radius,Math.sin(angle)*radius];
}

function flame(angle:number,radius:number,direction:number,width:number,height:number,bend:number):unknown[]{
 const at=(offset:number,lift:number)=>point(angle+offset*width,radius+lift*height*direction);
 let from=at(-.52,0);
 const path:unknown[]=[['moveTo',...from]];
 const curves=[
  [at(-.52,.34),at(-.12,.55)],
  [at(.28,.75),at(bend,1)],
  [at(.64,.75),at(.36,.42)],
  [at(.76,.22),at(.53,0)]
 ];
 for(const [control,to] of curves){
  for(let step=1;step<=4;step++){
   const t=step/4,rest=1-t;
   path.push(['lineTo',
    rest*rest*from[0]+2*rest*t*control[0]+t*t*to[0],
    rest*rest*from[1]+2*rest*t*control[1]+t*t*to[1]
   ]);
  }
  from=to;
 }
 return [...path,['closePath']];
}

const rims=fireEdges.map(radius=>Array.from({length:65},(_,i)=>
 [i?'lineTo':'moveTo',...point(gap+sweep*i/64,radius)]
));

const frames=Array.from({length:frameCount},(_,frame)=>{
 const phase=frame*Math.PI*2/frameCount;
 return fireEdges.flatMap((radius,side)=>{
  const direction=side?1:-1,count=side?15:12,step=sweep/count;
  return Array.from({length:count},(_,i)=>{
   const angle=gap+step*(i+.5);
   const wave=Math.sin(phase+i*1.93+side);
   const height=(side?6:8)+(i*5%7)*1.7+wave*2.2+(i%5===2?6:0);
   const bend=.38+.66*Math.cos(phase+i*2.1);
   return {
    base:flame(angle,radius,direction,step*(.92+(i%3)*.10),height,bend),
    core:flame(angle-step*.09,radius,direction,step*.67,height*.76,bend*.85),
    highlight:flame(angle+step*.06,radius,direction,step*.30,height*.56,bend-.3),
    filament:flame(angle-step*.18,radius,direction,step*.13,height*.66,bend+.25)
   };
  });
 });
});

export class BurstFire extends Laya.Sprite {
 private frame=-1;

 constructor(){
  super();
  this.name='burst-fire';
  this.mouseEnabled=false;
 }

 update(now:number,quiet:boolean,release:number):void{
  const frame=quiet?0:Math.floor(now/75)%frameCount;
  if(frame!==this.frame){
   this.frame=frame;
   const g=this.graphics;
   g.clear();
   for(const rim of rims){
    g.drawPath(0,0,rim,undefined,{strokeStyle:'rgba(192,22,9,0.07)',lineWidth:27});
    g.drawPath(0,0,rim,undefined,{strokeStyle:'rgba(212,34,8,0.13)',lineWidth:20});
    g.drawPath(0,0,rim,undefined,{strokeStyle:'rgba(232,55,8,0.24)',lineWidth:13});
   }
   for(const {base,core,highlight,filament} of frames[frame]){
    g.drawPath(0,0,base,{fillStyle:'rgba(206,30,9,0.94)'});
    g.drawPath(0,0,core,{fillStyle:'rgba(255,101,8,0.97)'});
    g.drawPath(0,0,highlight,{fillStyle:'#ffba21'});
    g.drawPath(0,0,filament,{fillStyle:'rgba(255,223,80,0.80)'});
   }
   const ember=quiet?0:Math.sin(frame*Math.PI*2/frameCount);
   g.drawCircle(0,ember*1.7,4.1,'rgba(255,112,16,0.17)');
   g.drawCircle(0,ember*1.7,2.2,'rgba(255,154,24,0.92)');
   g.drawCircle(0,ember*1.7,1,'#fff0a7');
   for(let i=0;i<3;i++){
    const age=(frame+i*5)%frameCount/frameCount;
    const angle=gap+sweep*(i+1)/4+age*.08;
    const [x,y]=point(angle,inner-9-age*10);
    const color=age<.55?'#ffcd54':'#ec641b';
    g.drawCircle(x,y,1.15-age*.65,color);
   }
  }
  const flare=quiet?0:Math.sin(Math.PI*Math.min(1,release*2.2));
  this.scale(1+.09*flare,1+.09*flare);
  this.alpha=1-.55*release;
 }
}
