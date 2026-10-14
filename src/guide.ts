import {Core as C} from './model.js';
import type {State} from './types.js';
import type {Board} from './renderer.js';
import {curvedPath} from './ui.js';
// Presentation only: the coach never writes ring angles or rule state.
export class Guide {
 root=new Laya.Sprite();hand=new Laya.Sprite();phase:'choose'|'turn'='choose';lastDraw=0;
 constructor(parent:Laya.Sprite,public board:Board,public id:string){this.root.mouseEnabled=false;this.root.zOrder=25;parent.addChild(this.root);this.hand.mouseEnabled=false;this.root.addChild(this.hand);
  curvedPath(this.hand.graphics,0,0,[['moveTo',-4,10],['lineTo',-4,-9],['quadraticCurveTo',-4,-17,3,-14],['lineTo',4,-1],['quadraticCurveTo',18,-3,22,8],['lineTo',23,22],['quadraticCurveTo',17,31,6,28],['lineTo',-7,15],['quadraticCurveTo',-11,8,-4,10]],{fillStyle:'#fff9e9'},{strokeStyle:'#9c793d',lineWidth:2.5})}
 draw(state:State,now:number,dragging:boolean):void{
  if(now-this.lastDraw<50)return;this.lastDraw=now;
  const g=this.root.graphics;g.clear();this.hand.visible=false;const ring=C.ring(state,this.id);
  if(!ring||ring.life!=='active'||this.board.animating)return;
  const center=this.board.toScreen(ring),radius=C.R*this.board.zoom;
  const pulse=1+Math.sin(now/350)*.06;
  for(const z of state.rods){if(!C.exists(state,z))continue;for(const e of C.endpoints(state,z))if(e.id===ring.id){
   const p=this.board.toScreen(e.p),d=15*pulse;
   for(const sx of [-1,1])for(const sy of [-1,1]){
    g.drawLine(p.x+sx*d,p.y+sy*d,p.x+sx*(d-6),p.y+sy*d,'#b48a37',2);
    g.drawLine(p.x+sx*d,p.y+sy*d,p.x+sx*d,p.y+sy*(d-6),'#b48a37',2);
   }
  }}
  if(dragging)return;
  // A ghost hand traces the arc. It has no input handler and cannot intercept touch.
  const t=(now%2400)/2400;
  const targets=state.rods.filter(z=>C.exists(state,z)).flatMap(z=>C.endpoints(state,z)).filter(e=>e.id===ring.id);
  const delta=targets.length?C.diff(C.angle(ring,targets[0].p),ring.a):80;
  const direction=Math.sign(delta)||1,a=ring.a+direction*8+Math.max(0,Math.min(1,(t-.1)/.72))*delta;
  const p=this.board.toScreen(C.point(ring,a));
  this.hand.pos(p.x+6,p.y+6);this.hand.visible=true;
 }
 clear():void{this.root.graphics.clear();this.hand.visible=false}
 destroy():void{this.root.destroy(true)}
}

