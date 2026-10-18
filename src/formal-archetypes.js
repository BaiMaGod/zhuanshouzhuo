// Hand-selected, continuously collision-tested "double-key switch" puzzles.
// [former center owner, rotating shared receiver, first new owner, second new owner]
// These ARE NOT additional center stars: both leaf receivers are converted into
// movable-clasp owners, so the shared receiver must rotate to two different cuffs.
// See tests/archetypes.test.mjs and tests/full/campaign-route.test.mjs.
export const VERIFIED_SWITCHES={
  15:['R22','R9','R16','R23'],
  16:['R22','R9','R16','R23'],
  20:['R15','R25','R11','R29'],
  26:['R4','R5','R1','R9'],
  30:['R36','R21','R20','R39'],
  35:['R12','R4','R6','R16'],
  36:['R18','R32','R10','R42'],
  38:['R3','R2','R1','R8'],
  40:['R5','R13','R7','R17'],
  41:['R48','R24','R32','R44'],
  42:['R48','R24','R32','R44'],
  54:['R7','R1','R3','R5'],
  68:['R43','R75','R61','R63']
};
const norm=a=>((a%360)+360)%360;
const diff=(a,b)=>((a-b+540)%360)-180;
const angle=(a,b)=>norm(Math.atan2(b[2]-a[2],b[1]-a[1])*180/Math.PI);

export function applyVerifiedSwitch(input,number){
 const entry=VERIFIED_SWITCHES[number];if(!entry)return input;
 const [center,pivot,leafA,leafB]=entry,leaves=[leafA,leafB];
 const {level}=input,points=new Map(level.points.map(p=>[p[0],p]));
 if(![center,pivot,...leaves].every(id=>points.has(id)))throw Error('Switch missing ring on '+number);
 if(!leaves.every(leaf=>Math.abs(Math.hypot(points.get(leaf)[1]-points.get(pivot)[1],points.get(leaf)[2]-points.get(pivot)[2])-92.0001)<.01))
  throw Error('Switch clasp is not adjacent on '+number);
 const source=level.links,edges=[],oldToNew=new Map();
 const removed=new Set;
 // Both leaves must become true single-destination clasp owners, not
 // be held by redundant inbound clasps from a neighbouring old hub.
 for(let i=0;i<source.length;i++){
  const edge=source[i];
  if(edge[0]==='m'&&leaves.includes(edge[2])){removed.add('L'+(i+1));continue}
  oldToNew.set('L'+(i+1),'L'+(edges.length+1));
  edges.push(edge);
 }
 if(!leaves.every(leaf=>removed.size>0&&source.some(edge=>edge[0]==='m'&&edge[1]===center&&edge[2]===leaf)))
  throw Error('Switch seed clasp missing on '+number);
 if(!edges.some(edge=>edge[0]==='m'&&edge[1]===center&&edge[2]===pivot))
  throw Error('Switch center cannot release shared receiver on '+number);
 const fixedStart=edges.findIndex(edge=>edge[0]==='b');
 const insert=fixedStart<0?edges.length:fixedStart;
 edges.splice(insert,0,...leaves.map(leaf=>['m',leaf,pivot]));
 for(const [old,id] of oldToNew)if(Number(id.slice(1))>insert)
  oldToNew.set(old,'L'+(Number(id.slice(1))+leaves.length));
 const stages=level.hintGraph.stages.filter(stage=>!stage.claspId||!removed.has(stage.claspId));
 for(const stage of stages)if(stage.claspId){
  const id=oldToNew.get(stage.claspId);
  if(!id)throw Error('Switch stage lost original clasp '+number+'/'+stage.claspId);
  stage.claspId=id;
 }
 const at=stages.findLastIndex(stage=>stage.releaseId===center);
 if(at<0)throw Error('Switch center stage missing '+number);
 const extra=leaves.map((leaf,i)=>({
  ringId:pivot,releaseId:leaf,claspId:'L'+(insert+i+1),
  targetAngle:angle(points.get(pivot),points.get(leaf))
 }));
 const pivotPoint=points.get(pivot);
 while(extra.some(s=>Math.abs(diff(pivotPoint[3],s.targetAngle))<12))
  pivotPoint[3]=norm(pivotPoint[3]+17);
 stages.splice(at+1,0,...extra);
 stages.forEach((stage,i)=>{
  stage.id='S'+(i+1);
  stage.requires=i?['S'+i]:[];
 });
 level.links=edges;
 level.hintGraph.stages=stages;
 level.revision=4;
 level.difficulty.archetype='double-key-switch';
 level.difficulty.switch={center,pivot,leaves};
 const angles=new Map(level.points.map(p=>[p[0],p[3]]));
 const solution=stages.map(stage=>{
  const delta=diff(stage.targetAngle,angles.get(stage.ringId));
  angles.set(stage.ringId,stage.targetAngle);
  return{id:stage.ringId,delta,rod:stage.claspId};
 });
 return{level,solution};
}
