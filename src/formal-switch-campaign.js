import {campaignLayout} from './campaign-layout.js';

// Physical-path curated introductory switch puzzles. These differ from the
// older outward hub: two leaf bracelets OWN clasps pointing INTO a pivot,
// forcing repeated turns of that pivot at the end of the outer branch.
// [root index, first switch-owner index, second switch-owner index].
// The untouched #1 remains the gentle intro; remaining #4, #7 and #10
// retain mixed fixed-cuff hold mechanisms.
export const INTRO_SWITCHES={
  2:[4,6,0],
  3:[4,6,0],
  5:[2,6,0],
  6:[4,0,3],
  8:[0,6,4],
  9:[4,12,6]
};
const norm=a=>((a%360)+360)%360;
const diff=(a,b)=>((a-b+540)%360)-180;
const angle=(a,b)=>norm(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
const adjacent=(a,b)=>Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-92.0001)<.01;

export function introSwitchFormal(number){
 const config=INTRO_SWITCHES[number];if(!config)return null;
 const [pivot,leafA,leafB]=config,leaves=[leafA,leafB];
 const nodes=campaignLayout(number+9),id=i=>nodes[i].id;
 if(!leaves.every(i=>adjacent(nodes[i],nodes[pivot])))
  throw Error('Stale introductory switch geometry '+number);
 const excluded=new Set(leaves),queue=[pivot],parent=new Map([[pivot,-1]]),depth=new Map([[pivot,0]]);
 // Build a connected spanning branch from the pivot, leaving both
 // switch-owner bracelets as strict leaves. This is done only once when
 // constructing the level, never through on-device solver search.
 for(let j=0;j<queue.length;j++){
  const here=queue[j],next=nodes.map((_,i)=>i)
   .filter(i=>!excluded.has(i)&&!parent.has(i)&&adjacent(nodes[here],nodes[i]));
  for(const i of next){
   queue.push(i);parent.set(i,here);depth.set(i,depth.get(here)+1);
  }
 }
 if(parent.size!==nodes.length-2)throw Error('Disconnected intro switch '+number);
 const links=[];
 for(const [i,p] of parent)if(i!==pivot)links.push(['m',id(p),id(i)]);
 for(const i of leaves)links.push(['m',id(i),id(pivot)]);
 const points=nodes.map((node,i)=>{
  const cuffs=links.filter(e=>e[2]===id(i))
   .map(e=>angle(node,nodes.find(p=>p.id===e[1])));
  let a=norm(37+number*43+i*71);
  while(cuffs.some(goal=>Math.abs(diff(a,goal))<12))a=norm(a+17);
  return [id(i),node.x,node.y,a];
 });
 const stages=[];
 const add=(ring,rod,release,targetAngle)=>stages.push({
  id:'S'+(stages.length+1),ringId:id(ring),targetAngle,
  claspId:'L'+(rod+1),releaseId:id(release),
  requires:stages.length?['S'+stages.length]:[]
 });
 const order=[...parent.keys()].filter(i=>i!==pivot)
  .sort((a,b)=>depth.get(b)-depth.get(a)||b-a);
 for(const i of order){
  const p=parent.get(i),rod=links.findIndex(e=>e[1]===id(p)&&e[2]===id(i));
  add(i,rod,p,angle(nodes[i],nodes[p]));
 }
 for(const i of leaves){
  const rod=links.findIndex(e=>e[1]===id(i)&&e[2]===id(pivot));
  add(pivot,rod,i,angle(nodes[pivot],nodes[i]));
 }
 const angles=new Map(points.map(p=>[p[0],p[3]]));
 const solution=stages.map(s=>{
  const delta=diff(s.targetAngle,angles.get(s.ringId));
  angles.set(s.ringId,s.targetAngle);
  return{id:s.ringId,delta,rod:s.claspId};
 });
 return{
  level:{
   name:'第'+number+'关',kind:'formal',revision:5,
   tip:'先清理外围枝节，再转动同一只玉镯，依次解开两把不同方向的活动扣。',
   points,links,hintGraph:{kind:'stages',stages},
   difficulty:{archetype:'intro-two-key',pivot:id(pivot),keyOwners:leaves.map(id)}
  },solution
 };
}
