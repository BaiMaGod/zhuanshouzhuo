// Curated two-tier relays. Each entry has been checked against continuous collisions.
// [owner receiver, downstream receiver, earlier hub, later hub]
export const VERIFIED_RELAYS = {"13":["R10","R14","R20","R18"],"15":["R11","R19","R7","R15"],"23":["R7","R3","R1","R11"],"24":["R19","R33","R11","R13"],"25":["R30","R26","R34","R16"],"27":["R18","R34","R12","R10"],"28":["R27","R35","R13","R31"],"29":["R19","R33","R11","R13"],"30":["R19","R33","R11","R13"],"31":["R26","R30","R40","R34"],"33":["R21","R39","R36","R29"],"35":["R27","R17","R13","R31"],"38":["R7","R1","R3","R5"],"39":["R40","R37","R41","R22"],"40":["R15","R8","R21","R25"],"43":["R20","R14","R28","R36"],"44":["R20","R21","R36","R8"],"49":["R44","R48","R24","R52"],"50":["R10","R32","R18","R24"],"51":["R44","R48","R60","R52"],"52":["R48","R44","R52","R60"],"53":["R11","R25","R15","R7"],"55":["R46","R50","R62","R54"],"56":["R12","R34","R62","R4"],"58":["R21","R15","R11","R29"],"63":["R34","R62","R50","R12"],"65":["R17","R5","R13","R9"],"71":["R34","R62","R42","R12"],"73":["R62","R74","R42","R50"],"74":["R61","R75","R43","R49"]};
const norm=a=>((a%360)+360)%360;
const diff=(a,b)=>((a-b+540)%360)-180;
const angle=(a,b)=>norm(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
export function applyVerifiedRelay(input,number){
 const entry=VERIFIED_RELAYS[number];if(!entry)return input;
 const [owner,receiver,firstHub,lateHub]=entry;
 const {level}=input;
 const count=level.links.filter(e=>e[0]==='m').length;
 const id='L'+(count+1);
 const nodes=new Map(level.points.map(p=>[p[0],p]));
 const a=nodes.get(owner),b=nodes.get(receiver);
 if(!a||!b||Math.abs(Math.hypot(a[1]-b[1],a[2]-b[2])-92.0001)>.01)
  throw Error('Stale relay layout on level '+number);
 const target=angle({x:b[1],y:b[2]},{x:a[1],y:a[2]});
 while(Math.abs(diff(b[3],target))<12)b[3]=norm(b[3]+17);
 level.links.splice(count,0,['m',owner,receiver]);
 const stages=level.hintGraph.stages;
 const insertAt=stages.findLastIndex(s=>s.releaseId===firstHub);
 const parentAt=stages.findIndex(s=>s.releaseId===lateHub);
 if(insertAt<0||parentAt<0||insertAt>=parentAt)
  throw Error('Stale relay stage graph on level '+number);
 for(const stage of stages)if(Number(stage.claspId?.slice(1))>count)
  stage.claspId='L'+(Number(stage.claspId.slice(1))+1);
 stages.splice(insertAt+1,0,{ringId:receiver,targetAngle:target,claspId:id,releaseId:owner});
 stages.forEach((stage,i)=>{stage.id='S'+(i+1);stage.requires=i?['S'+i]:[]});
 const angles=new Map(level.points.map(p=>[p[0],p[3]]));
 const solution=stages.map(stage=>{
  const delta=diff(stage.targetAngle,angles.get(stage.ringId));
  angles.set(stage.ringId,stage.targetAngle);
  return {id:stage.ringId,delta,rod:stage.claspId};
 });
 level.revision=3;
 level.difficulty.relay={owner,receiver,firstHub,lateHub};
 return {level,solution};
}
