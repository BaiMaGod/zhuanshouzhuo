import {Core as C} from './model.js';
import solutions from './solutions.js';
import type {Action,State} from './types.js';

// Match live progress (including a partly dragged ring) to the verified route.
// Simulations use clones; hints never rotate or remove a player's bracelet.
export function routeHint(state:State):Action|null{
 const reference=C.make(state.index),checkpoints:{before:State;after:State;action:Action}[]=[];
 for(const action of solutions[state.index] as Action[]){
  const before=C.clone(reference);C.request(reference,action.id,action.delta);
  checkpoints.push({before,after:C.clone(reference),action});
 }
 const same=(a:State,b:State,except?:string)=>a.rings.every(r=>{
  const q=C.ring(b,r.id)!;return r.life===q.life&&(r.life!=='active'||r.id===except||Math.abs(C.diff(r.a,q.a))<.02);
 });
 for(const {before,after,action} of checkpoints.reverse()){
  if(!same(state,before,action.id))continue;
  const ring=C.ring(state,action.id)!,goal=C.ring(after,action.id)!;
  const short=C.diff(goal.a,ring.a);
  for(const delta of [short,short>0?short-360:short+360]){
   if(Math.abs(delta)<.001)continue;
   const copy=C.clone(state),res=C.request(copy,action.id,delta);
   if(res.blocked||Math.abs(res.done)<.001||!same(copy,after))continue;
   const rod=state.rods.filter(z=>C.exists(state,z)).find(z=>C.endpoints(state,z).some(e=>e.id===ring.id&&Math.abs(C.diff(C.angle(ring,e.p),goal.a))<C.tolerance+.1));
   return {id:action.id,delta:res.done,rod:rod?.id||action.rod};
  }
 }
 return null;
}

export function formalHint(state:State):Action|null{
 const route=routeHint(state);if(route)return route;
 // Off-route states need a legal next move, not an expensive full-board DFS.
 // Prefer actual releases, then an endpoint alignment; reject every blocked move.
 let best:Action|null=null,bestScore=-Infinity;
 for(const action of C.candidates(state)){
  const copy=C.clone(state),res=C.request(copy,action.id,action.delta);
  if(res.blocked||Math.abs(res.done)<.001)continue;
  const aligned=Object.values(copy.states).flat().filter(x=>x==='aligned').length;
  const score=res.removed.length*100+aligned-Math.abs(res.done)/360;
  if(score>bestScore){bestScore=score;best={...action,delta:res.done}}
 }
 return best;
}
