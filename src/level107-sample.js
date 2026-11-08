// Development-only Level 107 sample builder.
// It reuses the already replay-verified 109-ring geometry of formal level 100,
// then applies only the exact aggregate quota deltas required by level 107.
// It is deliberately NOT imported by formal-campaign.js or levels.js.
import Core from './core.js';
import {formalLevels,formalSolutions} from './formal-campaign.js';

const BASE_FORMAL_NUMBER=100;
const REMOVED_BACKGROUND_ROD='L122';
const BURST_RINGS=['R90','R98'];
const EXTRA_MOUNTS=[
 // Receivers are released by the verified base route before their owners
 // move or disappear. Each new mounted clasp is already aligned at release.
 // The dependency chain is intentional: R89→R66→R11.
 ['R89','R8'],['R89','R66'],
 ['R92','R13'],['R92','R73'],
 ['R11','R6'],['R11','R95'],
 ['R66','R9'],['R66','R11']
];
const clone=value=>structuredClone(value);
const isActive=(state,id)=>Core.ring(state,id)?.life==='active';
const mountedCount=links=>links.filter(link=>link[0]==='m').length;
const backgroundCount=links=>links.filter(link=>link[0]==='b').length;
function ownerDistribution(links){
 const counts=new Map();
 for(const link of links)if(link[0]==='m')counts.set(link[1],(counts.get(link[1])||0)+1);
 const distribution={0:0,1:0,2:0,3:0,4:0,5:0,6:0};
 for(const count of counts.values())distribution[count]=(distribution[count]||0)+1;
 distribution[0]=109-counts.size;
 return distribution;
}
function baseRemovalSteps(baseIndex){
 const state=Core.make(baseIndex),solution=formalSolutions[BASE_FORMAL_NUMBER-1],removedAt=new Map(),removalAngles=new Map();
 for(let i=0;i<solution.length;i++){
  const action=solution[i],result=Core.request(state,action.id,action.delta);
  if(result.blocked)throw Error('第100关基底路线失效：'+i+' '+JSON.stringify(result.blocked));
  for(const id of result.removed)if(!removedAt.has(id)){removedAt.set(id,i);removalAngles.set(id,Core.ring(state,id).a)}
 }
 if(state.rings.some(r=>r.life!=='removed'))throw Error('第100关基底路线未完整清空');
 return{removedAt,removalAngles,steps:solution.length};
}
function remapBaseRod(id,removedIndex){
 if(!id||!/^L\d+$/.test(id))return null;
 const old=Number(id.slice(1));
 if(old===removedIndex+1)return null;
 return'L'+(old>removedIndex+1?old-1:old);
}
function alignToRod(state,ringId,rodId,route,label){
 const ring=Core.ring(state,ringId),rod=state.rods.find(item=>item.id===rodId);
 if(!ring||ring.life!=='active'||!rod||!Core.exists(state,rod))return false;
 const endpoint=Core.endpoints(state,rod).find(item=>item.id===ringId);
 if(!endpoint)return false;
 const delta=Core.diff(Core.angle(ring,endpoint.p),ring.a);
 if(Math.abs(delta)<.001){
  Core.settle(state);
  return false;
 }
 const result=Core.request(state,ringId,delta);
 if(result.blocked)throw Error(label+' '+ringId+' / '+rodId+' 碰撞：'+JSON.stringify(result.blocked));
 if(Math.abs(result.done)<.001)throw Error(label+' '+ringId+' / '+rodId+' 没有产生有效旋转');
 route.push({id:ringId,delta:result.done,rod:rodId});
 return true;
}
function finishWithLegalCandidates(state,route,baseActionStats,baseRouteHead){
 const remaining=state.rings.filter(r=>r.life==='active').map(r=>r.id);
 if(remaining.length)throw Error('第107关基底路线未能覆盖新增锁扣，剩余'+remaining.length+'只；基础动作统计='+JSON.stringify(baseActionStats)+'；前8步='+JSON.stringify(baseRouteHead)+'；已执行路线步数='+route.length+'；剩余='+remaining.slice(0,30).join(','));
 if(state.rods.some(rod=>Core.exists(state,rod)))throw Error('第107关基底路线完成后仍有活动锁扣');
}
function buildHintGraph(level,route){
 const angles=new Map(level.points.map(point=>[point[0],point[3]]));
 const stages=route.map((action,i)=>{
  const targetAngle=Core.norm(angles.get(action.id)+action.delta);
  angles.set(action.id,targetAngle);
  return{id:'S'+(i+1),ringId:action.id,targetAngle,claspId:action.rod,requires:i?['S'+i]:[]};
 });
 return{kind:'stages',stages};
}
export function buildLevel107Sample(){
 const baseIndex=Core.levels.indexOf(formalLevels[BASE_FORMAL_NUMBER-1]);
 if(baseIndex<0)throw Error('找不到已验证的第100关基底');
 const base=formalLevels[BASE_FORMAL_NUMBER-1],baseLinks=clone(base.links);
 const removedIndex=baseLinks.findIndex((_,i)=>'L'+(i+1)===REMOVED_BACKGROUND_ROD);
 if(removedIndex<0||baseLinks[removedIndex][0]!=='b')throw Error('待移除的背景扣不是第100关基底中的双头扣');
 const {removedAt,removalAngles,steps:baseSteps}=baseRemovalSteps(baseIndex);
 const level=clone(base);
 level.name='第107关';
 level.kind='formal';
 level.revision=1;
 level.tip='';
 level.links=baseLinks.filter((_,i)=>i!==removedIndex);
 for(const [owner,receiver] of EXTRA_MOUNTS)level.links.push(['m',owner,receiver]);
 level.special={
  rings:BURST_RINGS.map(id=>({id,attribute:'burst',silkLayers:0})),
  silkEdges:[]
 };
 level.difficulty={
  ...(level.difficulty||{}),
  sample:'level107-verified-base100-geometry',
  burstRings:BURST_RINGS,
  additionalMountedRods:EXTRA_MOUNTS,
  removedBackgroundRod:REMOVED_BACKGROUND_ROD
 };
 const distribution=ownerDistribution(level.links);
 const pointById=new Map(level.points.map(([id,x,y])=>[id,{x,y}]));
 const receiverReleaseAngles=EXTRA_MOUNTS.map(([owner,target])=>{
  if(baseLinks.some(link=>link[0]==='m'&&link[1]===target))
   throw Error('新增锁扣接收端不能仍拥有活动扣：'+target);
  const targetStep=removedAt.get(target),ownerStep=removedAt.get(owner);
  if(!Number.isInteger(targetStep)||!Number.isInteger(ownerStep)||targetStep>=ownerStep)
   throw Error('新增锁扣必须先释放接收端：'+owner+'→'+target);
  const requiredAngle=Core.angle(pointById.get(target),pointById.get(owner));
  const angleAtRemoval=removalAngles.get(target),delta=Core.diff(requiredAngle,angleAtRemoval);
  if(Math.abs(delta)>65)throw Error('新增锁扣旋转成本超出65°：'+owner+'→'+target+' '+delta);
  return{owner,target,targetStep,ownerStep,requiredAngle,angleAtRemoval,delta};
 });
 const expected={0:61,1:7,2:11,3:24,4:6,5:0,6:0};
 if(JSON.stringify(distribution)!==JSON.stringify(expected))throw Error('第107关自带扣配额不匹配：'+JSON.stringify(distribution));
 if(mountedCount(level.links)!==125||backgroundCount(level.links)!==14)throw Error('第107关杆件总数不匹配');
 const extraByStep=new Map();
 for(let i=0;i<EXTRA_MOUNTS.length;i++){
  const [owner,target]=EXTRA_MOUNTS[i],step=removedAt.get(target);
  if(!Number.isInteger(step)||!Number.isInteger(removedAt.get(owner))||step>=removedAt.get(owner))
   throw Error('新增Owner/Receiver先后顺序不成立：'+owner+'→'+target);
  const rodId='L'+(level.links.length-EXTRA_MOUNTS.length+i+1);
  if(!extraByStep.has(step))extraByStep.set(step,[]);
  extraByStep.get(step).push({owner,target,rodId});
 }
 const candidateIndex=Core.levels.push(level)-1;
 try{
  const state=Core.make(candidateIndex),errors=Core.validate(state);
  if(errors.length)throw Error('第107关几何校验失败：'+errors.slice(0,12).join(' | '));
  const premature=Core.settle(Core.clone(state));
  if(premature.length)throw Error('第107关开局自动消除：'+premature.join(','));
  const route=[],baseSolution=formalSolutions[BASE_FORMAL_NUMBER-1];
  const baseActionStats={total:baseSolution.length,withRod:0,rotated:0,skipped:0};
  const baseRouteHead=baseSolution.slice(0,8).map(action=>({id:action.id,delta:action.delta,rod:action.rod,remappedRod:remapBaseRod(action.rod,removedIndex)}));
  for(let i=0;i<baseSolution.length;i++){
   const action=baseSolution[i],rodId=remapBaseRod(action.rod,removedIndex);
   if(rodId){baseActionStats.withRod++;if(alignToRod(state,action.id,rodId,route,'基底路线'))baseActionStats.rotated++}else baseActionStats.skipped++;
   for(const extra of extraByStep.get(i)||[]){
    if(isActive(state,extra.target)){
     alignToRod(state,extra.target,extra.rodId,route,'新增锁扣');
     if(isActive(state,extra.target)){
      const receiver=Core.ring(state,extra.target),rod=state.rods.find(item=>item.id===extra.rodId);
      const endpoint=Core.endpoints(state,rod).find(item=>item.id===extra.target);
      const remaining=Core.connections(state,extra.target).map(item=>({rod:item.z.id,owner:item.z.owner||null,kind:item.z.kind,state:item.state}));
      throw Error('新增锁扣接收端未按预定步骤消除：'+JSON.stringify({step:i,owner:extra.owner,target:extra.target,rod:extra.rodId,angle:receiver.a,requiredAngle:Core.angle(receiver,endpoint.p),delta:Core.diff(Core.angle(receiver,endpoint.p),receiver.a),remaining}));
     }
    }
   }
  }
  finishWithLegalCandidates(state,route,baseActionStats,baseRouteHead);
  if(state.rods.some(rod=>Core.exists(state,rod)))throw Error('第107关胜利后仍有锁扣残留');
  level.hintGraph=buildHintGraph(level,route);
  return{
   level,route,
   metrics:{
    ringCount:state.rings.length,
    mountedCount:mountedCount(level.links),
    backgroundCount:backgroundCount(level.links),
    ownerDistribution:distribution,
    burstRings:BURST_RINGS,
    burstNeighbors:Object.fromEntries(BURST_RINGS.map(id=>[id,state.rings.filter(r=>r.id!==id&&Math.abs(Core.dist(r,Core.ring(state,id))-92.0001)<.01).map(r=>r.id)])),
    addedOwnerTargets:EXTRA_MOUNTS,
    receiverReleaseAngles,
    removedBackgroundRod:REMOVED_BACKGROUND_ROD,
    baseRouteSteps:baseSteps,
    baseActionStats,baseRouteHead,
    verifiedRouteSteps:route.length
   }
  };
 }finally{
  Core.levels.pop();
 }
}
