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
  for(const [width,color,k] of [[8,'249,159,195',.12],[3.5,'255,204,214',.4],[1.1,'255,249,215',.95]] as const)
   this.graphics.drawPath(0,0,path,undefined,{strokeStyle:`rgba(${color},${alpha*k})`,lineWidth:width});
 }
 private star(p:Point,strength:number,size=4):void{
  const g=this.graphics;
  g.drawCircle(p.x,p.y,size*2.5,`rgba(255,170,202,${strength*.09})`);
  g.drawCircle(p.x,p.y,size,`rgba(255,219,190,${strength*.3})`);
  g.drawLine(p.x-size,p.y,p.x+size,p.y,`rgba(255,245,217,${strength})`,1.1);
  g.drawLine(p.x,p.y-size,p.x,p.y+size,`rgba(255,245,217,${strength})`,1.1);
  g.drawCircle(p.x,p.y,1.5,`rgba(255,255,244,${strength})`);
 }
 draw(s:State,now:number,quiet:boolean):void{
  const g=this.graphics;g.clear();
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
     this.curve(this.origin,r,.6,t,22);this.star(p,.9,4);
    }else this.star(r,.65+(quiet?0:Math.sin(now/650+i)*.12),3.2);
    if(i===0||progress<arrival)continue;
    const pulse=quiet?.55:.55+.1*Math.sin(now/700+i);
    this.curve(hub,r,pulse);
    if(!quiet){const t=(now/2200+i*.31)%1;this.star(this.point(hub,r,t),.7,1.5);}
   }
  }
  this.flights=this.flights.filter(f=>now-f.at<CHAIN_MS);
  if(!quiet)for(const f of this.flights){
   const t=(now-f.at)/CHAIN_MS;if(t<0)continue;
   this.curve(f.from,f.to,1-t*.55);
   this.star(this.point(f.from,f.to,t),1,6);
  }
 }
}
export {CHAIN_MS};
