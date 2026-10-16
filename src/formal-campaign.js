import legacyLevel from './formal-level.js';
import legacySolution from './legacy-formal-solution.js';
import {mechanismFormal} from './formal-mechanisms.js';
import {campaignLayout,peelOrder,incomingAngle} from './campaign-layout.js';

// Hint dependency metadata is generated ONCE with the level definition.
const norm=a=>((a%360)+360)%360;
function legacyGraph(){
 const angles=new Map(legacyLevel.points.map(p=>[p[0],p[3]]));
 return {kind:'stages',stages:legacySolution.map((action,i)=>{
  const targetAngle=norm(angles.get(action.id)+action.delta);
  angles.set(action.id,targetAngle);
  return {id:'S'+(i+1),ringId:action.id,targetAngle,requires:i?['S'+i]:[]};
 })};
}
export const formalLevels=[],formalSolutions=[];
for(let number=1;number<=100;number++){
 if(number===1){
  // Restore the original ten-ring introduction; later mixed mechanisms stay intact.
  const nodes=campaignLayout(10),order=peelOrder(nodes);
  const points=nodes.map((p,i)=>[p.id,p.x,p.y,i?(incomingAngle(nodes,i)+20+360)%360:170]);
  const links=nodes.slice(1).map(p=>['m',nodes[p.parent].id,p.id]);
  const hintGraph={kind:'dependency',order:order.map(i=>nodes[i].id),nodes:nodes.map((p,i)=>({id:p.id,requires:nodes.filter(n=>n.parent===i).map(n=>n.id),claspId:i?'L'+i:null}))};
  formalLevels.push({name:'第1关',kind:'formal',revision:2,tip:'先观察锁扣归属，从外围逐步解开相扣的玉镯。',points,links,hintGraph});
  formalSolutions.push(order.map(i=>({id:nodes[i].id,delta:-20})));continue;
 }
 if(number===45){formalLevels.push({...legacyLevel,hintGraph:legacyGraph()});formalSolutions.push(legacySolution);continue}
 const mixed=mechanismFormal(number);
 if(!mixed)throw Error('Missing mixed-clasp campaign level '+number);
 formalLevels.push(mixed.level);formalSolutions.push(mixed.solution);
}
