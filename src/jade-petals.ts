import type {Point} from './types.js';
import {easeOut, FEEDBACK} from './feedback.js';
import {JADE_NAMES} from './jade.js';
import type {JadeName} from './jade.js';

export const PETAL_ASSET = 'assets/art-rose/jade-petals.png';
const PETAL_COUNT = 24;
const COLUMNS = 3;
const QUAD = new Float32Array([-6,-6, 6,-6, 6,6, -6,6]);
const INDICES = new Uint16Array([0,1,2,0,2,3]);
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
}

export class JadePetals {
 private active:Petal[] = [];
 private pool:Petal[] = [];
 constructor(private layer:Laya.Sprite) {}

 get count():number {return this.active.length}

 countFor(batchSize:number):number {
  const count = Math.min(PETAL_COUNT, Math.floor(FEEDBACK.maxParticles/batchSize));
  // Reclaim old trails before allocating, so each newly removed ring gets a complete arc.
  const discard = Math.max(0, this.active.length+count*batchSize-FEEDBACK.maxParticles);
  for (const petal of this.active.splice(0,discard)) this.recycle(petal);
  return count;
 }

 emit(center:Point, gapAngle:number, halfGap:number, radius:number, material:JadeName, start:number, count:number):void {
  const row = JADE_NAMES.indexOf(material);
  for (let i=0; i<count; i++) {
   const seed = (i*17+row*11)%31/30;
   const variant = row*COLUMNS+i%COLUMNS;
   const petal = this.pool.pop() ?? {sprite:new Laya.Sprite(), variant:-1, center, angle:0, radius, start, seed};
   petal.center = center;
   petal.angle = gapAngle+halfGap+(360-2*halfGap)*(i+.5)/count;
   petal.radius = radius+((i%3)-1)*1.7;
   petal.start = start;
   petal.seed = seed;
   if (petal.variant !== variant) {
    petal.variant = variant;
    petal.sprite.graphics.clear();
    petal.sprite.graphics.drawTriangles(Laya.loader.getRes(PETAL_ASSET),0,0,QUAD,UVS[variant],INDICES);
   }
   petal.sprite.mouseEnabled = false;
   petal.sprite.alpha = 0;
   this.layer.addChild(petal.sprite);
   this.active.push(petal);
  }
 }

 draw(now:number, up:Point):void {
  let alive = 0;
  for (const petal of this.active) {
   const age = now-petal.start;
   if (age>=FEEDBACK.particles) {
    this.recycle(petal);
    continue;
   }
   const {sprite,seed,center} = petal;
   const driftStart = FEEDBACK.release+seed*68;
   const drift = Math.max(0,(age-driftStart)/(FEEDBACK.particles-driftStart));
   const emerge = easeOut((age-65-seed*45)/165);
   const fade = 1-Math.max(0,(age-350)/(FEEDBACK.particles-350));
   const angle = (petal.angle+drift*(seed-.5)*23)*Math.PI/180;
   const radius = petal.radius+easeOut(drift)*(7+seed*13);
   const lift = drift*(5+seed*8);
   sprite.pos(center.x+Math.cos(angle)*radius+up.x*lift,center.y+Math.sin(angle)*radius+up.y*lift);
   sprite.rotation = petal.angle+90+(seed-.5)*(54+drift*220);
   sprite.scale((.82+seed*.3)*(1-drift*.24));
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
