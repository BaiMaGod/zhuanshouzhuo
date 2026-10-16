import {Core as C} from './model.js';
import type {State} from './types.js';
// Assist only real sleeve endpoints, and never bypass collision or captive rules.
export function snapDelta(s:State,id:string,motion=0):number|null{
 const r=C.ring(s,id);if(!r||r.life!=='active')return null;
 const candidates:number[]=[];
 for(const z of s.rods)if(C.exists(s,z))for(const e of C.endpoints(s,z)){
  if(e.id!==id||Math.abs(C.dist(r,e.p)-C.R)>.025)continue;
  const d=C.diff(C.angle(r,e.p),r.a);
  if(Math.abs(d)<.01||Math.abs(d)>7||motion&&d*motion<=0)continue;
  candidates.push(d);
 }
 for(const d of candidates.sort((a,b)=>Math.abs(a)-Math.abs(b))){
  const result=C.request(C.clone(s),id,d);
  if(!result.blocked&&(result.removed.includes(id)||Math.abs(result.done-d)<.01))return d;
 }
 return null;
}
