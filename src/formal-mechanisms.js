import {campaignLayout} from './campaign-layout.js';
import campaignTemplates from './formal-templates.js';
import diverseMotifs from './formal-motifs.js';
import {applyVerifiedRelay} from './formal-relays.js';

// Offline-selected adjacent cells. No random search or solver runs on a device.
// Centers own the rods; receivers can be shared by centers. Background pairs
// retain receivers while their gaps hold a center's cuffs in alignment.
const templates=[
 {centers:[1,4],pairs:[[0,6],[2,7]]},
 {centers:[1,3,10],pairs:[[0,6],[2,7],[4,8]]},
 {centers:[1,3,10],pairs:[[0,6],[2,7],[5,11]]},
 {centers:[1,3,10,12],pairs:[[0,6],[2,7],[4,8],[5,11]]},
 {centers:[1,3,10,12],pairs:[[0,6],[2,7],[4,8],[5,11]]},
 {centers:[3,6,7,9],pairs:[[0,2],[1,13],[4,12],[5,11],[10,14]]},
 {centers:[3,6,7,9],pairs:[[0,2],[1,13],[4,12],[5,11],[8,15],[10,14]]},
 {centers:[1,3,10,12],pairs:[[2,6],[4,16],[5,11],[7,14],[8,15],[9,13]]},
 {centers:[2,4,9,11],pairs:[[0,1],[3,15],[5,17],[6,12],[7,13],[8,16],[10,14]]},
 {centers:[1,4,10,11],pairs:[[2,6],[3,15],[5,17],[7,14],[8,16],[9,13],[12,18]]}
];
const norm=a=>((a%360)+360)%360;
const diff=(a,b)=>((a-b+540)%360)-180;
export function mechanismFormal(number){
 const seed=templates[number-1]||campaignTemplates[number];
 if(!seed)return null;
 const motif=diverseMotifs[number];
 const nodes=campaignLayout(number+9),id=i=>nodes[i].id;
 const adjacent=(a,b)=>Math.abs(Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y)-92.0001)<.01;
 const angle=(a,b)=>norm(Math.atan2(nodes[b].y-nodes[a].y,nodes[b].x-nodes[a].x)*180/Math.PI);
 const allMounts=seed.centers.flatMap(c=>nodes.map((_,r)=>r).filter(r=>adjacent(c,r)).map(r=>[c,r]));
 if(motif&&(motif.mounts.length!==allMounts.length||motif.pairs.length!==seed.pairs.length))
  throw Error('Outdated offline motif '+number+'; regenerate src/formal-motifs.js');
 const mounts=motif?allMounts.filter((_,i)=>motif.mounts[i]==='1'):allMounts;
 const pairs=motif?seed.pairs.filter((_,i)=>motif.pairs[i]==='1'):seed.pairs;
 const protectedIds=new Set(pairs.flat());
 const links=[...mounts.map(([c,r])=>['m',id(c),id(r)]),...pairs.map(([a,b])=>['b',id(a),id(b)])];
 const points=nodes.map((p,i)=>{
  const cuffs=[...mounts.filter(([,r])=>r===i).map(([c])=>angle(i,c)),...pairs.filter(pair=>pair.includes(i)).map(pair=>angle(i,pair.find(r=>r!==i)))];
  let a=norm(37+number*43+i*71);
  while(cuffs.some(goal=>Math.abs(diff(a,goal))<12))a=norm(a+17);
  return [p.id,p.x,p.y,a];
 });
 const stages=[];
 const add=(r,goal,claspId,releaseId)=>stages.push({id:'S'+(stages.length+1),ringId:id(r),targetAngle:goal,claspId,releaseId,requires:stages.length?['S'+stages.length]:[]});
 const order=[...seed.centers].sort((a,b)=>mounts.filter(([c,r])=>c===a&&protectedIds.has(r)).length-mounts.filter(([c,r])=>c===b&&protectedIds.has(r)).length||a-b);
 for(const c of order){
  const own=mounts.map(([owner,r],i)=>({owner,r,i})).filter(x=>x.owner===c);
  // Clear simple entry rings, then retain the protected receivers together.
  own.sort((a,b)=>Number(protectedIds.has(a.r))-Number(protectedIds.has(b.r))||a.r-b.r);
  for(const {r,i} of own)add(r,angle(r,c),'L'+(i+1),id(c));
 }
 for(let i=0;i<pairs.length;i++){
  const [a,b]=pairs[i],claspId='L'+(mounts.length+i+1);
  add(a,angle(a,b),claspId,id(a));add(b,angle(b,a),claspId,id(b));
 }
 const angles=new Map(points.map(p=>[p[0],p[3]]));
 const solution=stages.map(stage=>{
  const delta=diff(stage.targetAngle,angles.get(stage.ringId));angles.set(stage.ringId,stage.targetAngle);
  return {id:stage.ringId,delta,rod:stage.claspId};
 });
 return applyVerifiedRelay({level:{name:'第'+number+'关',kind:'formal',revision:motif?2:1,tip:'观察两类锁扣，保持相关玉镯的缺口对齐，再释放中心机关。',points,links,hintGraph:{kind:'stages',stages},difficulty:{centers:order.map(id),protectedReceivers:[...protectedIds].map(id),motif:motif?.family||'legacy-hold'}},solution},number);
}
