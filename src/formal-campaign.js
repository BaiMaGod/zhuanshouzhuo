import legacyLevel from './formal-level.js';
import legacySolution from './legacy-formal-solution.js';
import {campaignLayout,peelOrder,incomingAngle} from './campaign-layout.js';

export const formalLevels=[],formalSolutions=[];
for(let number=1;number<=100;number++){
 const count=number+9;
 if(count===54){formalLevels.push(legacyLevel);formalSolutions.push(legacySolution);continue}
 // A 20-degree initial offset has a verified legal peel route for all 99 new layouts.
 const nodes=campaignLayout(count),offset=20;
 const points=nodes.map((p,i)=>[p.id,p.x,p.y,i?(incomingAngle(nodes,i)+offset+360)%360:170]);
 const links=nodes.slice(1).map(p=>['m',nodes[p.parent].id,p.id]);
 formalLevels.push({name:'第'+number+'关',kind:'formal',tip:'先观察锁扣归属，从外围逐步解开相扣的玉镯。',points,links});
 formalSolutions.push(peelOrder(nodes).map(i=>({id:nodes[i].id,delta:-offset})));
}
