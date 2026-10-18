import test from 'node:test';
import assert from 'node:assert/strict';
import Core from '../dist/js/core.js';
import solutions from '../dist/js/solutions.js';
import {HintGraphRuntime} from '../dist/js/hint-graph.js';
import {INTRO_SWITCHES} from '../dist/js/formal-switch-campaign.js';
import {VERIFIED_SWITCHES} from '../dist/js/formal-archetypes.js';
import {VERIFIED_RELAYS} from '../dist/js/formal-relays.js';

const entries=value=>!value?[]:typeof value[0]==='string'?[value]:value;

test('six early formal levels have genuine receiver-owned two-key switches',()=>{
 assert.deepEqual(Object.keys(INTRO_SWITCHES).map(Number),[2,3,5,6,8,9]);
 for(const n of Object.keys(INTRO_SWITCHES).map(Number)){
  const index=n+9,level=Core.levels[index],state=Core.make(index);
  const {pivot,keyOwners}=level.difficulty;
  assert.equal(level.revision,5);
  assert.equal(level.difficulty.archetype,'intro-two-key');
  assert.equal(level.links.filter(e=>e[0]==='b').length,0);
  assert.equal(level.links.length,n+8,'connected spanning structure');
  assert.equal(keyOwners.length,2);
  for(const owner of keyOwners)assert.ok(level.links.some(e=>e[0]==='m'&&e[1]===owner&&e[2]===pivot));
  assert.equal(level.hintGraph.stages.filter(s=>s.ringId===pivot&&keyOwners.includes(s.releaseId)).length,2);
  assert.deepEqual(Core.validate(state),[],'intro geometry '+n);
  assert.deepEqual(Core.settle(Core.clone(state)),[],'intro does not preclear '+n);
  const graph=new HintGraphRuntime(index,state);
  for(let k=0;k<solutions[index].length;k++){
   const a=graph.next(state);
   assert.ok(a,'missing switch hint '+n+'/'+k);
   assert.equal(a.id,solutions[index][k].id);
   const from=Core.ring(state,a.id).a;
   const res=Core.request(state,a.id,a.delta);
   assert.equal(res.blocked,null,'intro blocked '+n+'/'+k);
   assert.ok(Math.abs(res.done)>.001,'intro did not turn '+n+'/'+k);
   graph.observe(state,res.removed,{id:a.id,from,done:res.done});
  }
  assert.ok(state.rings.every(r=>r.life==='removed'),'intro fully cleared '+n);
 }
});

test('28 advanced levels include 35 real switch modules, not renamed center stars',()=>{
 const ids=Object.keys(VERIFIED_SWITCHES).map(Number);
 assert.equal(ids.length,28);
 assert.equal(ids.reduce((count,n)=>count+entries(VERIFIED_SWITCHES[n]).length,0),35);
 for(const n of ids){
  const index=n+9,level=Core.levels[index],s=Core.make(index);
  assert.equal(level.revision,4,'switch revision '+n);
  assert.equal(level.difficulty.archetype,'double-key-switch');
  const groups=entries(VERIFIED_SWITCHES[n]);
  assert.equal(level.difficulty.switches.length,groups.length);
  for(const [center,pivot,leafA,leafB] of groups){
   assert.deepEqual(level.difficulty.switches.find(x=>x.center===center&&x.pivot===pivot)?.leaves,[leafA,leafB]);
   for(const leaf of [leafA,leafB]){
    assert.ok(level.links.some(e=>e[0]==='m'&&e[1]===leaf&&e[2]===pivot),'true owner direction '+n+'/'+leaf);
    assert.ok(s.rods.some(z=>z.kind==='m'&&z.owner===leaf&&z.targets[0]===pivot));
    const stage=level.hintGraph.stages.find(st=>st.ringId===pivot&&st.releaseId===leaf);
    assert.ok(stage,'explicit receiver rotation to key '+n+'/'+leaf);
    assert.equal(level.links[Number(stage.claspId.slice(1))-1][1],leaf);
   }
  }
  assert.equal(level.hintGraph.stages.length,solutions[index].length);
  assert.deepEqual(Core.validate(s),[],'switch initial geometry '+n);
  assert.deepEqual(Core.settle(Core.clone(s)),[],'switch no initial free ring '+n);
 }
});

test('no five consecutive advanced levels fall back to hold-only mechanics',()=>{
 const flavor=n=>{
  if(VERIFIED_SWITCHES[n])return 'switch';
  if(VERIFIED_RELAYS[n])return 'relay';
  if(n===45)return 'legacy';
  return 'hold';
 };
 for(let n=11;n<=96;n++){
  const five=Array.from({length:5},(_,i)=>flavor(n+i));
  assert.ok(five.some(k=>k!=='hold'),'five repetitive hub-only levels: '+n+'—'+(n+4));
 }
});

test('early formal #1 remains simple and legacy #45 remains unchanged',()=>{
 assert.equal(Core.make(10).rods.length,9);
 assert.equal(Core.levels[10].revision,2);
 assert.equal(Core.make(54).rods.length,62);
 assert.equal(Core.levels[54].difficulty?.archetype,undefined);
});
