import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';
import solutions from '../dist/js/solutions.js';
import {HintGraphRuntime} from '../dist/js/hint-graph.js';
import {VERIFIED_RELAYS} from '../dist/js/formal-relays.js';
import {VERIFIED_SWITCHES} from '../dist/js/formal-archetypes.js';

test('30 verified two-tier relays create an actual receiver-owned moving clasp',()=>{
 const ids=Object.keys(VERIFIED_RELAYS).map(Number).sort((a,b)=>a-b);
 assert.equal(ids.length,30);
 for(const number of ids){
  const index=number+9,level=C.levels[index],s=C.make(index);
  const [owner,receiver,firstHub,lateHub]=VERIFIED_RELAYS[number];
  assert.equal(level.revision,VERIFIED_SWITCHES[number]?4:3,'relay revision '+number);
  assert.deepEqual(level.difficulty.relay,{owner,receiver,firstHub,lateHub});
  assert.ok(!level.difficulty.centers.includes(owner),'relay owner is not another full hub');
  const relay=s.rods.find(z=>z.owner===owner&&z.targets[0]===receiver);
  assert.ok(relay,'missing true moving relay clasp '+number);
  assert.ok(s.rods.some(z=>z.kind==='m'&&z.targets.includes(owner)),'relay owner must be held by upstream clasp '+number);
  assert.ok(s.rods.some(z=>z.kind==='m'&&z.targets.includes(receiver)),'downstream bracelet must be connected '+number);
  const stages=level.hintGraph.stages;
  const relayStage=stages.findIndex(stage=>stage.claspId===relay.id);
  assert.ok(relayStage>0,'relay stage missing '+number);
  assert.equal(stages[relayStage].ringId,receiver,'relay gap belongs to receiver '+number);
  assert.equal(stages[relayStage].releaseId,owner,'relay stage unlocks owned moving rod '+number);
  assert.ok(stages.slice(0,relayStage).some(x=>x.releaseId===firstHub),'first hub must precede relay '+number);
  assert.ok(stages.slice(relayStage+1).some(x=>x.releaseId===lateHub),'later hub must follow relay '+number);
  assert.equal(stages.length,solutions[index].length);
  for(let j=0;j<stages.length;j++){
   const stage=stages[j];
   assert.equal(stage.claspId,solutions[index][j].rod,'stage and solution clasp ids match '+number+'/'+j);
   const z=s.rods.find(z=>z.id===stage.claspId);
   assert.ok(z,'missing clasp '+number+'/'+stage.claspId);
   assert.ok(C.endpoints(s,z).some(e=>e.id===stage.ringId),
    'stage points at wrong cuff '+number+'/'+j);
   assert.deepEqual(stage.requires,j?['S'+j]:[],'stage dependency '+number+'/'+j);
  }
  assert.deepEqual(C.validate(s),[], 'initial geometry '+number);
  assert.deepEqual(C.settle(C.clone(s)),[], 'no initial deletion '+number);
 }
});

test('relay levels perform real continuous rotation, and their hints recover on reload',()=>{
 // Full campaign suite checks every route; focus this regression on hint+physics together.
 for(const number of [13,25,40,74]){
  const index=number+9,s=C.make(index);
  let hint=new HintGraphRuntime(index,s),count=0;
  while(s.rings.some(r=>r.life==='active')){
   assert.ok(count<solutions[index].length+10,'hint loop on level '+number);
   const action=hint.next(s);
   assert.ok(action,'missing hint '+number+'/'+count);
   const old=C.ring(s,action.id).a;
   const res=C.request(s,action.id,action.delta);
   assert.equal(res.blocked,null,'blocked hinted relay '+number+'/'+count);
   assert.ok(Math.abs(res.done)>.001,'hint did not move '+number+'/'+count);
   hint.observe(s,res.removed,{id:action.id,from:old,done:res.done});
   count++;
   if(count===3)hint=new HintGraphRuntime(index,s,hint.progress);
  }
  assert.ok(s.rods.every(z=>!C.exists(s,z)),'no residual clasps '+number);
 }
});

test('non-relay intro and restored level 45 keep previous revisions',()=>{
 for(const n of [1,2,10,11,12,45,100]){
  const l=C.levels[n+9];
  assert.equal(l.revision||0,n===1?2:n===45?0:n<=10?1:2);
 }
});
