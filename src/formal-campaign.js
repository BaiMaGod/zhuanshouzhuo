import legacyLevel from './formal-level.js';
import legacySolution from './legacy-formal-solution.js';
import {mechanismFormal} from './formal-mechanisms.js';

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
 if(number===45){formalLevels.push({...legacyLevel,hintGraph:legacyGraph()});formalSolutions.push(legacySolution);continue}
 const mixed=mechanismFormal(number);
 if(!mixed)throw Error('Missing mixed-clasp campaign level '+number);
 formalLevels.push(mixed.level);formalSolutions.push(mixed.solution);
}
