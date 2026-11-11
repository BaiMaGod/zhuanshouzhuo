// Constructive, bounded search for physically legal progress in authored levels.
// EVERY accepted move is Core.request on a fresh state; no direct life/rod edits.
// The result is not a solvability certificate unless an independent full replay
// reaches zero active bracelets and no live clasps.
export function planPhysicalProgress(Core,initial,{maxRounds=100,maxSingleReleases=250}={}){
 const active=s=>s.rings.filter(r=>r.life==='active').length;
 let current=Core.clone(initial);const actions=[];
 function oneStep(state){
  const live=state.rods.filter(z=>Core.exists(state,z)),options=[];
  for(const r of state.rings){
   if(r.life!=='active')continue;
   if(live.some(z=>z.owner===r.id&&Core.endpoints(state,z).some((e,i)=>state.states[z.id][i]==='latched')))continue;
   const incoming=live.flatMap(z=>Core.endpoints(state,z).flatMap((e,i)=>
    e.id===r.id&&state.states[z.id][i]==='latched'?[{rod:z.id,angle:Core.angle(r,e.p)}]:[]));
   if(!incoming.length||incoming.some(h=>Math.abs(Core.diff(h.angle,incoming[0].angle))>2*Core.tolerance-.01))continue;
   const delta=Core.diff(incoming[0].angle,r.a);
   if(Math.abs(delta)>.01)options.push({id:r.id,delta,rod:incoming[0].rod,heads:incoming.length});
  }
  options.sort((a,b)=>a.heads-b.heads||Math.abs(a.delta)-Math.abs(b.delta));
  for(const o of options)for(const delta of[o.delta,o.delta>0?o.delta-360:o.delta+360]){
   const stateCopy=Core.clone(state),out=Core.request(stateCopy,o.id,delta);
   if(!out.blocked&&out.removed.length)return{state:stateCopy,actions:[{id:o.id,delta:out.done,removed:out.removed,rod:o.rod}]};
  }
  return null;
 }
 function eligibleOwners(state){
  const live=state.rods.filter(z=>Core.exists(state,z)),options=[];
  for(const r of state.rings){
   if(r.life!=='active')continue;
   const incoming=live.flatMap(z=>Core.endpoints(state,z).flatMap((e,i)=>
    e.id===r.id&&state.states[z.id][i]==='latched'?[e]:[]));
   if(incoming.length)continue;
   const outgoing=live.filter(z=>z.owner===r.id&&z.targets.some(id=>Core.ring(state,id)?.life==='active'&&state.states[z.id][0]==='latched'));
   if(!outgoing.length||new Set(outgoing.map(z=>z.targets[0])).size!==outgoing.length)continue;
   options.push({owner:r.id,rods:outgoing.map(z=>({id:z.id,target:z.targets[0]}))});
  }
  return options.sort((a,b)=>a.rods.length-b.rods.length);
 }
 function tryMacro(state,option){
  let candidateState=Core.clone(state);const moves=[];
  for(const {id,target} of option.rods){
   if(Core.ring(candidateState,option.owner)?.life!=='active')break;
   const rod=candidateState.rods.find(r=>r.id===id),ring=Core.ring(candidateState,target);
   if(!rod||!ring||ring.life!=='active')continue;
   const end=Core.endpoints(candidateState,rod).find(e=>e.id===target);
   if(!end)return null;
   const delta=Core.diff(Core.angle(ring,end.p),ring.a);
   if(Math.abs(delta)<.001)continue;
   let picked=null;
   for(const turn of[delta,delta>0?delta-360:delta+360]){
    const trial=Core.clone(candidateState),result=Core.request(trial,target,turn);
    if(!result.blocked&&Math.abs(result.done)>Math.abs(delta)-2){picked={trial,result};break}
   }
   if(!picked)return null;
   candidateState=picked.trial;
   moves.push({id:target,delta:picked.result.done,removed:picked.result.removed,rod:id});
  }
  const gain=active(state)-active(candidateState);
  return gain>0?{state:candidateState,actions:moves,gain,owner:option.owner}:null;
 }
 let singles=0,macros=0;
 for(let round=0;round<maxRounds;round++){
  for(let i=0;i<maxSingleReleases;i++){
   const step=oneStep(current);if(!step)break;
   current=step.state;actions.push(...step.actions);singles++;
  }
  if(!active(current))break;
  let best=null;
  for(const owner of eligibleOwners(current)){
   const next=tryMacro(current,owner);
   if(next&&(!best||next.gain>best.gain||next.gain===best.gain&&next.actions.length<best.actions.length))best=next;
  }
  if(!best)break;
  current=best.state;actions.push(...best.actions);macros++;
 }
 return{state:current,actions,removed:active(initial)-active(current),remaining:active(current),
  complete:active(current)===0,statistics:{singleReleaseActions:singles,macroPlans:macros}};
}
