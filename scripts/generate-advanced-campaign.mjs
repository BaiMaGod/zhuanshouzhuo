// Deterministic authoring helper for advanced campaign levels.
// A level is returned only after Core.validate and a complete Core.request replay.
// This helper never mutates ring life, clasp state, or the solution state directly.
const norm=a=>((a%360)+360)%360;
const diff=(a,b)=>((a-b+540)%360)-180;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a,b)=>norm(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
const ringId=n=>'R'+String(n).padStart(3,'0');
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function makeBackgroundGroups(n,adj,targetSet,counts,rng){
 const triangles=[];
 for(let a=0;a<n;a++)if(targetSet.has(a))for(const b of adj[a])if(b>a&&targetSet.has(b))
  for(const c of adj[b])if(c>b&&targetSet.has(c)&&adj[a].includes(c))triangles.push([a,b,c]);
 const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const pairCount=counts[0]||0,tripleCount=counts[1]||0;
 for(let h=4;h<=6;h++)if(counts[h-2])throw Error('当前批次尚未开放四至六头背景扣');
 const pairAdj=new Map([...targetSet].map(i=>[i,adj[i].filter(j=>targetSet.has(j))]));
 const memo=new Map();
 function matchPairs(vertices,needed){
  if(needed===0)return[];
  if(vertices.length<needed*2)return null;
  const key=vertices.join(',')+'|'+needed;if(memo.has(key))return memo.get(key);
  let selected=-1,options=null;
  for(const v of vertices){
   const neighbors=pairAdj.get(v).filter(w=>vertices.includes(w));
   if(neighbors.length&&(!options||neighbors.length<options.length)){selected=v;options=neighbors}
  }
  if(selected<0){memo.set(key,null);return null}
  const rest=vertices.filter(v=>v!==selected);
  for(const neighbor of shuffle(options)){
   const next=matchPairs(rest.filter(v=>v!==neighbor),needed-1);
   if(next){const answer=[[selected,neighbor],...next];memo.set(key,answer);return answer}
  }
  const skipped=matchPairs(rest,needed);
  memo.set(key,skipped);return skipped;
 }
 const tripleOptions=shuffle(triangles);
 function chooseTriples(available,remaining,chosen){
  if(remaining===0){
   const pairs=matchPairs(available,pairCount);
   return pairs?[...chosen,...pairs]:null;
  }
  for(const group of tripleOptions){
   if(!group.every(v=>available.includes(v)))continue;
   const result=chooseTriples(available.filter(v=>!group.includes(v)),remaining-1,[...chosen,group]);
   if(result)return result;
  }
  return null;
 }
 return chooseTriples([...targetSet],tripleCount,[]);
}
function chooseBurstNodes(spec,sources,adj,cells,quotaBy,groups,rng){
 const count=spec.burstOnly+spec.both;if(!count)return[];
 const brief=spec.designBrief||'',wantsPair=/一对|首对|短接续/.test(brief);
 const candidates=sources.map(i=>({i,degree:adj[i].length,quota:quotaBy.get(i)}))
  .sort((a,b)=>a.degree-b.degree||a.quota-b.quota||a.i-b.i);
 const groupTargets=new Set(groups.flat()),touchesGroup=i=>adj[i].some(j=>groupTargets.has(j));
 const far=(i,chosen,min=150)=>chosen.every(j=>!adj[i].includes(j)&&distance(cells[i],cells[j])>=min);
 let chosen=[];
 if(spec.level===127&&count===2){
  const near=candidates.filter(x=>touchesGroup(x.i)),farSide=candidates.filter(x=>!touchesGroup(x.i));
  for(const a of near){const b=farSide.find(x=>x.i!==a.i&&far(x.i,[a.i]));if(b){chosen=[a.i,b.i];break}}
 }
 if(!chosen.length&&wantsPair&&count>=2){
  const pairs=[];
  for(const a of candidates)for(const b of candidates)
   if(a.i<b.i&&adj[a.i].includes(b.i))pairs.push([a.i,b.i]);
  pairs.sort((a,b)=>(adj[a[0]].length+adj[a[1]].length)-(adj[b[0]].length+adj[b[1]].length));
  for(const pair of pairs){
   const extra=[];
   for(const c of candidates){if(pair.includes(c.i))continue;if(far(c.i,[...pair,...extra]))extra.push(c.i);if(extra.length===count-2)break}
   if(extra.length===count-2){chosen=[...pair,...extra];break}
  }
 }
 if(!chosen.length&&spec.level===119){
  for(const group of groups.filter(g=>g.length===3)){
   const eligible=candidates.filter(x=>group.every(t=>!adj[x.i].includes(t)));
   const picked=[];
   for(const x of eligible){if(far(x.i,picked))picked.push(x.i);if(picked.length===count)break}
   if(picked.length===count){chosen=picked;break}
  }
 }
 if(!chosen.length){
  for(let attempt=0;attempt<180;attempt++){
   const pool=[...candidates].sort(()=>rng()-.5),picked=[];
   for(const x of pool){if(far(x.i,picked))picked.push(x.i);if(picked.length===count)break}
   if(picked.length<count)for(const x of pool)if(!picked.includes(x.i)&&far(x.i,picked,92.01)){picked.push(x.i);if(picked.length===count)break}
   if(picked.length===count){chosen=picked;break}
  }
 }
 if(chosen.length!==count)throw Error('无法放置 '+count+' 枚烈焰玉镯');
 if(spec.level===119&&!groups.some(g=>g.length===3&&g.every(t=>!chosen.some(b=>adj[b].includes(t)))))
  throw Error('第119关必须保留至少一件未被爆裂触及的三头背景扣');
 return chosen;
}
function buildOwnerOrder(sources,bursts,spec){
 const normal=sources.filter(i=>!bursts.includes(i)),brief=spec.designBrief||'';
 if(!bursts.length)return normal;
 if(/一对|首对|短接续/.test(brief)&&bursts.length>=2)
  return [...bursts.slice(0,2),...normal,...bursts.slice(2)];
 if(spec.level===117)return [...normal.slice(0,Math.ceil(normal.length*.25)),bursts[0],...normal.slice(Math.ceil(normal.length*.25)),bursts[1]];
 if(spec.level===123)return [...normal.slice(0,Math.ceil(normal.length*.15)),bursts[0],...normal.slice(Math.ceil(normal.length*.15)),bursts[1]];
 if(spec.level===115||spec.level===125)return [...normal,...bursts];
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
  if(!makeBackgroundGroups(number,adj,set,spec.backgroundPieceCounts,()=>.5))penalty+=50000;
  return penalty;
 };
 let best=null,bestScore=Infinity;
 for(let attempt=0;attempt<100;attempt++){
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
   if(current===0)break;
  }
  if(bestScore===0)break;
 }
 if(bestScore!==0||!best)throw Error('无法满足自带扣配额的相邻几何分区：'+bestScore);
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
 const groups=makeBackgroundGroups(number,adj,best,spec.backgroundPieceCounts,rng);
 if(!groups)throw Error('背景扣组无法满足配额');
 const bursts=chooseBurstNodes(spec,sources,adj,cells,quotaBy,groups,rng);
 const backgroundPieces=groups.map((group,i)=>{
  const pieceId='F'+String(i+1).padStart(3,'0'),members=group.map(j=>cells[j]);
  const anchor={x:members.reduce((s,p)=>s+p.x,0)/members.length,y:members.reduce((s,p)=>s+p.y,0)/members.length};
  const endpoints=group.map((j,k)=>{
   const p=cells[j],dx=anchor.x-p.x,dy=anchor.y-p.y,length=Math.hypot(dx,dy);
   return{id:pieceId+'-H'+(k+1),receiverId:ringId(j+1),pointWorld:{x:p.x+40*dx/length,y:p.y+40*dy/length},
    endpointWorldAngle:norm(Math.atan2(dy,dx)*180/Math.PI),endpointWidth:7};
  });
  return{id:pieceId,heads:group.length,anchorWorld:anchor,endpoints,branchPaths:endpoints.map(e=>[anchor,e.pointWorld])};
 });
 const incomingAngles=Array.from({length:number},()=>[]);
 for(const [,owner,target] of links)incomingAngles[Number(target.slice(1))-1].push(angle(cells[Number(target.slice(1))-1],cells[Number(owner.slice(1))-1]));
 for(const piece of backgroundPieces)for(const e of piece.endpoints)incomingAngles[Number(e.receiverId.slice(1))-1].push(e.endpointWorldAngle);
 for(let i=0;i<number;i++){
  let selected=0,clearance=-1;
  for(let a=0;a<360;a++){const gap=Math.min(180,...incomingAngles[i].map(x=>Math.abs(diff(a,x))));if(gap>clearance){clearance=gap;selected=a}}
  if(clearance<=3)throw Error('初始缺口无法避开锁扣 '+ringId(i+1));
  points[i][3]=selected;
 }
 const special={rings:bursts.map(i=>({id:ringId(i+1),attribute:'burst',silkLayers:0})),silkEdges:[]};
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
 for(const owner of buildOwnerOrder(sources,bursts,spec)){
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
  bursts:bursts.length,routeSteps:solution.length,remaining:0,
  ownedClaspRingCounts:actualQuota.reduce((a,q)=>(a[q]=(a[q]||0)+1,a),{})}};
}
