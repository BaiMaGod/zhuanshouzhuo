// Compile ONLY fully authored and independently replayed level specifications.
// The 2026-11-06 seven-sample skeleton intentionally fails this gate.
import {challengeDuration} from './advanced-mechanics.js';
const TYPES={'普通':'ordinary','仅爆裂':'burst','仅缠丝':'silk','爆裂缠丝':'burst+silk'};
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function requireField(ok,reason){if(!ok)throw Error('样板未准备就绪: '+reason)}
const norm=a=>((a%360)+360)%360;
const angle=(a,b)=>norm(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
const delta=(a,b)=>((a-b+540)%360)-180;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rotate=(p,a)=>({x:p.x*Math.cos(a*Math.PI/180)-p.y*Math.sin(a*Math.PI/180),y:p.x*Math.sin(a*Math.PI/180)+p.y*Math.cos(a*Math.PI/180)});
const closePoint=(a,b)=>distance(a,b)<0.01;
export function compileApprovedSample(spec){
 requireField(Number.isInteger(spec.level)&&spec.level>=101&&spec.level<=200,'关卡编号');
 const n=spec.level,expected=n<=109?109:n;
 requireField(spec.ringCount===expected&&spec.rings?.length===expected,'镯数');
 const validationGates=['staticIntegrity','connectivityComplete','geometryVerified','sweepVerified','fullRouteVerified','difficultyVerified','mobilePlaytested','publishReady'];
 for(const gate of validationGates)requireField(spec.validation?.[gate]===true,'验收证据未齐备 '+gate);
 const rings=new Map,attrs=[],points=[],ownerQuota=new Map;
 for(const r of spec.rings){
  requireField(!rings.has(r.id)&&TYPES[r.attribute]!==undefined,'镯ID/属性 '+r.id);
  requireField(Number.isInteger(r.mountedClaspQuota)&&r.mountedClaspQuota>=0&&r.mountedClaspQuota<=6,'自带扣配额 '+r.id);
  ownerQuota.set(r.id,0);
  requireField(point(r.center)&&r.radius===40&&r.ringWidth===12&&finite(r.gapLocalAngle)&&finite(r.initialRotation),'玉镯几何 '+r.id);
  requireField(Number.isInteger(r.silkLayers)&&r.silkLayers>=0&&r.silkLayers<=3,'缠丝层数 '+r.id);
  rings.set(r.id,r);points.push([r.id,r.center.x,r.center.y,norm(r.initialRotation)]);
  attrs.push({id:r.id,attribute:TYPES[r.attribute],silkLayers:r.silkLayers});
 }
 requireField(spec.mountedRods?.length===spec.rings.reduce((a,r)=>a+r.mountedClaspQuota,0),'自带锁杆总数');
 // Do not require all endpoints on one receiver to share an angle here.
 // A mounted owner can be destroyed by a verified burst before the receiver is
 // cleared, and a background piece can be broken as a whole. Only the full
 // Core.request replay can prove that the remaining constraints are solvable.
 const mountedRods=[],seen=new Set;
 for(const m of spec.mountedRods){
  requireField(!seen.has(m.id)&&rings.has(m.ownerId)&&rings.has(m.receiverId)&&m.ownerId!==m.receiverId,'活动杆唯一ID/连接 '+m.id);
  ownerQuota.set(m.ownerId,ownerQuota.get(m.ownerId)+1);
  requireField(point(m.anchorLocal)&&finite(m.angleLocal)&&finite(m.length)&&m.length>0&&m.endpointWidth===7,'活动杆几何 '+m.id);
  seen.add(m.id);
  const d=m.angleLocal*Math.PI/180,endLocal={x:m.anchorLocal.x+m.length*Math.cos(d),y:m.anchorLocal.y+m.length*Math.sin(d)};
  const owner=rings.get(m.ownerId),receiver=rings.get(m.receiverId),worldEndOffset=rotate(endLocal,owner.initialRotation);
  const worldEnd={x:owner.center.x+worldEndOffset.x,y:owner.center.y+worldEndOffset.y};
  requireField(Math.abs(Math.hypot(m.anchorLocal.x,m.anchorLocal.y)-owner.radius)<0.001,'活动杆Owner端不贴合镯边 '+m.id);
  requireField(Math.abs(distance(worldEnd,receiver.center)-receiver.radius)<0.001,'活动杆Receiver端不贴合镯边 '+m.id);
  mountedRods.push({id:m.id,owner:m.ownerId,targets:[m.receiverId],local:m.anchorLocal,end:endLocal});
 }
 for(const r of spec.rings)requireField(ownerQuota.get(r.id)===r.mountedClaspQuota,'Owner自带扣数量不匹配 '+r.id+' expected='+r.mountedClaspQuota+' actual='+ownerQuota.get(r.id));
 const receiverIds=new Set,backgroundPieces=[];
 for(const b of spec.backgroundPieces||[]){
  requireField(!seen.has(b.id)&&point(b.anchorWorld)&&b.heads>=2&&b.heads<=6,'背景扣 ID/锚点 '+b.id);
  requireField(Number.isInteger(b.heads)&&b.endpoints?.length===b.heads&&b.branchPaths?.length===b.heads,'背景扣分支 '+b.id);
  const targetSet=new Set;
  const endpoints=b.endpoints.map(e=>{
   requireField(rings.has(e.receiverId)&&!targetSet.has(e.receiverId)&&!receiverIds.has(e.receiverId),'背景扣端点目标 '+e.id);
   requireField(point(e.pointWorld)&&finite(e.endpointWorldAngle)&&e.endpointWidth===7,'背景扣端点世界几何 '+e.id);
   const receiver=rings.get(e.receiverId),actualAngle=angle(receiver.center,e.pointWorld);
   requireField(Math.abs(distance(receiver.center,e.pointWorld)-receiver.radius)<0.001,'背景扣端点不贴合镯边 '+e.id);
   requireField(Math.abs(delta(actualAngle,e.endpointWorldAngle))<0.05,'背景扣端点朝向不匹配 '+e.id);
   receiverIds.add(e.receiverId);targetSet.add(e.receiverId);
   return{id:e.id,receiverId:e.receiverId,pointWorld:e.pointWorld};
  });
  for(let i=0;i<b.branchPaths.length;i++){
   const path=b.branchPaths[i],endpoint=endpoints[i];
   requireField(Array.isArray(path)&&path.length>=2&&path.every(point),'背景扣支杆路径 '+b.id);
   requireField((closePoint(path[0],b.anchorWorld)&&closePoint(path[path.length-1],endpoint.pointWorld))||(closePoint(path[path.length-1],b.anchorWorld)&&closePoint(path[0],endpoint.pointWorld)),'背景扣支杆未连接锚点与端点 '+b.id+'/'+endpoint.id);
  }
  seen.add(b.id);backgroundPieces.push({id:b.id,anchorWorld:b.anchorWorld,endpoints,branchPaths:b.branchPaths});
 }
 requireField(Number.isInteger(spec.backgroundPieceCount)&&spec.backgroundPieceCount>=0,'背景扣件数缺失');
 requireField(Number.isInteger(spec.backgroundEndpointCount)&&spec.backgroundEndpointCount>=0,'背景扣端点数缺失');
 requireField(backgroundPieces.length===spec.backgroundPieceCount,'背景扣件数');
 requireField(backgroundPieces.reduce((sum,piece)=>sum+piece.endpoints.length,0)===spec.backgroundEndpointCount,'背景扣端点总数');
 const silkEdges=[],silkTargetCounts=new Map;
 for(const e of spec.silkEdges||[]){
  requireField(e.validatedAdjacent===true&&rings.has(e.sourceId)&&rings.has(e.targetId)&&e.sourceId!==e.targetId,'解缠邻接证据 '+e.sourceId);
  const from=rings.get(e.sourceId).center,to=rings.get(e.targetId).center;
  requireField(Math.abs(Math.hypot(from.x-to.x,from.y-to.y)-92.0001)<0.05,'解缠来源不是真实相邻 '+e.sourceId+'→'+e.targetId);
  silkTargetCounts.set(e.targetId,(silkTargetCounts.get(e.targetId)||0)+1);
  silkEdges.push({sourceId:e.sourceId,targetId:e.targetId});
 }
 for(const r of spec.rings)requireField((silkTargetCounts.get(r.id)||0)===r.silkLayers,'缠丝来源数量不匹配 '+r.id);
 for(const candidate of spec.burstCandidates||[]){
  requireField(candidate.validatedAdjacent===true&&rings.has(candidate.sourceId),'爆裂真实邻接证明 '+candidate.sourceId);
  requireField(['仅爆裂','爆裂缠丝'].includes(rings.get(candidate.sourceId).attribute),'爆裂来源属性 '+candidate.sourceId);
  const neighborId=candidate.neighborId||candidate.targetId;
  if(neighborId){
   requireField(rings.has(neighborId)&&neighborId!==candidate.sourceId,'爆裂邻镯ID '+neighborId);
   const from=rings.get(candidate.sourceId).center,to=rings.get(neighborId).center;
   requireField(Math.abs(Math.hypot(from.x-to.x,from.y-to.y)-92.0001)<0.05,'爆裂邻镯不是真实相邻 '+candidate.sourceId+'→'+neighborId);
  }
 }
 const route=spec.verifiedRoute;
 const sha256=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
 requireField(route?.replayReport?.passed===true&&sha256(route.initialStateHash)&&sha256(route.finalStateHash),
  '缺少引擎全盘回放证据或状态SHA256格式错误');
 requireField(Array.isArray(route.orderedSteps)&&route.orderedSteps.length===route.stepsS&&route.stepsS>0,'完整动作与计步');
 const phases=[],angles=new Map(points.map(p=>[p[0],p[3]]));
 for(const step of route.orderedSteps){
  requireField(rings.has(step.id)&&finite(step.delta)&&Math.abs(step.delta)>.0001,'路线动作无效');
  const target=norm(angles.get(step.id)+step.delta);angles.set(step.id,target);
  phases.push({id:'S'+(phases.length+1),ringId:step.id,targetAngle:target,
    requires:phases.length?['S'+phases.length]:[],claspId:step.rod});
 }
 let timed=null;
 if(spec.timedChallenge){
  const policy=spec.timing;
  requireField(policy&&policy.routeVerified===true,'限时无道具路线');
  const value=challengeDuration({steps:route.stepsS,secondsPerStep:policy.t,thinkingSeconds:policy.H,routeVerified:true});
  requireField(policy.T===value&&finite(policy.calibratedT)&&policy.calibratedT>0,'限时公式/校准未完成');
  timed={durationSeconds:policy.calibratedT,formulaSeconds:value,routeSteps:route.stepsS};
 }
 return{
  name:'第'+n+'关',kind:'formal',revision:1,tip:'',points,links:[],mountedRods,backgroundPieces,
  special:{rings:attrs,silkEdges},timed,hintGraph:{kind:'stages',stages:phases},
  proof:{initialHash:route.initialStateHash,finalHash:route.finalStateHash,steps:route.stepsS}
 };
}
