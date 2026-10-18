import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';
import solutions from '../dist/js/solutions.js';
import {HintGraphRuntime} from '../dist/js/hint-graph.js';
import {GameModel} from '../dist/js/model.js';
import {Save} from '../dist/js/storage.js';

test('第1关恢复十镯九扣的简单入门，每次对齐都能消除并完整通关',()=>{
 const s=C.make(10),graph=new HintGraphRuntime(10,s);
 assert.equal(s.rings.length,10);assert.equal(s.rods.length,9);assert.ok(s.rods.every(z=>z.kind==='m'));
 assert.equal(C.levels[10].revision,2);assert.equal(graph.graph.kind,'dependency');assert.equal(solutions[10].length,9);
 for(let step=0;step<9;step++){
  const a=graph.next(s);assert.ok(a);const from=C.ring(s,a.id).a,res=C.request(s,a.id,a.delta);
  assert.equal(res.blocked,null);assert.ok(res.removed.length>0);graph.observe(s,res.removed,{id:a.id,from,done:res.done});
 }
 assert.ok(s.rings.every(r=>r.life==='removed'));assert.equal(graph.next(s),null);
});

test('后续混合机关有真实多扣和保持约束，固定扣不将单缺口镯永久锁死',()=>{
 for(let index=11;index<110;index++){
  if(index===54)continue;
  const l=C.levels[index],s=C.make(index),background=s.rods.filter(z=>z.kind==='b');
  assert.equal(l.revision,index>=20?2:1);assert.equal(l.hintGraph.kind,'stages');
  assert.ok(background.length>=2,'background pairs '+index);
  const fixed=new Map(s.rings.map(r=>[r.id,0]));
  for(const z of background)for(const id of z.targets)fixed.set(id,fixed.get(id)+1);
  assert.ok([...fixed.values()].every(n=>n<=1),'two permanent fixed cuffs would deadlock a single gap');
  const hard=s.rings.filter(r=>s.rods.filter(z=>z.owner===r.id&&fixed.get(z.targets[0])===1).length>=2);
  assert.ok(hard.length>=2,'at least two genuine hold groups '+index);
  assert.ok(s.rings.some(r=>s.rods.filter(z=>z.kind==='m'&&z.targets.includes(r.id)).length>=2),'shared receivers '+index);
 }
});

test('第2—10关穷举仅产生消除的合法目标操作，不能一路贪心清空',()=>{
 for(let index=11;index<20;index++){
  const visited=new Set();
  function greedy(s){
   if(s.rings.every(r=>r.life==='removed'))return true;
   const key=s.rings.map(r=>r.life==='removed'?'x':Math.round(r.a*1000)).join(',');
   if(visited.has(key))return false;visited.add(key);
   assert.ok(visited.size<2000,'exhaustive removal-only search must finish');
   for(const a of C.candidates(s)){
    const copy=C.clone(s),res=C.request(copy,a.id,a.delta);
    if(res.blocked||!res.removed.length)continue;
    copy.events=[];
    if(greedy(copy))return true;
   }
   return false;
  }
  assert.equal(greedy(C.make(index)),false,'level '+(index-9)+' requires a non-removing setup');
 }
});

test('第2—10关完整图提示可通关；保持被转离后修复，已消失的中心不再要求旧角度',()=>{
 for(let index=11;index<20;index++){
  const s=C.make(index),graph=new HintGraphRuntime(index,s);let moves=0,setups=0,reversed=false;
  while(!s.rings.every(r=>r.life==='removed')){
   const before=JSON.stringify(s),a=graph.next(s);assert.equal(JSON.stringify(s),before,'query is read only');assert.ok(a,index+'/'+moves);
   const from=C.ring(s,a.id).a,res=C.request(s,a.id,a.delta);assert.equal(res.blocked,null);assert.ok(Math.abs(res.done)>.001);
   graph.observe(s,res.removed,{id:a.id,from,done:res.done});moves++;
   if(!res.removed.length){
    setups++;
    if(!reversed){
     const progress=graph.progress,ring=C.ring(s,a.id),start=ring.a,undo=C.request(s,a.id,7);
     graph.observe(s,undo.removed,{id:a.id,from:start,done:undo.done});
     assert.ok(graph.progress<progress,'live hold reversal rewinds checkpoint');
     const repair=graph.next(s);assert.equal(repair.id,a.id);
     const restored=new HintGraphRuntime(index,s,progress);assert.equal(restored.next(s).id,a.id);
     reversed=true;
    }
   }
   assert.ok(moves<solutions[index].length+12,'no stale holding loop '+index);
  }
  assert.ok(setups>=3);assert.ok(reversed);
 }
});

test('偏离、部分拖动及消除任意镯后，阶段提示仍能合法收尾',()=>{
 for(const index of [11,14,19])for(const tool of ['center','receiver']){
  const m=new GameModel(index),stages=C.levels[index].hintGraph.stages;
  // Move several receivers off the recommended sequence before erasing a ring.
  for(const stage of stages.slice(0,6))m.turn(stage.ringId,13);
  const id=tool==='center'?stages[0].releaseId:stages[0].ringId;
  m.removeWithTool(id);m.resetHint(10000);
  for(let n=0;!m.cleared;n++){
   assert.ok(n<stages.length+10,'no stuck checkpoint '+index+'/'+tool);
   const a=m.hints.next(m.state);assert.ok(a);
   const res=m.turn(a.id,a.delta);assert.equal(res.blocked,null);assert.ok(Math.abs(res.done)>.001);
   // Reload during partially completed holds, including after the erase tool.
   if(n===3)m.resetHint(m.hints.progress);
  }
 }
});

test('关卡重构拒绝旧局内盘面，保留通关成绩并恢复新版道具与阶段进度',()=>{
 const memory=new Map(),key='jade-bracelet-laya-v1';
 globalThis.Laya={LocalStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
 memory.set(key,JSON.stringify({version:2,records:{10:{steps:9,stars:3},21:{steps:20,stars:2}},unlocked:5,sound:false,tutorial:2}));
 const save=new Save(),s=C.make(10);
 memory.set(key+'-run-10',JSON.stringify({version:1,levelRevision:1,state:s,hint:0,erase:0,hintProgress:8}));
 assert.equal(save.readRun(10),null,'old level definition cannot use new stage indices');
 assert.equal(save.data.records[10].stars,3);assert.equal(save.data.records[21].stars,2);assert.equal(save.data.sound,false);
 save.writeRun(10,s,0,1,2);const restored=save.readRun(10);
 assert.ok(restored);assert.equal(restored.hint,0);assert.equal(restored.erase,1);assert.equal(restored.hintProgress,2);
 const old=C.make(54);memory.set(key+'-run-54',JSON.stringify({version:1,state:old,hint:0,erase:1,hintProgress:0}));
 assert.ok(save.readRun(54),'unchanged legacy level stays resumable');
});
