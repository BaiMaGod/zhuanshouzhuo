import C0 from './core.js';
import type {CoreAPI} from './types.js';

const C=C0 as unknown as CoreAPI;
export const BURST_FIRE_ASSET='assets/art-rose/burst-fire.webp';
export const BURST_FIRE_EXTENT=68;
const columns=4,rows=4,frameCount=8,frameMs=75;
const edge=BURST_FIRE_EXTENT;
const vertices=new Float32Array([-edge,-edge,edge,-edge,edge,edge,-edge,edge]);
const indices=new Uint16Array([0,1,2,0,2,3]);
function frameUV(frame:number,rowOffset:number):Float32Array{
 const left=(frame%columns)/columns;
 const top=(Math.floor(frame/columns)+rowOffset)/rows;
 return new Float32Array([left,top,left+1/columns,top,left+1/columns,top+1/rows,left,top+1/rows]);
}
const frames=Array.from({length:frameCount},(_,frame)=>({
 rim:frameUV(frame,0),surface:frameUV(frame,rows/2)
}));
const gap=Math.asin(C.GAP/(2*(C.R-C.BAND/2)))+.23;

export class BurstFire extends Laya.Sprite {
 private frame=-1;
 private particleStep=-1;
 private flame=new Laya.Sprite();
 readonly surface=new Laya.Sprite();
 private embers=new Laya.Sprite();
 private atlasTexture=Laya.loader.getRes(BURST_FIRE_ASSET);

 constructor(private phaseOffset:number){
  super();
  this.name='burst-fire';
  this.mouseEnabled=false;
  this.surface.mouseEnabled=false;
  this.surface.name='burst-fire-surface';
  this.addChild(this.flame);
  this.addChild(this.embers);
 }

 update(now:number,quiet:boolean,release:number):void{
  const frame=quiet?0:(Math.floor(now/frameMs)+this.phaseOffset)%frameCount;
  if(frame!==this.frame){
   this.frame=frame;
   const g=this.flame.graphics;
   g.clear();
   g.drawTriangles(this.atlasTexture,0,0,vertices,frames[frame].rim,indices);
   const surface=this.surface.graphics;
   surface.clear();
   surface.drawTriangles(this.atlasTexture,0,0,vertices,frames[frame].surface,indices);
  }

  const flare=quiet?0:Math.sin(Math.PI*Math.min(1,release*1.7));
  this.flame.scale(1+.12*flare,1+.12*flare);
  this.alpha=1-.66*release;
  this.surface.alpha=this.alpha;
  const step=quiet?-2:Math.floor(now/32);
  if(release===0&&step===this.particleStep)return;
  this.particleStep=release>0?-1:step;
  const particles=this.embers.graphics;
  particles.clear();
  if(quiet)return;

  if(release===0){
   const lift=Math.sin(now/260)*1.1;
   particles.drawCircle(0,lift,3.1,'rgba(255,96,18,0.17)');
   particles.drawCircle(0,lift,1.65,'rgba(255,159,24,0.89)');
   particles.drawCircle(0,lift,.7,'#fff3ba');
  }
  const count=release>0?10:4;
  for(let i=0;i<count;i++){
   const seed=i*.61803398875;
   const progress=release>0?release:(now/(840+i*77)+seed)%1;
   const angle=gap+(Math.PI*2-2*gap)*(i+.5)/count+progress*.12;
   const radius=release>0?C.R+8+progress*(22+(i%3)*8):C.R+7+progress*(9+(i%3)*3);
   const alpha=(1-progress)*Math.min(1,progress*8);
   const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
   particles.drawCircle(x,y,1.65,'rgba(255,91,15,'+alpha*.24+')');
   particles.drawCircle(x,y,.65+(i%3)*.16,'rgba(255,194,45,'+alpha+')');
  }
 }
}
