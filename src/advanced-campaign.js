import {campaignLayout} from './campaign-layout.js';
import {challengeDuration} from './advanced-mechanics.js';
import {buildLevel107GeometryCandidate} from './level107-geometry-candidate.js';
import {advanced110113} from './advanced-campaign-110-113.js';
import {advanced108109} from './advanced-campaign-108-109.js';
import {earlyBoards,source107,route107} from './advanced-campaign-data.js';
import {advancedCampaign114117} from './advanced-campaign-114-117.js';
import {advancedCampaign118121} from './advanced-campaign-118-121.js';
import {advancedCampaign122125} from './advanced-campaign-122-125.js';
import {advancedCampaign126129} from './advanced-campaign-126-129.js';
import {advancedCampaign130133} from './advanced-campaign-130-133.js';
import {advancedCampaign134137} from './advanced-campaign-134-137.js';
import {advancedCampaign138141} from './advanced-campaign-138-141.js';
import {advancedCampaign142145} from './advanced-campaign-142-145.js';

const cells=campaignLayout(109);
const norm=angle=>((angle%360)+360)%360;

function withRoute(level,solution){
 const angles=new Map(level.points.map(([id,,,angle])=>[id,angle]));
 const stages=solution.map(({id,delta,rod},i)=>{
  const targetAngle=norm(angles.get(id)+delta);
  angles.set(id,targetAngle);
  return {id:'S'+(i+1),ringId:id,targetAngle,claspId:rod,requires:i?['S'+i]:[]};
 });
 return {level:{...level,hintGraph:{kind:'stages',stages},proof:{steps:solution.length}},solution};
}

function makeEarlyBoard({number,angles,mounts,pairs,burst,solution}){
 const points=cells.map((p,i)=>[p.id,p.x,p.y,angles[i]]);
 const links=[...mounts.map(([a,b])=>['m',cells[a].id,cells[b].id]),
  ...pairs.map(([a,b])=>['b',cells[a].id,cells[b].id])];
 const special={rings:burst.map(i=>({id:cells[i].id,attribute:'burst',silkLayers:0})),silkEdges:[]};
 const timed=number===105?challengeDuration({
  steps:solution.length,secondsPerStep:3,thinkingSeconds:20,routeVerified:true
 }):null;
 return withRoute({name:'第'+number+'关',kind:'formal',revision:1,
  tip:'消除烈焰玉镯，火焰花瓣会消除周围一圈玉镯。',points,links,special,
  timed:timed===null?null:{durationSeconds:timed,formulaSeconds:timed,routeSteps:solution.length}},solution);
}

const board107=buildLevel107GeometryCandidate(source107).level;
export const advancedCampaign=[
 ...earlyBoards.map(makeEarlyBoard),
 withRoute({...board107,name:'第107关',kind:'formal',revision:1,
  tip:'消除第一枚烈焰玉镯，火焰花瓣命中第二枚后会继续扩散。'},route107),
 ...advanced108109,
 ...advanced110113,
 ...advancedCampaign114117,
 ...advancedCampaign118121,
 ...advancedCampaign122125,
 ...advancedCampaign126129,
 ...advancedCampaign130133,
 ...advancedCampaign134137,
 ...advancedCampaign138141,
 ...advancedCampaign142145
];
