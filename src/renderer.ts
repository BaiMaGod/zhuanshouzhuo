import C0 from './core.js';
import type {CoreAPI,State,Point,Ring,Block} from './types.js';
import {JADE_NAMES,drawJade} from './jade.js';
const C=C0 as unknown as CoreAPI;
export interface Ghost {r:Ring;state:State;start:number}
interface RingView {root:Laya.Sprite;body:Laya.Sprite;halo:Laya.Sprite;label:Laya.Text;shadow:Laya.Sprite}
export class Board {
 root=new Laya.Sprite();space=new Laya.Sprite();rods=new Laya.Sprite();effects=new Laya.Sprite();
 rings=new Map<string,RingView>();
 center:Point={x:0,y:0}; screen:Point;zoom=1;turn=0;selected:string|null=null;
 hint:Point|null=null;blocked:Block|null=null;blockUntil=0;
 ghosts:Ghost[]=[];sparks:{x:number;y:number;start:number;seed:number}[]=[];
 constructor(parent:Laya.Sprite,public rect:{x:number;y:number;w:number;h:number}){
  this.screen={x:rect.x+rect.w/2,y:rect.y+rect.h/2};
  parent.addChild(this.root);this.root.addChild(this.space);
  this.space.addChild(this.rods);this.space.addChild(this.effects);
  this.rods.zOrder=10;this.effects.zOrder=20;this.root.mouseEnabled=false;
 }
 load(s:State):void{
  for(const v of this.rings.values())v.root.destroy(true);this.rings.clear();
  this.ghosts=[];this.sparks=[];this.hint=null;this.blocked=null;
  const xs=s.rings.map(r=>r.x),ys=s.rings.map(r=>r.y);
  const dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys);
  this.center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
  this.turn=(dx+110)/(dy+110)>1.7&&this.rect.h/this.rect.w>1.3?90:0;
  const w=(this.turn?dy:dx)+116,h=(this.turn?dx:dy)+116;
  this.zoom=Math.min(this.rect.w/w,this.rect.h/h,3.4);
  this.root.pos(this.screen.x,this.screen.y);this.root.scale(this.zoom,this.zoom);this.root.rotation=this.turn;
  this.space.pos(-this.center.x,-this.center.y);
  s.rings.forEach((r,i)=>{
   const root=new Laya.Sprite();root.pos(r.x,r.y);this.space.addChild(root);
   const shadow=new Laya.Sprite();
   // Reuse the preblurred silhouette; its soft tips follow the gap without another mesh draw.
   shadow.graphics.drawImage(Laya.loader.getRes('assets/shadow.png'),-55,-55,110,110);
   const offset=C.rot({x:1.7,y:2.9},-this.turn);shadow.pos(offset.x,offset.y);root.addChild(shadow);
   const halo=new Laya.Sprite();root.addChild(halo);
   const body=new Laya.Sprite();drawJade(body.graphics,JADE_NAMES[i%5]);root.addChild(body);
   const label=new Laya.Text();label.text=r.id;label.fontSize=12;label.color='#85784f';label.font='serif';label.align='center';label.valign='middle';label.size(36,28);label.pivot(18,14);label.rotation=-this.turn;root.addChild(label);
   this.rings.set(r.id,{root,body,halo,label,shadow});
  });
 }
 toWorld(p:Point):Point{
  const r=C.rot({x:(p.x-this.screen.x)/this.zoom,y:(p.y-this.screen.y)/this.zoom},-this.turn);
  return{x:r.x+this.center.x,y:r.y+this.center.y};
 }
 toScreen(p:Point):Point{
  const r=C.rot({x:p.x-this.center.x,y:p.y-this.center.y},this.turn);
  return{x:this.screen.x+r.x*this.zoom,y:this.screen.y+r.y*this.zoom};
 }
 pick(p:Point,s:State):Ring|undefined{
  const q=this.toWorld(p);
  const hits=s.rings.filter(r=>r.life==='active').map(r=>({r,d:Math.abs(C.dist(r,q)-C.R)})).filter(h=>h.d<15).sort((a,b)=>a.d-b.d);
  return hits[0]?.r||s.rings.find(r=>r.life==='active'&&C.dist(r,q)<23);
 }
 release(before:State,after:State,ids:string[]):void{
  for(const id of ids){
   const r=C.ring(after,id)!;this.ghosts.push({r:{...r},state:before,start:performance.now()});
   for(let k=0;k<8;k++){const p=C.point(r,k*45,40);this.sparks.push({...p,start:performance.now(),seed:k})}
  }
 }
 get animating():boolean {return this.ghosts.length>0}
 private line(g:Laya.Graphics,p:Point,q:Point,c:string,w:number):void{g.drawLine(p.x,p.y,q.x,q.y,c,w)}
 private sleeve(g:Laya.Graphics,p:Point,a:number,state:string):void{
  // Rounded silver sleeve retains its hollow opening, pose and complete outline.
  const points:number[]=[];
  for(const [x,y,start]of [[6,-.5,-90],[6,.5,0],[-6,.5,90],[-6,-.5,180]])
   for(let step=0;step<=4;step++){
    const t=(start+step*22.5)*C.D,q=C.rot({x:x+3*Math.cos(t),y:y+3*Math.sin(t)},a);
    points.push(q.x+p.x,q.y+p.y);
   }
  const shade=C.rot({x:1,y:1.3},-this.turn);
  g.drawPoly(shade.x,shade.y,points,null,'rgba(45,58,48,0.23)',2.1);
  g.drawPoly(0,0,points,null,state==='aligned'?'#609f92':'#819b94',1.8);
  g.drawPoly(0,0,points,null,'#dbece5',.95);
  const u=C.rot({x:1,y:0},a),v={x:-u.y,y:u.x};
  for(const sign of[-1,1])this.line(g,{x:p.x-u.x*5.8+v.x*sign*2.8,y:p.y-u.y*5.8+v.y*sign*2.8},{x:p.x+u.x*5.8+v.x*sign*2.8,y:p.y+u.y*5.8+v.y*sign*2.8},sign<0?'#fffef4':'#b3cec5',.75);
 }
 private jewel(g:Laya.Graphics,p:Point,a:number):void{
  const vertices=new Float32Array([[-11,-4.4],[11,-4.4],[11,4.4],[-11,4.4]].flatMap(([x,y])=>{
   const q=C.rot({x,y},a);return[p.x+q.x,p.y+q.y];
  }));
  g.drawTriangles(Laya.loader.getRes('assets/art-v3/clasp.png'),0,0,vertices,new Float32Array([0,0,1,0,1,1,0,1]),new Uint16Array([0,1,2,0,2,3]));
 }
 private drawRods(s:State,g:Laya.Graphics,ownerFilter?:string):void{
  const jewels:{p:Point;a:number;fixed:boolean}[]=[];
  for(const z of s.rods){
   if(!C.exists(s,z)||(ownerFilter!==undefined&&z.owner!==ownerFilter))continue;
   const p=C.pose(s,z),a=C.angle(p.p,p.q),hot=this.blocked?.rod===z.id&&performance.now()<this.blockUntil;
   const shadow=C.rot({x:1.1,y:1.8},-this.turn);
   this.line(g,{x:p.p.x+shadow.x,y:p.p.y+shadow.y},{x:p.q.x+shadow.x,y:p.q.y+shadow.y},'rgba(46,63,51,0.25)',5.3);
   this.line(g,p.p,p.q,hot?'#c27051':'#839f98',4.4);
   this.line(g,p.p,p.q,hot?'#e4aa7b':'#d5e9e3',2.9);
   const v=C.rot({x:0,y:-.8},a);
   this.line(g,{x:p.p.x+v.x,y:p.p.y+v.y},{x:p.q.x+v.x,y:p.q.y+v.y},'#fff9e5',.65);
   C.endpoints(s,z).forEach((e,i)=>this.sleeve(g,e.p,a,s.states[z.id][i]));
   jewels.push({p:z.kind==='m'?p.p:{x:(p.p.x+p.q.x)/2,y:(p.p.y+p.q.y)/2},a,fixed:z.kind==='b'});
  }
  // Keep all gemstone texture commands adjacent, then draw fixed-anchor marks.
  for(const j of jewels)this.jewel(g,j.p,j.a);
  for(const j of jewels)if(j.fixed){
   const mid=j.p;
   this.line(g,{x:mid.x-1.1,y:mid.y-1.1},{x:mid.x+1.1,y:mid.y+1.1},'#fffef2',.7);
   this.line(g,{x:mid.x+1.1,y:mid.y-1.1},{x:mid.x-1.1,y:mid.y+1.1},'#fffef2',.7);
  }
 }
 draw(s:State,now=performance.now()):void{
  this.ghosts=this.ghosts.filter(g=>now-g.start<340);this.sparks=this.sparks.filter(p=>now-p.start<520);
  for(const r of s.rings){
   const v=this.rings.get(r.id)!;const ghost=this.ghosts.find(g=>g.r.id===r.id);
   v.root.visible=r.life==='active'||!!ghost;
   v.root.alpha=ghost?1-(now-ghost.start)/340:1;
   const dy=ghost?((now-ghost.start)/340)**2*16:0;
   const offset=C.rot({x:0,y:dy},-this.turn);v.root.pos(r.x+offset.x,r.y+offset.y);
   v.body.rotation=r.a;v.shadow.rotation=r.a;
   v.halo.graphics.clear();v.label.alpha=r.id===this.selected?1:.55;
   if(r.id===this.selected&&r.life==='active'){
    v.halo.graphics.drawCircle(0,0,49,null,'#bca163',.9);
    const p=C.point({x:0,y:0},r.a,51);v.halo.graphics.drawCircle(p.x,p.y,1.5,'#b8994f');
   }
  }
  this.rods.graphics.clear();this.drawRods(s,this.rods.graphics);
  // Ghost rods are separate entities so their alpha can animate with their owner.
  this.effects.destroy(true);this.effects=new Laya.Sprite();this.effects.zOrder=20;this.space.addChild(this.effects);
  for(const ghost of this.ghosts){
   const sprite=new Laya.Sprite();sprite.alpha=1-(now-ghost.start)/340;
   const dy=((now-ghost.start)/340)**2*16,offset=C.rot({x:0,y:dy},-this.turn);
   sprite.pos(offset.x,offset.y);
   const st=C.clone(ghost.state);C.ring(st,ghost.r.id)!.a=ghost.r.a;
   this.drawRods(st,sprite.graphics,ghost.r.id);this.effects.addChild(sprite);
  }
  for(const p of this.sparks){
   const t=(now-p.start)/520,a=p.seed*45;
   const q=C.point(p,a,12*t);this.effects.graphics.drawCircle(q.x,q.y,(1-t)*1.8,'#e3bc64');
  }
  if(this.hint){const pulse=1+Math.sin(now/170)*.09;this.effects.graphics.drawCircle(this.hint.x,this.hint.y,9*pulse,null,'#b18d38',1.1)}
 }
 destroy():void{this.root.destroy(true)}
}
