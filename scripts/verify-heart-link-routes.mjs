import {writeFileSync} from 'node:fs';
import C from '../src/core.js';
import solutions from '../src/solutions.js';
const verified={};
for(let n=131;n<=145;n++){
 const index=n+9,s=C.make(index),route=[];
 if(C.settle(C.clone(s)).length)throw Error('Initial auto clear '+n);
 const errors=C.validate(s);if(errors.length)throw Error(JSON.stringify(errors));
 for(const a of solutions[index]){
  if(C.ring(s,a.id).life!=='active')continue;
  const result=C.request(s,a.id,a.delta);
  if(result.blocked)throw Error(n+': '+JSON.stringify(result.blocked));
  if(Math.abs(result.done)>.001)route.push({...a,delta:result.done});
 }
 if(s.rings.some(r=>r.life==='active')||s.rods.some(z=>C.exists(s,z)))throw Error('Uncleared '+n);
 verified[n]=route;
 writeFileSync('tests/results/heart-links/routes.json',JSON.stringify(verified));
 console.log(n,'groups',s.special.linkGroups.length,'verified steps',route.length);
}
writeFileSync('src/heart-link-routes.js','// Verified by scripts/verify-heart-link-routes.mjs through Core.request.\nexport const heartLinkRoutes='+JSON.stringify(verified)+';\n');
