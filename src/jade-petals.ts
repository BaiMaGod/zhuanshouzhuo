import type {Point} from './types.js';
import {easeOut, glint, FEEDBACK} from './feedback.js';
import {JADE_NAMES} from './jade.js';
import type {JadeName} from './jade.js';

export const PETAL_ASSET = 'assets/art-rose/jade-petals-v2.png';
export const FLAME_PETAL_ASSET = 'assets/art-rose/flame-petals.webp';
export const FLAME_FLIGHT_MS = 320;
const PETAL_COUNT = 48;
const COLUMNS = 3;
const QUAD = new Float32Array([-6,-6, 6,-6, 6,6, -6,6]);
const INDICES = new Uint16Array([0,1,2,0,2,3]);
const FLAME_QUAD = new Float32Array([-5,-3, 5,-3, 5,15, -5,15]);
const FLAME_UVS = Array.from({length:COLUMNS}, (_, col) => {
 const a=col/COLUMNS,b=(col+1)/COLUMNS;
 return new Float32Array([a,0,b,0,b,1,a,1]);
});
const UVS = JADE_NAMES.flatMap((_, row) => Array.from({length:COLUMNS}, (_, col) => {
 const left = col/COLUMNS, right = (col+1)/COLUMNS;
 const top = row/JADE_NAMES.length, bottom = (row+1)/JADE_NAMES.length;
 return new Float32Array([left,top, right,top, right,bottom, left,bottom]);
}));

interface Petal {
 sprite:Laya.Sprite;
 variant:number;
 center:Point;
 angle:number;
 radius:number;
 start:number;
 seed:number;
 fiery:boolean;
 flight:Point|null;
}

export class JadePetals {
 private active:Petal[] = [];
 private pool:Petal[] = [];
 constructor(private layer:Laya.Sprite) {}

 get count():number {return this.active.length}

 countFor(batchSize:number):number {
  // Give every ring the same dense burst, while keeping the whole simultaneous
  // release within the shared particle budget. New releases take priority over
  // older trails so the action the player just triggered always reads clearly.
  const count = Math.min(PETAL_COUNT, Math.floor(FEEDBACK.maxParticles/batchSize));
  const discard = Math.max(0, this.active.length+count*batchSize-FEEDBACK.maxParticles);
  for (const petal of this.active.splice(0,discard)) this.recycle(petal);
  return count;
 }

 emit(center:Point, gapAngle:number, halfGap:number, radius:number, material:JadeName, start:number, count:number, fiery=false):void {
  const row = JADE_NAMES.indexOf(material);
  for (let i=0; i<count; i++) {
   const seed = (i*17+row*11)%31/30;
   const variant = row*COLUMNS+i%COLUMNS;
   // Slight deterministic angular variation breaks the perfect ring without
   // leaving a visible hole where the bracelet's opening used to be.
   const angle = gapAngle+halfGap+(360-2*halfGap)*(i+.5)/count+(seed-.5)*8;
   // Five radial bands (-6/-3/0/+3/+6) make the burst feel fuller in depth.
   this.spawn(center,angle,radius+((i%5)-2)*3,start,seed,variant,fiery,null);
  }
 }

 emitFlameFlight(center:Point,target:Point,radius:number,material:JadeName,start:number):void {
  const row=JADE_NAMES.indexOf(material),heading=Math.atan2(target.y-center.y,target.x-center.x)*180/Math.PI;
  for(let i=0;i<5;i++){
   const fan=i-2;
   this.spawn(center,heading+fan*13,radius-7,start+Math.abs(fan)*13,i/4,row*COLUMNS+i%COLUMNS,true,target);
  }
 }

