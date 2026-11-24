import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../src/core.js';
import {makeLinkGroups,prepareSpecial,processSpecialRemoval} from '../src/advanced-mechanics.js';
const h=92.0001;
const rings=()=>['A','B','C','D'].map((id,i)=>({id,x:i*h,y:0,a:90,life:'active'}));
test('连心组不再锁住旋转，消除任意成员双向触发整组且不重复',()=>{
 const s={rings:rings(),rods:[],events:[]};
 prepareSpecial(s,{special:{linked:true,rings:[{id:'B',attribute:'silk',silkLayers:2}],silkEdges:[{sourceId:'A',targetId:'B'},{sourceId:'C',targetId:'B'}]}});
 assert.ok(s.rings.every(r=>r.silkRemaining===0));
 s.rings[2].life='removed';
 assert.deepEqual(new Set(processSpecialRemoval(s,['C'])),new Set(['A','B']));
 assert.equal(s.rings[3].life,'active');
 assert.deepEqual(processSpecialRemoval(s,['C']),[]);
 assert.equal(s.events.filter(e=>e.kind==='link-chain').length,1);
});
test('远处关系不会生成连线，共享来源不扩大成全盘一组',()=>{
 const rs=rings();rs.push({id:'F',x:1000,y:1000,life:'active'});
 const gs=makeLinkGroups(rs,[{sourceId:'A',targetId:'B'},{sourceId:'C',targetId:'B'},{sourceId:'F',targetId:'B'},{sourceId:'C',targetId:'D'}]);
 assert.deepEqual(gs,[['B','A','C']]);
 assert.equal(new Set(gs.flat()).size,gs.flat().length);
});
test('连心消除保留外部背景扣，最后连接镯移除才退出',()=>{
 const index=C.levels.push({name:'linked test',points:[['A',0,0,90],['B',h,0,90],['C',2*h,0,90]],links:[['b','A','B'],['b','B','C']],special:{linked:true,rings:[{id:'B',attribute:'silk',silkLayers:1}],silkEdges:[{sourceId:'A',targetId:'B'}]}})-1;
 try{const s=C.make(index);assert.notEqual(C.request(s,'B',5).blocked?.kind,'silk');s.rings[0].life='removed';C.processSpecialRemoval(s,['A']);C.update(s);assert.equal(C.exists(s,s.rods[0]),false);assert.equal(C.exists(s,s.rods[1]),true);s.rings[2].life='removed';C.update(s);assert.equal(C.exists(s,s.rods[1]),false);}finally{C.levels.pop();}
});
