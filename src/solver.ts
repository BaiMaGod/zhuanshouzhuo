import {Core as C} from './model.js';
import type {Action,State} from './types.js';
// Yield between search operations so the same solver works without Web Workers.
export function* search(initial:State,budget=600):Generator<void,Action[]|null,void>{
 const visited=new Set<string>();let count=0;
 const key=(s:State)=>s.rings.map(r=>r.life==='removed'?'x':Math.round(r.a*10)).join(',');
 function* dfs(s:State):Generator<void,Action[]|null,void>{
  yield;
  if(s.rings.every(r=>r.life==='removed'))return [];
  if(++count>budget)return null;
  const k=key(s);if(visited.has(k))return null;visited.add(k);
  const opts:{a:Action;c:State;done:number;score:number}[]=[];
  for(const a of C.candidates(s)){
   yield;const c=C.clone(s),res=C.request(c,a.id,a.delta);
   if(res.blocked||Math.abs(res.done)<.001||key(c)===k)continue;
   opts.push({a,c,done:res.done,score:res.removed.length*100-Math.abs(res.done)/360});
  }
  opts.sort((a,b)=>b.score-a.score);
  for(const o of opts){if(count>budget)return null;const rest=yield* dfs(o.c);if(rest)return [{...o.a,delta:o.done},...rest]}
  return null;
 }
 return yield* dfs(C.clone(initial));
}
export function nextFrame():Promise<void>{return new Promise(resolve=>Laya.timer.frameOnce(1,null,resolve))}