 private spawn(center:Point,angle:number,radius:number,start:number,seed:number,variant:number,fiery:boolean,flight:Point|null):void {
  if(this.active.length>=FEEDBACK.maxParticles)this.recycle(this.active.shift()!);
  const petal=this.pool.pop()??{sprite:new Laya.Sprite(),variant:-1,center,angle,radius,start,seed,fiery:false,flight:null};
  if(petal.variant!==variant||petal.fiery!==fiery){
   const g=petal.sprite.graphics;
   g.clear();
   if(fiery)g.drawTriangles(Laya.loader.getRes(FLAME_PETAL_ASSET),0,0,FLAME_QUAD,FLAME_UVS[variant%COLUMNS],INDICES);
   g.drawTriangles(Laya.loader.getRes(PETAL_ASSET),0,0,QUAD,UVS[variant],INDICES);
   if(fiery)glint(g,0,-1,2.4,'rgba(255,224,142,.75)');
  }
  Object.assign(petal,{center,angle,radius,start,seed,variant,fiery,flight});
  petal.sprite.mouseEnabled=false;
  petal.sprite.alpha=0;
  this.layer.addChild(petal.sprite);
  this.active.push(petal);
 }

 draw(now:number, up:Point):void {
  let alive = 0;
  for (const petal of this.active) {
   const age = now-petal.start;
   const lifetime=petal.flight?FLAME_FLIGHT_MS-(Math.abs(petal.seed-.5)*52):FEEDBACK.particles;
   if (age>=lifetime) {
    this.recycle(petal);
    continue;
   }
   const {sprite,seed,center} = petal;
   if(petal.flight){
    const t=Math.max(0,age/lifetime),travel=t*(.64+.36*t),radians=petal.angle*Math.PI/180;
    const x=center.x+Math.cos(radians)*petal.radius,y=center.y+Math.sin(radians)*petal.radius;
    const dx=petal.flight.x-x,dy=petal.flight.y-y,bend=Math.sin(t*Math.PI)*(seed-.5)*.8;
    sprite.pos(x+dx*travel-dy*bend,y+dy*travel+dx*bend);
    sprite.rotation=Math.atan2(dy,dx)*180/Math.PI+90+Math.sin(t*Math.PI)*(seed-.5)*78;
    const size=(1.1+Math.sin(t*Math.PI)*.42)*(1-Math.abs(seed-.5)*.42);
    sprite.scale(size,size);
    sprite.alpha=Math.min(1,t*12,(1-t)*10);
    this.active[alive++]=petal;
    continue;
   }
   // First bloom rapidly away from the jade silhouette, then fan farther out.
   const burst = easeOut((age-24-seed*24)/180);
   const driftStart = FEEDBACK.release*.45+seed*55;
   const drift = Math.max(0,(age-driftStart)/(FEEDBACK.particles-driftStart));
   const emerge = easeOut((age-30-seed*25)/155);
   const fade = 1-Math.max(0,(age-560)/(FEEDBACK.particles-560));
   const angle = (petal.angle+drift*(seed-.5)*46)*Math.PI/180;
   const radius = petal.radius+burst*(10+seed*16)+(petal.fiery?burst*13:0)+easeOut(drift)*(12+seed*24);
   // A small upward bloom turns into a gentle fall as the petals disperse.
   const lift = burst*(2+seed*5)-drift*(5+seed*11);
   sprite.pos(center.x+Math.cos(angle)*radius+up.x*lift,center.y+Math.sin(angle)*radius+up.y*lift);
   sprite.rotation = petal.angle+90+(seed-.5)*(54+drift*260);
   const size = (.7+seed*.55)*(1-drift*.24);
   sprite.scale(size,size);
   sprite.alpha = emerge*fade**1.5;
   this.active[alive++] = petal;
  }
  this.active.length = alive;
 }

 reset():void {
  for (const petal of this.active) this.recycle(petal);
  this.active.length = 0;
 }

 destroy():void {
  this.reset();
  for (const petal of this.pool) petal.sprite.destroy(true);
  this.pool.length = 0;
 }

 private recycle(petal:Petal):void {
  petal.sprite.removeSelf();
  this.pool.push(petal);
 }
}
