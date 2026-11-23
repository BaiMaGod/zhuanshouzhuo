import type {State,Point} from './types.js';

const INTRO_MS=1350;
const CHAIN_MS=300;
interface Flight {from:Point;to:Point;at:number}

/** One bounded graphics batch, in board coordinates; never follows ring rotation. */
export class HeartLinks extends Laya.Sprite {
 private started=0;
 private groups:string[][]=[];
 private flights:Flight[]=[];
 private origin:Point={x:0,y:0};
 private weight=1;
 constructor(){super();this.name='heart-links';this.mouseEnabled=false;this.zOrder=12;}
 load(s:State,origin:Point):void{
  this.started=performance.now();this.origin={...origin};
  this.groups=s.special?.linked?(s.special.linkGroups||[]).map(g=>[...g]):[];
  this.flights=[];this.graphics.clear();
 }
 get animating():boolean{return this.flights.length>0||(this.groups.length>0&&performance.now()-this.started<INTRO_MS);}
 send(from:Point,to:Point,at:number):void{
  this.flights.push({from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},at});
  this.flights=this.flights.slice(-48);
 }
 private point(a:Point,b:Point,t:number,bend=9):Point{
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));
  const offset=Math.sin(t*Math.PI)*bend;
  return{x:a.x+dx*t-dy/d*offset,y:a.y+dy*t+dx/d*offset};
 }
 private curve(a:Point,b:Point,alpha:number,end=1,bend=9):void{
  const path:unknown[]=[];
  for(let i=0;i<=20;i++){const p=this.point(a,b,end*i/20,bend);path.push([i?'lineTo':'moveTo',p.x,p.y]);}
  for(const [width,color,k] of [[18,'190,94,230',.10],[10,'221,91,195',.20],[6,'126,49,156',.48],[3.8,'238,121,211',.96],[1.35,'255,251,218',1]] as const)
   this.graphics.drawPath(0,0,path,undefined,{strokeStyle:`rgba(${color},${alpha*k})`,lineWidth:width*this.weight});
 }
 private star(p:Point,strength:number,size=4):void{
  const g=this.graphics;size*=this.weight;
  g.drawCircle(p.x,p.y,size*2.7,`rgba(185,82,226,${strength*.12})`);
  g.drawCircle(p.x,p.y,size*1.65,`rgba(237,113,208,${strength*.25})`);
  // A colored rim remains readable against the cream tray; the light core
  // stays small enough that the clasp and jade texture remain unobscured.
  const points=[0,-size,size*.24,-size*.24,size,0,size*.24,size*.24,0,size,-size*.24,size*.24,-size,0,-size*.24,-size*.24];
  g.drawPoly(p.x,p.y,points,`rgba(255,250,216,${strength})`,`rgba(154,64,169,${strength*.85})`,this.weight*.8);
  g.drawCircle(p.x,p.y,1.65*this.weight,`rgba(255,255,246,${strength})`);
 }
 private rune(p:Point,now:number,quiet:boolean,index:number):void{
  const phase=quiet?index*.7:now/1400+index*.7;
  const strength=quiet?.95:.9+.1*Math.sin(now/480+index);
  this.star(p,strength,4.3);
  for(let side=0;side<2;side++){
   const path:unknown[]=[],radius=8*this.weight;
   for(let i=0;i<=12;i++){
    const angle=phase+side*Math.PI+i/12*Math.PI*.63;
    path.push([i?'lineTo':'moveTo',p.x+Math.cos(angle)*radius,p.y+Math.sin(angle)*radius]);
   }
   this.graphics.drawPath(0,0,path,undefined,{strokeStyle:`rgba(172,73,189,${strength*.8})`,lineWidth:1.5*this.weight});
   const angle=phase+side*Math.PI,tip={x:p.x+Math.cos(angle)*radius,y:p.y+Math.sin(angle)*radius};
   this.graphics.drawCircle(tip.x,tip.y,1.5*this.weight,'#fff5c0');
  }
 }
 draw(s:State,now:number,quiet:boolean,zoom=1):void{
  const g=this.graphics;g.clear();
  // Keep a legible core when a dense campaign is fitted to a phone screen.
  this.weight=Math.min(4,Math.max(.65,1.7/Math.max(.1,zoom)));
  const rings=new Map(s.rings.map(r=>[r.id,r]));
  const progress=quiet?1:Math.min(1,Math.max(0,(now-this.started)/INTRO_MS));
  for(const group of this.groups){
   // The first member is the old target; a local star keeps every branch short.
   const hub=rings.get(group[0]);if(!hub||hub.life!=='active')continue;
   const members=group.map(id=>rings.get(id)).filter(r=>r?.life==='active');
   if(members.length<2)continue;
   for(let i=0;i<members.length;i++){
    const r=members[i]!;
    const arrival=.35+i*.14;
    if(progress<arrival){
     const t=Math.min(1,progress/arrival),p=this.point(this.origin,r,t,22);
     this.curve(this.origin,r,.95,t,22);
     for(let tail=3;tail>=1;tail--){const u=Math.max(0,t-tail*.045);this.star(this.point(this.origin,r,u,22),.22+(.1*(4-tail)),2.1);}
     this.star(p,1,7);
    }else this.rune(r,now,quiet,i);
    if(i===0||progress<arrival)continue;
    const pulse=quiet?.95:.9+.1*Math.sin(now/600+i);
    this.curve(hub,r,pulse);
    if(!quiet){
     const t=(now/1500+i*.31)%1;
     this.star(this.point(hub,r,(t+.93)%1),.4,1.6);
     this.star(this.point(hub,r,t),1,3);
    }
   }
  }
  this.flights=this.flights.filter(f=>now-f.at<CHAIN_MS);
  if(!quiet)for(const f of this.flights){
   const t=(now-f.at)/CHAIN_MS;if(t<0)continue;
   this.curve(f.from,f.to,1-t*.15);
   for(let tail=4;tail>=1;tail--)this.star(this.point(f.from,f.to,Math.max(0,t-tail*.055)),(5-tail)*.17,2.5);
   this.star(this.point(f.from,f.to,t),1,9);
  }
 }
}
export {CHAIN_MS};
