import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';
import solutions from '../dist/js/solutions.js';
import {FORMAL_INDEX,FORMAL_COUNT,LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';
import {HintGraphRuntime} from '../dist/js/hint-graph.js';

test('100个正式关卡均预生成依赖元数据，节点及锁扣匹配',()=>{
 for(let i=FORMAL_INDEX;i<FORMAL_INDEX+FORMAL_COUNT;i++){
  const level=C.levels[i],graph=level.hintGraph;
  assert.ok(graph,'missing graph '+i);
  if(i===LEGACY_FORMAL_INDEX){
   assert.equal(graph.kind,'stages');
   assert.equal(graph.stages.length,solutions[i].length);
   for(let j=0;j<graph.stages.length;j++)assert.equal(graph.stages[j].ringId,solutions[i][j].id);
  }else{
   assert.equal(graph.kind,'dependency');
   assert.equal(graph.nodes.length,level.points.length);
   assert.equal(graph.order.length,level.points.length-1);
   for(const n of graph.nodes)if(n.claspId){
    assert.equal(level.links[Number(n.claspId.slice(1))-1][2],n.id);
   }
  }
 }
});
test('第1、13、44、46、100关前五步的图提示可以连续合法执行',()=>{
 for(const index of [10,22,53,55,109]){
  const s=C.make(index),graph=new HintGraphRuntime(index,s);
  for(let step=0;step<5;step++){
   const a=graph.next(s);
   assert.ok(a,index+'/'+step);
   assert.equal(a.id,solutions[index][step].id);
   const from=C.ring(s,a.id).a,res=C.request(s,a.id,a.delta);
   assert.equal(res.blocked,null,index+'/'+step);
   assert.ok(Math.abs(res.done)>.001);
   graph.observe(s,res.removed,{id:a.id,from,done:res.done});
  }
 }
});
test('第45关阶段图以目标角度推动进度且可恢复，不存固定旋转方向',()=>{
 const index=LEGACY_FORMAL_INDEX,s=C.make(index),graph=new HintGraphRuntime(index,s),first=graph.next(s);
 assert.equal(first.id,solutions[index][0].id);
 assert.ok(Math.abs(first.delta-solutions[index][0].delta)<.01);
 const from=C.ring(s,first.id).a,res=C.request(s,first.id,first.delta);
 assert.equal(res.blocked,null);
 graph.observe(s,res.removed,{id:first.id,from,done:res.done});
 assert.ok(graph.progress>=1);
 assert.equal(new HintGraphRuntime(index,s,graph.progress).next(s)?.id,solutions[index][1].id);
 assert.ok(!('delta' in C.levels[index].hintGraph.stages[0]));
});
