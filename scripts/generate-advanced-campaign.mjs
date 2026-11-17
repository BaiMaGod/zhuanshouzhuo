// Deterministic authoring helper for advanced campaign levels.
// A level is returned only after Core.validate and a complete Core.request replay.
// This helper never mutates ring life, clasp state, or the solution state directly.
const norm=a=>((a%360)+360)%360;
const diff=(a,b)=>((a-b+540)%360)-180;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a,b)=>norm(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
const ringId=n=>'R'+String(n).padStart(3,'0');
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function makeBackgroundGroups(n,adj,targetSet,counts,cells,rng){
 const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const groupsBySize=new Map([2,3,4,5,6].map(h=>[h,[]]));
 const add=(members,anchor,key)=>{
  const sorted=[...members].sort((a,b)=>a-b),membersSet=new Set(sorted);
  if(sorted.length<2||new Set(sorted).size!==sorted.length)return;
  for(const i of sorted)if(!targetSet.has(i))return;
  // Every branch must approach its own receiver without crossing another jade ring.
  for(const i of sorted){
   const p=cells[i],dx=anchor.x-p.x,dy=anchor.y-p.y,d=Math.hypot(dx,dy);
   if(d<40.1)return;
   const end={x:p.x+40*dx/d,y:p.y+40*dy/d},vx=end.x-anchor.x,vy=end.y-anchor.y,den=vx*vx+vy*vy;
   for(let j=0;j<n;j++)if(j!==i){
    const q=cells[j],t=Math.max(0,Math.min(1,((q.x-anchor.x)*vx+(q.y-anchor.y)*vy)/den));
    if(Math.hypot(q.x-anchor.x-t*vx,q.y-anchor.y-t*vy)<45.8)return;
   }
  }
  groupsBySize.get(sorted.length).push({members:sorted,anchor,key});
 };
 // Two- and three-head clasps use compact local junctions.
 for(let a=0;a<n;a++)if(targetSet.has(a))for(const b of adj[a])if(b>a&&targetSet.has(b)){
  const anchor={x:(cells[a].x+cells[b].x)/2,y:(cells[a].y+cells[b].y)/2};
  add([a,b],anchor,'local:'+a+':'+b);
  for(const c of adj[b])if(c>b&&targetSet.has(c)&&adj[a].includes(c)){
   const tri=[a,b,c],center={x:tri.reduce((v,i)=>v+cells[i].x,0)/3,y:tri.reduce((v,i)=>v+cells[i].y,0)/3};
   add(tri,center,'local:'+tri.join(':'));
  }
 }
 // Four-to-six head clasps are placed outside the packed board perimeter.
 // Their independent branches enter from unobstructed outer approaches.
 const minX=Math.min(...cells.map(p=>p.x)),maxX=Math.max(...cells.map(p=>p.x));
 const minY=Math.min(...cells.map(p=>p.y)),maxY=Math.max(...cells.map(p=>p.y));
 const anchors=[],step=30;
 for(const offset of [62,78,96,118]){
  for(let y=minY-120;y<=maxY+120;y+=step){
   anchors.push({x:minX-offset,y},{x:maxX+offset,y});
  }
  for(let x=minX-120;x<=maxX+120;x+=step){
   anchors.push({x,y:minY-offset},{x,y:maxY+offset});
  }
 }
 const seenAnchors=new Set;
 for(const anchor of anchors){
  const key='outer:'+Math.round(anchor.x)+':'+Math.round(anchor.y);
  if(seenAnchors.has(key))continue;seenAnchors.add(key);
  if(cells.some(p=>distance(p,anchor)<46.2))continue;
  const visible=[...targetSet].filter(i=>{
   const p=cells[i],dx=anchor.x-p.x,dy=anchor.y-p.y,d=Math.hypot(dx,dy);
   if(d<40.1)return false;
   const end={x:p.x+40*dx/d,y:p.y+40*dy/d},vx=end.x-anchor.x,vy=end.y-anchor.y,den=vx*vx+vy*vy;
   for(let j=0;j<n;j++)if(j!==i){
    const q=cells[j],t=Math.max(0,Math.min(1,((q.x-anchor.x)*vx+(q.y-anchor.y)*vy)/den));
    if(Math.hypot(q.x-anchor.x-t*vx,q.y-anchor.y-t*vy)<46.2)return false;
   }
   return true;
  }).sort((a,b)=>Math.atan2(cells[a].y-anchor.y,cells[a].x-anchor.x)-Math.atan2(cells[b].y-anchor.y,cells[b].x-anchor.x));
  for(let h=4;h<=6;h++)if(visible.length>=h){
   for(let start=0;start<=visible.length-h;start++)add(visible.slice(start,start+h),anchor,key);
  }
 }
 const sizes=[6,5,4,3,2],required=counts||[];
 for(let h=2;h<=6;h++)if(required[h-2]&&!groupsBySize.get(h).length)return null;
 for(const h of sizes)groupsBySize.set(h,shuffle(groupsBySize.get(h)));
 function search(sizeIndex,available,chosen,usedAnchors){
  if(sizeIndex>=sizes.length)return chosen;
  const h=sizes[sizeIndex],need=required[h-2]||0;
  if(!need)return search(sizeIndex+1,available,chosen,usedAnchors);
  const candidates=groupsBySize.get(h).filter(g=>!usedAnchors.has(g.key)&&g.members.every(i=>available.has(i))).slice(0,900);
  function pick(start,left,free,selected,anchorKeys){
   if(left===0)return search(sizeIndex+1,free,[...chosen,...selected],anchorKeys);
   for(let i=start;i<candidates.length;i++){
    const g=candidates[i];if(g.members.some(x=>!free.has(x)))continue;
    const nextFree=new Set(free);g.members.forEach(x=>nextFree.delete(x));
    const nextAnchors=new Set(anchorKeys);nextAnchors.add(g.key);
    const result=pick(i+1,left-1,nextFree,[...selected,g],nextAnchors);
    if(result)return result;
   }
   return null;
  }
  return pick(0,need,available,[],usedAnchors);
 }
 return search(0,new Set(targetSet),[],new Set());
}
function chooseBurstNodes(spec,sources,adj,cells,quotaBy,groups,rng){
 const count=spec.burstOnly+spec.both;if(!count)return[];
 const candidates=sources.map(i=>({i,degree:adj[i].length,quota:quotaBy.get(i)}))
  .sort((a,b)=>a.degree-b.degree||a.quota-b.quota||a.i-b.i);
 const far=(i,chosen,min=150)=>chosen.every(j=>!adj[i].includes(j)&&distance(cells[i],cells[j])>=min);
 let chosen=[];
 if(spec.level===127&&count===2){
  const groupTargets=new Set(groups.flatMap(g=>g.members||g));
  const near=candidates.filter(x=>adj[x.i].some(j=>groupTargets.has(j))),farSide=candidates.filter(x=>!adj[x.i].some(j=>groupTargets.has(j)));
  for(const x of near){const y=farSide.find(y=>far(y.i,[x.i]));if(y){chosen=[x.i,y.i];break}}
 }
 if(!chosen.length&&/一对|首对|短接续/.test(spec.designBrief||'')&&count>=2){
  const pairs=[];for(const x of candidates)for(const y of candidates)if(x.i<y.i&&adj[x.i].includes(y.i))pairs.push([x.i,y.i]);
  pairs.sort((a,b)=>(adj[a[0]].length+adj[a[1]].length)-(adj[b[0]].length+adj[b[1]].length));
  for(const pair of pairs){const extra=[];for(const x of candidates){if(pair.includes(x.i))continue;if(far(x.i,[...pair,...extra]))extra.push(x.i);if(extra.length===count-2)break}if(extra.length===count-2){chosen=[...pair,...extra];break}}
 }
 if(!chosen.length){for(let attempt=0;attempt<180;attempt++){const pool=[...candidates].sort(()=>rng()-.5),picked=[];for(const x of pool){if(far(x.i,picked))picked.push(x.i);if(picked.length===count)break}if(picked.length===count){chosen=picked;break}}}
 if(chosen.length!==count)throw Error('无法放置 '+count+' 枚烈焰玉镯');
 return chosen;
}
function buildSpecialPlan(spec,targets,sources,adj,cells,ownerTargets,rng){
 const burstOnlyCount=spec.burstOnly||0,bothCount=spec.both||0,silkOnlyCount=spec.silkOnly||0;
 const layerPlan=[];
 for(let layer=1;layer<=3;layer++)for(let k=0;k<(spec.silkLayerCounts?.[layer-1]||0);k++)layerPlan.push(layer);
 if(layerPlan.length!==silkOnlyCount+bothCount)throw Error('缠丝层数分布与缠丝镯数量不一致：'+spec.level);
 if(!burstOnlyCount&&!bothCount&&!silkOnlyCount)return{burstOnly:[],both:[],silkOnly:[],silkSources:[],earlyOwners:[],silkEdges:[],layerBy:new Map()};
 const sourceList=[...sources],targetList=[...targets];
 const ownersByTarget=new Map(targetList.map(i=>[i,sources.filter(owner=>ownerTargets.get(owner).includes(i))]));
 const layerBoth=layerPlan.slice().sort((a,b)=>b-a).slice(0,bothCount);
 const layerSilk=layerPlan.slice().sort((a,b)=>b-a).slice(bothCount);
 for(let attempt=0;attempt<320;attempt++){
  const silkTargets=[],both=[],silkOnly=[],layerBy=new Map(),silkSources=[],silkEdges=[],sourceUse=new Map();
  const forbiddenTarget=new Set();
  function addSilkTarget(layers,isBoth){
   const candidates=sourceList.filter(i=>!silkTargets.includes(i)&&!forbiddenTarget.has(i));
   const feasible=candidates.map(target=>{
    const options=adj[target].filter(t=>targets.has(t)&&
     (ownersByTarget.get(t)||[]).length>0&&
     (ownersByTarget.get(t)||[]).every(owner=>!silkTargets.includes(owner)));
    return {target,options};
   }).filter(x=>x.options.length>=layers).sort((x,y)=>y.options.length-x.options.length);
   if(!feasible.length)return false;
   const chosen=feasible[Math.floor(rng()*Math.min(5,feasible.length))];
   const selected=chosen.options.sort((x,y)=>
    (sourceUse.get(x)||0)-(sourceUse.get(y)||0)||
    adj[y].filter(j=>targets.has(j)).length-adj[x].filter(j=>targets.has(j)).length
   ).slice(0,layers);
   if(selected.length!==layers)return false;
   silkTargets.push(chosen.target);
   if(isBoth)both.push(chosen.target);else silkOnly.push(chosen.target);
   layerBy.set(chosen.target,layers);
   for(const source of selected){
    if(!silkSources.includes(source))silkSources.push(source);
    sourceUse.set(source,(sourceUse.get(source)||0)+1);
    silkEdges.push({sourceId:ringId(source+1),targetId:ringId(chosen.target+1)});
   }
   if(isBoth)for(const neighbor of adj[chosen.target])forbiddenTarget.add(neighbor);
   return true;
  }
  let failed=false;
  for(const layers of layerBoth)if(!addSilkTarget(layers,true)){failed=true;break}
  if(failed)continue;
  for(const layers of layerSilk)if(!addSilkTarget(layers,false)){failed=true;break}
  if(failed)continue;
  const burstOnly=[];
  const burstCandidates=sourceList.filter(i=>!silkTargets.includes(i)&&silkTargets.every(t=>!adj[i].includes(t)));
  for(const i of burstCandidates.sort(()=>rng()-.5)){
   if(burstOnly.every(j=>!adj[i].includes(j)))burstOnly.push(i);
   if(burstOnly.length===burstOnlyCount)break;
  }
  if(burstOnly.length!==burstOnlyCount)continue;
  const specialSources=new Set([...silkTargets,...burstOnly]);
  const earlyOwners=[...new Set(silkSources.flatMap(i=>ownersByTarget.get(i)||[]))];
  if(earlyOwners.some(i=>specialSources.has(i)))continue;
  return {burstOnly,both,silkOnly,silkSources,earlyOwners,silkEdges,layerBy};
 }
 throw Error('无法在第'+spec.level+'关布置无循环的缠丝来源/爆裂区域');
}
function buildOwnerOrder(sources,bursts,spec){
 const normal=sources.filter(i=>!bursts.includes(i)),brief=spec.designBrief||'';
 if(!bursts.length)return normal;
 if(/一对|首对|短接续/.test(brief)&&bursts.length>=2)return [...bursts.slice(0,2),...normal,...bursts.slice(2)];
 const order=[];let cursor=0;
 bursts.forEach((b,i)=>{const at=Math.floor((i+1)*normal.length/(bursts.length+1));order.push(...normal.slice(cursor,at),b);cursor=at});
 order.push(...normal.slice(cursor));return order;
}
export function generateAdvancedLevel(number,{design,campaignLayout,createCore}){
 const spec=design.levels.find(x=>x.level===number);
 if(!spec)throw Error('设计文档缺少第'+number+'关');
 const rng=seeded(number*7919+17),cells=campaignLayout(number);
 if(cells.length!==spec.ringCount)throw Error('玉镯数量与设计配额不一致');
 const adj=cells.map((p,i)=>cells.map((q,j)=>j).filter(j=>j!==i&&Math.abs(distance(p,cells[j])-92.0001)<.05));
 const m0=spec.ownedClaspRingCounts[0],quota=[];
 for(let k=1;k<=6;k++)for(let j=0;j<spec.ownedClaspRingCounts[k];j++)quota.push(k);
 quota.sort((a,b)=>b-a);
 const score=set=>{
  const sources=cells.map((_,i)=>i).filter(i=>!set.has(i));
  const degrees=sources.map(i=>adj[i].filter(j=>set.has(j)).length).sort((a,b)=>b-a);
  let penalty=0;
  for(let i=0;i<degrees.length;i++)if(degrees[i]<(quota[i]||0))penalty+=(quota[i]-degrees[i])**2*1000;
  penalty+=[...set].filter(i=>adj[i].every(j=>set.has(j))).length*10000;
  penalty+=[...set].filter(i=>!adj[i].some(j=>!set.has(j))).length*10000;
  return penalty;
 };
 let best=null,bestScore=Infinity,bestGroups=null;
 for(let attempt=0;attempt<60;attempt++){
  const set=new Set();while(set.size<m0)set.add(Math.floor(rng()*number));
  let current=score(set);
  for(let it=0;it<1800;it++){
   const outs=[...set],ins=cells.map((_,i)=>i).filter(i=>!set.has(i));
   const a=outs[Math.floor(rng()*outs.length)],b=ins[Math.floor(rng()*ins.length)];
   set.delete(a);set.add(b);
   const next=score(set),temperature=Math.max(.05,5*(1-it/1800));
   if(next<=current||rng()<Math.exp((current-next)/temperature))current=next;
   else{set.delete(b);set.add(a)}
   if(current<bestScore){bestScore=current;best=new Set(set)}
   if(current===0){
    const packed=makeBackgroundGroups(number,adj,set,spec.backgroundPieceCounts,cells,rng);
    if(packed){best=new Set(set);bestGroups=packed;break}
   }
  }
  if(bestGroups)break;
 }
 if(bestScore!==0||!best)throw Error('无法满足自带扣配额的相邻几何分区：'+bestScore);
 if(!bestGroups)bestGroups=makeBackgroundGroups(number,adj,best,spec.backgroundPieceCounts,cells,rng);
 if(!bestGroups)throw Error('无法满足背景扣的端点数量与几何排布：'+number);
 const targets=[...best],sources=cells.map((_,i)=>i).filter(i=>!best.has(i));
 const ranked=sources.map(i=>({i,degree:adj[i].filter(j=>best.has(j)).length})).sort((a,b)=>b.degree-a.degree||a.i-b.i);
 const quotaBy=new Map(ranked.map((x,i)=>[x.i,quota[i]]));
 const capacity=new Map(ranked.map(x=>[x.i,quotaBy.get(x.i)]));
 const ownerTargets=new Map(sources.map(i=>[i,[]])),incomingCount=new Map(targets.map(i=>[i,0]));
 const possible=new Map(targets.map(t=>[t,sources.filter(s=>adj[s].includes(t))]));
 for(const target of [...targets].sort((a,b)=>possible.get(a).length-possible.get(b).length)){
  const choices=possible.get(target).filter(s=>capacity.get(s)>0).sort((a,b)=>capacity.get(b)-capacity.get(a));
  if(!choices.length)throw Error('存在没有活动扣入口的玉镯 '+ringId(target+1));
  const owner=choices[0];ownerTargets.get(owner).push(target);
  capacity.set(owner,capacity.get(owner)-1);incomingCount.set(target,incomingCount.get(target)+1);
 }
 for(const owner of sources)while(capacity.get(owner)>0){
  const choices=adj[owner].filter(t=>best.has(t)&&!ownerTargets.get(owner).includes(t))
   .sort((a,b)=>incomingCount.get(a)-incomingCount.get(b));
  if(!choices.length)throw Error('自带扣数量无法补齐 '+ringId(owner+1));
  const target=choices[0];ownerTargets.get(owner).push(target);
  capacity.set(owner,capacity.get(owner)-1);incomingCount.set(target,incomingCount.get(target)+1);
 }
 const points=cells.map((p,i)=>[ringId(i+1),p.x,p.y,0]),links=[];
 for(const owner of sources)for(const target of ownerTargets.get(owner))links.push(['m',ringId(owner+1),ringId(target+1)]);
 const groups=bestGroups;
 const specialPlan=number<131
  ?{burstOnly:chooseBurstNodes(spec,sources,adj,cells,quotaBy,groups,rng),both:[],silkOnly:[],silkSources:[],silkEdges:[],layerBy:new Map()}
  :buildSpecialPlan(spec,best,sources,adj,cells,ownerTargets,rng);
 const bursts=[...specialPlan.burstOnly,...specialPlan.both];
 const backgroundPieces=groups.map((group,i)=>{
  const pieceId='F'+String(i+1).padStart(3,'0'),members=group.members.map(j=>cells[j]);
  const anchor=group.anchor;
  const endpoints=group.members.map((j,k)=>{
   const p=cells[j],dx=anchor.x-p.x,dy=anchor.y-p.y,length=Math.hypot(dx,dy);
   return{id:pieceId+'-H'+(k+1),receiverId:ringId(j+1),pointWorld:{x:p.x+40*dx/length,y:p.y+40*dy/length},
    endpointWorldAngle:norm(Math.atan2(dy,dx)*180/Math.PI),endpointWidth:7};
  });
  return{id:pieceId,heads:group.members.length,anchorWorld:anchor,endpoints,branchPaths:endpoints.map(e=>[anchor,e.pointWorld])};
 });
 const incomingAngles=Array.from({length:number},()=>[]);
 for(const [,owner,target] of links){
  incomingAngles[Number(target.slice(1))-1].push(angle(cells[Number(target.slice(1))-1],cells[Number(owner.slice(1))-1]));
  incomingAngles[Number(owner.slice(1))-1].push(angle(cells[Number(owner.slice(1))-1],cells[Number(target.slice(1))-1]));
 }
 for(const piece of backgroundPieces)for(const e of piece.endpoints)incomingAngles[Number(e.receiverId.slice(1))-1].push(e.endpointWorldAngle);
 for(let i=0;i<number;i++){
  let selected=0,clearance=-1;
  for(let a=0;a<360;a++){const gap=Math.min(180,...incomingAngles[i].map(x=>Math.abs(diff(a,x))));if(gap>clearance){clearance=gap;selected=a}}
  if(clearance<=3)throw Error('初始缺口无法避开锁扣 '+ringId(i+1));
  points[i][3]=selected;
 }
 const special={rings:[
  ...specialPlan.burstOnly.map(i=>({id:ringId(i+1),attribute:'burst',silkLayers:0})),
  ...specialPlan.silkOnly.map(i=>({id:ringId(i+1),attribute:'silk',silkLayers:specialPlan.layerBy.get(i)})),
  ...specialPlan.both.map(i=>({id:ringId(i+1),attribute:'burst+silk',silkLayers:specialPlan.layerBy.get(i)}))
 ],silkEdges:specialPlan.silkEdges};
 const level={name:'第'+number+'关',kind:'formal',revision:1,tip:spec.designBrief,points,links,backgroundPieces,special,timed:null};
 const Core=createCore(level);let state=Core.make(0);
 const errors=Core.validate(state);if(errors.length)throw Error('初始物理校验失败：'+errors.slice(0,8).join('；'));
 const solution=[];
 function rotateTo(targetId,rodId){
  if(Core.ring(state,targetId)?.life!=='active')return;
  const rod=state.rods.find(z=>z.id===rodId);if(!rod||!Core.exists(state,rod))return;
  const endpoint=Core.endpoints(state,rod).find(e=>e.id===targetId);if(!endpoint)return;
  const ring=Core.ring(state,targetId),delta=Core.diff(Core.angle(ring,endpoint.p),ring.a);
  if(Math.abs(delta)<.001)return;
  let accepted=null,reason='';
  for(const turn of[delta,delta>0?delta-360:delta+360]){
   const trial=Core.clone(state),result=Core.request(trial,targetId,turn);
   const nextRod=trial.rods.find(z=>z.id===rodId);
   const released=Core.ring(trial,targetId)?.life!=='active'||!nextRod||!Core.exists(trial,nextRod);
   if(!result.blocked&&(Math.abs(result.done)>Math.abs(turn)-.01||released)){accepted={trial,result};break}
   reason=result.blocked?.text||'只完成了 '+result.done+'°';
  }
  if(!accepted)throw Error('物理路线被阻挡 '+targetId+'/'+rodId+'：'+reason);
  state=accepted.trial;solution.push({id:targetId,delta:accepted.result.done,rod:rodId});
 }
 if(number>=131&&specialPlan.silkSources.length){
  const silkSourceIds=new Set(specialPlan.silkSources.map(i=>ringId(i+1)));
  for(const owner of specialPlan.earlyOwners){
   const ownerId=ringId(owner+1);if(Core.ring(state,ownerId)?.life!=='active')continue;
   const rods=state.rods.filter(z=>z.kind==='m'&&z.owner===ownerId).map(z=>z.id);
   for(const rodId of rods){
    if(Core.ring(state,ownerId)?.life!=='active')break;
    const rod=state.rods.find(z=>z.id===rodId);if(rod&&Core.exists(state,rod))rotateTo(rod.targets[0],rodId);
   }
   Core.settle(state);
  }
  for(const piece of backgroundPieces)for(const e of piece.endpoints)
   if(silkSourceIds.has(e.receiverId)&&Core.ring(state,e.receiverId)?.life==='active')rotateTo(e.receiverId,piece.id);
  Core.settle(state);
 }
 const sourceOrder=number<131?buildOwnerOrder(sources,bursts,spec):sources;
 for(const owner of sourceOrder){
  const ownerId=ringId(owner+1);if(Core.ring(state,ownerId)?.life!=='active')continue;
  const rods=state.rods.filter(z=>z.kind==='m'&&z.owner===ownerId).map(z=>z.id);
  for(const rodId of rods){
   if(Core.ring(state,ownerId)?.life!=='active')break;
   const rod=state.rods.find(z=>z.id===rodId);if(rod&&Core.exists(state,rod))rotateTo(rod.targets[0],rodId);
  }
  Core.settle(state);
 }
 for(const piece of backgroundPieces)for(const e of piece.endpoints)
  if(Core.ring(state,e.receiverId)?.life==='active')rotateTo(e.receiverId,piece.id);
 Core.settle(state);
 const remaining=state.rings.filter(r=>r.life==='active').map(r=>r.id);
 if(remaining.length)throw Error('完整路线未通关，剩余 '+remaining.length+' 枚：'+remaining.slice(0,18).join(','));
 if(state.rods.some(z=>Core.exists(state,z)))throw Error('通关后仍存在活动锁扣');
 if(spec.timedChallenge){
  const steps=solution.length,seconds=spec.timePolicy.secondsPerStep,thinking=spec.timePolicy.thinkingAllowanceSeconds;
  const duration=5*Math.ceil((steps*seconds+thinking)/5);
  level.timed={durationSeconds:duration,formulaSeconds:duration,routeSteps:steps};
 }
 const angleMap=new Map(points.map(p=>[p[0],p[3]]));
 level.hintGraph={kind:'stages',stages:solution.map((step,i)=>{
  const target=norm(angleMap.get(step.id)+step.delta);angleMap.set(step.id,target);
  return{id:'S'+(i+1),ringId:step.id,targetAngle:target,claspId:step.rod,requires:i?['S'+i]:[]};
 })};
 level.proof={steps:solution.length,engineReplay:true};
 const actualQuota=ranked.map(x=>quotaBy.get(x.i)).sort((a,b)=>a-b);
 return{level,solution,stats:{level:number,rings:number,edges:links.length,sourceCount:sources.length,targetCount:targets.length,
  backgroundPieces:backgroundPieces.length,headCounts:backgroundPieces.reduce((a,p)=>(a[p.heads]=(a[p.heads]||0)+1,a),{}),
  bursts:bursts.length,silkOnly:specialPlan.silkOnly.length,both:specialPlan.both.length,
  silkEdges:specialPlan.silkEdges.length,routeSteps:solution.length,remaining:0,
  ownedClaspRingCounts:actualQuota.reduce((a,q)=>(a[q]=(a[q]||0)+1,a),{})}};
}
