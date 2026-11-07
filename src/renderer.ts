import C0 from './core.js';
import type {CoreAPI,State,Point,Ring,Block} from './types.js';
import {JADE_NAMES,drawJade} from './jade.js';
import type {JadeName} from './jade.js';
import {JadePetals} from './jade-petals.js';
import {trayFit} from './tray-layout.js';
import {TEACHING_COUNT} from './levels.js';
import {THEME} from './ui.js';
import {FEEDBACK,reducedMotion,easeOut,glint} from './feedback.js';
const C=C0 as unknown as CoreAPI;
export interface Ghost {r:Ring;start:number;rods:Laya.Sprite;glow:Laya.Sprite|null}
interface RingView {material:JadeName;root:Laya.Sprite;body:Laya.Sprite;halo:Laya.Sprite;focus:Laya.Sprite;label:Laya.Text;shadow:Laya.Sprite}
const RELEASE_GLOW:Record<JadeName,string> = {
 amber:'252,210,72', peach:'253,179,158', celadon:'174,221,164',
 ice:'166,231,219', ivory:'255,244,207'
};
const HALF_GAP = Math.asin(C.GAP/(2*(C.R-C.BAND/2)))/C.D;

export class Board {
 viewport=new Laya.Sprite();root=new Laya.Sprite();space=new Laya.Sprite();rods=new Laya.Sprite();fixedRods=new Laya.Sprite();effects=new Laya.Sprite();
 private petals=new JadePetals(this.effects);
 backdrop:Laya.Sprite|null=null;
 rings=new Map<string,RingView>();
 center:Point={x:0,y:0}; screen:Point;zoom=1;fitZoom=1;bounds={w:1,h:1};turn=0;selected:string|null=null;
 lastState:State|null=null;
 showLabels=true;
 // A single immutable graphics batch costs one cached quad per frame.
 // Invalidate only when the camera, ring poses or collision highlight changes.
 private rodsDrawKey=''; private highlightedRing:string|null=null;
 private fixedRodViews=new Map<string,Laya.Sprite>();
 private fixedRodKeys=new Map<string,string>();
 private focusId:string|null=null;
 private traySize:{w:number;h:number}|undefined;
 hint:Point|null=null;blocked:Block|null=null;blockUntil=0;blockedRing:string|null=null;
 ghosts:Ghost[]=[];sparks:{x:number;y:number;start:number;seed:number;strength:number}[]=[];
 private flashes:{x:number;y:number;start:number}[]=[];
 private clearAt=-Infinity;private releaseAt=-Infinity;private streak=0;
 private quiet=reducedMotion();
 constructor(private parent:Laya.Sprite,public rect:{x:number;y:number;w:number;h:number}){
  this.screen={x:rect.x+rect.w/2,y:rect.y+rect.h/2};
  this.viewport.pos(rect.x,rect.y);this.viewport.size(rect.w,rect.h);this.viewport.scrollRect=new Laya.Rectangle(0,0,rect.w,rect.h);this.viewport.mouseEnabled=false;
  parent.addChild(this.viewport);this.viewport.addChild(this.root);this.root.addChild(this.space);
  this.rods.name='board-rods';this.rods.cacheAs='normal';
  // Background fixed clasps change visibility when either endpoint ring is
  // removed. Keep them outside the cached moving-rod batch so GPU bitmap caches
  // cannot preserve the final clasp after its Sprite has been hidden.
  this.fixedRods.name='board-fixed-rods';this.fixedRods.cacheAs='none';
  this.effects.name='board-effects';
  this.space.addChild(this.rods);this.space.addChild(this.fixedRods);this.space.addChild(this.effects);
  this.rods.zOrder=10;this.fixedRods.zOrder=11;this.effects.zOrder=20;this.root.mouseEnabled=false;
 }
 load(s:State,traySize?:{w:number;h:number}):void{
  if(traySize)this.traySize=traySize;
  this.lastState=null;this.rodsDrawKey='';this.highlightedRing=null;this.focusId=null;
  // A prior completed level hides the owner-mounted clasp layer entirely.
  // Restore it when loading a fresh board, including replaying the same level.
  this.rods.visible=true;this.rods.cacheAs='normal';this.rods.graphics.clear();
  for(let i=this.rods.numChildren-1;i>=0;i--)this.rods.getChildAt(i).destroy(true);
  for(let i=this.fixedRods.numChildren-1;i>=0;i--)this.fixedRods.getChildAt(i).destroy(true);
  this.fixedRodViews.clear();this.fixedRodKeys.clear();
  // Cache only the immutable jade/ring bodies and the clasp batch; never
  // cache the moving whole scene, input targets or zoomable camera.
  for(const v of this.rings.values())v.root.destroy(true);this.rings.clear();
  this.ghosts=[];this.sparks=[];this.flashes=[];this.clearAt=-Infinity;this.releaseAt=-Infinity;this.streak=0;
  this.quiet=reducedMotion();this.hint=null;this.blocked=null;this.blockedRing=null;this.blockUntil=0;
  this.effects.graphics.clear();
  this.petals.reset();
  for(let i=this.effects.numChildren-1;i>=0;i--)this.effects.getChildAt(i).destroy(true);
  const xs=s.rings.map(r=>r.x),ys=s.rings.map(r=>r.y);
  const dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys);
  this.center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
  this.turn=s.index>=TEACHING_COUNT?0:(dx+110)/(dy+110)>1.7&&this.rect.h/this.rect.w>1.3?90:0;
  const w=(this.turn?dy:dx)+116,h=(this.turn?dx:dy)+116;
  this.bounds={w,h};this.fitZoom=Math.min(this.rect.w/w,this.rect.h/h,3.4);
  if(s.index>=TEACHING_COUNT){
   if(!this.traySize)throw new Error('Formal layout requires the actual tray dimensions');
   this.fitZoom=Math.min(this.fitZoom,trayFit(s.rings,this.center,this.traySize.w,this.traySize.h));
  }
  this.resetView();
  this.space.pos(-this.center.x,-this.center.y);
  s.rings.forEach((r,i)=>{
   const root=new Laya.Sprite();root.pos(r.x,r.y);this.space.addChild(root);
   const shadow=new Laya.Sprite();
   // Reuse the preblurred silhouette; its soft tips follow the gap without another mesh draw.
   shadow.graphics.drawImage(Laya.loader.getRes('assets/shadow.png'),-55,-55,110,110);
   // A close contact shadow separates pale jade from the pale tray. Reuse the
   // original gap-shaped texture, preserving its transparent opening.
   shadow.graphics.drawImage(Laya.loader.getRes('assets/shadow.png'),-54,-56,110,110);
   const offset=C.rot({x:1.7,y:3.6},-this.turn);shadow.pos(offset.x,offset.y);root.addChild(shadow);
   const halo=new Laya.Sprite();halo.visible=false;root.addChild(halo);
   const material=JADE_NAMES[i%JADE_NAMES.length];
   const body=new Laya.Sprite();drawJade(body.graphics,material);
   // A body never changes its local mesh; only its sprite rotation changes.
   // Rasterize once into a small offscreen surface, even on a 54-ring board.
   body.cacheAs='normal';root.addChild(body);
   const focus=new Laya.Sprite();focus.name='ring-focus:'+r.id;focus.visible=false;focus.mouseEnabled=false;
   // Two small polished tips identify the actual held ring, without outlining
   // the ring or drawing across the authoritative gap.
   const half=Math.asin(C.GAP/(2*(C.R-C.BAND/2)))/C.D;
   for(const sign of [-1,1]){
    const p=C.point({x:0,y:0},sign*(half+5),C.R);
    focus.graphics.drawCircle(p.x,p.y,4,'rgba(42,104,79,0.34)');
    glint(focus.graphics,p.x,p.y,2.8,'#fff8d8');
   }
   focus.cacheAs='normal';root.addChild(focus);
   const label=new Laya.Text();label.name='ring-id:'+r.id;label.text=s.index>=TEACHING_COUNT||!this.showLabels?'':r.id;label.fontSize=12;label.color=THEME.ink;label.font='serif';label.align='center';label.valign='middle';label.size(36,28);label.pivot(18,14);label.rotation=-this.turn;root.addChild(label);
   this.rings.set(r.id,{material,root,body,halo,focus,label,shadow});
  });
  // Background double-ended rods have their own render node. Their lifetime is
  // controlled by the two endpoint rings, not by the moving-clasp batch cache.
  for(const z of s.rods)if(z.kind==='b'){
   const view=new Laya.Sprite();view.name='background-fixed-rod:'+z.id;view.mouseEnabled=false;
   this.fixedRods.addChild(view);this.fixedRodViews.set(z.id,view);
  }
 }
 focus(id:string|null):void{
  if(id===this.focusId)return;
  const previous=this.focusId&&this.rings.get(this.focusId);
  if(previous){previous.focus.visible=false;previous.shadow.scale(1,1)}
  this.focusId=id;
  const current=id&&this.rings.get(id);
  if(current){current.focus.visible=true;current.shadow.scale(1.045,1.045)}
 }
 contains(p:Point):boolean{return p.x>=this.rect.x&&p.x<=this.rect.x+this.rect.w&&p.y>=this.rect.y&&p.y<=this.rect.y+this.rect.h}
 attachBackdrop(images:Laya.Sprite[]):void{
  this.backdrop?.destroy(true);this.backdrop=new Laya.Sprite();this.backdrop.name='board-backdrop';this.backdrop.zOrder=-1;this.backdrop.mouseEnabled=false;
  this.parent.addChild(this.backdrop);
  // Register the original artwork in board coordinates once. Both roots use the
  // same camera matrix; only the ring layer has the smaller gameplay clip.
  for(const image of images){
   const p=this.toWorld({x:image.x,y:image.y});
   this.backdrop.addChild(image);image.pos(p.x-this.center.x,p.y-this.center.y);
   image.scale(1/this.fitZoom,1/this.fitZoom);image.rotation=-this.turn;
  }
  this.applyView();
 }
 applyView():void{
  this.root.pos(this.screen.x-this.rect.x,this.screen.y-this.rect.y);this.root.scale(this.zoom,this.zoom);this.root.rotation=this.turn;
  if(this.backdrop){
   this.backdrop.pos(this.screen.x,this.screen.y);this.backdrop.scale(this.zoom,this.zoom);this.backdrop.rotation=this.turn;
  }
  if(this.lastState)this.draw(this.lastState);
 }
 resetView():void{this.zoom=this.fitZoom;this.screen={x:this.rect.x+this.rect.w/2,y:this.rect.y+this.rect.h/2};this.applyView()}
 clampView():void{
  const mid={x:this.rect.x+this.rect.w/2,y:this.rect.y+this.rect.h/2},extra=this.zoom>this.fitZoom*1.01?.2:0;
  let dx=Math.max(0,(this.bounds.w*this.zoom-this.rect.w)/2)+this.rect.w*extra;
  let dy=Math.max(0,(this.bounds.h*this.zoom-this.rect.h)/2)+this.rect.h*extra;
  if(this.traySize){
   // Do not expose the rectangular tray edge at extreme zoom and pan.
   const scale=this.zoom/this.fitZoom;
   dx=Math.min(dx,Math.max(0,(this.traySize.w*scale-this.rect.w)/2));
   dy=Math.min(dy,Math.max(0,(this.traySize.h*scale-this.rect.h)/2));
  }
  this.screen={x:Math.max(mid.x-dx,Math.min(mid.x+dx,this.screen.x)),y:Math.max(mid.y-dy,Math.min(mid.y+dy,this.screen.y))};this.applyView();
 }
 zoomTo(value:number,anchor:Point,world=this.toWorld(anchor)):void{
  this.zoom=Math.max(this.fitZoom,Math.min(Math.min(this.fitZoom*8,3.4),value));
  const delta=C.rot({x:world.x-this.center.x,y:world.y-this.center.y},this.turn);
  this.screen={x:anchor.x-delta.x*this.zoom,y:anchor.y-delta.y*this.zoom};this.clampView();
 }
 panTo(p:Point):void{this.screen={...p};this.clampView()}
 toWorld(p:Point):Point{
  const r=C.rot({x:(p.x-this.screen.x)/this.zoom,y:(p.y-this.screen.y)/this.zoom},-this.turn);
  return{x:r.x+this.center.x,y:r.y+this.center.y};
 }
 toScreen(p:Point):Point{
  const r=C.rot({x:p.x-this.center.x,y:p.y-this.center.y},this.turn);
  return{x:this.screen.x+r.x*this.zoom,y:this.screen.y+r.y*this.zoom};
 }
 pick(p:Point,s:State):Ring|undefined{
  if(!this.contains(p))return;const q=this.toWorld(p);
  const hits=s.rings.filter(r=>r.life==='active').map(r=>({r,d:Math.abs(C.dist(r,q)-C.R)})).filter(h=>h.d<15).sort((a,b)=>a.d-b.d);
  return hits[0]?.r||s.rings.find(r=>r.life==='active'&&C.dist(r,q)<23);
 }
 release(before:State,after:State,ids:string[]):void{
  const now=performance.now();this.quiet=reducedMotion();
  this.streak=now-this.releaseAt<1800?Math.min(3,this.streak+1):1;this.releaseAt=now;
  const departing=ids.slice(0,FEEDBACK.maxGhosts);
  const petalCount=this.quiet||!departing.length?0:this.petals.countFor(departing.length);
  for(const id of departing){
   const r=C.ring(after,id)!;
   // Batch each departing clasp once; don't clone state/create nodes per frame.
   const rods=new Laya.Sprite();rods.mouseEnabled=false;
   const state=C.clone(before);C.ring(state,id)!.a=r.a;
   this.drawRods(state,rods.graphics,id);this.effects.addChild(rods);
   const material=this.rings.get(id)!.material;
   const glow=this.quiet?null:this.releaseGlow(r,material);
   this.ghosts.push({r:{...r},start:now,rods,glow});
   for(const z of before.rods)for(const e of C.endpoints(before,z))if(e.id===id)this.flash(e.p,now);
   if(petalCount)this.petals.emit(r,r.a,HALF_GAP,C.R,material,now,petalCount);
   if(!this.quiet)for(let k=0;k<2+this.streak;k++){
    const p=C.point(r,k*137.5,34+(k%3)*5);
    this.sparks.push({...p,start:now,seed:k,strength:this.streak});
   }
  }
  while(this.ghosts.length>FEEDBACK.maxGhosts)this.disposeGhost(this.ghosts.shift()!);
  this.sparks=this.sparks.slice(-FEEDBACK.maxParticles);
  if(after.rings.every(r=>r.life!=='active')&&this.clearAt===-Infinity)this.clearAt=now;
 }
 private releaseGlow(r:Ring,material:JadeName):Laya.Sprite{
  const glow=new Laya.Sprite(),arc:unknown[]=[];
  glow.mouseEnabled=false;
  for(let i=0;i<=32;i++){
   const angle=r.a+HALF_GAP+(360-2*HALF_GAP)*i/32;
   const point=C.point(r,angle,C.R);
   arc.push([i===0?'moveTo':'lineTo',point.x,point.y]);
  }
  const color=RELEASE_GLOW[material];
  glow.graphics.drawPath(0,0,arc,undefined,{strokeStyle:'rgba('+color+',0.22)',lineWidth:C.BAND+5});
  glow.graphics.drawPath(0,0,arc,undefined,{strokeStyle:'rgba('+color+',0.5)',lineWidth:C.BAND-2});
  this.effects.addChild(glow);
  return glow;
 }
 private disposeGhost(ghost:Ghost):void{
  ghost.rods.destroy(true);
  ghost.glow?.destroy(true);
 }
 private flash(p:Point,now:number):void{
  this.flashes.push({...p,start:now});this.flashes=this.flashes.slice(-32);
 }
 alignment(before:State,after:State,id:string):void{
  const now=performance.now();
  for(const z of after.rods)if(C.exists(after,z))C.endpoints(after,z).forEach((e,j)=>{
   if(e.id===id&&after.states[z.id][j]==='aligned'&&before.states[z.id]?.[j]!=='aligned')this.flash(e.p,now);
  });
 }
 get hasVisibleFixedRods():boolean{return [...this.fixedRodViews.values()].some(view=>view.visible)}
 get hasVisibleClaspLayer():boolean{return this.rods.visible||this.hasVisibleFixedRods}
 get animating():boolean {return this.ghosts.length>0||performance.now()-this.clearAt<(this.quiet?180:FEEDBACK.clear)}
 get hasFeedback():boolean{return this.animating||this.petals.count>0||this.sparks.length>0||this.flashes.length>0}
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
  g.drawPoly(0,0,points,null,state==='aligned'?'#3b8779':'#55766a',2.2);
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
  private drawBackgroundRod(s:State,z:State['rods'][number],g:Laya.Graphics):void{
  const p=C.pose(s,z),a=C.angle(p.p,p.q),hot=this.blocked?.rod===z.id&&performance.now()<this.blockUntil;
  const shadow=C.rot({x:1.1,y:1.8},-this.turn);
  this.line(g,{x:p.p.x+shadow.x,y:p.p.y+shadow.y},{x:p.q.x+shadow.x,y:p.q.y+shadow.y},'rgba(46,63,51,0.25)',5.3);
  this.line(g,p.p,p.q,hot?'#c27051':'#537b6e',4.8);
  this.line(g,p.p,p.q,hot?'#e4aa7b':'#d5e9e3',2.9);
  const v=C.rot({x:0,y:-.8},a);
  this.line(g,{x:p.p.x+v.x,y:p.p.y+v.y},{x:p.q.x+v.x,y:p.q.y+v.y},'#fff9e5',.65);
  // A lock is one physical object: never erase one sleeve while keeping its shaft.
  // Core.exists owns the full background-lock lifecycle until both rings are gone.
  C.endpoints(s,z).forEach((e,i)=>this.sleeve(g,e.p,a,s.states[z.id][i]));
  const mid={x:(p.p.x+p.q.x)/2,y:(p.p.y+p.q.y)/2};
  this.jewel(g,mid,a);
  this.line(g,{x:mid.x-1.1,y:mid.y-1.1},{x:mid.x+1.1,y:mid.y+1.1},'#fffef2',.7);
  this.line(g,{x:mid.x+1.1,y:mid.y-1.1},{x:mid.x-1.1,y:mid.y+1.1},'#fffef2',.7);
 }
 private syncBackgroundRods(s:State,now:number):void{
  // Build one live endpoint set per frame. This bypasses the renderer's shared
  // ring lookup cache while keeping lifecycle checks O(rings + rods).
  const active=new Set(s.rings.filter(r=>r.life==='active').map(r=>r.id));
  for(const z of s.rods){
   if(z.kind!=='b')continue;
   const view=this.fixedRodViews.get(z.id);if(!view)continue;
   const visible=C.exists(s,z);
   view.visible=visible;
   const hot=this.blocked?.rod===z.id&&now<this.blockUntil;
   const key=(s.states[z.id]||[]).join(',')+':'+(hot?'1':'0')+':'+(visible?'1':'0');
   if(this.fixedRodKeys.get(z.id)!==key){
    view.graphics.clear();
    if(visible)this.drawBackgroundRod(s,z,view.graphics);
    this.fixedRodKeys.set(z.id,key);
   }
  }
 }
 private drawRods(s:State,g:Laya.Graphics,ownerFilter?:string):void{
  const jewels:{p:Point;a:number}[]=[];
  for(const z of s.rods){
   // Fixed background rods are independent child sprites with explicit
   // endpoint-driven visibility; this batch contains only owner-mounted rods.
   if(z.kind==='b'||!C.exists(s,z)||(ownerFilter!==undefined&&z.owner!==ownerFilter))continue;
   const p=C.pose(s,z),sp=this.toScreen(p.p),sq=this.toScreen(p.q),margin=(ownerFilter===undefined?12:30)*this.zoom;
   if(Math.max(sp.x,sq.x)+margin<this.rect.x||Math.min(sp.x,sq.x)-margin>this.rect.x+this.rect.w||Math.max(sp.y,sq.y)+margin<this.rect.y||Math.min(sp.y,sq.y)-margin>this.rect.y+this.rect.h)continue;
   const a=C.angle(p.p,p.q),hot=this.blocked?.rod===z.id&&performance.now()<this.blockUntil;
   const shadow=C.rot({x:1.1,y:1.8},-this.turn);
   this.line(g,{x:p.p.x+shadow.x,y:p.p.y+shadow.y},{x:p.q.x+shadow.x,y:p.q.y+shadow.y},'rgba(46,63,51,0.25)',5.3);
   this.line(g,p.p,p.q,hot?'#c27051':'#537b6e',4.8);
   this.line(g,p.p,p.q,hot?'#e4aa7b':'#d5e9e3',2.9);
   const v=C.rot({x:0,y:-.8},a);
   this.line(g,{x:p.p.x+v.x,y:p.p.y+v.y},{x:p.q.x+v.x,y:p.q.y+v.y},'#fff9e5',.65);
   // A mounted lock stays whole while its owner exists (even if the receiver
   // ring is gone). When the owner is removed, Core.exists hides every part.
   C.endpoints(s,z).forEach((e,i)=>this.sleeve(g,e.p,a,s.states[z.id][i]));
   jewels.push({p:p.p,a});
  }
  for(const j of jewels)this.jewel(g,j.p,j.a);
 }
 draw(s:State,now=performance.now()):void{
  this.lastState=s;
  const releaseMs=this.quiet?150:FEEDBACK.release;
  this.ghosts=this.ghosts.filter(g=>{if(now-g.start<releaseMs)return true;this.disposeGhost(g);return false});
  this.sparks=this.sparks.filter(p=>now-p.start<FEEDBACK.particles);
  this.flashes=this.flashes.filter(p=>now-p.start<(this.quiet?140:FEEDBACK.alignment));
  this.petals.draw(now,C.rot({x:0,y:-1},-this.turn));
  const ghosts=new Map(this.ghosts.map(g=>[g.r.id,g]));
  for(const r of s.rings){
   const v=this.rings.get(r.id)!;const ghost=ghosts.get(r.id);
   const screen=this.toScreen(r),margin=72*this.zoom;
   v.root.visible=(r.life==='active'||!!ghost)&&screen.x+margin>=this.rect.x&&screen.x-margin<=this.rect.x+this.rect.w&&screen.y+margin>=this.rect.y&&screen.y-margin<=this.rect.y+this.rect.h;
   const t=ghost?Math.min(1,(now-ghost.start)/releaseMs):0;
   // Cross-fade in place so the petal arc follows the original jade silhouette.
   const dissolve=this.quiet?t:Math.max(0,(t-.28)/.72);
   v.root.alpha=ghost?1-dissolve*dissolve*(3-2*dissolve):1;
   v.root.pos(r.x,r.y);
   if(v.body.rotation!==r.a)v.body.rotation=r.a;
   if(v.shadow.rotation!==r.a)v.shadow.rotation=r.a;
   if(v.focus.rotation!==r.a)v.focus.rotation=r.a;
   v.label.alpha=r.id===this.selected?1:.55;
   if(r.id===this.blockedRing&&now<this.blockUntil){
    if(!v.halo.name){
     v.halo.name='blocked-edge:'+r.id;
     // Local immutable paths replace ~356 line commands rebuilt every frame.
     // Rotation belongs to the sprite; the opening remains visible.
     for(const radius of [C.R+C.BAND/2+1,C.R-C.BAND/2-1]){
      const path:unknown[]=[];
      for(let a=8;a<=352;a+=4){const p=C.point({x:0,y:0},a,radius);path.push([a===8?'moveTo':'lineTo',p.x,p.y])}
      v.halo.graphics.drawPath(0,0,path,undefined,{strokeStyle:'rgba(234,79,88,0.22)',lineWidth:6});
      v.halo.graphics.drawPath(0,0,path,undefined,{strokeStyle:'#ed6670',lineWidth:1.8});
     }
     v.halo.cacheAs='normal';
    }
    v.halo.visible=true;v.halo.rotation=r.a;
    const fade=Math.min(1,(this.blockUntil-now)/180);
    v.halo.alpha=fade;
   }else if(this.highlightedRing===r.id)v.halo.visible=false;
   // Keep every jade opaque when selecting; release fading stays on the root.
   v.body.alpha=1;
  }
  this.highlightedRing=now<this.blockUntil?this.blockedRing:null;
  this.syncBackgroundRods(s,now);
  // The final action may remove one, two, or several bracelets in a single
  // settle pass. Never let a cached clasp bitmap outlive its owner when the
  // board reaches zero active rings. Departing clasp ghosts on the effects
  // layer still fade normally and are destroyed before victory.
  if(s.rings.every(r=>r.life!=='active')){
   this.rods.visible=false;
   this.rods.cacheAs='none';
   this.rods.graphics.clear();
   this.rodsDrawKey='';
  }else{
   if(!this.rods.visible){this.rods.visible=true;this.rods.cacheAs='normal';this.rodsDrawKey=''}
   // Avoid rebuilding drawing commands on unchanged frames while rings remain.
   const hot=now<this.blockUntil?this.blocked?.rod||'':'';
   const key=[this.zoom,this.screen.x,this.screen.y,this.turn,hot,
    ...s.rings.map(r=>r.id+':'+r.a+':'+r.life)].join('|');
   if(this.rodsDrawKey!==key){
    this.rods.graphics.clear();this.drawRods(s,this.rods.graphics);
    this.rodsDrawKey=key;
   }
  }
  // Reuse the effects layer and departing clasp nodes through their lifetime.
  this.effects.graphics.clear();
  for(const ghost of this.ghosts){
   const age=now-ghost.start;
   ghost.rods.alpha=1-age/releaseMs;
   if(ghost.glow)ghost.glow.alpha=Math.sin(Math.PI*Math.min(1,(age+20)/210));
  }
  for(const p of this.sparks){
   const age=now-p.start;
   if(age<380)continue;
   const t=(age-380)/(FEEDBACK.particles-380),a=p.seed*137.5;
   const q=C.point(p,a,(8+p.strength*4)*easeOut(t));q.y-=12*t;
   const alpha=Math.sin(Math.PI*t)**2*.65,r=(1-t)*(p.seed%3===0?3.2:1.8);
   glint(this.effects.graphics,q.x,q.y,r,'rgba(206,164,97,'+alpha+')');
  }
  for(const p of this.flashes){
   const t=(now-p.start)/(this.quiet?140:FEEDBACK.alignment),alpha=Math.sin(Math.PI*t);
   this.effects.graphics.drawCircle(p.x,p.y,5+t*4,'rgba(105,201,155,'+(alpha*.25)+')');
   glint(this.effects.graphics,p.x,p.y,3+alpha*3,'rgba(71,164,119,'+alpha+')');
  }
  if(!this.quiet&&now-this.clearAt<FEEDBACK.clear)this.drawClear(now);
  if(this.hint){const d=8*(1+Math.sin(now/170)*.09),p=this.hint;this.effects.graphics.drawPoly(p.x,p.y,[0,-d,d,0,0,d,-d,0],null,THEME.pressed,1.1)}
 }
 private drawClear(now:number):void{
  const age=now-this.clearAt;
  if(age<FEEDBACK.clearBloom)return;
  const u=(age-FEEDBACK.clearBloom)/(FEEDBACK.clear-FEEDBACK.clearBloom),g=this.effects.graphics,c=this.center,alpha=Math.sin(u*Math.PI);
  // Local celebration follows the jade tray camera, without a screen flash.
  for(let k=0;k<3;k++)g.drawCircle(c.x,c.y,(45+easeOut(u)*100+k*14),null,'rgba(174,203,172,'+(alpha*(.24-k*.055))+')',1.6-k*.3);
  for(let k=0;k<18;k++){
   const a=k*137.5,p=C.point(c,a,48+(1-easeOut(u))*85),r=(k%3+2)*alpha;
   if(k%3)glint(g,p.x,p.y,r,'rgba(203,161,95,'+(alpha*.8)+')');
   else g.drawPoly(p.x,p.y,[0,-r*1.5,r*.8,0,0,r*1.5,-r*.8,0],'rgba(213,151,170,'+(alpha*.6)+')');
  }
 }
 destroy():void{this.fixedRodViews.clear();this.fixedRodKeys.clear();this.petals.destroy();this.backdrop?.destroy(true);this.backdrop=null;this.viewport.destroy(true)}
}


