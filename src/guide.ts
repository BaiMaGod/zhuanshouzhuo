import {Core as C} from './model.js';
import type {State,Action,Point} from './types.js';
import type {Board} from './renderer.js';
import {curvedPath,THEME} from './ui.js';
// Presentation only: Game owns debug rotation through the normal rule API.
export class Guide {
 root=new Laya.Sprite();hand=new Laya.Sprite();phase:'choose'|'turn'='choose';lastDraw=0;followRotation=false;
 constructor(parent:Laya.Sprite,public board:Board,public id:string,public action?:Action){this.root.mouseEnabled=false;this.root.zOrder=25;parent.addChild(this.root);this.hand.mouseEnabled=false;this.root.addChild(this.hand);
  if(action){this.root.pos(board.rect.x,board.rect.y);this.root.size(board.rect.w,board.rect.h);this.root.scrollRect=new Laya.Rectangle(0,0,board.rect.w,board.rect.h);this.hand.scale(1.25,1.25)}
  curvedPath(this.hand.graphics,0,0,[['moveTo',-4,10],['lineTo',-4,-9],['quadraticCurveTo',-4,-17,3,-14],['lineTo',4,-1],['quadraticCurveTo',18,-3,22,8],['lineTo',23,22],['quadraticCurveTo',17,31,6,28],['lineTo',-7,15],['quadraticCurveTo',-11,8,-4,10]],{fillStyle:THEME.white},{strokeStyle:THEME.pressed,lineWidth:2.5})}
 draw(state:State,now:number,dragging:boolean):void{
  if(now-this.lastDraw<50)return;this.lastDraw=now;
  const g=this.root.graphics;g.clear();this.hand.visible=false;const ring=C.ring(state,this.id);
  if(!ring||ring.life!=='active'||this.board.animating)return;
  const screen=(p:Point)=>{const q=this.board.toScreen(p);return this.action?{x:q.x-this.board.rect.x,y:q.y-this.board.rect.y}:q};
  const targets=state.rods.filter(z=>C.exists(state,z)&&(!this.action?.rod||z.id===this.action.rod)).flatMap(z=>C.endpoints(state,z)).filter(e=>e.id===ring.id);
  // Staged alignment may target a gap angle rather than a single clasp.
  const target=this.action?.targetAngle!==undefined?{id:ring.id,p:C.point(ring,this.action.targetAngle)}:
   this.action?targets.sort((a,b)=>Math.abs(C.diff(C.angle(ring,a.p),ring.a+this.action!.delta))-Math.abs(C.diff(C.angle(ring,b.p),ring.a+this.action!.delta)))[0]:undefined;
  const pulse=1+Math.sin(now/350)*.06;
  for(const e of target?[target]:targets){
   const p=screen(e.p),d=(this.action?10:15)*pulse;
   for(const sx of [-1,1])for(const sy of [-1,1]){
    g.drawLine(p.x+sx*d,p.y+sy*d,p.x+sx*(d-6),p.y+sy*d,THEME.pressed,2);
    g.drawLine(p.x+sx*d,p.y+sy*d,p.x+sx*d,p.y+sy*(d-6),THEME.pressed,2);
   }
  }
  if(dragging)return;
  // A ghost hand traces the arc. It has no input handler and cannot intercept touch.
  const t=(now%2400)/2400;
  const delta=this.action?.delta??(targets.length?C.diff(C.angle(ring,targets[0].p),ring.a):80);
  const direction=Math.sign(delta)||1,a=this.followRotation?ring.a:ring.a+direction*8+Math.max(0,Math.min(1,(t-.1)/.72))*delta;
  if(this.action){
   // A short directional arc, never a selection circle. The direction comes
   // from the verified legal action, including routes longer than 180 degrees.
   const start=ring.a+direction*10,span=direction*Math.min(55,Math.max(22,Math.abs(delta))),r=C.R+9;
   let prev=screen(C.point(ring,start,r));
   for(let k=1;k<=16;k++){const next=screen(C.point(ring,start+span*k/16,r));g.drawLine(prev.x,prev.y,next.x,next.y,THEME.pressed,2.5);prev=next}
   const tip=screen(C.point(ring,start+span,r)),v=C.rot({x:0,y:direction},start+span);
   g.drawPoly(tip.x,tip.y,[0,0,-v.x*10-v.y*5,-v.y*10+v.x*5,-v.x*10+v.y*5,-v.y*10-v.x*5],THEME.pressed);
  }
  const p=screen(C.point(ring,a));
  this.hand.pos(p.x+6,p.y+6);this.hand.visible=true;
 }
 clear():void{this.root.graphics.clear();this.hand.visible=false}
 destroy():void{this.root.destroy(true)}
}

