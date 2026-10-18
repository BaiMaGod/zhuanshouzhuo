// Hand-selected, continuously collision-tested "double-key switch" puzzles.
// [former center owner, rotating shared receiver, first new owner, second new owner]
// These ARE NOT additional center stars: both leaf receivers are converted into
// movable-clasp owners, so the shared receiver must rotate to two different cuffs.
// See tests/archetypes.test.mjs and tests/full/campaign-route.test.mjs.
export const VERIFIED_SWITCHES={
 "15": [
  "R22",
  "R9",
  "R16",
  "R23"
 ],
 "20": [
  "R15",
  "R25",
  "R11",
  "R29"
 ],
 "25": [
  "R32",
  "R10",
  "R18",
  "R24"
 ],
 "30": [
  "R36",
  "R21",
  "R20",
  "R39"
 ],
 "35": [
  "R12",
  "R4",
  "R6",
  "R16"
 ],
 "38": [
  "R3",
  "R2",
  "R1",
  "R8"
 ],
 "41": [
  "R48",
  "R24",
  "R32",
  "R44"
 ],
 "46": [
  "R8",
  "R3",
  "R2",
  "R15"
 ],
 "49": [
  "R7",
  "R5",
  "R1",
  "R13"
 ],
 "50": [
  [
   "R22",
   "R9",
   "R16",
   "R23"
  ],
  [
   "R15",
   "R3",
   "R8",
   "R11"
  ]
 ],
 "54": [
  "R7",
  "R1",
  "R3",
  "R5"
 ],
 "56": [
  [
   "R60",
   "R32",
   "R42",
   "R48"
  ],
  [
   "R2",
   "R14",
   "R8",
   "R10"
  ]
 ],
 "58": [
  "R9",
  "R16",
  "R4",
  "R22"
 ],
 "61": [
  "R51",
  "R35",
  "R27",
  "R63"
 ],
 "64": [
  "R50",
  "R34",
  "R26",
  "R62"
 ],
 "68": [
  "R43",
  "R75",
  "R61",
  "R63"
 ],
 "70": [
  "R50",
  "R26",
  "R34",
  "R46"
 ],
 "73": [
  "R42",
  "R32",
  "R18",
  "R60"
 ],
 "75": [
  [
   "R67",
   "R59",
   "R41",
   "R83"
  ],
  [
   "R70",
   "R44",
   "R52",
   "R76"
  ],
  [
   "R64",
   "R56",
   "R38",
   "R80"
  ]
 ],
 "76": [
  "R69",
  "R59",
  "R58",
  "R83"
 ],
 "79": [
  "R53",
  "R45",
  "R29",
  "R71"
 ],
 "83": [
  "R18",
  "R34",
  "R12",
  "R42"
 ],
 "84": [
  [
   "R92",
   "R64",
   "R80",
   "R84"
  ],
  [
   "R18",
   "R34",
   "R12",
   "R42"
  ]
 ],
 "88": [
  "R62",
  "R42",
  "R34",
  "R74"
 ],
 "91": [
  "R15",
  "R29",
  "R21",
  "R25"
 ],
 "94": [
  "R15",
  "R25",
  "R11",
  "R29"
 ],
 "98": [
  "R17",
  "R27",
  "R13",
  "R31"
 ],
 "100": [
  [
   "R20",
   "R8",
   "R14",
   "R21"
  ],
  [
   "R54",
   "R86",
   "R66",
   "R72"
  ],
  [
   "R2",
   "R1",
   "R3",
   "R6"
  ]
 ]
};
const norm=a=>((a%360)+360)%360;
const diff=(a,b)=>((a-b+540)%360)-180;
const angle=(a,b)=>norm(Math.atan2(b[2]-a[2],b[1]-a[1])*180/Math.PI);

export function applyVerifiedSwitch(input,number){
 const data=VERIFIED_SWITCHES[number];if(!data)return input;
 const entries=typeof data[0]==='string'?[data]:data;
 return entries.reduce((current,entry)=>applyOneSwitch(current,number,entry),input);
}
function applyOneSwitch(input,number,entry){
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
 (level.difficulty.switches??=[]).push({center,pivot,leaves});
 const angles=new Map(level.points.map(p=>[p[0],p[3]]));
 const solution=stages.map(stage=>{
  const delta=diff(stage.targetAngle,angles.get(stage.ringId));
  angles.set(stage.ringId,stage.targetAngle);
  return{id:stage.ringId,delta,rod:stage.claspId};
 });
 return{level,solution};
}
